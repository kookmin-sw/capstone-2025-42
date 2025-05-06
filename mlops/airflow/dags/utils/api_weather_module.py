import pandas as pd
import time
import json
from sqlalchemy import create_engine, inspect, text
from utils.api_weather_util import fetch_weather_df


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

    station_id = (
        df["STN_ID"].iloc[0] if "STN_ID" in df.columns and not df.empty else None
    )

    with engine.begin() as conn:
        conn.execute(
            text(
                """
            INSERT INTO numerical_meta 
            (table_name, category, year, month, source, row_count, columns, is_empty)
            VALUES (:table_name, :category, :year, :month, :source, :row_count, :columns, :is_empty)
        """
            ),
            {
                "table_name": table_name,
                "category": category,
                "year": year,
                "month": month,
                "source": "KMA",  # 또는 적절한 출처 입력
                "row_count": row_count,
                "columns": json.dumps(col_list),
                "is_empty": is_empty
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
