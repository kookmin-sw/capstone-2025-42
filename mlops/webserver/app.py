from flask import (
    Flask,
    request,
    jsonify,
    send_file,
    render_template,
    after_this_request,
    send_from_directory,
    make_response,
)
from minio import Minio
from werkzeug.security import generate_password_hash, check_password_hash
import psycopg2
import pandas as pd
from psycopg2.extras import RealDictCursor
import jwt
from uuid import uuid4
import json
import os
import time
from datetime import datetime, timedelta
from urllib.parse import unquote
from mecab import MeCab
from flask_cors import CORS
from functools import wraps
from sqlalchemy import create_engine, text
from collections import Counter, defaultdict
from pathlib import Path
import mimetypes


app = Flask(__name__, static_folder="dist", static_url_path="")
CORS(app, origins="http://localhost:5173", supports_credentials=True)


def load_secret(name, default=""):
    path = f"/run/secrets/{name}"
    if os.path.exists(path):
        with open(path) as f:
            return f.read().strip()
    return os.getenv(name.upper(), default)


MINIO_USER = load_secret("minio_root_user")
MINIO_PASSWORD = load_secret("minio_root_password")
JWT_SECRET_KEY = load_secret("jwt_secret_key")
MINIO_URL = os.getenv("MINIO_URL", "minio:9000")
BUCKET_NAME = os.getenv("BUCKET_NAME", "data-bucket")
minio_client = Minio(
    MINIO_URL, access_key=MINIO_USER, secret_key=MINIO_PASSWORD, secure=False
)

POSTGRESQL_HOST = load_secret("postgresql_host")
POSTGRESQL_DATABASE = load_secret("postgresql_database")
POSTGRESQL_USER = load_secret("postgresql_user")
POSTGRESQL_PASSWORD = load_secret("postgresql_password")
SLEEP_SECONDS = 2
for i in range(60):
    try:
        conn = psycopg2.connect(
            host=POSTGRESQL_HOST,
            database=POSTGRESQL_DATABASE,
            user=POSTGRESQL_USER,
            password=POSTGRESQL_PASSWORD,
        )
        print("PostgreSQL 연결 성공")
        break
    except psycopg2.OperationalError as e:
        print(f"DB 연결 재시도 중...")
        time.sleep(SLEEP_SECONDS)
else:
    raise Exception("PostgreSQL 연결 실패: DB가 안 떠 있음")

DB_URI = f"postgresql+psycopg2://{POSTGRESQL_USER}:{POSTGRESQL_PASSWORD}@postgres:5432/airflow"
engine = create_engine(DB_URI)


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get("token")

        if not token:
            return jsonify({"message": "토큰이 없습니다"}), 401

        try:
            data = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
            user_id = data["user_id"]
            username = data["username"]
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "토큰이 만료되었습니다"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "유효하지 않은 토큰입니다"}), 401

        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM users WHERE user_id = %s", (user_id,))
            if cur.fetchone() is None:
                return jsonify({"message": "유효하지 않은 토큰입니다"}), 401

        return f(user_id, username, *args, **kwargs)

    return decorated


@app.route("/region_file_count_auth", methods=["GET"])
@token_required
def get_region_file_count_auth(user_id, username):
    cur = conn.cursor()

    cur.execute(
        """
        SELECT v.village_id, v.region, v.district
        FROM   users          AS u
        JOIN   village        AS v ON v.village_id = u.current_village_id
        WHERE  u.user_id = %s;
        """,
        (user_id,),
    )
    row = cur.fetchone()
    if not row:
        return jsonify({"status": "error", "message": "마을 정보가 없습니다."}), 404

    village_id, region, district = row

    cur.execute(
        "SELECT COUNT(*) FROM uploaded_file WHERE village_id = %s;",
        (village_id,),
    )
    total_cnt = cur.fetchone()[0]

    cur.execute(
        """
        SELECT file_type, COUNT(*) 
        FROM   uploaded_file
        WHERE  village_id = %s
        GROUP  BY file_type;
        """,
        (village_id,),
    )
    type_counts = {ftype: cnt for ftype, cnt in cur.fetchall()}

    return (
        jsonify(
            {
                "status": "success",
                "village_id": village_id,
                "region": region,
                "district": district,
                "total": total_cnt,
                "type_counts": type_counts,
            }
        ),
        200,
    )


