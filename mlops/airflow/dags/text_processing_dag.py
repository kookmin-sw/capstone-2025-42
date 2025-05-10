from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.trigger_dagrun import TriggerDagRunOperator
from datetime import datetime
import json, os
from utils.text_preprocessing import process_text
from utils.airflow_utils import make_json_meta_file


def process_and_save_intermediate(**context):
    conf = context["dag_run"].conf
    meta = conf["meta_path"]
    file = conf["file_path"]

    # data = process_video(file)
    data = process_text(file)
    results = make_json_meta_file(data, meta)

    results_path = f"/opt/airflow/files/{results['uuid']}_results.json"
    with open(results_path, "w") as f:
        json.dump(results, f)

    context["ti"].xcom_push(key="results_path", value=results_path)

    os.remove(meta)
    os.remove(file)


with DAG(
    dag_id="text_processing_dag",
    start_date=datetime(2025, 1, 1),
    schedule_interval=None,
    catchup=False,
) as dag:

    t1 = PythonOperator(
        task_id="process_and_save_intermediate",
        python_callable=process_and_save_intermediate,
        provide_context=True,
    )

    t2 = TriggerDagRunOperator(
        task_id="trigger_postprocess_dag",
        trigger_dag_id="postprocess_dag",
        conf={
            "result_path": "{{ ti.xcom_pull(task_ids='process_and_save_intermediate', key='results_path') }}"
        },
        wait_for_completion=False,
    )

    t1 >> t2
