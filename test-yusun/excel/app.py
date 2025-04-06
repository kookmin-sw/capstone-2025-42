import os
import uuid
from flask import Flask, request, render_template_string, send_file
import pandas as pd
from fuzzywuzzy import fuzz
from io import BytesIO
from collections import defaultdict
from sentence_transformers import SentenceTransformer, util

semantic_model = SentenceTransformer('intfloat/multilingual-e5-base')
app = Flask(__name__)
app.config['SECRET_KEY'] = "SOME_SECRET_KEY"

# ------------------------------------------------------------------------------
# 전역 임시 저장소 (실무에선 DB나 세션, Redis 등에 저장 권장)
# key: uuid, value: { "df": DataFrame, "key_threshold": int, "value_threshold": int }
# ------------------------------------------------------------------------------
temp_storage = {}


# ===============================
# 1) HTML 템플릿들
# ===============================

index_template = """
<!DOCTYPE html>
<html>
<head>
    <title>엑셀 합치기</title>
</head>
<body>
    <h1>엑셀 합치기 - (컬럼/키/값 유사도 병합)</h1>
    <form method="POST" action="/upload" enctype="multipart/form-data" id="upload-form">
        <label>엑셀 파일들 선택:</label><br/>
        <input type="file" id="file-input" name="files" multiple required><br/><br/>

        <div id="orientation-options"></div>

        <label>컬럼 유사도 기준(0~100):</label><br/>
        <input type="number" name="column_similarity_threshold" value="80" min="0" max="100"/><br/><br/>

        <label>키 유사도 기준(0~100):</label><br/>
        <input type="number" name="key_similarity_threshold" value="80" min="0" max="100"/><br/><br/>

        <label>값 유사도 기준(0~100):</label><br/>
        <input type="number" name="value_similarity_threshold" value="80" min="0" max="100"/><br/><br/>

        <input type="submit" value="업로드 & 통합"/>
    </form>
</body>
<script>
document.getElementById("file-input").addEventListener("change", function(event) {
    const container = document.getElementById("orientation-options");
    container.innerHTML = ""; // 초기화

    Array.from(event.target.files).forEach((file, idx) => {
        const id = `orientation-${idx}`;
        container.innerHTML += `
            <div style="margin-top: 10px">
                <strong>${file.name}</strong><br/>
                <input type="radio" name="orientation-${idx}" value="vertical" checked> 세로
                <input type="radio" name="orientation-${idx}" value="horizontal"> 가로
            </div>
        `;
    });
});
</script>
</html>
"""

choose_key_template = """
<!DOCTYPE html>
<html>
<head>
    <title>키 컬럼 선택</title>
</head>
<body>
    <h1>키 후보 중에서 선택</h1>
    {% if not unique_candidates %}
        <p><strong>컬럼 후보가 없습니다.</strong></p>
        <p>키 없이 그냥 통합 결과를 다운로드하시려면 아래 버튼을 누르세요.</p>
        <form action="{{ url_for('download_result') }}" method="GET">
            <input type="hidden" name="session_id" value="{{ session_id }}">
            <button type="submit">결과 다운로드</button>
        </form>
    {% else %}
        <form method="POST" action="{{ url_for('select_key') }}">
            <input type="hidden" name="session_id" value="{{ session_id }}">
        {% for cand in unique_candidates %}
            <input type="radio" name="key_col" value="{{ cand.column }}" required>
                {{ cand.column }} (고유값: {{ cand.unique }} / 전체: {{ cand.total }} → {{ (cand.ratio)|round(1) }}%)
            <br/>
        {% endfor %}
            <input type="submit" value="이 컬럼으로 병합 진행하기"/>
        </form>
    {% endif %}
    <hr/>
    <p>{{ message }}</p>
</body>
</html>
"""


def key_similarity(a, b):
    """키용: 문자열 기반 유사도"""
    if not a or not b:
        return 0
    return fuzz.ratio(str(a).strip(), str(b).strip())