@app.route("/region_file_count", methods=["GET"])
def get_region_file_count():
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM uploaded_file;")
    total_cnt = cur.fetchone()[0]

    cur.execute(
        """
        SELECT file_type, COUNT(*)
        FROM   uploaded_file
        GROUP  BY file_type;
        """
    )
    type_counts = {ftype: cnt for ftype, cnt in cur.fetchall()}

    return (
        jsonify(
            {
                "status": "success",
                "village_id": None,
                "region": "시도(전체)",
                "district": "시군구(전체)",
                "total": total_cnt,
                "type_counts": type_counts,
            }
        ),
        200,
    )


@app.route("/api/archive_metrics", methods=["GET"])
def archive_metrics():
    """
    {
      "status": "success",
      "total": 1200,
      "completed": 1050,
      "in_progress": 150,
      "completion_rate": 87.5        # (%) 소수 첫째자리
    }
    """
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        """
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'completed') AS completed,
          COUNT(*) FILTER (WHERE status = 'progress') AS in_progress
        FROM uploaded_file;
        """
    )
    row = cur.fetchone()
    total = row["total"] or 0
    completed = row["completed"] or 0
    rate = round(completed / total * 100, 1) if total else 0.0
    row["completion_rate"] = rate
    return jsonify({"status": "success", **row}), 200


@app.route("/region_uploads", methods=["GET"])
def region_uploads():
    """
    각 시/도-시/군/구 단위 업로드 개수
    반환 예)
    [
      {"region": "경기도", "district": "수원시", "count": 42},
      {"region": "경기도", "district": "고양시", "count": 37},
      ...
    ]
    """
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        """
        SELECT v.region,
               v.district,
               COUNT(*) AS count
        FROM   uploaded_file AS f
        JOIN   village       AS v
          ON   v.village_id  = f.village_id
        GROUP  BY v.region, v.district
        ORDER  BY v.region, count DESC;
        """
    )
    return jsonify({"status": "success", "data": cur.fetchall()}), 200


@app.route("/top_keywords", methods=["GET"])
def top_keywords():
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        """
        SELECT t.tag_name AS tag,
               COUNT(*)   AS count
        FROM   file_tags  AS ft
        JOIN   tags       AS t  ON t.tag_id  = ft.tag_id
        GROUP  BY t.tag_name
        ORDER  BY count DESC
        LIMIT  20;
        """
    )
    rows = cur.fetchall()
    return jsonify({"status": "success", "data": rows}), 200


@app.route("/village_uploads", methods=["GET"])
def village_uploads():
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        """
        SELECT v.region, v.district, COUNT(*) AS count
        FROM   uploaded_file AS f
        JOIN   village       AS v ON v.village_id = f.village_id
        GROUP  BY v.region, v.district;
        """
    )
    rows = cur.fetchall()
    return jsonify({"status": "success", "data": rows}), 200


@app.route("/api/random_story", methods=["GET"])
def random_story():
    """
    응답 예:
    {
      "status": "success",
      "title": "포천 마을회관의 옛 사진 기록",
      "description": "포천시 주민들이 기증한 자료로 구성된 영상 데이터"
    }
    """
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        """
        SELECT file_name, description
        FROM   uploaded_file
        WHERE  description IS NOT NULL AND description <> ''
        ORDER  BY RANDOM()
        LIMIT 1;
        """
    )
    row = cur.fetchone()
    if not row:
        return jsonify({"status": "empty"}), 200

    title = os.path.splitext(row["file_name"])[0]
    desc = row["description"].split("|")[-1].strip()

    return jsonify({"status": "success", "title": title, "description": desc}), 200


