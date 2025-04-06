# 1) 파이썬 베이스 이미지
FROM python:3.9-slim

# 2) 작업 디렉토리 생성
WORKDIR /app

# 3) 시스템 패키지 업데이트 및 필수 패키지 설치
RUN apt-get update && apt-get install -y gcc

# 4) requirements.txt 복사 후, pip install
COPY requirements.txt /app
RUN pip install --no-cache-dir -r requirements.txt

# 5) 소스 코드 복사
COPY app.py /app

# 6) Flask 포트 개방
EXPOSE 5000

# 7) 컨테이너 실행 시 Flask 서버 실행
CMD [ "python", "app.py" ]

