from flask import (
    Flask,
    request,
    jsonify,
    send_file,
    render_template,
    after_this_request,
    make_response,
)
from minio import Minio
from werkzeug.security import generate_password_hash, check_password_hash
import psycopg2
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
from collections import Counter


app = Flask(__name__)
CORS(app)


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


@app.route("/", methods=["GET"])
def index():
    token = request.cookies.get("token")
    if not token:
        return render_template("login.html")
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        return render_template("index.html", username=payload["username"])
    except jwt.ExpiredSignatureError:
        return render_template("login.html", message="세션이 만료되었습니다.")
    except jwt.InvalidTokenError:
        return render_template("login.html", message="잘못된 토큰입니다.")


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

        return f(user_id, username, *args, **kwargs)

    return decorated


@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()
    username = data["username"]
    password = data["password"]
    password_hash = generate_password_hash(password)

    cur = conn.cursor()

    try:
        cur.execute(
            "INSERT INTO users (username, password_hash) VALUES (%s, %s)",
            (username, password_hash),
        )
        conn.commit()
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        return jsonify({"message": "이미 존재하는 사용자입니다"}), 400
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
    cur = conn.cursor()
    cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
    conn.commit()
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


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data["username"]
    password = data["password"]

    cur = conn.cursor()
    cur.execute("SELECT id, password_hash FROM users WHERE username = %s", (username,))
    row = cur.fetchone()
    cur.close()

    if row and check_password_hash(row[1], password):
        user_id = row[0]
        payload = {
            "user_id": user_id,
            "username": username,
            "exp": datetime.utcnow() + timedelta(hours=1),
        }
        token = jwt.encode(payload, JWT_SECRET_KEY, algorithm="HS256")
        response = make_response(jsonify({"message": "로그인 성공"}))
        response.set_cookie(
            "token", token, httponly=True, secure=False, samesite="Lax", max_age=3600
        )
        return response

    return jsonify({"message": "로그인 실패"}), 401


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
    description = request.form.get("description", "")
    tags = request.form.get("tags", "")
    title = request.form.get("title", "(제목 없음)")

    saved_files = []

    for file in uploaded_files:
        if file.filename:
            file_name = file.filename
            ext = os.path.splitext(file_name)[1]
            base_name = os.path.splitext(file_name)[0]
            unique_id = str(uuid4())

            file_key = f"{base_name}_{unique_id}{ext}"
            json_key = f"meta/{base_name}_{unique_id}.json"

            file_path = f"/tmp/{file_key}"
            json_path = f"/tmp/{json_key}"
            file.save(file_path)

            json_data = {
                "description": description,
                "tags": tags,
                "file_name": file_name,
                "uuid": unique_id,
                "upload_time": datetime.now().isoformat(),
                "user_id": user_id,
            }

            os.makedirs(os.path.dirname(json_path), exist_ok=True)
            with open(json_path, "w") as f:
                json.dump(json_data, f)

            minio_client.fput_object(BUCKET_NAME, file_key, file_path)
            minio_client.fput_object(BUCKET_NAME, json_key, json_path)

            os.remove(file_path)
            os.remove(json_path)

            saved_files.append(
                {
                    "file_name": file_name,
                    "title": title,
                    "description": description,
                    "uuid": unique_id,
                    "time": datetime.now().isoformat(),
                }
            )

    return jsonify({"status": "success", "files": saved_files})


@app.route("/search", methods=["GET"])
@token_required
def search(user_id, username):
    keyword_string = request.args.get("word", "")
    order_string = request.args.get("order", "")
    date_string = request.args.get("date", "all")  # all, today, week
    exp_string = request.args.get("exp", "")  # text, video, ...

    keywords = keyword_string.split()
    result = None

    # 정렬 기준
    if order_string == "name":
        order_by = "ORDER BY file_name ASC"
    elif order_string == "recent":
        order_by = "ORDER BY uploaded_at DESC"
    else:
        order_by = "ORDER BY file_name ASC"

    # 조건 모음
    conditions = []
    params = []

    # 키워드 검색
    for kw in keywords:
        pattern = f"%{kw}%"
        conditions.append("(file_name ILIKE %s OR COALESCE(description, '') ILIKE %s)")
        params.extend([pattern, pattern])

    # 날짜 필터링
    if date_string == "today":
        today = datetime.utcnow().date()
        conditions.append("DATE(uploaded_at) = %s")
        params.append(today)
    elif date_string == "week":
        week_ago = datetime.utcnow().date() - timedelta(days=7)
        conditions.append("DATE(uploaded_at) >= %s")
        params.append(week_ago)

    # 확장자/파일타입 필터링
    if exp_string and exp_string != "all":
        conditions.append("file_type = %s")
        params.append(exp_string)

    # WHERE 절 조립
    where_clause = ""
    if conditions:
        where_clause = " WHERE " + " AND ".join(conditions)

    # 최종 쿼리 조립
    query = f"""
        SELECT file_path, uuid, description
        FROM uploaded_file
        {where_clause}
        {order_by}
    """

    related_word = []
    with conn.cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()
        all_description_text = ""
        for row in rows:
            if row[2] is not None:
                all_description_text += row[2]
                all_description_text += " "
        related_word_set_list = top5_nouns(all_description_text)
        related_word = [word for word, _ in related_word_set_list]
        results = [
            {"file_name": row[0].replace(f"_{row[1]}", ""), "real_path": row[0]}
            for row in rows
        ]

    return jsonify({"results": results, "related_word": related_word})


@app.route("/download", methods=["GET"])
@token_required
def download(user_id, username):
    file_name = request.args.get("file_name")
    origin_name = request.args.get("origin_name")

    if not file_name:
        return {"error": "file_name query param required"}, 400

    with conn.cursor() as cur:
        cur.execute(
            "SELECT file_path FROM uploaded_file WHERE file_path = %s",
            (unquote(file_name),),
        )
        row = cur.fetchone()
        if not row:
            return {"error": "File not found"}, 404
        file_path = row[0]

    local_path = f"/tmp/{os.path.basename(file_path)}"
    minio_client.fget_object(BUCKET_NAME, file_path, local_path)

    @after_this_request
    def remove_file(response):
        try:
            os.remove(local_path)
            print(f"Deleted file: {local_path}", flush=True)
        except Exception as e:
            print(f"Error deleting file: {e}", flush=True)
        return response

    return send_file(local_path, as_attachment=True, download_name=origin_name)


if __name__ == "__main__":
    app.run(debug=True)
