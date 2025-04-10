import xml.etree.ElementTree as ET
import docx
import fitz  # PyMuPDF: PDF 텍스트 추출용
import pandas as pd
from collections import defaultdict
from konlpy.tag import Okt
from sklearn.feature_extraction.text import TfidfVectorizer
import logging

logging.basicConfig(level=logging.INFO)
okt = Okt()  # Okt 형태소 분석기 초기화


# HWPX 문서에서 텍스트 추출
def extract_hwpx(path):
    try:
        tree = ET.parse(path)
        return [elem.text.strip() for elem in tree.iter("t") if elem.text]
    except Exception as e:
        logging.warning(f"HWPX 처리 중 오류: {e}")
        return []


# DOCX 문서에서 텍스트 추출
def extract_docx(path):
    try:
        doc = docx.Document(path)
        texts = [para.text.strip() for para in doc.paragraphs if para.text.strip()]
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    text = cell.text.strip()
                    if text:
                        texts.append(text)
        return texts
    except Exception as e:
        logging.warning(f"DOCX 처리 중 오류: {e}")
        return []


# PDF 문서에서 텍스트 추출
def extract_pdf(path):
    try:
        doc = fitz.open(path)
        texts = []
        for page in doc:
            page_text = page.get_text("text")
            lines = [line.strip() for line in page_text.splitlines() if line.strip()]
            texts.extend(lines)
        return texts
    except Exception as e:
        logging.warning(f"PDF 처리 중 오류: {e}")
        return []


# 파일 확장자에 따라 적절한 추출 함수 선택
def extract_texts(path):
    ext = path.lower().split(".")[-1]
    extractor = {
        "hwpx": extract_hwpx,
        "docx": extract_docx,
        "pdf": extract_pdf,
    }.get(ext)

    if extractor:
        return extractor(path)
    raise ValueError(f"지원되지 않는 파일 형식: {ext}")


# 단어에서 초성 추출
def get_initial_consonant(word):
    if word and "가" <= word[0] <= "힣":
        cho_idx = (ord(word[0]) - ord("가")) // 588
        chosung_list = [
            "ㄱ",
            "ㄲ",
            "ㄴ",
            "ㄷ",
            "ㄸ",
            "ㄹ",
            "ㅁ",
            "ㅂ",
            "ㅃ",
            "ㅅ",
            "ㅆ",
            "ㅇ",
            "ㅈ",
            "ㅉ",
            "ㅊ",
            "ㅋ",
            "ㅌ",
            "ㅍ",
            "ㅎ",
        ]
        return chosung_list[cho_idx]
    return "기타"


# 텍스트 리스트에서 상위 키워드를 추출하고 초성 기준으로 그룹화
def process_keywords(text_list, top_k=15):
    # 각 문장에서 명사 추출 후 하나의 문서로 만듦
    documents = [" ".join(okt.nouns(text)) for text in text_list if text.strip()]
    if not documents:
        return pd.DataFrame({"Proper Nouns": {}})

    # TF-IDF 벡터화
    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform(documents)
    scores = tfidf_matrix.mean(axis=0).A1
    word_scores = dict(zip(vectorizer.get_feature_names_out(), scores))

    # 점수 기준 상위 K개 키워드 추출
    top_keywords = sorted(word_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
    # 초성 기준 그룹핑
    grouped = defaultdict(list)
    for word, _ in top_keywords:
        grouped[get_initial_consonant(word)].append(word)

    # DataFrame 반환 (초성 기준 정렬)
    return pd.DataFrame(
        {"Proper Nouns": {k: ", ".join(sorted(v)) for k, v in grouped.items()}}
    ).sort_index()