def combined_similarity(a, b):
    """fuzz + 의미 유사도 중 max 사용"""
    if not a or not b:
        return 0
    a, b = str(a).strip(), str(b).strip()

    # 2. semantic similarity
    emb1 = semantic_model.encode(a, convert_to_tensor=True)
    emb2 = semantic_model.encode(b, convert_to_tensor=True)
    sem_score = util.cos_sim(emb1, emb2).item() * 100

    return sem_score


# ===============================
# 2) 유틸 함수: 컬럼 유사도 통합
# ===============================
def unify_columns(all_dfs, similarity_threshold=90):
    """
    의미 기반 유사도 + 그룹 평균 유사도 기준으로 컬럼명을 그룹핑 후 대표 컬럼 매핑을 반환.
    """
    from itertools import combinations
    from collections import defaultdict
#
    # 1. 모든 컬럼 수집
    col_set = set()
    for df in all_dfs:
        df.columns = df.columns.map(str)
        col_set.update(df.columns.tolist())
    col_list = list(col_set)

    # 2. 모든 쌍 유사도 계산
    pair_similarities = {}
    for a, b in combinations(col_list, 2):
        sim = combined_similarity(a, b)
        pair_similarities[frozenset([a, b])] = sim

    # 3. 그룹핑 (평균 유사도 기준)
    groups = []

    def avg_similarity_to_group(col, group):
        sims = [pair_similarities.get(frozenset([col, g]), combined_similarity(col, g)) for g in group]
        return sum(sims) / len(sims)

    for col in col_list:
        added = False
        for group in groups:
            avg_sim = avg_similarity_to_group(col, group)
            if avg_sim >= similarity_threshold:
                group.append(col)
                added = True
                break
        if not added:
            groups.append([col])

    # 4. 대표 컬럼 결정 (그룹 내에서 다른 컬럼들과 유사도 총합 가장 높은 것)
    final_mapping = {}
    for group in groups:
        if len(group) == 1:
            rep = group[0]
        else:
            max_score = -1
            rep = group[0]
            for cand in group:
                score = sum(combined_similarity(cand, other) for other in group if cand != other)
                if score > max_score:
                    max_score = score
                    rep = cand
        for col in group:
            final_mapping[col] = rep

    print("평균 유사도 기반 컬럼 매핑 결과:", final_mapping)
    return final_mapping


def find_unique_column_candidates_verbose(df, unique_ratio_threshold=40):
    """
    고유 비율과 함께 컬럼 후보를 반환
    """
    candidates = []
    for col in df.columns:
        values = df[col].dropna().astype(str).str.strip()
        values = values[values != ""]
        total = len(values)
        if total == 0:
            continue
        unique = values.nunique()
        ratio = (unique / total) * 100
        if ratio >= unique_ratio_threshold:
            candidates.append({
                "column": col,
                "unique": unique,
                "total": total,
                "ratio": ratio
            })
    return candidates


def fuzzy_merge_values(values, threshold=80):
    """
    여러 값 리스트에서 유사도가 threshold 이상이면 하나의 클러스터로 묶고,
    각 클러스터 대표값(첫 번째)만 ','로 연결해 반환.
    """
    from fuzzywuzzy import fuzz
    import pandas as pd

    # NaN, 빈 문자열, 'nan' 등 제외
    filtered = [
        str(v).strip()
        for v in values
        if pd.notna(v) and str(v).strip() != '' and str(v).lower() != 'nan'
    ]

    clusters = []
    for val in filtered:
        placed = False
        for cluster in clusters:
            rep = cluster[0]
            similarity = combined_similarity(val.lower(), rep.lower())
            if similarity >= threshold:
                cluster.append(val)
                placed = True
                break
        if not placed:
            clusters.append([val])

    # 각 클러스터의 대표값은 첫 번째
    if not clusters:
        return ""
    reps = []
    for cluster in clusters:
        longest = max(cluster, key=len)
        reps.append(longest)
    return ",".join(reps)