@app.route("/api/regions", methods=["GET"])
def get_regions():
    cur = conn.cursor()
    cur.execute("SELECT region, district FROM village ORDER BY region, district;")
    rows = cur.fetchall()

    data = {}
    for region, district in rows:
        data.setdefault(region, []).append(district)

    # 공통 ‘전체’ 옵션 추가
    data = {"시도(전체)": ["시군구(전체)"], **data}
    return jsonify(data), 200


@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json() or {}

    required = ("name", "email", "password")
    missing = [f for f in required if f not in data or not data[f]]
    if missing:
        return jsonify({"message": f"누락된 필드: {', '.join(missing)}"}), 400

    username = data["name"]
    email = data["email"]
    password = data["password"]
    password_hash = generate_password_hash(password)

    cur = conn.cursor()

    try:
        cur.execute(
            "INSERT INTO users (username, password_hash, email) VALUES (%s, %s, %s)",
            (username, password_hash, email),
        )
        conn.commit()
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        return jsonify({"message": "이미 존재하는 사용자입니다"}), 400
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"등록 실패: {str(e)}"}), 500
    finally:
        cur.close()

    return jsonify({"message": "회원가입 성공"})


@app.route("/api/delete_account", methods=["DELETE"])
@token_required
def delete_account(user_id, username):
    token = request.cookies.get("token")
    if not token:
        return jsonify({"message": "로그인 정보가 없습니다"}), 401

    try:
        data = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        user_id = data["user_id"]
    except jwt.ExpiredSignatureError:
        return jsonify({"message": "토큰이 만료되었습니다"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"message": "유효하지 않은 토큰입니다"}), 401

    # DB 연결 및 유저 삭제
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM users WHERE user_id = %s", (user_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"계정 삭제 실패: {str(e)}"}), 500
    finally:
        cur.close()

    # 쿠키 제거
    response = make_response(jsonify({"message": "계정 삭제 완료"}))
    response.set_cookie(
        "token",
        "",
        max_age=0,
        httponly=True,
        secure=False,  # 배포 시엔 반드시 True (HTTPS 환경)
        samesite="Lax",
    )
    return response


@app.route("/api/me")
@token_required
def me(user_id, username):
    return jsonify({"logged_in": True, "user_id": user_id, "username": username}), 200


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    # 1) 입력 검증
    required = ("email", "password", "region", "district")
    missing = [f for f in required if f not in data or not data[f]]
    if missing:
        return jsonify({"message": f"누락 필드: {', '.join(missing)}"}), 400

    email = data["email"]
    password = data["password"]
    region = data["region"]
    district = data["district"]

    # 2) 사용자 조회
    with conn.cursor() as cur:
        cur.execute(
            "SELECT user_id, password_hash, username FROM users WHERE email = %s",
            (email,),
        )
        row = cur.fetchone()
        username = row[2]

    if not row or not check_password_hash(row[1], password):
        return jsonify({"message": "아이디‧비밀번호 불일치"}), 401

    user_id = row[0]

    # 3) 지역(village) 지정/변경
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT village_id FROM village " "WHERE region = %s AND district = %s",
                (region, district),
            )
            village_row = cur.fetchone()

            if village_row:  # 유효한 지역만 업데이트
                cur.execute(
                    "UPDATE users SET current_village_id = %s WHERE user_id = %s",
                    (village_row[0], user_id),
                )
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"로그인 실패: {str(e)}"}), 500

    # 4) JWT 발급 & 쿠키 설정
    payload = {
        "user_id": user_id,
        "username": username,
        "exp": datetime.utcnow() + timedelta(hours=1),
    }
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm="HS256")

    resp = make_response(jsonify({"message": "로그인 성공"}))
    resp.set_cookie(
        "token", token, httponly=True, secure=False, samesite="Lax", max_age=3600
    )
    return resp


