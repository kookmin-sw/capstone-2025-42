from faster_whisper import WhisperModel
import subprocess
import os
import json
import shutil
from pathlib import Path
import cv2
import numpy as np
from transformers import BlipProcessor, BlipForConditionalGeneration
import argostranslate.package
import argostranslate.translate
from argostranslate.translate import translate
from PIL import Image


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


# 영상에서 오디오 추출 (FFmpeg 사용)
def extract_audio(video_path, audio_path=None):
    if audio_path is None:
        audio_path = f"{Path(video_path).stem}_audio.wav"

    command = ["ffmpeg", "-i", video_path, "-q:a", "0", "-map", "a", audio_path, "-y"]
    result = subprocess.run(
        command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )

    if result.returncode != 0:
        print("Error extracting audio:", result.stderr)
        return None

    return audio_path


def get_whisper_model():
    return WhisperModel("base", device="cpu", compute_type="int8")


# Whisper를 사용하여 오디오를 텍스트로 변환
def transcribe_audio(audio_path):
    model = get_whisper_model()
    segments, result = model.transcribe(audio_path)
    text = ""
    for segment in segments:
        text += f"{segment.text} "
    return text

def contains_english(text):
    return any("a" <= c.lower() <= "z" for c in text)


def get_en_kr_model():
    available_packages = argostranslate.package.get_available_packages()

    package_to_install = list(
        filter(lambda x: x.from_code == "en" and x.to_code == "ko", available_packages)
    )[0]

    download_path = package_to_install.download()
    argostranslate.package.install_from_path(download_path)


# 영상 프레임 추출 (1초당 1프레임)
def extract_frames(video_path, output_folder="frames", frame_rate=0.2):
    os.makedirs(output_folder, exist_ok=True)
    command = [
        "ffmpeg",
        "-i",
        video_path,
        "-vf",
        f"fps={frame_rate}",
        f"{output_folder}/frame_%04d.png",
        "-y",
    ]
    subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


# BLIP 이미지 설명 생성
def generate_caption(image_path, processor, model):
    image = Image.open(image_path).convert("RGB")
    inputs = processor(images=image, return_tensors="pt")
    output = model.generate(**inputs)
    return processor.decode(output[0], skip_special_tokens=True)


def get_blip_model():
    processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
    video_model = BlipForConditionalGeneration.from_pretrained(
        "Salesforce/blip-image-captioning-base"
    )
    return processor, video_model


def make_text_display_in_video(frame_folder="frames"):
    text = []

    processor, model = get_blip_model()
    get_en_kr_model()

    for i in range(1, 1000):
        frame_path = f"{frame_folder}/frame_{i:04d}.png"
        try:
            caption = generate_caption(frame_path, processor, model)
            caption = translate(caption, "en", "ko")
            words = caption.split(" ")
            kor_words = []
            for j in range(len(words)):
                if not contains_english(words[j]):
                    kor_words.append(words[j])
            caption = " ".join(kor_words)
            text.append(caption)
        except FileNotFoundError:
            break

    return " ".join(text)


# 전체 영상 처리 함수
def process_video(video_file):
    print("get_metadata")
    metadata = get_metadata(video_file)
    if metadata is None:
        print("Failed to extract metadata")
        return None

    print("extract_audio")
    audio_file = extract_audio(video_file)
    if audio_file is None:
        print("Failed to extract audio")
        return None

    print("transcribe_audio")
    audio_text = transcribe_audio(audio_file)

    print("get frames")
    extract_frames(video_file)

    print("make frame description")
    display_text = make_text_display_in_video("frames")

    real_text = f"{audio_text} {display_text}"

    # 리소스 정리
    try:
        os.remove(audio_file)
    except FileNotFoundError:
        pass

    try:
        shutil.rmtree("frames")  # 필요하다면 예외 처리
    except FileNotFoundError:
        pass

    return {"metadata": metadata, "text": real_text}
