from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
from utils.api_weather_module import (
    drop_weather_views,
    save_weather_to_postgres,
    update_weather_views,
)
from utils.secrets import load_secret

POSTGRESQL_HOST = load_secret("postgresql_host")
POSTGRESQL_DATABASE = load_secret("postgresql_database")
POSTGRESQL_USER = load_secret("postgresql_user")
POSTGRESQL_PASSWORD = load_secret("postgresql_password")

db_uri = f"postgresql+psycopg2://{POSTGRESQL_USER}:{POSTGRESQL_PASSWORD}@{POSTGRESQL_HOST}:5432/{POSTGRESQL_DATABASE}"

default_args = {
    "start_date": datetime(2024, 5, 1),
    "retries": 1,
    "retry_delay": timedelta(minutes=10),
}

with DAG(
    dag_id="weather_to_psql",
    default_args=default_args,
    schedule_interval="0 0 2 * *",  # 매월 2일 00:00에 실행
    catchup=False,
) as dag:

    def weather_to_drop():
        drop_weather_views(db_uri)

    def weather_to_psql():
        today = datetime.today()
        prev_month = today.replace(day=1) - timedelta(days=1)
        year = prev_month.year
        month = prev_month.month

        save_weather_to_postgres(year, month, db_uri)

    def weather_to_sql():
        update_weather_views(db_uri)

    w0 = PythonOperator(task_id="weather_to_drop", python_callable=weather_to_drop)

    w1 = PythonOperator(task_id="weather_to_psql", python_callable=weather_to_psql)

    w2 = PythonOperator(task_id="weather_to_views", python_callable=weather_to_sql)

    w0 >> w1 >> w2
