import os
import json
import subprocess
from datetime import datetime

from airflow import DAG
import json
from airflow.operators.python_operator import PythonOperator
import boto3
import psycopg2
import magic


def load_secret(name):
    path = f"/run/secrets/{name}"
    if os.path.exists(path):
        with open(path) as f:
            return f.read().strip()
    else:
        raise FileNotFoundError(f"Secret {name} not found at {path}")

MINIO_ACCESS_KEY = load_secret("minio_root_user")
MINIO_SECRET_KEY = load_secret("minio_root_password")
POSTGRES_USER = load_secret("postgresql_user")
POSTGRES_PASSWORD = load_secret("postgresql_password")


def get_file_type_by_magic(filepath):
    mime = magic.Magic(mime=True)
    mime_type = mime.from_file(filepath)

    if mime_type.startswith('image/'):
        return 'image'
    elif mime_type.startswith('video/'):
        return 'video'
    elif mime_type.startswith('audio/'):
        return 'audio'
    elif mime_type == 'text/plain':
        return 'text'
    elif mime_type in ['application/vnd.ms-excel',
                       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']:
        return 'excel'
    else:
        return f'unknown ({mime_type})'


def process_data(meta, file):
    file_type = get_file_type_by_magic(file)
    if file_type == 'image':
        final_text = "test_text_img"
    elif file_type == 'video':
        final_text = "test_text_video"
    elif file_type == 'audio':
        final_text = "test_text_audio"
    elif file_type == 'text':
        final_text = "test_text_text"
    elif file_type == 'excel':
        final_text = "test_text_excel"

    json_data = {}
    with open(meta) as f:
        json_data = json.load(f)
    json_data["datetime"] = "sampledate"
    json_data["location"] = "samplelocation"
    return json_data, final_text


with DAG(
    dag_id='pre_processing_dag',
    start_date=datetime(2025, 1, 1),
    schedule_interval=None,
    catchup=False
) as dag:

    def download_from_minio(**context):
        dag_run_conf = context.get('dag_run').conf or {}

        if not dag_run_conf:
            dag_run_conf = context

        records = dag_run_conf.get('Records', [])
        if not records:
            print("No Records found in conf. Cannot proceed.")
            return None

        record = records[0]
        bucket_name = record['s3']['bucket']['name']
        meta_key = record['s3']['object']['key']

        s3 = boto3.client(
            's3',
            endpoint_url='http://minio:9000',
            aws_access_key_id=MINIO_ACCESS_KEY,
            aws_secret_access_key=MINIO_SECRET_KEY,
            region_name='ap-northeast-2'
        )

        local_folder = "/opt/airflow/files/"
        os.makedirs(local_folder, exist_ok=True)
        meta_local_path = os.path.join(local_folder, os.path.basename(meta_key))
        s3.download_file(bucket_name, meta_key, meta_local_path)

        with open(meta_local_path) as f:
            meta = json.load(f)

        filename_list = meta['original_filename'].split('.')
        original_file_key = f"{filename_list[0]}_{meta['uuid']}.{filename_list[-1]}"
        file_local_path = os.path.join(local_folder, os.path.basename(original_file_key))
        s3.download_file(bucket_name, original_file_key, file_local_path)

        return meta_local_path, file_local_path

    def process_and_save(**context):
        meta, file = context['ti'].xcom_pull(task_ids='download_from_minio')
        if (not meta) or (not file):
            print("No meta or file found.")
            return

        meta_data, final_text = process_data(meta, file)

        conn = psycopg2.connect(
            host='postgres',
            database='airflow',
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD
        )
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS file_data (
                id SERIAL PRIMARY KEY,
                filename TEXT,
                result TEXT
            );
        """)
        cur.execute(
            "INSERT INTO file_data (filename, result) VALUES (%s, %s);",
            (os.path.basename(file), final_text)
        )
        cur.execute("""
            CREATE TABLE IF NOT EXISTS file_meta_data (
                id SERIAL PRIMARY KEY,
                filename TEXT,
                description TEXT,
                location TEXT,
                datetime TEXT
            );
        """)
        cur.execute("""
            INSERT INTO file_meta_data (
                filename, description, location, datetime
            ) VALUES (%s, %s, %s, %s);
            """,
            (os.path.basename(file), meta_data["description"],
             meta_data["location"], meta_data["datetime"])
        )
        conn.commit()
        cur.close()
        conn.close()
        os.remove(meta)
        os.remove(file)

    t1 = PythonOperator(
        task_id='download_from_minio',
        python_callable=download_from_minio,
        provide_context=True
    )

    t2 = PythonOperator(
        task_id='process_and_save',
        python_callable=process_and_save,
        provide_context=True
    )

    t1 >> t2

