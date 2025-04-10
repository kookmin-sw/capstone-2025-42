from flask import (
    Flask,
    request,
    jsonify,
    send_file,
    render_template,
    after_this_request,
)
from minio import Minio
import psycopg2
from uuid import uuid4
import json
import os
import time
from datetime import datetime
from urllib.parse import unquote


app = Flask(__name__)


def load_secret(name, default=""):
    path = f"/run/secrets/{name}"
    if os.path.exists(path):
        with open(path) as f:
            return f.read().strip()
    return os.getenv(name.upper(), default)


MINIO_USER = load_secret("minio_root_user")
MINIO_PASSWORD = load_secret("minio_root_password")
MINIO_URL = os.getenv("MINIO_URL", "minio:9000")
BUCKET_NAME = os.getenv("BUCKET_NAME", "data-bucket")
minio_client = Minio(
    MINIO_URL, access_key=MINIO_USER, secret_key=MINIO_PASSWORD, secure=False
)

POSTGRESQL_USER = load_secret("postgresql_user")
POSTGRESQL_PASSWORD = load_secret("postgresql_password")
SLEEP_SECONDS = 2
for i in range(60):
    try:
        conn = psycopg2.connect(
            host="postgres",
            database="airflow",
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
    return render_template("index.html")


@app.route("/upload", methods=["POST"])
def upload():
    uploaded_files = request.files.getlist("file")
    description = request.form.get("description", "")
    title = request.form.get("title", "(제목 없음)")

    saved_files = []

    for file in uploaded_files:
        if file.filename:
            filename = file.filename
            ext = os.path.splitext(filename)[1]
            base_name = os.path.splitext(filename)[0]
            unique_id = str(uuid4())

            file_key = f"{base_name}_{unique_id}{ext}"
            json_key = f"meta/{base_name}_{unique_id}.json"

            file_path = f"/tmp/{file_key}"
            json_path = f"/tmp/{json_key}"
            file.save(file_path)

            json_data = {
                "description": description,
                "filename": filename,
                "uuid": unique_id,
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
                    "filename": filename,
                    "title": title,
                    "description": description,
                    "uuid": unique_id,
                    "time": datetime.now().isoformat(),
                }
            )

    return jsonify({"status": "success", "files": saved_files})


@app.route("/search", methods=["GET"])
def search():
    keyword_string = request.args.get("word", "")
    keywords = keyword_string.split()
    result = None
    like_clauses_data = []
    like_clauses_meta = []

    for word in keywords:
        like_clauses_data.append("filename ILIKE %s")
        like_clauses_data.append("result ILIKE %s")
        like_clauses_meta.append("filename ILIKE %s")
        like_clauses_meta.append("description ILIKE %s")

    where_data = " OR ".join(like_clauses_data)
    where_meta = " OR ".join(like_clauses_meta)

    where_data_clause = f"WHERE {where_data}" if where_data else ""
    where_meta_clause = f"WHERE {where_meta}" if where_meta else ""

    query = f"""
    WITH unioned AS (
        SELECT filename, NULL AS uuid FROM file_data
        {where_data_clause}
        UNION ALL
        SELECT filename, uuid FROM file_meta_data
        {where_meta_clause}
    )
    SELECT filename, MIN(uuid) AS uuid
    FROM unioned
    GROUP BY filename;
    """
    params = []
    for kw in keywords:
        params += [f"%{kw}%", f"%{kw}%"]
    for kw in keywords:
        params += [f"%{kw}%", f"%{kw}%"]
    with conn.cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()
        results = [
            {"filename": row[0].replace(f"_{row[1]}", ""), "realpath": row[0]}
            for row in rows
        ]

    return jsonify({"results": results})


@app.route("/download", methods=["GET"])
def download():
    filename = request.args.get("filename")
    origin_name = request.args.get("origin_name")

    if not filename:
        return {"error": "filename query param required"}, 400

    with conn.cursor() as cur:
        print(filename, flush=True)
        cur.execute(
            "SELECT filename FROM file_data WHERE filename = %s", (unquote(filename),)
        )
        row = cur.fetchone()
        if not row:
            return {"error": "File not found"}, 404
        filename = row[0]

    local_path = f"/tmp/{os.path.basename(filename)}"
    minio_client.fget_object(BUCKET_NAME, filename, local_path)

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
