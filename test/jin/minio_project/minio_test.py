
from minio import Minio

# MinIO 연결
client = Minio(
    "localhost:9000",
    access_key="admin",
    secret_key="password",
    secure=False  # HTTPS 사용 안 함
)

# 버킷 생성
bucket_name = "my-bucket"
if not client.bucket_exists(bucket_name):
    client.make_bucket(bucket_name)
    print(f"Bucket '{bucket_name}' 생성 완료")

# 파일 업로드
file_path = "example.txt"

# 테스트 파일 생성
with open(file_path, "w") as file:
    file.write("이것은 MinIO 테스트 파일입니다.")

client.fput_object(bucket_name, "example.txt", file_path)
print(f"'{file_path}' 파일 업로드 완료")
