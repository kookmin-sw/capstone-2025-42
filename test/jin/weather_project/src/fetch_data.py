import requests

API_URL = "https://example.com/weather-api"  # API URL 변경 필요
API_PARAMS = {
    "location": "Seoul",
    "date": "20250304"
}

def fetch_weather_data():
    response = requests.get(API_URL, params=API_PARAMS)
    if response.status_code == 200:
        # 데이터를 파싱하여 JSON으로 변환
        data_str = response.text.strip()
        data_list = data_str.split(", ")

        # JSON 형식으로 변환
        parsed_data = {
            "date": data_list[0],
            "avg_temp": float(data_list[1]),
            "max_temp": float(data_list[2]),
            "max_temp_time": data_list[3],
            "min_temp": float(data_list[4]),
            "min_temp_time": data_list[5],
            "total_precipitation": float(data_list[6]),
            "max_hourly_precipitation": float(data_list[7]),
            "max_hourly_precipitation_time": data_list[8]
        }

        return parsed_data
    else:
        raise Exception(f"API 요청 실패: {response.status_code}")
