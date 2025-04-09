import psycopg2

host = "postgres"
port = 5432
dbname = "airflow"
user = "admin"
password = "admin"

# PostgreSQL 연결 정보 설정
conn = psycopg2.connect(
        host=host,
        port=port,
        dbname=dbname,
        user=user,
        password=password
    )

# 커서 열기
cur = conn.cursor()

# 마을 테이블 생성 SQL
create_village_sql = """
CREATE TABLE IF NOT EXISTS village (
    village_id SERIAL PRIMARY KEY,
    village_name TEXT NOT NULL,
    region_code TEXT,
    location TEXT
);
"""

# 데이터 주제 테이블 SQL
create_theme_sql = """
CREATE TABLE IF NOT EXISTS theme (
    theme_id SERIAL PRIMARY KEY,
    theme_name TEXT NOT NULL,
    village_id INTEGER REFERENCES village(village_id),
    update_cycle TEXT
);
"""

create_uploaded_file_sql = """
CREATE TABLE IF NOT EXISTS uploaded_file (
    file_id SERIAL PRIMARY KEY,
    theme_id INTEGER REFERENCES theme(theme_id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_period TEXT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploader_id TEXT
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

# 주제-태그 연결 테이블 (N:M 관계)
create_theme_tags_sql = """
CREATE TABLE IF NOT EXISTS theme_tags (
    theme_id INTEGER REFERENCES theme(theme_id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(tag_id) ON DELETE CASCADE,
    PRIMARY KEY (theme_id, tag_id)
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
    cur.execute(create_village_sql)
    print("✅ 'village' 테이블 생성 완료")

    cur.execute(create_theme_sql)
    print("✅ 'theme' 테이블 생성 완료")

    cur.execute(create_uploaded_file_sql)
    print("✅ 'uploaded_file' 테이블 생성 완료")

    cur.execute(create_tags_sql)
    print("✅ 'tag' 테이블 생성 완료")

    cur.execute(create_theme_tags_sql)
    print("✅ 'theme_tags' 테이블 생성 완료")

    cur.execute(create_file_tags_sql)
    print("✅ 'file_tags' 테이블 생성 완료")

    conn.commit()

except Exception as e:
    print(f"❌ 오류 발생: {e}")
    conn.rollback()
finally:
    cur.close()
    conn.close()