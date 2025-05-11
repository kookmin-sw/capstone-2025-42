import pandas as pd
import time
import json
from sqlalchemy import create_engine, inspect, text
from utils.api_weather_util import fetch_weather_df
from datetime import datetime
from uuid import uuid4


def drop_weather_views(db_uri):
    engine = create_engine(db_uri)
    with engine.connect() as conn:
        for category in ["temp", "rain", "snow"]:
            view_name = f"weather_{category}_all"
            conn.execute(text(f"DROP VIEW IF EXISTS {view_name}"))
            print(f"🗑️ Dropped view if existed: {view_name}")


def save_weather_metadata(engine, table_name, category, year, month, df):
    col_list = list(df.columns)
    row_count = len(df)
    is_empty = row_count == 0  # ✅ 빈 데이터 여부

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO uploaded_file (
                    file_name, 
                    file_type,
                    specific_file_type,
                    file_path, 
                    file_period, 
                    uuid, 
                    uploaded_at, 
                    description, 
                    category, 
                    status
                )
                VALUES (
                    :file_name, 
                    :file_type,
                    :specific_file_type,
                    :file_path, 
                    :file_period, 
                    :uuid, 
                    :uploaded_at, 
                    :description, 
                    :category, 
                    :status
                )
                """
            ),
            {
                "file_name": table_name,
                "file_type": "text",
                "specific_file_type": "numercial",
                "file_path": f"/virtual/numerical/{table_name}",
                "file_period": f"{year}-{month:02d}",
                "uuid": str(uuid4()),
                "uploaded_at": datetime.utcnow(),
                "description": json.dumps(
                    {
                        "columns": col_list,
                        "row_count": row_count,
                        "source": "KMA",
                        "is_empty": is_empty,
                    }
                ),
                "category": category,
                "status": "completed",
            },
        )


def save_weather_to_postgres(year, month, db_uri):
    table_suffix = f"{year}{month:02d}"
    engine = create_engine(db_uri)
    inspector = inspect(engine)

    try:
        df_temp, df_rain, df_snow = fetch_weather_df(year, month)
    except Exception as e:
        print(f"❌ Failed to fetch weather data: {e}")
        return

    for category, df in {"temp": df_temp, "rain": df_rain, "snow": df_snow}.items():
        table_name = f"weather_{category}_{table_suffix}"

        if inspector.has_table(table_name):
            print(f"⚠️ Table already exists, skipping: {table_name}")
            continue

        try:
            if df.empty:
                print(f"⚠️ No data available, creating empty table for: {table_name}")
                # 빈 구조만 가진 테이블 생성
                df[:0].to_sql(table_name, engine, index=False, if_exists="replace")
            else:
                df.to_sql(table_name, engine, index=False, if_exists="replace")
                print(f"✅ Saved: {table_name}")

            # 메타데이터는 빈 데이터든 아니든 기록
            save_weather_metadata(engine, table_name, category, year, month, df)

        except Exception as e:
            print(f"❌ Failed to save {table_name}: {e}")

        time.sleep(1)


def update_weather_views(db_uri):
    engine = create_engine(db_uri)
    with engine.connect() as conn:
        for category in ["temp", "rain", "snow"]:
            table_prefix = f"weather_{category}_"
            result = conn.execute(
                text(
                    f"""
                SELECT tablename FROM pg_tables 
                WHERE tablename LIKE '{table_prefix}%'
                ORDER BY tablename;
            """
                )
            )
            tables = [row[0] for row in result]
            if not tables:
                continue

            union_sql = "\nUNION ALL\n".join(
                [f"SELECT * FROM {table}" for table in tables]
            )
            view_sql = f"CREATE OR REPLACE VIEW weather_{category}_all AS\n{union_sql};"
            conn.execute(text(view_sql))
            print(f"✅ Created view: weather_{category}_all")