@app.route("/api/logout", methods=["POST"])
@token_required
def logout(user_id, username):
    response = make_response(jsonify({"message": "로그아웃 성공"}))

    response.set_cookie(
        "token",
        "",
        max_age=0,
        httponly=True,
        secure=False,  # 배포 시엔 반드시 True (HTTPS 환경)
        samesite="Lax",
    )
    return response


@app.route("/make_tags", methods=["POST"])
@token_required
def make_tags(user_id, username):
    description = request.form.get("description", "")
    tagger = MeCab()
    tags = tagger.nouns(description)
    unique_tags = sorted(set(tags))

    return jsonify({"status": "success", "tags": unique_tags})


def top5_nouns(text):
    tagger = MeCab()
    morphs = tagger.parse(text)
    nouns = [m.surface for m in morphs if m.feature.pos in ("NNG", "NNP")]
    return Counter(nouns).most_common(5)


@app.route("/upload", methods=["POST"])
@token_required
def upload(user_id, username):
    uploaded_files = request.files.getlist("file")

    # ---------- (1) 파일별 메타 JSON 파싱 ----------
    try:
        meta_list = json.loads(request.form.get("meta", "[]"))
    except json.JSONDecodeError:
        return jsonify({"status": "error", "message": "meta JSON 형식 오류"}), 400

    if len(meta_list) != len(uploaded_files):
        return jsonify({"status": "error", "message": "meta 길이 불일치"}), 400

    now = datetime.utcnow().isoformat()

    # ---------- (2) village 조회 ----------
    with conn.cursor() as cur:
        cur.execute(
            "SELECT current_village_id FROM users WHERE user_id = %s",
            (user_id,),
        )
        row = cur.fetchone()
        current_village_id = row and row[0]

    saved_files = []

    # ---------- (3) 파일별 처리 ----------
    for idx, file in enumerate(uploaded_files):
        if not file or not file.filename:
            continue

        # 3-1) 개별 메타 가져오기
        meta = meta_list[idx] if idx < len(meta_list) else {}
        description = meta.get("description", "")
        tags = meta.get("tags", "")
        category = meta.get("category", "")

        file_name = file.filename
        base_name, ext = os.path.splitext(file_name)
        uuid_val = str(uuid4())

        file_key = f"{base_name}_{uuid_val}{ext}"
        json_key = f"meta/{base_name}_{uuid_val}.json"

        file_path = f"/tmp/{file_key}"
        json_path = f"/tmp/{json_key}"

        # 3-2) 파일 저장
        file.save(file_path)

        json_data = {
            "description": description,
            "tags": tags,
            "category": category,
            "file_name": file_name,
            "uuid": uuid_val,
            "upload_time": now,
            "user_id": user_id,
            "current_village_id": current_village_id,
        }

        os.makedirs(os.path.dirname(json_path), exist_ok=True)
        with open(json_path, "w") as f:
            json.dump(json_data, f, ensure_ascii=False)

        # 3-3) MinIO 업로드
        minio_client.fput_object(BUCKET_NAME, file_key, file_path)
        minio_client.fput_object(BUCKET_NAME, json_key, json_path)

        os.remove(file_path)
        os.remove(json_path)

        saved_files.append(
            {
                "file_name": file_name,
                "title": base_name,
                "description": description,
                "uuid": uuid_val,
                "time": now,
            }
        )

    return jsonify({"status": "success", "files": saved_files})


@app.route("/get_categories", methods=["GET"])
def get_categories():
    query = """
    SELECT category AS name, COUNT(*) AS count
    FROM uploaded_file
    WHERE category IS NOT NULL
    GROUP BY category
    """
    with conn.cursor() as cur:
        cur.execute(query)
        rows = cur.fetchall()

    category_counter = {}

    for name, count in rows:
        category_counter[name] = category_counter.get(name, 0) + count

    result = [
        {"name": name, "count": count}
        for name, count in sorted(category_counter.items(), key=lambda x: -x[1])
    ]
    return jsonify(result)


