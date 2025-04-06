#!/bin/bash

# 스크립트 실행 중 에러 발생 시 종료
set -e

# 이미지 이름
IMAGE_NAME="excel-merge:latest"

echo "도커 이미지 빌드 중..."
docker build -t $IMAGE_NAME .

echo "이전에 실행된 컨테이너 정리 중..."
docker rm -f excel-merge-container 2>/dev/null || true

echo "도커 컨테이너 실행 중..."
docker run -d \
  --name excel-merge-container \
  -p 5000:5000 \
  -v "$PWD:/app" \
  $IMAGE_NAME

echo "실행 완료! 브라우저에서 http://localhost:5000으로 들어가세요"
