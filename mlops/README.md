## 실행 방법

### Docker Compose 실행
```bash
docker-compose up -d --build
```

### Docker Compose 종료
```bash
docker-compose down -v
```

---

## 프로젝트 파일 구조

```
.
├── README.md
├── airflow
│   ├── Dockerfile
│   ├── dags
│   │   ├── api_weather_dag.py
│   │   ├── image_processing_dag.py
│   │   ├── numerical_processing_dag.py
│   │   ├── postprocess_dag.py
│   │   ├── process_router_dag.py
│   │   ├── text_processing_dag.py
│   │   ├── utils
│   │   │   ├── __init__.py
│   │   │   ├── airflow_utils.py
│   │   │   ├── api_weather_module.py
│   │   │   ├── api_weather_util.py
│   │   │   ├── image_preprocessing.py
│   │   │   ├── minio_utils.py
│   │   │   ├── numerical_preprocessing.py
│   │   │   ├── secrets.py
│   │   │   ├── text_preprocessing.py
│   │   │   └── video_preprocessing.py
│   │   └── video_processing_dag.py
│   ├── pom.xml
│   ├── requirements.txt
│   └── setup.sh
├── docker-compose.yml
├── front
│   ├── Dockerfile
│   ├── README.md
│   ├── dist
│   ├── eslint.config.js
│   ├── index.html
│   ├── node_modules
│   ├── package-lock.json
│   ├── package.json
│   ├── postcss.config.js
│   ├── public
│   │   └── vite.svg
│   ├── src
│   │   ├── App.css
│   │   ├── App.jsx
│   │   ├── assets
│   │   │   ├── example.jpg
│   │   │   ├── icon.png
│   │   │   └── react.svg
│   │   ├── components
│   │   │   ├── Navbar.jsx
│   │   │   └── RequireAuth.jsx
│   │   ├── index.css
│   │   ├── main.jsx
│   │   └── pages
│   │       ├── HomePage.jsx
│   │       ├── LoginPage.jsx
│   │       ├── MergeTablesModal.jsx
│   │       ├── NumericalDownloads.jsx
│   │       ├── SearchPage.jsx
│   │       └── UploadPage.jsx
│   ├── tailwind.config.js
│   └── vite.config.js
├── init
│   ├── Dockerfile
│   └── init-minio.sh
├── init-db
│   ├── Dockerfile
│   ├── init_db.py
│   ├── requirements.txt
│   └── wait-for-postgres.sh
├── proxy
│   ├── Dockerfile
│   └── app.py
├── secrets
│   ├── airflow_fernet_key
│   ├── airflow_password
│   ├── airflow_user
│   ├── jwt_secret_key
│   ├── kma_api_key
│   ├── minio_root_password
│   ├── minio_root_user
│   ├── postgresql_database
│   ├── postgresql_host
│   ├── postgresql_password
│   └── postgresql_user
└── webserver
    ├── Dockerfile
    ├── __pycache__
    │   └── app.cpython-39.pyc
    ├── app.py
    └── dist
```

---

## 주의사항

- **WSL 환경**에서 실행할 경우 **Docker 4.27.1 이상**이 필요합니다.
- `secrets/` 폴더는 각종 비밀번호 및 키 정보 등 **민감한 데이터를 포함**하고 있으므로 **사용자 개별적으로 생성**해야 합니다.
- 이 저장소에는 `secrets/` 폴더가 포함되어 있지 않습니다.

---

## 간단한 사용법

1. **MinIO 콘솔 접속**  
   [http://localhost:9001](http://localhost:9001)  
   로그인 정보:  
   - 사용자명: `minio_root_user` 파일 내용  
   - 비밀번호: `minio_root_password` 파일 내용

2. **Airflow 웹 UI 확인**  
   [http://localhost:8080](http://localhost:8080)  
   로그인 정보:  
   - 사용자명: `airflow_user`  
   - 비밀번호: `airflow_password`  
   실행 로그 및 DAG 진행 상황 확인 가능
