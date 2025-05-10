#!/bin/bash
set -e

# --- Load secrets from file or environment ---
read_secret() {
  local file="/run/secrets/$1"
  if [ -f "$file" ]; then
    cat "$file"
  else
    eval echo "\$$1"
  fi
}

AIRFLOW_USER=$(read_secret airflow_user)
AIRFLOW_PASSWORD=$(read_secret airflow_password)
AIRFLOW_FERNET_KEY=$(read_secret airflow_fernet_key)
POSTGRES_HOST=$(read_secret postgresql_host)
POSTGRES_USER=$(read_secret postgresql_user)
POSTGRES_PASSWORD=$(read_secret postgresql_password)
POSTGRES_PASSWORD=$(read_secret postgresql_password)
export AIRFLOW__CORE__SQL_ALCHEMY_CONN="postgresql+psycopg2://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/airflow"

echo "Loaded secrets for Airflow user: $AIRFLOW_USER"

export AIRFLOW__CORE__FERNET_KEY=$AIRFLOW_FERNET_KEY

echo "Initializing Airflow DB..."
airflow db migrate

echo "Creating admin user..."
airflow users create \
    --username "$AIRFLOW_USER" \
    --password "$AIRFLOW_PASSWORD" \
    --firstname admin \
    --lastname admin \
    --role Admin \
    --email admin@example.com || true

echo "Starting scheduler in background to load DAGs..."
airflow scheduler &

echo "Waiting for DAG to be registered..."
RETRY=30
until airflow dags list | grep -q "process_router_dag"; do
  echo "DAG not found yet... waiting"
  sleep 2
  RETRY=$((RETRY - 1))
  if [ "$RETRY" -eq 0 ]; then
    echo "DAG not found after waiting. Skipping unpause."
    break
  fi
done

echo "DAG found. Unpausing..."
airflow dags list | tail -n +2 | awk '{print $1}' | grep -v '^[=|+-]' | xargs -n1 airflow dags unpause || true

echo "Starting webserver..."
exec airflow webserver
