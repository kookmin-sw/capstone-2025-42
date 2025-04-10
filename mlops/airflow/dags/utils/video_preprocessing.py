import whisper
import subprocess
import os
import json
import shutil
from pathlib import Path


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


# Whisper를 사용하여 오디오를 텍스트로 변환
def transcribe_audio(audio_path, model):
    result = model.transcribe(audio_path)
    return result["text"]


# 전체 영상 처리 함수
def process_video(video_file, model):
    metadata = get_metadata(video_file)
    if metadata is None:
        print("Failed to extract metadata")
        return None

    audio_file = extract_audio(video_file)
    if audio_file is None:
        print("Failed to extract audio")
        return None

    audio_text = transcribe_audio(audio_file, model)

    # 리소스 정리
    try:
        os.remove(audio_file)
    except FileNotFoundError:
        pass

    try:
        shutil.rmtree("frames")  # 필요하다면 예외 처리
    except FileNotFoundError:
        pass

    return {"metadata": metadata, "text": audio_text}


if __name__ == "__main__":
    model = whisper.load_model("base")
    video_file = "test.mp4"
    result = process_video(video_file, model)
    if result:
        print(result["metadata"])
        print(result["text"])