@app.route("/search_by_category", methods=["GET"])
def search_by_category():
    category = request.args.get("category")
    if not category:
        return jsonify({"error": "category parameter is required"}), 400

    query = """
    SELECT
        uf.file_path,
        uf.uuid,
        uf.description,
        uf.file_id,
        v.region,
        v.district,
        uf.uploaded_at,
        uf.file_type,
        uf.specific_file_type,
        uf.file_name
    FROM uploaded_file uf
    LEFT JOIN village v ON uf.village_id = v.village_id
    WHERE uf.category = %s
    ORDER BY uf.uploaded_at DESC;
    """
    with conn.cursor() as cur:
        cur.execute(query, (category,))
        rows = cur.fetchall()

    result = [
        {
            "id":            row[3],
            "title":         row[9] or "",
            "summary":       (row[2] or "").split("|")[-1],
            "region":        row[4],
            "district":      row[5],
            "date":          row[6],
            "type":          row[7],          # text / image / video / numerical …
            "specific_type": row[8],          # docx / pptx / hwpx / jpg …
            "file_path":     row[0],
            "table_name":    row[0].rsplit('.', 1)[0].replace("-", "_").replace(" ", "_").lower() if row[7] == "numerical" else None,
        }
        for row in rows
    ]
    return jsonify(result)


@app.route("/search", methods=["GET"])
def search():
    keyword_string = request.args.get("word", "")
    order_string = request.args.get("order", "")
    date_string = request.args.get("date", "all")  # all / today / week
    exp_string = request.args.get("exp", "")  # text / video …

    keywords = keyword_string.split()
    conditions, params = [], []

    # 키워드 검색
    for kw in keywords:
        like = f"%{kw}%"
        conditions.append("(file_name ILIKE %s OR COALESCE(description,'') ILIKE %s)")
        params.extend([like, like])

    if date_string == "today":
        conditions.append("DATE(uploaded_at) = %s")
        params.append(datetime.utcnow().date())
    elif date_string == "week":
        week_ago = datetime.utcnow().date() - timedelta(days=7)
        conditions.append("DATE(uploaded_at) >= %s")
        params.append(week_ago)

    if exp_string and exp_string != "all":
        conditions.append("file_type = %s")
        params.append(exp_string)

    where_sql = f" WHERE {' AND '.join(conditions)}" if conditions else ""
    order_sql = (
        "ORDER BY uploaded_at DESC"
        if order_string == "recent"
        else "ORDER BY file_name ASC"
    )

    query = f"""
        SELECT uf.file_path,
               uf.uuid,
               uf.description,
               uf.file_id,
               v.region,
               v.district,
               uf.uploaded_at,
               uf.file_type,
               uf.specific_file_type,
               uf.category,
               uf.file_name
        FROM uploaded_file uf
        LEFT JOIN village v ON v.village_id = uf.village_id
           {where_sql}
           {order_sql};
    """

    results = defaultdict(list)

    with conn.cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()

        # 연관 검색어 추출
        all_desc = " ".join((row[2] or "") for row in rows)
        related_word = [w for w, _ in top5_nouns(all_desc)]

        for row in rows:
            cate = row[9]
            table_name = row[0].rsplit('.', 1)[0].replace("-", "_").replace(" ", "_").lower()
            results[cate].append({
                "id": row[3],
                "title": row[10] or "",
                "summary": (row[2] or "").split("|")[-1],
                "region": row[4] or "-",
                "district": row[5] or "-",
                "date": row[6].isoformat() if row[6] else "-",
                "type": row[7],  # 대분류
                "specific_type": row[8],  # 세부
                "file_path": row[0],
                "table_name": table_name if row[7] == "numerical" else None,
            })

    return jsonify({"results": results, "related_word": related_word})


