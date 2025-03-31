from flask import Flask, request, jsonify, render_template_string, send_file
from minio import Minio
import psycopg2
from uuid import uuid4
import json
import os
import time


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
    MINIO_URL,
    access_key=MINIO_USER,
    secret_key=MINIO_PASSWORD,
    secure=False
)

POSTGRESQL_USER=load_secret("postgresql_user")
POSTGRESQL_PASSWORD=load_secret("postgresql_password")
SLEEP_SECONDS = 2
for i in range(60):
    try:
        conn = psycopg2.connect(
            host="postgres",
            database="airflow",
            user=POSTGRESQL_USER,
            password=POSTGRESQL_PASSWORD
        )
        print("PostgreSQL 연결 성공")
        break
    except psycopg2.OperationalError as e:
        print(f"DB 연결 재시도 중...")
        time.sleep(SLEEP_SECONDS)
else:
    raise Exception("PostgreSQL 연결 실패: DB가 안 떠 있음")


EXAMPLE_HTML = """
<!doctype html>
<html>
<head>
  <title>파일 업로드</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 40px auto; }
    input, textarea { width: 100%; padding: 10px; margin: 10px 0; }
    button { padding: 10px 20px; }
    .result { margin-top: 20px; }
  </style>
</head>
<body>
  <h2>파일 + 설명 업로드</h2>
  <form method="POST" action="/upload" enctype="multipart/form-data">
    <label>파일 선택:</label>
    <input type="file" name="file" required><br>
    <label>설명:</label>
    <textarea name="description" rows="4" placeholder="이 파일에 대한 설명을 입력하세요" required></textarea><br>
    <button type="submit">업로드</button>
  </form>

  <h2>파일 검색</h2>
  <form method="GET" action="/search">
    <input type="text" name="word" placeholder="파일을 나타내는 단어" required>
    <button type="submit">검색</button>
  </form>

  {% if results is not none %}
    {% if results %}
    <table>
      <thead><tr><th>파일명</th><th>다운로드</th></tr></thead>
      <tbody>
        {% for r in results %}
        <tr>
          <td>{{ r.filename }}</td>
          <td><a href="/download?filename={{ r.realpath }}&origin_name={{ r.filename }}">다운로드</a></td>
        </tr>
        {% endfor %}
      </tbody>
    </table>
    {% else %}
      <p>검색 결과가 없습니다.</p>
    {% endif %}
  {% endif %}
</body>
</html>
"""

@app.route("/", methods=["GET"])
def index():
    return render_template_string(EXAMPLE_HTML, results=None)


@app.route("/upload", methods=["POST"])
def upload():
    file = request.files.get('file')
    description = request.form.get('description', '')

    if not file:
        return jsonify({"error": "파일이 없습니다."}), 400

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
        "uuid": unique_id
    }

    os.makedirs(os.path.dirname(json_path), exist_ok=True)
    with open(json_path, "w") as f:
        json.dump(json_data, f)

    minio_client.fput_object(BUCKET_NAME, file_key, file_path)
    minio_client.fput_object(BUCKET_NAME, json_key, json_path)

    os.remove(file_path)
    os.remove(json_path)

    return f"""
        <p>업로드 성공!</p>
        <ul>
          <li><strong>파일:</strong> {file_key}</li>
          <li><strong>설명 JSON:</strong> {json_key}</li>
        </ul>
        <a href="/">다시 업로드</a>
    """

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

    query = f"""
    WITH unioned AS (
        SELECT filename, NULL AS uuid FROM file_data
        WHERE {where_data}
        UNION ALL
        SELECT filename, uuid FROM file_meta_data
        WHERE {where_meta}
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
        results = [{"filename": row[0].replace(f"_{row[1]}", ""), "realpath": row[0]} for row in rows]

    return render_template_string(EXAMPLE_HTML, results=results)


@app.route("/download", methods=["GET"])
def download():
    filename = request.args.get("filename")
    origin_name = request.args.get("origin_name")

    if not filename:
        return {"error": "filename query param required"}, 400

    with conn.cursor() as cur:
        cur.execute("SELECT filename FROM file_data WHERE filename = %s", (filename,))
        row = cur.fetchone()
        if not row:
            return {"error": "File not found"}, 404
        filename = row[0]

    local_path = f"/tmp/{os.path.basename(filename)}"
    minio_client.fget_object(BUCKET_NAME, filename, local_path)

    return send_file(local_path, as_attachment=True, download_name=origin_name)


if __name__ == '__main__':
    app.run(debug=True)

