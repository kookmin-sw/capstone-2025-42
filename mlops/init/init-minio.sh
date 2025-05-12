#!/bin/sh
set -e

MINIO_ALIAS=local
MINIO_URL=http://minio:9000
MINIO_ACCESS_KEY=$(cat /run/secrets/minio_root_user)
MINIO_SECRET_KEY=$(cat /run/secrets/minio_root_password)
BUCKET_NAME=data-bucket
WEBHOOK_NAME=airflow
PROXY_ENDPOINT=http://proxy:8000/webhook

echo "Waiting for MinIO to be ready..."
until mc alias set $MINIO_ALIAS $MINIO_URL $MINIO_ACCESS_KEY $MINIO_SECRET_KEY --quiet; do
  sleep 2
done

echo "Creating bucket if not exists..."
mc mb $MINIO_ALIAS/$BUCKET_NAME || true

echo "Removing existing webhook if exists..."
mc event remove --force $MINIO_ALIAS/$BUCKET_NAME arn:minio:sqs::$WEBHOOK_NAME:webhook || true

echo "Waiting for proxy..."
until nc -z proxy 8000; do
  sleep 2
done
echo "Proxy is up!"

echo "Adding webhook..."
mc event add $MINIO_ALIAS/$BUCKET_NAME arn:minio:sqs::$WEBHOOK_NAME:webhook \
  --event put \
  --prefix "meta/" \
  --suffix ".json" --quiet

echo "Setting CORS..."
cat >/tmp/cors.json <<'EOF'
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "http://localhost:8792",
      "https://view.officeapps.live.com"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range", "Authorization"],
    "ExposeHeaders": [
      "Accept-Ranges",
      "Content-Range",
      "Content-Length",
      "ETag"
    ],
    "MaxAgeSeconds": 600
  }
]
EOF
mc admin bucket cors set $MINIO_ALIAS/$BUCKET_NAME /tmp/cors.json
rm /tmp/cors.json

echo "MinIO webhook registration complete!"
