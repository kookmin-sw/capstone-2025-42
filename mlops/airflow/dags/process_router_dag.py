from airflow import DAG
from airflow.operators.python import PythonOperator, BranchPythonOperator
from airflow.operators.trigger_dagrun import TriggerDagRunOperator
from datetime import datetime
import os, json
from urllib.parse import unquote_plus
from minio import Minio
import magic
import psycopg2
from utils.minio_utils import download_meta_and_file
from utils.secrets import load_secret
from utils.airflow_utils import get_file_type_by_magic, is_hwpx

MINIO_URL = os.getenv("MINIO_URL", "minio:9000")
MINIO_ACCESS_KEY = load_secret("minio_root_user")
MINIO_SECRET_KEY = load_secret("minio_root_password")
POSTGRESQL_HOST = load_secret("postgresql_host")
POSTGRESQL_DATABASE = load_secret("postgresql_database")
POSTGRESQL_USER = load_secret("postgresql_user")
POSTGRESQL_PASSWORD = load_secret("postgresql_password")


with DAG(
    dag_id="process_router_dag",
    start_date=datetime(2025, 1, 1),
    schedule_interval=None,
    catchup=False,
) as dag:

    def route(**context):
        dag_run_conf = context.get("dag_run").conf or {}

        if not dag_run_conf:
            dag_run_conf = context

        records = dag_run_conf.get("Records", [])
        if not records:
            raise ValueError("No Records found in trigger input")

        record = records[0]
        bucket = record["s3"]["bucket"]["name"]
        key = unquote_plus(record["s3"]["object"]["key"])

        client = Minio(
            MINIO_URL,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=False,
        )

        # 메타/파일 다운로드
        meta_path, file_path = download_meta_and_file(client, bucket, key)
        specific_file_type, file_type = get_file_type_by_magic(file_path)

        meta_data = {}
        with open(meta_path) as f:
            meta_data = json.load(f)
        file_name_list = meta_data["file_name"].rsplit(".", 1)
        real_file_path = f"{file_name_list[0]}_{meta_data['uuid']}.{file_name_list[-1]}"
        description = " |"
        description += meta_data["description"]

        conn = psycopg2.connect(
            host=POSTGRESQL_HOST,
            database=POSTGRESQL_DATABASE,
            user=POSTGRESQL_USER,
            password=POSTGRESQL_PASSWORD,
        )
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO uploaded_file (
                file_name, file_type, specific_file_type, file_path, uuid, description,
                uploaded_at, uploader_id, category, status, village_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    	    RETURNING file_id;
            """,
            (
                meta_data["file_name"],
                file_type,
                specific_file_type,
                real_file_path,
                meta_data["uuid"],
                description,
                meta_data["upload_time"],
                meta_data["user_id"],
                meta_data["category"],
                "progress",
                meta_data["current_village_id"],
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
            placeholders = ",".join(["%s"] * len(tags))
            cur.execute(
                f"SELECT tag_id, tag_name FROM tags WHERE tag_name IN ({placeholders})",
                tags,
            )
            rows = cur.fetchall()
            tag_map = {name: tag_id for tag_id, name in rows}
            for tag in tags:
                tag_id = tag_map.get(tag)
                if tag_id:
                    cur.execute(
                        "INSERT INTO file_tags (file_id, tag_id) VALUES (%s, %s) ON CONFLICT DO NOTHING;",
                        (file_id, tag_id),
                    )
            conn.commit()

        cur.close()
        conn.close()

        context["ti"].xcom_push(key="meta_path", value=meta_path)
        context["ti"].xcom_push(key="file_path", value=file_path)
        context["ti"].xcom_push(key="file_type", value=file_type)

    decide_file_type = PythonOperator(
        task_id="decide_file_type",
        python_callable=route,
        provide_context=True,
    )

    trigger_video_dag = TriggerDagRunOperator(
        task_id="trigger_video_dag",
        trigger_dag_id="video_processing_dag",
        execution_date="{{ execution_date }}",
        wait_for_completion=False,
        reset_dag_run=True,
        conf={
            "meta_path": "{{ ti.xcom_pull(task_ids='decide_file_type', key='meta_path') }}",
            "file_path": "{{ ti.xcom_pull(task_ids='decide_file_type', key='file_path') }}",
            "file_type": "{{ ti.xcom_pull(task_ids='decide_file_type', key='file_type') }}",
        },
        trigger_rule="none_failed",
    )

    trigger_image_dag = TriggerDagRunOperator(
        task_id="trigger_image_dag",
        trigger_dag_id="image_processing_dag",
        execution_date="{{ execution_date }}",
        wait_for_completion=False,
        reset_dag_run=True,
        conf={
            "meta_path": "{{ ti.xcom_pull(task_ids='decide_file_type', key='meta_path') }}",
            "file_path": "{{ ti.xcom_pull(task_ids='decide_file_type', key='file_path') }}",
            "file_type": "{{ ti.xcom_pull(task_ids='decide_file_type', key='file_type') }}",
        },
        trigger_rule="none_failed",
    )

    trigger_text_dag = TriggerDagRunOperator(
        task_id="trigger_text_dag",
        trigger_dag_id="text_processing_dag",
        execution_date="{{ execution_date }}",
        wait_for_completion=False,
        reset_dag_run=True,
        conf={
            "meta_path": "{{ ti.xcom_pull(task_ids='decide_file_type', key='meta_path') }}",
            "file_path": "{{ ti.xcom_pull(task_ids='decide_file_type', key='file_path') }}",
            "file_type": "{{ ti.xcom_pull(task_ids='decide_file_type', key='file_type') }}",
        },
        trigger_rule="none_failed",
    )

    trigger_numerical_dag = TriggerDagRunOperator(
        task_id="trigger_numerical_dag",
        trigger_dag_id="numerical_processing_dag",
        execution_date="{{ execution_date }}",
        wait_for_completion=False,
        reset_dag_run=True,
        conf={
            "meta_path": "{{ ti.xcom_pull(task_ids='decide_file_type', key='meta_path') }}",
            "file_path": "{{ ti.xcom_pull(task_ids='decide_file_type', key='file_path') }}",
            "file_type": "{{ ti.xcom_pull(task_ids='decide_file_type', key='file_type') }}",
        },
        trigger_rule="none_failed",
    )

    def branch(**context):
        file_type = context["ti"].xcom_pull(
            task_ids="decide_file_type", key="file_type"
        )
        if file_type == "video":
            return "trigger_video_dag"
        elif file_type == "image":
            return "trigger_image_dag"
        elif file_type == "text":
            return "trigger_text_dag"
        elif file_type == "numerical":
            return "trigger_numerical_dag"
        else:
            raise ValueError(f"Unsupported file type: {file_type}")

    branch_op = BranchPythonOperator(
        task_id="branch_dag_trigger",
        python_callable=branch,
        provide_context=True,
    )

    (
        decide_file_type
        >> branch_op
        >> [trigger_video_dag, trigger_image_dag, trigger_text_dag, trigger_numerical_dag]
    )
