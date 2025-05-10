from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime
import json, os
import psycopg2
from utils.secrets import load_secret

POSTGRESQL_HOST = load_secret("postgresql_host")
POSTGRESQL_DATABASE = load_secret("postgresql_database")
POSTGRESQL_USER = load_secret("postgresql_user")
POSTGRESQL_PASSWORD = load_secret("postgresql_password")


def save_to_db(**context):
    conf = context["dag_run"].conf
    result_path = conf["result_path"]

    with open(result_path) as f:
        data = json.load(f)

    meta_data = data
    final_text = data["text"]

    conn = psycopg2.connect(
        host=POSTGRESQL_HOST,
        database=POSTGRESQL_DATABASE,
        user=POSTGRESQL_USER,
        password=POSTGRESQL_PASSWORD,
    )
    cur = conn.cursor()

    file_name_list = meta_data["file_name"].rsplit(".", 1)
    file_path = f"{file_name_list[0]}_{meta_data['uuid']}.{file_name_list[-1]}"

    cur.execute(
        """
    	UPDATE uploaded_file
    	SET
            file_period = %s,
            description = %s,
            location    = %s,
            status      = %s
    	WHERE uuid = %s;
    	""",
        (
            meta_data["datetime"],
            final_text,
            meta_data["location"],
            "completed",
            meta_data["uuid"],
        ),
    )
    conn.commit()
    cur.close()
    conn.close()
    os.remove(result_path)


with DAG(
    dag_id="postprocess_dag",
    start_date=datetime(2025, 1, 1),
    schedule_interval=None,
    catchup=False,
) as dag:
    save_task = PythonOperator(
        task_id="save_to_db",
        python_callable=save_to_db,
        provide_context=True,
    )
