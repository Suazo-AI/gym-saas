from __future__ import annotations

import base64
import hashlib
import os
import time
from pathlib import Path
from typing import Any, Optional, Union

import cv2
import numpy as np
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


MODEL_CODE = os.getenv("FACE_MODEL_CODE", "opencv-sface-2021dec")
MODEL_VERSION = "2021dec"
MODEL_DIR = Path(os.getenv("FACE_MODEL_DIR", "models"))
YUNET_PATH = MODEL_DIR / "face_detection_yunet_2023mar.onnx"
SFACE_PATH = MODEL_DIR / "face_recognition_sface_2021dec.onnx"
YUNET_URL = "https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx"
SFACE_URL = "https://huggingface.co/opencv/face_recognition_sface/resolve/main/face_recognition_sface_2021dec.onnx"
YUNET_SHA256 = "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4"
SFACE_SHA256 = "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79"

app = FastAPI(title="FitManager Face Recognition")
_detector: Optional[Any] = None
_recognizer: Optional[Any] = None


class EmbedRequest(BaseModel):
  imageBase64: str = Field(min_length=32)


class EmbedResponse(BaseModel):
  embedding: list[float]
  faceCount: int
  qualityScore: float
  modelCode: str
  modelVersion: str
  processingMs: int


@app.get("/health")
def health() -> dict[str, Union[str, bool]]:
  return {
    "status": "ok",
    "model": MODEL_CODE,
    "modelVersion": MODEL_VERSION,
    "modelReady": model_file_is_valid(YUNET_PATH, YUNET_SHA256)
      and model_file_is_valid(SFACE_PATH, SFACE_SHA256),
  }


@app.post("/embed", response_model=EmbedResponse)
def embed_face(payload: EmbedRequest) -> dict[str, Any]:
  started = time.perf_counter()
  image = decode_image(payload.imageBase64)
  face = detect_single_face(image)
  quality_score = assess_face_quality(image, face)
  embedding = create_embedding(image, face)

  return {
    "embedding": [float(value) for value in embedding],
    "faceCount": 1,
    "qualityScore": quality_score,
    "modelCode": MODEL_CODE,
    "modelVersion": MODEL_VERSION,
    "processingMs": int((time.perf_counter() - started) * 1000),
  }


def detect_single_face(image: np.ndarray) -> np.ndarray:
  detector = get_detector()
  detector.setInputSize((image.shape[1], image.shape[0]))
  _, faces = detector.detect(image)

  if faces is None or len(faces) == 0:
    raise HTTPException(status_code=422, detail="FACE_NOT_FOUND")
  if len(faces) > 1:
    raise HTTPException(status_code=422, detail="MULTIPLE_FACES")
  return np.asarray(faces[0], dtype=np.float32)