def unify_same_named_columns(df, use_fuzzy=True, value_threshold=80):
    """
    같은 이름의 컬럼들에 대해 한 컬럼으로 합치는 함수.
    - row 단위로, 여러 컬럼에 들어있는 데이터를 합쳐서 하나의 문자열로 만든다.
    - use_fuzzy=True 이면, fuzzy_merge_values로 유사 값까지 묶는다.
    """
    import pandas as pd
    from collections import defaultdict

    col_names = df.columns
    name_to_indices = defaultdict(list)

    # 1) 동일 컬럼명에 해당하는 인덱스들 수집
    for i, c in enumerate(col_names):
        name_to_indices[c].append(i)

    new_data = {}
    # 2) 같은 컬럼명 그룹 단위로 row 병합
    for col_name, idx_list in name_to_indices.items():
        if len(idx_list) == 1:
            # 해당 이름의 컬럼이 1개뿐이면 그대로 사용
            new_data[col_name] = df.iloc[:, idx_list[0]].tolist()
        else:
            # 여러 컬럼이 같은 이름 -> row별로 통합
            merged_col = []
            n_rows = len(df)
            for row_idx in range(n_rows):
                row_vals = []
                for col_idx in idx_list:
                    val = df.iloc[row_idx, col_idx]
                    row_vals.append(val)
                if use_fuzzy:
                    # fuzzy 방식으로 유사도 병합
                    merged_str = fuzzy_merge_values(row_vals, threshold=value_threshold)
                else:
                    # 기존 방식(단순 중복 제거 -> ',' 연결)
                    # 중복 제거
                    filtered = [
                        str(x).strip()
                        for x in row_vals
                        if pd.notna(x) and str(x).strip() != '' and str(x).lower() != 'nan'
                    ]
                    filtered = list(set(filtered))
                    merged_str = ",".join(filtered) if filtered else ""
                merged_col.append(merged_str)
            new_data[col_name] = merged_col

    unified_df = pd.DataFrame(new_data)
    return unified_df


# ===============================
# 6) 유틸 함수: 키(식별자) 유사도 통합 + groupby
# ===============================
def fuzzy_cluster_key_and_merge(df, key_col, key_threshold=90, value_threshold=80):
    """
    (A) 키 컬럼을 fuzzy 클러스터링 → 대표 키로 치환
    (B) 대표 키로 groupby
    (C) 그룹 내 다른 컬럼 값들도 fuzzy_merge_values로 통합
    """
    # 1) 키 컬럼 전처리
    original_keys = df[key_col].tolist()

    # 키 유사도 클러스터링
    key_clusters = []
    for k in original_keys:
        placed = False
        if pd.isna(k) or str(k).strip() == '' or str(k).lower() == 'nan':
            # NaN/빈키는 자기 자신으로 (별도 클러스터)
            key_clusters.append([k])
            continue
        for cluster in key_clusters:
            rep = cluster[0]
            if pd.isna(rep):
                similarity = 0
            else:
                similarity = key_similarity(str(k).lower(), str(rep).lower())
            if similarity >= key_threshold:
                cluster.append(k)
                placed = True
                break
        if not placed:
            key_clusters.append([k])

    # key_mapping = {원본키: 대표키}
    key_mapping = {}
    for cluster in key_clusters:
        rep_key = cluster[0]
        for c in cluster:
            key_mapping[c] = rep_key

    # df의 키 컬럼을 대표키로 치환
    df = df.copy()
    df[key_col] = df[key_col].apply(lambda x: key_mapping.get(x, x))

    # 2) 대표키로 groupby + 나머지 컬럼 병합
    grouped = df.groupby(key_col, dropna=False)
    merged_rows = []
    for group_key, sub_df in grouped:
        row_data = {}
        for col in df.columns:
            if col == key_col:
                row_data[col] = group_key
            else:
                col_values = sub_df[col].tolist()
                # 값 유사도 병합
                merged_val = fuzzy_merge_values(col_values, threshold=value_threshold)
                row_data[col] = merged_val
        merged_rows.append(row_data)

    final_df = pd.DataFrame(merged_rows)
    return final_df


# ===============================
# 7) Flask 라우트
# ===============================
@app.route('/')
def index():
    return render_template_string(index_template)

