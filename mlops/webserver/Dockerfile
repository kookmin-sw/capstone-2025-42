FROM python:3.9-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    mecab \
    libmecab-dev \
    mecab-ipadic-utf8

RUN pip install flask gunicorn requests minio psycopg2-binary flask-cors werkzeug pyjwt python-mecab-ko
RUN pip install pandas sqlalchemy

CMD ["flask", "run", "--host=0.0.0.0", "--port=8000"]
#CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:8000", "app:app", "--access-logfile", "-", "--error-logfile", "-"]