def assess_face_quality(image: np.ndarray, face: np.ndarray) -> float:
  x, y, width, height = [float(value) for value in face[:4]]
  image_height, image_width = image.shape[:2]
  eye_distance = float(np.linalg.norm(face[4:6] - face[6:8]))

  if min(width, height) < 180 or eye_distance < 70:
    raise HTTPException(status_code=422, detail="FACE_TOO_SMALL")

  left = max(0, int(x))
  top = max(0, int(y))
  right = min(image_width, int(x + width))
  bottom = min(image_height, int(y + height))
  crop = image[top:bottom, left:right]
  if crop.size == 0:
    raise HTTPException(status_code=422, detail="FACE_NOT_FOUND")

  gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
  brightness = float(np.mean(gray))
  if brightness < 45:
    raise HTTPException(status_code=422, detail="FACE_TOO_DARK")
  if brightness > 215:
    raise HTTPException(status_code=422, detail="FACE_OVEREXPOSED")

  blur = float(cv2.Laplacian(gray, cv2.CV_64F).var())
  if blur < 65:
    raise HTTPException(status_code=422, detail="FACE_BLURRY")

  face_center_x = x + width / 2
  face_center_y = y + height / 2
  if abs(face_center_x - image_width / 2) > image_width * 0.22 or abs(face_center_y - image_height / 2) > image_height * 0.22:
    raise HTTPException(status_code=422, detail="FACE_NOT_CENTERED")

  right_eye = face[4:6]
  left_eye = face[6:8]
  nose = face[8:10]
  roll = abs(float(np.degrees(np.arctan2(left_eye[1] - right_eye[1], left_eye[0] - right_eye[0]))))
  eye_midpoint = (right_eye + left_eye) / 2
  yaw_ratio = abs(float(nose[0] - eye_midpoint[0])) / max(eye_distance, 1.0)
  if roll > 12 or yaw_ratio > 0.22:
    raise HTTPException(status_code=422, detail="FACE_POSE_INVALID")

  size_score = min(1.0, eye_distance / 130.0)
  blur_score = min(1.0, blur / 180.0)
  light_score = max(0.0, 1.0 - abs(brightness - 130.0) / 130.0)
  return round(max(0.01, min(1.0, size_score * 0.4 + blur_score * 0.35 + light_score * 0.25)), 4)


def create_embedding(image: np.ndarray, face: np.ndarray) -> np.ndarray:
  recognizer = get_recognizer()
  aligned = recognizer.alignCrop(image, face)
  feature = recognizer.feature(aligned)
  return normalise_embedding(feature)


def normalise_embedding(feature: np.ndarray) -> np.ndarray:
  embedding = np.asarray(feature, dtype=np.float32).reshape(-1)
  if embedding.shape[0] != 128:
    raise HTTPException(status_code=500, detail="Face model returned an invalid embedding size.")
  norm = float(np.linalg.norm(embedding))
  if not np.isfinite(norm) or norm <= 0:
    raise HTTPException(status_code=500, detail="Face model returned an invalid embedding.")
  return embedding / norm


def get_detector():
  global _detector
  if _detector is None:
    ensure_model_file(YUNET_PATH, YUNET_URL, YUNET_SHA256)
    _detector = cv2.FaceDetectorYN.create(str(YUNET_PATH), "", (960, 720), 0.90, 0.30, 5000)
  return _detector


def get_recognizer():
  global _recognizer
  if _recognizer is None:
    ensure_model_file(SFACE_PATH, SFACE_URL, SFACE_SHA256)
    _recognizer = cv2.FaceRecognizerSF.create(str(SFACE_PATH), "")
  return _recognizer


def ensure_model_file(path: Path, url: str, expected_sha256: str) -> None:
  if model_file_is_valid(path, expected_sha256):
    return
  path.parent.mkdir(parents=True, exist_ok=True)
  temporary = path.with_suffix(path.suffix + ".part")
  with requests.get(url, stream=True, timeout=90) as response:
    response.raise_for_status()
    with temporary.open("wb") as target:
      for chunk in response.iter_content(chunk_size=1024 * 1024):
        if chunk:
          target.write(chunk)
  if not model_file_is_valid(temporary, expected_sha256):
    temporary.unlink(missing_ok=True)
    raise HTTPException(status_code=500, detail="Downloaded face model failed integrity verification.")
  temporary.replace(path)


def model_file_is_valid(path: Path, expected_sha256: str) -> bool:
  if not path.is_file():
    return False
  digest = hashlib.sha256()
  with path.open("rb") as source:
    for chunk in iter(lambda: source.read(1024 * 1024), b""):
      digest.update(chunk)
  return digest.hexdigest() == expected_sha256


def decode_image(image_base64: str) -> np.ndarray:
  encoded = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
  try:
    image_bytes = base64.b64decode(encoded, validate=True)
  except Exception as exc:
    raise HTTPException(status_code=400, detail="Invalid base64 image.") from exc
  image = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
  if image is None:
    raise HTTPException(status_code=400, detail="Invalid image.")
  return image
