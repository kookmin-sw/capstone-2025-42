import os
import json
import subprocess
from datetime import datetime
from PIL import Image
from transformers import BlipProcessor, BlipForConditionalGeneration
from ultralytics import YOLO
import argostranslate.package
from argostranslate.translate import translate


# 영상에서 메타데이터 추출 (Exiftool 사용)
def get_metadata(filepath):
    cmd = ["exiftool", "-j", filepath]
    result = subprocess.run(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )

    if result.returncode != 0:
        print("Error getting metadata:", result.stderr)
        return None

    find_key = ["createdate", "gpslatitude", "gpslongitude"]
    metadata = json.loads(result.stdout)[0]
    text_metadata = {}
    for key, value in metadata.items():
        for find in find_key:
            if (find in key.lower()) and (
                (
                    (find == find_key[0])
                    and (
                        ((find in text_metadata) and (text_metadata[find] < value))
                        or (not (find in text_metadata))
                    )
                )
                or (find != find_key[0])
            ):
                text_metadata[find] = value
                break
    return text_metadata


# 🔹 BLIP 설명 생성
def generate_caption(image_path, processor, model):
    image = Image.open(image_path).convert("RGB")
    inputs = processor(image, return_tensors="pt").to("cpu")
    out = model.generate(**inputs)
    return processor.decode(out[0], skip_special_tokens=True)


# 🔹 YOLO 객체 탐지 결과 추출
def detect_objects(image_path, model):
    results = model(image_path)
    labels = results[0].boxes.cls.cpu().tolist()
    names = results[0].names
    return list(set([names[int(idx)] for idx in labels]))


# 🔹 모델 로딩 함수
def load_yolo_model():
    return YOLO("yolov8n.pt")


def load_blip_model():
    processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
    blip_model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
    return processor, blip_model


def contains_english(text):
    return any("a" <= c.lower() <= "z" for c in text)


def get_en_kr_model():
    available_packages = argostranslate.package.get_available_packages()

    package_to_install = list(
        filter(lambda x: x.from_code == "en" and x.to_code == "ko", available_packages)
    )[0]

    download_path = package_to_install.download()
    argostranslate.package.install_from_path(download_path)


# 🔹 통합 전처리 함수
def process_image(image_file):
    get_en_kr_model()
    processor, blip_model = load_blip_model()
    yolo_model = load_yolo_model()

    metadata = get_metadata(image_file)

    caption = generate_caption(image_file, processor, blip_model)
    caption = translate(caption, "en", "ko")
    words = caption.split(" ")
    kor_words = []
    for j in range(len(words)):
        if not contains_english(words[j]):
            kor_words.append(words[j])
    caption = " ".join(kor_words)
    labels = detect_objects(image_file, yolo_model)

    text = f"이 이미지에는 {', '.join(labels)} 등이 있으며, 설명은 다음과 같습니다: {caption}"

    return {
        "metadata": metadata,
        "text": text
    }
