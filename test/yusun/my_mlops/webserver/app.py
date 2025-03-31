from flask import Flask, request, jsonify, render_template_string
from minio import Minio
from uuid import uuid4
import json
import os

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


UPLOAD_HTML = """
<!doctype html>
<html>
<head>
  <title>파일 업로드</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 40px auto; }
    input, textarea { width: 100%; padding: 10px; margin: 10px 0; }
    button { padding: 10px 20px; }
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
</body>
</html>
"""

@app.route("/", methods=["GET"])
def index():
    return render_template_string(UPLOAD_HTML)


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
        "original_filename": filename,
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
        <p>✅ 업로드 성공!</p>
        <ul>
          <li><strong>파일:</strong> {file_key}</li>
          <li><strong>설명 JSON:</strong> {json_key}</li>
        </ul>
        <a href="/">다시 업로드</a>
    """

if __name__ == '__main__':
    app.run(debug=True)

