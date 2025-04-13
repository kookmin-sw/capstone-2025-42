import xml.etree.ElementTree as ET
import docx
import fitz  # PyMuPDF: PDF 텍스트 추출용
import logging
import magic
import zipfile
from pptx import Presentation
import olefile
import subprocess
import re
import os
import datetime
from pathlib import Path
import PyPDF2


logging.basicConfig(level=logging.INFO)


def to_iso_str(dt):
    """datetime 또는 문자열을 ISO 8601 문자열로 변환"""
    if isinstance(dt, datetime.datetime):
        return dt.strftime("%Y-%m-%dT%H:%M:%S")
    elif isinstance(dt, str):
        dt = dt.replace("D:", "").strip()
        try:
            parsed = datetime.datetime.strptime(dt[:14], "%Y%m%d%H%M%S")
            return parsed.strftime("%Y-%m-%dT%H:%M:%S")
        except:
            return ""
    return ""


def get_ole_created_date(path):
    try:
        if not olefile.isOleFile(path):
            return ""
        ole = olefile.OleFileIO(path)
        if ole.exists("\x05SummaryInformation"):
            props = ole.getproperties("\x05SummaryInformation")
            created = props.get(12)  # PIDSI_CREATE_DTM
            return to_iso_str(created)
    except:
        pass
    return ""


def get_office_openxml_created_date(path):
    try:
        with zipfile.ZipFile(path, "r") as z:
            core_xml = z.read("docProps/core.xml")
            root = ET.fromstring(core_xml)
            ns = {"dcterms": "http://purl.org/dc/terms"}
            created = root.find("dcterms:created", ns)
            if created is not None:
                return to_iso_str(created.text)
    except:
        return ""
    return ""


def get_hwpx_created_date(path):
    try:
        with zipfile.ZipFile(path, "r") as z:
            for name in z.namelist():
                if "FileHeader.xml" in name:
                    content = z.read(name)
                    tree = ET.fromstring(content)
                    for elem in tree.iter():
                        if "dateCreated" in elem.attrib:
                            return to_iso_str(elem.attrib["dateCreated"])
    except:
        pass
    return ""


