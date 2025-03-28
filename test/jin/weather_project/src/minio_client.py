import boto3
from botocore.client import Config
import json

# MinIO 설정
MINIO_ENDPOINT = "http://localhost:9000"
ACCESS_KEY = "admin"
SECRET_KEY = "password"
BUCKET_NAME = "weather-data"

# MinIO 클라이언트 생성
s3_client = boto3.client(
    's3',
    endpoint_url=MINIO_ENDPOINT,
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    config=Config(signature_version='s3v4'),
    region_name="us-east-1"
)

def upload_to_minio(data):
    file_name = f"{data['date']}_weather.json"
    s3_client.put_object(
        Bucket=BUCKET_NAME,
        Key=file_name,
        Body=json.dumps(data),
        ContentType='application/json'
    )
    print(f"✅ '{file_name}' 업로드 완료")
