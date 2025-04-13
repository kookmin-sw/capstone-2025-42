from airflow import DAG
from airflow.operators.python import PythonOperator, BranchPythonOperator
from airflow.operators.trigger_dagrun import TriggerDagRunOperator
from datetime import datetime
import os, json
from urllib.parse import unquote_plus
from minio import Minio
import magic
from utils.minio_utils import download_meta_and_file
from utils.secrets import load_secret
from utils.airflow_utils import get_file_type_by_magic, is_hwpx


MINIO_URL = os.getenv("MINIO_URL", "minio:9000")
MINIO_ACCESS_KEY = load_secret("minio_root_user")
MINIO_SECRET_KEY = load_secret("minio_root_password")


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
        file_type = get_file_type_by_magic(file_path)

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
        >> [trigger_video_dag, trigger_image_dag, trigger_text_dag]
    )