def get_pdf_created_date(path):
    try:
        with open(path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            info = reader.metadata
            return to_iso_str(info.get("/CreationDate"))
    except:
        return ""


def get_file_ctime_created_date(path):
    try:
        ts = os.path.getctime(path)
        return to_iso_str(datetime.datetime.fromtimestamp(ts))
    except:
        return ""


def extract_ppt(filepath):
    if not olefile.isOleFile(filepath):
        return ""

    ole = olefile.OleFileIO(filepath)
    if not ole.exists("PowerPoint Document"):
        return ""

    try:
        with ole.openstream("PowerPoint Document") as stream:
            data = stream.read()

            # 한글/영문 UTF-16LE만 추출
            matches = re.findall(
                rb"((?:[A-Za-z]\x00|[\x00-\xff][\xac-\xd7]){2,})", data
            )

            results = []
            for m in matches:
                try:
                    decoded = m.decode("utf-16le").strip()
                    results.append(decoded)
                except:
                    continue

            return "\n".join(results)

    except Exception as e:
        return f"[Error] {e}"


def extract_doc(filepath):
    try:
        output = subprocess.check_output(["antiword", filepath], text=True)
        return output
    except:
        return ""
    return ""


def extract_hwp(filepath):
    if not olefile.isOleFile(filepath):
        return ""

    ole = olefile.OleFileIO(filepath)
    text = ""

    for entry in ole.listdir():
        name = "/".join(entry)
        if name.startswith("BodyText"):
            try:
                with ole.openstream(name) as stream:
                    data = stream.read()

                    # 한글/영문 UTF-16LE만 추출
                    matches = re.findall(
                        rb"((?:[A-Za-z]\x00|[\x00-\xff][\xac-\xd7]){2,})", data
                    )

                    results = []
                    for m in matches:
                        try:
                            decoded = m.decode("utf-16le").strip()
                            results.append(decoded)
                        except:
                            continue
                    return "\n".join(results)
            except Exception as e:
                print(f"[⚠️] {name}: {e}")
    return text


# HWPX 문서에서 텍스트 추출
def extract_hwpx(path):
    texts = []
    with zipfile.ZipFile(path, "r") as z:
        for name in z.namelist():
            if name.startswith("Contents/section") and name.endswith(".xml"):
                content = z.read(name)
                root = ET.fromstring(content)
                for t_elem in root.iter():
                    if t_elem.tag.endswith("t") and t_elem.text:
                        try:
                            # 이스케이프된 한글 바이트인 경우 decode 시도
                            decoded = bytes(t_elem.text, "latin1").decode("utf-8")
                            texts.append(decoded)
                        except:
                            texts.append(t_elem.text.strip())
    return " ".join(texts)


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
        return " ".join(texts)
    except Exception as e:
        logging.warning(f"DOCX 처리 중 오류: {e}")
        return ""


# PDF 문서에서 텍스트 추출
def extract_pdf(path):
    try:
        doc = fitz.open(path)
        texts = []
        for page in doc:
            page_text = page.get_text("text")
            lines = [line.strip() for line in page_text.splitlines() if line.strip()]
            texts.extend(lines)
        return " ".join(texts)
    except Exception as e:
        logging.warning(f"PDF 처리 중 오류: {e}")
        return ""


def extract_pptx(filepath):
    prs = Presentation(filepath)
    all_texts = []

    for slide in prs.slides:
        for shape in slide.shapes:
            if shape.has_text_frame:
                # 일반 텍스트
                all_texts.append(shape.text.strip())
            elif shape.shape_type == 19:  # 표(table)
                table = shape.table
                for row in table.rows:
                    for cell in row.cells:
                        if cell.text.strip():
                            all_texts.append(cell.text.strip())

    # 모든 텍스트를 스페이스로 연결해서 한 줄로 저장
    flat_line = " ".join(all_texts)
    return flat_line


# 파일 확장자에 따라 적절한 추출 함수 선택
def process_text(filepath):
    mime = magic.Magic(mime=True)
    mime_type = mime.from_file(filepath)
    ext = ""
    if olefile.isOleFile(filepath):
        try:
            ole = olefile.OleFileIO(filepath)
            streams = ole.listdir()
            stream_names = [".".join(s) for s in streams]
            if any("PowerPoint Document" in s for s in stream_names):
                ext = "ppt"
            elif any("WordDocument" in s for s in stream_names):
                ext = "doc"
            elif any(
                s in stream_names for s in ["BodyText", "FileHeader", "HwpSummary"]
            ):
                ext = "hwp"
        except:
            pass
    elif mime_type == "application/zip":
        try:
            with zipfile.ZipFile(filepath, "r") as zipf:
                names = [name.replace("\\", "/") for name in zipf.namelist()]
                if any(name.endswith("word/document.xml") for name in names):
                    ext = "docx"
                elif any(name.endswith("ppt/presentation.xml") for name in names):
                    ext = "pptx"
        except:
            pass
    elif (
        mime_type
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ):
        try:
            with zipfile.ZipFile(filepath, "r") as zipf:
                names = [name.replace("\\", "/") for name in zipf.namelist()]
                if any(name.endswith("word/document.xml") for name in names):
                    ext = "docx"
        except:
            pass
    elif (
        mime_type
        == "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ):
        try:
            with zipfile.ZipFile(filepath, "r") as zipf:
                names = [name.replace("\\", "/") for name in zipf.namelist()]
                if any(name.endswith("ppt/presentation.xml") for name in names):
                    ext = "pptx"
        except:
            pass
    try:
        with zipfile.ZipFile(filepath, "r") as zipf:
            names = zipf.namelist()
            if any(name.startswith("Contents/") for name in names):
                ext = "hwpx"
    except:
        pass

    with open(filepath, "rb") as f:
        header = f.read(5)
        if header == b"%PDF-":
            ext = "pdf"

    text_extractor = {
        "hwp": extract_hwp,
        "doc": extract_doc,
        "ppt": extract_ppt,
        "hwpx": extract_hwpx,
        "docx": extract_docx,
        "pptx": extract_pptx,
        "pdf": extract_pdf,
    }.get(ext)

    meta_extractor = {
        "hwp": get_file_ctime_created_date,
        "doc": get_ole_created_date,
        "ppt": get_ole_created_date,
        "hwpx": get_hwpx_created_date,
        "docx": get_office_openxml_created_date,
        "pptx": get_office_openxml_created_date,
        "pdf": get_pdf_created_date,
    }.get(ext)

    if text_extractor and meta_extractor:
        return {
            "metadata": {"createdate": meta_extractor(filepath)},
            "text": text_extractor(filepath),
        }
    else:
        return {"metadata": {"createdate": ""}, "text": ""}
