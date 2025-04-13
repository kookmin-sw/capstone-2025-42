import os
import json
import subprocess
from datetime import datetime
from PIL import Image
from transformers import BlipProcessor, BlipForConditionalGeneration
from ultralytics import YOLO


# 🔹 exiftool을 이용한 이미지 메타데이터 추출
def get_metadata(image_file):
    result = subprocess.run(
        ["exiftool", image_file],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
    )

    metadata = {
        "filename": os.path.basename(image_file),
        "description": "",
        "location": "",
        "datetime": "",
        "uuid": os.path.splitext(os.path.basename(image_file))[0],
    }

    for line in result.stdout.splitlines():
        if "Date/Time Original" in line:
            metadata["datetime"] = line.split(":", 1)[1].strip()
        elif "GPS Position" in line:
            metadata["location"] = line.split(":", 1)[1].strip()
        elif "Image Description" in line:
            metadata["description"] = line.split(":", 1)[1].strip()

    if not metadata["datetime"]:
        metadata["datetime"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    return metadata


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
    model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
    return processor, model


# 🔹 통합 전처리 함수
def process_image(image_file, processor, blip_model, yolo_model):
    metadata = get_metadata(image_file)
    metadata["file_name"] = os.path.basename(image_file)  # ✅ 요 줄을 추가

    caption = generate_caption(image_file, processor, blip_model)
    labels = detect_objects(image_file, yolo_model)

    text = f"이 이미지에는 {', '.join(labels)} 등이 있으며, 설명은 다음과 같습니다: {caption}"

    return {
        "meta": metadata,
        "text": text
    }