# ./front/Dockerfile  ── 개발용 (npm run dev + 볼륨 마운트)
FROM node:20-alpine

# 1. 작업 디렉터리
WORKDIR /app

# 2. 의존성 파일만 먼저 복사 → npm install (캐시 효율 ↑)
COPY package*.json ./
RUN npm install

# 3. dev 서버가 외부에서 접근 가능하도록 0.0.0.0 + 5173 노출
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

