FROM python:3.9-slim

WORKDIR /app

COPY app.py .

RUN pip install flask gunicorn requests minio

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:8000", "app:app"]