@app.route("/preview_numerical", methods=["GET"])
def preview_numerical():
    table_name = request.args.get("table_name")
    if table_name.startswith("/virtual/numerical/"):
        table_name = Path(table_name).name

    if not table_name:
        return {"error": "Missing table_name"}, 400

    query = f'SELECT * FROM "{table_name}" LIMIT 5'
    try:
        df = pd.read_sql(query, engine)
    except Exception as e:
        return jsonify({"error": f"Query Failed: {str(e)}", "query": query}), 500

    return jsonify(
        {"columns": list(df.columns), "preview": df.to_dict(orient="records")}
    )


@app.route("/download_numerical_filtered", methods=["GET"])
def download_numerical_filtered():
    table_name = request.args.get("table_name")
    if table_name.startswith("/virtual/numerical/"):
        table_name = Path(table_name).name
    title = request.args.get("title")
    columns = request.args.get("columns")
    sort = request.args.get("sort")

    if not table_name:
        return {"error": "Missing table_name"}, 400

    col_clause = "*"
    if columns:
        col_list = [col.strip() for col in columns.split(",") if col.strip()]
        if col_list:
            col_clause = ", ".join([f'"{col}"' for col in col_list])

    order_clause = ""
    if sort:
        try:
            sort_items = []
            for s in sort.split(","):
                col, dir = s.split(":")
                col = col.strip()
                dir = dir.strip()
                if dir.lower() in ["asc", "desc"]:
                    sort_items.append(f'"{col}" {dir}')
            if sort_items:
                order_clause = " ORDER BY " + ", ".join(sort_items)
        except Exception:
            return {"error": "Invalid sort format"}, 400

    query = f'SELECT {col_clause} FROM "{table_name}"{order_clause}'
    try:
        df = pd.read_sql(query, engine)
    except Exception as e:
        return {"error": str(e)}, 500

    path = f"/tmp/{table_name}_filtered"
    df.to_csv(path, index=False, encoding="utf-8-sig")

    @after_this_request
    def cleanup(response):
        try:
            os.remove(path)
        except:
            pass
        return response

    return send_file(path, as_attachment=True, download_name=f"{title}.csv")


@app.route("/preview_url", methods=["GET"])
def preview_url():
    key = unquote(request.args.get("file_path", ""))
    if not key:
        return {"error": "file_path required"}, 400

    CT_MAP = {
        "pdf": "application/pdf",
        "doc": "application/msword",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "ppt": "application/vnd.ms-powerpoint",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "hwp": "application/x-hwp",
        "hwpx": "application/x-hwp",
    }

    NUMERICAL_CT = {
        ".xls": "application/vnd.ms-excel",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".csv": "text/csv",
    }

    with conn.cursor() as cur:
        cur.execute(
            "SELECT file_type, specific_file_type "
            "FROM uploaded_file WHERE file_path = %s",
            (key,),
        )
        row = cur.fetchone()
    if not row:
        return {"error": "File not found"}, 404

    file_type, spec = row
    ext = Path(key).suffix.lower()

    if spec and spec != "numerical":
        content_type = CT_MAP.get(spec, "application/octet-stream")
    elif spec == "numerical":  # ← numerical 판별
        content_type = NUMERICAL_CT.get(ext) or "application/octet-stream"
    else:
        content_type = mimetypes.guess_type(key)[0] or "application/octet-stream"

    presigned = minio_client.presigned_get_object(
        BUCKET_NAME,
        key,
        expires=timedelta(minutes=10),
        response_headers={
            "response-content-type": content_type,
            "response-content-disposition": "inline",
        },
    )

    return jsonify({"url": presigned, "file_type": file_type})


