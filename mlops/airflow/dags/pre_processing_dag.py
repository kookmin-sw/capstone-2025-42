import os
import json
import subprocess
from datetime import datetime

from airflow import DAG
import json
from airflow.operators.python_operator import PythonOperator
from minio import Minio
import psycopg2
import magic
import zipfile
from urllib.parse import unquote_plus
from utils.video_preprocessing import process_video


def load_secret(name):
    path = f"/run/secrets/{name}"
    if os.path.exists(path):
        with open(path) as f:
            return f.read().strip()
    else:
        raise FileNotFoundError(f"Secret {name} not found at {path}")


MINIO_URL = os.getenv("MINIO_URL", "minio:9000")
MINIO_ACCESS_KEY = load_secret("minio_root_user")
MINIO_SECRET_KEY = load_secret("minio_root_password")
POSTGRESQL_USER = load_secret("postgresql_user")
POSTGRESQL_PASSWORD = load_secret("postgresql_password")


def is_hwp(filepath):
    with open(filepath, "rb") as f:
        header = f.read(8)
        return header == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"


def is_pdf(filepath):
    with open(filepath, "rb") as f:
        header = f.read(5)
        return header == b"%PDF-"


def get_file_type_by_magic(filepath):
    mime = magic.Magic(mime=True)
    mime_type = mime.from_file(filepath)
    if mime_type == "application/zip":
        try:
            with zipfile.ZipFile(filepath, "r") as zipf:
                names = zipf.namelist()
                if "word/document.xml" in names:
                    return "text"
                elif "xl/workbook.xml" in names:
                    return "excel"
                elif "ppt/presentation.xml" in names:
                    return "text"
        except:
            pass
    elif (
        mime_type
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ):
        try:
            with zipfile.ZipFile(filepath, "r") as zipf:
                names = zipf.namelist()
                if "word/document.xml" in names:
                    return "text"
        except:
            pass
    elif mime_type.startswith("image/"):
        return "image"
    elif mime_type.startswith("video/"):
        return "video"
    elif mime_type.startswith("audio/"):
        return "audio"
    elif mime_type == "text/plain":
        return "text"
    elif mime_type in [
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]:
        return "excel"
    elif is_hwp(filepath):
        return "text"
    elif is_pdf(filepath):
        return "text"
    else:
        return f"unknown ({mime_type})"


def process_data(meta, file):
    file_type = get_file_type_by_magic(file)
    data = {}
    final_text = "test_text_default"
    if file_type == "image":
        final_text = "test_text_img"
    elif file_type == "video":
        data = process_video(file)
        data["text"] += " "
    elif file_type == "audio":
        final_text = "test_text_audio"
    elif file_type == "text":
        final_text = "test_text_text"
    elif file_type == "excel":
        final_text = "test_text_excel"

    json_data = {}
    with open(meta) as f:
        json_data = json.load(f)
    find_key = ["createdate", "gpslatitude", "gpslongitude"]
    data["text"] += json_data["description"]
    if "createdate" in data["metadata"]:
        json_data["datetime"] = data["metadata"]["createdate"]
    else:
        json_data["datetime"] = ""
    if ("gpslatitude" in data["metadata"]) and ("gpslongitude" in data["metadata"]):
        json_data["location"] = (
            f'{data["metadata"]["gpslatitude"]|data["metadata"]["gpslongitude"]}'
        )
    else:
        json_data["location"] = ""
    json_data["file_type"] = file_type
    return json_data, data["text"]


with DAG(
    dag_id="pre_processing_dag",
    start_date=datetime(2025, 1, 1),
    schedule_interval=None,
    catchup=False,
) as dag:

    def download_from_minio(**context):
        dag_run_conf = context.get("dag_run").conf or {}

        if not dag_run_conf:
            dag_run_conf = context

        records = dag_run_conf.get("Records", [])
        if not records:
            print("No Records found in conf. Cannot proceed.")
            return None

        record = records[0]
        bucket_name = record["s3"]["bucket"]["name"]
        meta_key = record["s3"]["object"]["key"]

        client = Minio(
            MINIO_URL,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=False,
        )

        local_folder = "/opt/airflow/files/"
        os.makedirs(local_folder, exist_ok=True)
        meta_key = unquote_plus(meta_key)
        meta_local_path = os.path.join(local_folder, os.path.basename(meta_key))
        client.fget_object(bucket_name, meta_key, meta_local_path)

        with open(meta_local_path) as f:
            meta = json.load(f)

        file_name_list = meta["file_name"].rsplit(".", 1)
        original_file_key = f"{file_name_list[0]}_{meta['uuid']}.{file_name_list[-1]}"
        file_local_path = os.path.join(
            local_folder, os.path.basename(original_file_key)
        )
        client.fget_object(bucket_name, original_file_key, file_local_path)

        return meta_local_path, file_local_path

    def process_and_save(**context):
        meta, file = context["ti"].xcom_pull(task_ids="download_from_minio")
        if (not meta) or (not file):
            print("No meta or file found.")
            return

        meta_data, final_text = process_data(meta, file)

        conn = psycopg2.connect(
            host="postgres",
            database="airflow",
            user=POSTGRESQL_USER,
            password=POSTGRESQL_PASSWORD,
        )
        cur = conn.cursor()

        file_name_list = meta_data["file_name"].rsplit(".", 1)
        file_path = f"{file_name_list[0]}_{meta_data['uuid']}.{file_name_list[-1]}"

        cur.execute(
            """
            INSERT INTO uploaded_file (
                file_name, file_type, file_path, file_period, uuid, uploaded_at, description, uploader_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING file_id;
            """,
            (
                meta_data["file_name"],
                meta_data["file_type"],
                file_path,
                meta_data["datetime"],
                meta_data["uuid"],
                meta_data["upload_time"],
                final_text,
                meta_data["user_id"],
            ),
        )
        file_id = cur.fetchone()[0]

        insert_sql = """
            INSERT INTO tags (tag_name, description)
            VALUES (%s, %s)
            ON CONFLICT (tag_name) DO NOTHING;
        """
        tags = meta_data["tags"].split(",")
        tag_values = [(tag.strip(), "") for tag in tags]

        cur.executemany(insert_sql, tag_values)
        conn.commit()

        if meta_data["tags"] != "":
            tag_names = meta_data["tags"].split(",")
            placeholders = ",".join(["%s"] * len(tag_names))
            sql = (
                f"SELECT tag_id, tag_name FROM tags WHERE tag_name IN ({placeholders})"
            )
            cur.execute(sql, tag_names)
            rows = cur.fetchall()
            tag_map = {name: tag_id for tag_id, name in rows}
            for tag_name in tag_names:
                tag_id = tag_map.get(tag_name)
                if tag_id:
                    cur.execute(
                        """
                            INSERT INTO file_tags (file_id, tag_id)
                            VALUES (%s, %s)
                            ON CONFLICT DO NOTHING;
                        """,
                        (file_id, tag_id),
                    )
            conn.commit()

        cur.close()
        conn.close()
        os.remove(meta)
        os.remove(file)

    t1 = PythonOperator(
        task_id="download_from_minio",
        python_callable=download_from_minio,
        provide_context=True,
    )

    t2 = PythonOperator(
        task_id="process_and_save",
        python_callable=process_and_save,
        provide_context=True,
    )

    t1 >> t2
