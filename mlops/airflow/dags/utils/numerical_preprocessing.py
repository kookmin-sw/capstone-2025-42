import pandas as pd
import os
from sqlalchemy import create_engine
from utils.secrets import load_secret
import psycopg2, time, olefile, zipfile, openpyxl, xlrd, magic
from datetime import datetime, timedelta
from pathlib import Path
import xml.etree.ElementTree as ET
import chardet


POSTGRESQL_HOST = load_secret("postgresql_host")
POSTGRESQL_DATABASE = load_secret("postgresql_database")
POSTGRESQL_USER = load_secret("postgresql_user")
POSTGRESQL_PASSWORD = load_secret("postgresql_password")
SLEEP_SECONDS = 2
for i in range(60):
    try:
        conn = psycopg2.connect(
            host=POSTGRESQL_HOST,
            database=POSTGRESQL_DATABASE,
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

DB_URI = f"postgresql+psycopg2://{POSTGRESQL_USER}:{POSTGRESQL_PASSWORD}@{POSTGRESQL_HOST}:5432/{POSTGRESQL_DATABASE}"
engine = create_engine(DB_URI)


def get_ole_created_date(path):
    try:
        if not olefile.isOleFile(path):
            return ""
        ole = olefile.OleFileIO(path)
        if ole.exists("\x05SummaryInformation"):
            props = ole.getproperties("\x05SummaryInformation")
            created = props.get(13)
            if isinstance(created, (int, float)):
                created = datetime(1601, 1, 1) + timedelta(seconds=created)
                return to_iso_str(created)
            else:
                return created
    except:
        return ""
    return ""


def get_office_openxml_created_date(path):
    try:
        with zipfile.ZipFile(path, "r") as z:
            core_xml = z.read("docProps/core.xml").decode("utf-8", "ignore")
            root = ET.fromstring(core_xml)
            for t_elem in root.iter("{http://purl.org/dc/terms/}modified"):
                if t_elem.text is not None:
                    return t_elem.text.replace("Z", "")
    except:
        return ""
    return ""


def get_file_created_date(path):
    try:
        ts = os.path.getctime(path)
        return datetime.fromtimestamp(ts).strftime("%Y-%m-%dT%H:%M:%S")
    except:
        return ""


def extract_xlsx(filepath):
    return pd.read_excel(filepath, engine="openpyxl")


def extract_xls(filepath):
    return pd.read_excel(filepath, engine="xlrd")


def extract_csv(filepath):
    # 인코딩 자동 감지
    with open(filepath, "rb") as f:
        result = chardet.detect(f.read(10000))  # 첫 10KB로 인코딩 감지
        encoding = result["encoding"]

    try:
        return pd.read_csv(filepath, encoding=encoding)
    except UnicodeDecodeError:
        for fallback_enc in ["cp949", "euc-kr"]:
            try:
                return pd.read_csv(filepath, encoding=fallback_enc)
            except UnicodeDecodeError:
                continue
        raise ValueError(
            f"Failed to decode CSV file with detected encodings. File: {filepath}"
        )


# 파일 확장자에 따라 적절한 추출 함수 선택
def process_numerical(filepath):
    mime = magic.Magic(mime=True)
    mime_type = mime.from_file(filepath)
    ext = "default"

    if mime_type in [
        "application/vnd.ms-excel",
    ]:
        ext = "xls"
    if mime_type in [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]:
        ext = "xlsx"
    elif mime_type == "application/zip":
        try:
            with zipfile.ZipFile(filepath, "r") as zipf:
                names = [name.replace("\\", "/") for name in zipf.namelist()]
                if any(name.endswith("xl/workbook.xml") for name in names):
                    ext = "xlsx"
        except:
            pass
    elif filepath.lower().endswith(".csv"):
        ext = "csv"

    numerical_extractor = {
        "xlsx": extract_xlsx,
        "xls": extract_xls,
        "csv": extract_csv,
    }.get(ext)

    if not numerical_extractor:
        raise ValueError(f"Unsupported file type for numerical processing: {filepath}")

    # DataFrame 추출
    df = numerical_extractor(filepath)

    # 테이블명 자동 생성
    file_stem = Path(filepath).stem
    safe_table_name = file_stem.replace("-", "_").replace(" ", "_").lower()

    # DB 저장
    df.to_sql(safe_table_name, engine, if_exists="replace", index=False)

    # 메타데이터 생성
    meta_extractor = {
        "xls": get_ole_created_date,
        "xlsx": get_office_openxml_created_date,
        "csv": get_file_created_date,
    }.get(ext, lambda x: "")

    text_data = df.to_csv(index=False)

    return {"metadata": {"createdate": meta_extractor(filepath)}, "text": text_data}
