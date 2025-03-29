from fastapi import FastAPI, UploadFile
import csv
import json
from minio import Minio

app = FastAPI()

# MinIO 연결
client = Minio(
    "localhost:9000",
    access_key="admin",
    secret_key="password",
    secure=False
)

bucket_name = "weather-data"
if not client.bucket_exists(bucket_name):
    client.make_bucket(bucket_name)

@app.post("/upload-weather-data/")
async def upload_weather_data(file: UploadFile):
    # CSV 데이터를 JSON으로 변환
    data_list = []
    content = await file.read()
    rows = content.decode('utf-8-sig').strip().split('\n')

    reader = csv.DictReader(rows)
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
    json_file_path = "weather_202401.json"
    with open(json_file_path, "w", encoding='utf-8') as jsonfile:
        json.dump(data_list, jsonfile, ensure_ascii=False, indent=4)

    # JSON 파일 MinIO에 업로드
    client.fput_object(bucket_name, "weather_202401.json", json_file_path)

    return {"message": "✅ 데이터 업로드 성공!"}
