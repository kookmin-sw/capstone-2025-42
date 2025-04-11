import psycopg2
import os
import time


def load_secret(name, default=""):
    path = f"/run/secrets/{name}"
    if os.path.exists(path):
        with open(path) as f:
            return f.read().strip()
    return os.getenv(name.upper(), default)


POSTGRESQL_USER = load_secret("postgresql_user")
POSTGRESQL_PASSWORD = load_secret("postgresql_password")
SLEEP_SECONDS = 2
for i in range(60):
    try:
        conn = psycopg2.connect(
            host="postgres",
            database="airflow",
            user=POSTGRESQL_USER,
            password=POSTGRESQL_PASSWORD,
        )
        print("PostgreSQL 연결 성공")
        break
    except psycopg2.OperationalError as e:
        print(f"DB 연결 재시도 중...")
        time.sleep(SLEEP_SECONDS)
else:
    raise Exception("PostgreSQL 연결 실패: DB가 안 떠 있음")
cur = conn.cursor()


create_users = """
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);
"""

create_uploaded_file_sql = """
CREATE TABLE IF NOT EXISTS uploaded_file (
    file_id SERIAL PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_period TEXT NOT NULL,
    uuid TEXT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploader_id TEXT,
    description TEXT
);
"""

# 태그 테이블 SQL
create_tags_sql = """
CREATE TABLE IF NOT EXISTS tags (
    tag_id SERIAL PRIMARY KEY,
    tag_name TEXT NOT NULL UNIQUE,
    description TEXT
);
"""

create_file_tags_sql = """
CREATE TABLE IF NOT EXISTS file_tags (
    file_id INTEGER REFERENCES uploaded_file(file_id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(tag_id) ON DELETE CASCADE,
    PRIMARY KEY (file_id, tag_id)
);
"""

try:
    cur.execute(create_users)
    print("✅ 'users' 테이블 생성 완료")

    cur.execute(create_uploaded_file_sql)
    print("✅ 'uploaded_file' 테이블 생성 완료")

    cur.execute(create_tags_sql)
    print("✅ 'tag' 테이블 생성 완료")

    cur.execute(create_file_tags_sql)
    print("✅ 'file_tags' 테이블 생성 완료")

    conn.commit()

except Exception as e:
    print(f"❌ 오류 발생: {e}")
    conn.rollback()
finally:
    cur.close()
    conn.close()
