import os
import json
import pandas as pd
from datetime import datetime

# -----------------------------
# 설정
# -----------------------------
SOURCE_DIR = ".\\old"  # 원본 CSV 파일이 있는 폴더
OUTPUT_DIR = ".\\new"  # 새 CSV 파일들을 저장할 폴더
HEADERS_FILE = "headers.json"  # 표준 헤더 정보를 저장한 JSON 파일
TODAY = datetime.today().strftime("%Y%m%d")  # 수정날짜 (YYYYMMDD)

# OUTPUT_DIR 폴더가 없으면 생성
os.makedirs(OUTPUT_DIR, exist_ok=True)

# -----------------------------
# 1) headers.json 에서 표준 헤더 정보 불러오기
#    (json 파일이 없거나 비어있을 경우 빈 딕셔너리로 시작)
# -----------------------------
if os.path.exists(HEADERS_FILE):
    with open(HEADERS_FILE, 'r', encoding='utf-8') as f:
        try:
            standard_headers = json.load(f) # 예: {"인구조사": ["연령별", "남", "여"], ...}
        except json.JSONDecodeError:
            standard_headers = {}
else:
    standard_headers = {}


# -----------------------------
# 2) CSV 파일 처리 함수
# -----------------------------
def process_csv_file(filepath):
    filename = os.path.basename(filepath)
    base, ext = os.path.splitext(filename)
    parts = base.split("_")

    # 파일명에서 조사날짜(4자리 또는 6자리 숫자)와 데이터명칭(나머지 부분) 추출
    allowed_lengths = {4, 6, 8}  # 예: "2024" 또는 "202401", "20240101' 같은 형식
    name_parts = []
    survey_date = None
    for part in parts:
        if part.isdigit() and len(part) in allowed_lengths:
            survey_date = part
        else:
            name_parts.append(part)

    # 조사날짜가 없으면 기본값 사용
    if survey_date is None:
        survey_date = "YYMMDD"
    # 파일명에서 추출한 데이터명칭 (없으면 기본값 "데이터명칭")
    data_name_extracted = "_".join(name_parts) if name_parts else "데이터명칭"

    # CSV 파일 읽기 (UTF-8 시도, 실패 시 cp949 사용)
    try:
        df_raw = pd.read_csv(filepath, header=None, low_memory=False)
    except UnicodeDecodeError:
        df_raw = pd.read_csv(filepath, header=None, encoding='cp949', low_memory=False)

    # ---------------------------------
    # 헤더 판별: headers.json에 저장된 예상 헤더와 비교하여 전치 여부 결정
    # ---------------------------------
    # headers.json에 등록된 예상 헤더가 있다면
    expected_header = standard_headers.get(data_name_extracted)

    # CSV의 첫 행과 첫 열 추출
    first_row = [str(v).strip() for v in df_raw.iloc[0].tolist()]
    first_col = [str(v).strip() for v in df_raw.iloc[:, 0].tolist()]

    # 만약 예상 헤더가 등록되어 있다면, 첫 행과 첫 열을 비교하여 전치 여부를 결정함
    if expected_header is not None:
        # 첫 행이 예상 헤더와 다르면서, 첫 열이 예상 헤더와 일치하면 파일이 전치된 것으로 판단
        if first_row != expected_header and first_col == expected_header:
            df_raw = df_raw.transpose()

    # 전치 후(또는 전치하지 않은 상태) 첫 행을 헤더로 사용
    header = df_raw.iloc[0].tolist()

    # ---------------------------------
    # 데이터 명칭 재결정 및 새로운 헤더 등록
    # ---------------------------------
    header_found = False
    # JSON에 이미 등록된 헤더와 비교하여 일치하는 것이 있으면, JSON에 등록된 데이터명칭으로 덮어씀
    for std_data_name, std_header in standard_headers.items():
        if str(header).strip() == str(std_header).strip():
            data_name_extracted = std_data_name
            header_found = True
            break

    # 만약 JSON에 등록된 헤더와 일치하는 항목이 없다면, 현재 파일의 헤더를 새로 등록
    if not header_found:
        standard_headers[data_name_extracted] = header
        print(f"Registered new header for {data_name_extracted}: {header}")

    # -----------------------------
    # 새 CSV 파일 생성 (OUTPUT_DIR에 저장)
    # -----------------------------
    new_filename = f"{data_name_extracted}_{survey_date}_{TODAY}{ext}"
    new_file_path = os.path.join(OUTPUT_DIR, new_filename)

    # DataFrame 생성: 첫 행은 헤더, 나머지 행은 데이터
    df = df_raw[1:].copy()
    df.columns = header
    df.to_csv(new_file_path, index=False, encoding="utf-8-sig")
    print(f"Processed: '{filepath}' -> '{new_file_path}'")


# -----------------------------
# 3) SOURCE_DIR 내 모든 CSV 파일 처리
# -----------------------------
for file in os.listdir(SOURCE_DIR):
    if file.endswith(".csv"):
        full_path = os.path.join(SOURCE_DIR, file)
        process_csv_file(full_path)

# -----------------------------
# 4) headers.json 업데이트 (새로운 헤더 정보 저장)
# -----------------------------
with open(HEADERS_FILE, 'w', encoding='utf-8') as f:
    json.dump(standard_headers, f, ensure_ascii=False, indent=4)


# -----------------------------
# 현재 문제
# 데이터 명칭이 없을 경우 표준 헤더를 비교하여 데이터 명칭 재부여
# 조사날짜 없을 경우 파일 작성일을 기반으로 조사날짜 부여
# 표준 헤더 등록 시 데이터 명칭, 헤더가 오류 날 경우 대응 불가
# (예: 인구조사보다 먼저 같은 헤더를 가지고 안구조사라 입력 시, 이후 데이터 명칭이 안구조사를 따라감)
# (예: 안구조사와 인구조사가 같은 데이터를 조사했으나 둘의 헤더가 행렬이 다를 경우 별개의 데이터 명칭으로 인식)
# (예: 인구조사: ['연령별', '남', '여'], 안구조사: ['연령별', '20대', '30대', '40대'])
# 데이터 조사날짜가 중복일 경우 어떻게 처리해야할지 방안 X)
# -----------------------------