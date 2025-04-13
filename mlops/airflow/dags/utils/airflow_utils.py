import magic
import zipfile
import json


def make_json_meta_file(data, meta, file_type):
    json_data = {}
    with open(meta) as f:
        json_data = json.load(f)

    find_key = ["createdate", "gpslatitude", "gpslongitude"]
    data["text"] += " "
    data["text"] += json_data["description"]
    if "createdate" in data["metadata"]:
        json_data["datetime"] = data["metadata"]["createdate"]
    else:
        json_data["datetime"] = ""
    if ("gpslatitude" in data["metadata"]) and ("gpslongitude" in data["metadata"]):
        json_data["location"] = (
            f'{data["metadata"]["gpslatitude"]|data["metadata"]["gpslongitude"]}'
        )
    else:
        json_data["location"] = ""
    json_data["file_type"] = file_type
    json_data["text"] = data["text"]
    
    return json_data


def is_hwp(filepath):
    with open(filepath, "rb") as f:
        header = f.read(8)
        return header == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"


def is_pdf(filepath):
    with open(filepath, "rb") as f:
        header = f.read(5)
        return header == b"%PDF-"


def get_file_type_by_magic(filepath):
    mime = magic.Magic(mime=True)
    mime_type = mime.from_file(filepath)
    if mime_type == "application/zip":
        try:
            with zipfile.ZipFile(filepath, "r") as zipf:
                names = zipf.namelist()
                if "word/document.xml" in names:
                    return "text"
                elif "xl/workbook.xml" in names:
                    return "excel"
                elif "ppt/presentation.xml" in names:
                    return "text"
        except:
            pass
    elif (
        mime_type
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ):
        try:
            with zipfile.ZipFile(filepath, "r") as zipf:
                names = zipf.namelist()
                if "word/document.xml" in names:
                    return "text"
        except:
            pass
    elif mime_type.startswith("image/"):
        return "image"
    elif mime_type.startswith("video/"):
        return "video"
    elif mime_type.startswith("audio/"):
        return "audio"
    elif mime_type == "text/plain":
        return "text"
    elif mime_type in [
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]:
        return "excel"
    elif is_hwp(filepath):
        return "text"
    elif is_pdf(filepath):
        return "text"
    else:
        return f"unknown ({mime_type})"
