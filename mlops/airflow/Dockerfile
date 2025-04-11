FROM apache/airflow:2.8.1-python3.9

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    libmagic1 \
    libmagic-dev \
    libimage-exiftool-perl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

USER airflow
COPY airflow/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY airflow/dags /opt/airflow/dags
COPY airflow/setup.sh /setup.sh
USER root
RUN chmod +x /setup.sh
USER airflow

ENTRYPOINT ["/setup.sh"]

