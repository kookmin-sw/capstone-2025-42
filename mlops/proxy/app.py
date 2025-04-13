from fastapi import FastAPI, Request
import requests
import os
import base64

app = FastAPI()

AIRFLOW_URL = os.getenv("AIRFLOW_URL", "http://airflow:8080")
DAG_ID = os.getenv("DAG_ID", "process_router_dag")


def load_secret(name, default=""):
    path = f"/run/secrets/{name}"
    if os.path.exists(path):
        with open(path) as f:
            return f.read().strip()
    return os.getenv(name.upper(), default)


AIRFLOW_USER = load_secret("airflow_user")
AIRFLOW_PASSWORD = load_secret("airflow_password")
AUTH_TOKEN = base64.b64encode(f"{AIRFLOW_USER}:{AIRFLOW_PASSWORD}".encode()).decode()

AIRFLOW_API_URL = f"{AIRFLOW_URL}/api/v1/dags/{DAG_ID}/dagRuns"
AUTH_HEADER = {"Authorization": f"Basic {AUTH_TOKEN}"}


@app.post("/webhook")
async def handle_minio_event(request: Request):
    payload = await request.json()
    print("Received from MinIO:", payload)

    try:
        record = payload["Records"][0]
        bucket = record["s3"]["bucket"]["name"]
        key = record["s3"]["object"]["key"]

        airflow_payload = {
            "conf": {
                "Records": [
                    {"s3": {"bucket": {"name": bucket}, "object": {"key": key}}}
                ]
            }
        }

        response = requests.post(
            AIRFLOW_API_URL,
            headers={**AUTH_HEADER, "Content-Type": "application/json"},
            json=airflow_payload,
        )

        return {"status": response.status_code, "airflow_response": response.text}

    except Exception as e:
        return {"error": str(e)}
