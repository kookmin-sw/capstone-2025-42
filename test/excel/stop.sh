#!/bin/bash

# 스크립트 실행 중 에러 발생 시 종료
set -e

CONTAINER_NAME="excel-merge-container"

echo "컨테이너 중지 중..."
docker stop $CONTAINER_NAME 2>/dev/null || echo "이미 중지되었거나 존재하지 않음"

echo "컨테이너 삭제 중..."
docker rm $CONTAINER_NAME 2>/dev/null || echo "이미 삭제되었거나 존재하지 않음"

echo "정리 완료!"

