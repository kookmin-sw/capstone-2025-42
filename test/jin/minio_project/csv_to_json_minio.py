import csv
import json
from minio import Minio

# MinIO 연결
client = Minio(
    "localhost:9000",
    access_key="admin",
    secret_key="password",
    secure=False
)

# 버킷 생성
bucket_name = "weather-data"
if not client.bucket_exists(bucket_name):
    client.make_bucket(bucket_name)

# CSV 파일 읽기 및 JSON 변환
csv_file_path = "/Users/jin/Desktop/cap/minio_project/weather_202401.csv"
json_file_path = "weather_202401.json"

data_list = []
try:
    with open(csv_file_path, encoding='utf-8-sig') as csvfile:
        reader = csv.DictReader(csvfile)
        print("✅ CSV 데이터 읽기 성공")
        for row in reader:
            formatted_data = {
                "date": row.get("YMD", ""),
                "avg_temp": float(row.get("TA_DAVG", "0").strip()) if row.get("TA_DAVG") != "-999.0" else None,
                "max_temp": float(row.get("TMX_DD", "0").strip()) if row.get("TMX_DD") != "-999.0" else None,
                "max_temp_time": row.get("TMX_OCUR_TMA", "").strip(),
                "min_temp": float(row.get("TMN_DD", "0").strip()) if row.get("TMN_DD") != "-999.0" else None,
                "min_temp_time": row.get("TMN_OCUR_TMA", "").strip(),
                "total_precipitation": float(row.get("RN_DSUM", "0").strip()) if row.get("RN_DSUM") != "-999.0" else None,
                "max_hourly_precipitation": float(row.get("RN_MAX_1HR", "0").strip()) if row.get("RN_MAX_1HR") != "-999.0" else None,
                "max_hourly_precipitation_time": row.get("RN_MAX_1HR_OCUR_TMA", "").strip()
            }
            data_list.append(formatted_data)

    # JSON 파일 생성
    with open(json_file_path, "w", encoding='utf-8') as jsonfile:
        json.dump(data_list, jsonfile, ensure_ascii=False, indent=4)

    print("✅ JSON 파일 생성 완료")

    # ➡️ JSON 파일 MinIO에 업로드
    try:
        client.fput_object(bucket_name, "weather_202401.json", json_file_path)
        print("✅ JSON 데이터 MinIO 업로드 완료!")
    except Exception as e:
        print(f"❌ MinIO 업로드 실패: {e}")

except Exception as e:
    print(f"❌ 오류 발생: {e}")
