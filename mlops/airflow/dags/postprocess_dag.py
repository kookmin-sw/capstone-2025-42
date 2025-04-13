from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime
import json, os
import psycopg2
from utils.secrets import load_secret

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
            file_name, file_type, file_path, file_period, uuid, uploaded_at, description, uploader_id, location
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
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
            meta_data["location"],
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