@app.route('/upload', methods=['POST'])
def upload_files():
    # 1) 폼 파라미터
    col_sim_threshold = int(request.form.get('column_similarity_threshold', 80))
    key_sim_threshold = int(request.form.get('key_similarity_threshold', 80))
    val_sim_threshold = int(request.form.get('value_similarity_threshold', 80))

    # 2) 파일 업로드
    uploaded_files = request.files.getlist("files")
    if not uploaded_files:
        return "파일이 업로드되지 않았습니다."

    dfs = []
    for idx, file in enumerate(uploaded_files):
        if file.filename == '':
            continue
        df = pd.read_excel(file, engine='openpyxl')

        # 파일마다 orientation 설정 가져오기
        orientation_key = f"orientation-{idx}"
        orientation = request.form.get(orientation_key, "vertical")

        if orientation == 'horizontal':
            df = df.transpose()
            df.columns = df.iloc[0]
            df = df.drop(df.index[0])
            df.reset_index(drop=True, inplace=True)

        dfs.append(df)

    if len(dfs) == 0:
        return "업로드된 엑셀이 없습니다."

    # 3) 컬럼 유사도에 따른 통합
    col_map = unify_columns(dfs, col_sim_threshold)
    normalized_dfs = []
    for df in dfs:
        df = df.rename(columns=col_map)
        normalized_dfs.append(df)

    # 4) concat
    combined_df = pd.concat(normalized_dfs, ignore_index=True)

    # 5) 동일한 컬럼명 통합
    combined_df = unify_same_named_columns(combined_df)

    # 6) 중복 없는 컬럼(키 후보) 찾기
    unique_candidates = find_unique_column_candidates_verbose(combined_df)

    # 7) 실제로 컬럼명 유사도 병합이 일어났는지 메시지
    groups_count = defaultdict(int)
    for orig_col, rep_col in col_map.items():
        groups_count[rep_col] += 1
    merged_column_exists = any(c > 1 for c in groups_count.values())
    if not merged_column_exists:
        message = "유사도가 낮아 컬럼 통합이 거의 일어나지 않았습니다."
    else:
        message = "일부 컬럼이 유사도로 통합되었습니다."

    # 8) 임시 저장
    session_id = str(uuid.uuid4())
    temp_storage[session_id] = {
        "df": combined_df,
        "key_threshold": key_sim_threshold,
        "value_threshold": val_sim_threshold
    }

    return render_template_string(
        choose_key_template,
        session_id=session_id,
        unique_candidates=unique_candidates,
        message=message
    )

@app.route('/select_key', methods=['POST'])
def select_key():
    session_id = request.form.get('session_id')
    key_col = request.form.get('key_col')

    if not session_id or session_id not in temp_storage:
        return "세션이 만료되었거나 잘못되었습니다. 다시 업로드해주세요."

    store = temp_storage[session_id]
    combined_df = store["df"]
    key_threshold = store["key_threshold"]
    value_threshold = store["value_threshold"]

    if not key_col or key_col not in combined_df.columns:
        return "유효한 키 컬럼이 없습니다."

    # (A) 키 유사도 클러스터 + (B) 값 유사도 병합
    final_df = fuzzy_cluster_key_and_merge(
        combined_df,
        key_col=key_col,
        key_threshold=key_threshold,
        value_threshold=value_threshold
    )

    # 결과를 엑셀 다운로드
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        final_df.to_excel(writer, index=False, sheet_name='MergedData')
    output.seek(0)

    # 임시 데이터 삭제
    del temp_storage[session_id]

    return send_file(
        output,
        as_attachment=True,
        download_name="merged_result_with_fuzzy_key.xlsx",
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )

@app.route('/download_result', methods=['GET'])
def download_result():
    """
    유니크 컬럼이 전혀 없어서 키를 못 고르는 경우 등 -> 키 없이 그냥 다운로드
    """
    session_id = request.args.get('session_id')
    if not session_id or session_id not in temp_storage:
        return "세션이 만료되었거나 잘못되었습니다."

    store = temp_storage[session_id]
    combined_df = store["df"]

    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        combined_df.to_excel(writer, index=False, sheet_name='MergedData')
    output.seek(0)

    # 임시 데이터 삭제
    del temp_storage[session_id]

    return send_file(
        output,
        as_attachment=True,
        download_name="merged_result_no_key.xlsx",
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )

# ===============================
# 실행
# ===============================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