@app.route("/preview_url", methods=["GET"])
def preview_url():
    key = unquote(request.args.get("file_path", ""))
    if not key:
        return {"error": "file_path required"}, 400

    CT_MAP = {
        "pdf": "application/pdf",
        "doc": "application/msword",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "ppt": "application/vnd.ms-powerpoint",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "hwp": "application/x-hwp",
        "hwpx": "application/x-hwp",
    }

    NUMERICAL_CT = {
        ".xls": "application/vnd.ms-excel",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".csv": "text/csv",
    }

    with conn.cursor() as cur:
        cur.execute(
            "SELECT file_type, specific_file_type "
            "FROM uploaded_file WHERE file_path = %s",
            (key,),
        )
        row = cur.fetchone()
    if not row:
        return {"error": "File not found"}, 404

    file_type, spec = row
    ext = Path(key).suffix.lower()

    if spec and spec != "numerical":
        content_type = CT_MAP.get(spec, "application/octet-stream")
    elif spec == "numerical":  # ← numerical 판별
        content_type = NUMERICAL_CT.get(ext) or "application/octet-stream"
    else:
        content_type = mimetypes.guess_type(key)[0] or "application/octet-stream"

    presigned = minio_client.presigned_get_object(
        BUCKET_NAME,
        key,
        expires=timedelta(minutes=10),
        response_headers={
            "response-content-type": content_type,
            "response-content-disposition": "inline",
        },
    )
    return jsonify({"url": presigned, "file_type": file_type})


@app.route("/download", methods=["GET"])
@token_required
def download(user_id, username):
    file_path = request.args.get("file_path")
    title = request.args.get("title")

    if not file_path:
        return {"error": "file_path query param required"}, 400

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT file_path, file_type, file_name 
            FROM uploaded_file 
            WHERE file_path = %s
            """,
            (unquote(file_path),),
        )
        row = cur.fetchone()
        if not row:
            return {"error": "File not found"}, 404
        file_path, file_type, file_name = row

    if file_type == "numerical":
        return jsonify({"popup_required": True}), 200

    local_path = f"/tmp/{os.path.basename(file_path)}"
    minio_client.fget_object(BUCKET_NAME, file_path, local_path)

    @after_this_request
    def remove_temp_file(response):
        try:
            os.remove(local_path)
        except:
            pass
        return response

    return send_file(
        local_path,
        as_attachment=True,
        download_name=title or os.path.basename(file_name),
    )


@app.route("/preview_merge_table", methods=["GET"])
def preview_merge_table():
    table_name = request.args.get("table_name")
    if not table_name:
        return {"error": "Missing table_name"}, 400

    query = f"SELECT * FROM {table_name} LIMIT 5"
    try:
        df = pd.read_sql(query, engine)
        return jsonify(
            {"columns": list(df.columns), "preview": df.to_dict(orient="records")}
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/download_merge", methods=["GET"])
def download_merge():
    table1 = request.args.get("base")
    table2 = request.args.get("target")
    how = request.args.get("join_type", "join")  # join, concat_h, concat_v
    on = request.args.get("join_key")

    base_cols = request.args.get("base_cols", "").split(",")
    target_cols = request.args.get("target_cols", "").split(",")

    if not table1 or not table2:
        return {"error": "base와 target 테이블명이 필요합니다."}, 400

    try:
        df1 = pd.read_sql(f"SELECT * FROM {table1}", engine)[base_cols]
        df2 = pd.read_sql(f"SELECT * FROM {table2}", engine)[target_cols]
    except Exception as e:
        return {"error": f"테이블 로드 실패: {e}"}, 500

    try:
        if how == "concat_v":
            df_merged = pd.concat([df1, df2], axis=0)
        elif how == "concat_h":
            df_merged = pd.concat(
                [df1.reset_index(drop=True), df2.reset_index(drop=True)], axis=1
            )
        else:
            if not on:
                return {"error": "조인 기준 컬럼이 필요합니다."}, 400
            df_merged = pd.merge(df1, df2, on=on, how="inner")
    except Exception as e:
        return {"error": f"병합 실패: {e}"}, 500

    # 파일 저장 및 응답
    filename = f"{table1}_{table2}_merged.csv"
    csv_path = os.path.join("/tmp", filename)
    df_merged.to_csv(csv_path, index=False)

    @after_this_request
    def cleanup(response):
        try:
            os.remove(csv_path)
        except:
            pass
        return response

    return send_file(csv_path, as_attachment=True, download_name=filename)


if __name__ == "__main__":
    app.run(debug=True)
