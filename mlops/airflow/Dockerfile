FROM apache/airflow:2.8.1-python3.9

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    libmagic1 \
    libmagic-dev \
    libimage-exiftool-perl \
    ffmpeg \
    gawk \
    libgl1 \
    libglib2.0-0 \
    perl \
    antiword \
    python3-magic \
    catdoc \
    openjdk-17-jdk \
    && rm -rf /var/lib/apt/lists/*

USER airflow
COPY airflow/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY airflow/dags/ /opt/airflow/dags/
COPY airflow/setup.sh /setup.sh

USER root
COPY airflow/pom.xml /maven/

RUN apt-get update && apt-get install -y maven \
 && cd /maven && mvn dependency:copy-dependencies \
 && apt-get purge -y maven && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
RUN chmod +x /setup.sh
USER airflow

ENTRYPOINT ["/setup.sh"]
