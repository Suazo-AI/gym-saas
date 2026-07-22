from __future__ import annotations

import base64
import os
import time
import zipfile
from pathlib import Path
from typing import Any, Optional, Union

import cv2
import numpy as np
import onnxruntime as ort
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


MODEL_CODE = os.getenv("FACE_MODEL_CODE", "insightface-buffalo-l-w600k-r50")
MODEL_DIR = Path(os.getenv("FACE_MODEL_DIR", "models"))
MODEL_PATH = MODEL_DIR / "w600k_r50.onnx"
MODEL_ZIP_URL = os.getenv(
  "FACE_MODEL_ZIP_URL",
  "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip",
)
PROVIDERS = ["CPUExecutionProvider"]

app = FastAPI(title="FitManager Face Recognition")
_recognition_session: Optional[ort.InferenceSession] = None


class EmbedRequest(BaseModel):
  imageBase64: str = Field(min_length=32)


class EmbedResponse(BaseModel):
  embedding: list[float]
  faceCount: int
  qualityScore: Optional[float]
  modelCode: str
  processingMs: int


@app.get("/health")
def health() -> dict[str, Union[str, bool]]:
  return {"status": "ok", "model": MODEL_CODE, "modelReady": MODEL_PATH.exists()}


@app.post("/embed", response_model=EmbedResponse)
def embed_face(payload: EmbedRequest) -> dict[str, Any]:
  started = time.perf_counter()
  image_bytes = decode_image(payload.imageBase64)
  image = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)

  if image is None:
    raise HTTPException(status_code=400, detail="Invalid image.")

  crop, quality_score = crop_single_face(image)
  embedding = create_embedding(crop)

  processing_ms = int((time.perf_counter() - started) * 1000)

  return {
    "embedding": [float(value) for value in embedding],
    "faceCount": 1,
    "qualityScore": quality_score,
    "modelCode": MODEL_CODE,
    "processingMs": processing_ms,
  }


def crop_single_face(image: np.ndarray) -> tuple[np.ndarray, float]:
  cascade_path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
  detector = cv2.CascadeClassifier(str(cascade_path))

  if detector.empty():
    raise HTTPException(status_code=500, detail="Face detector is not available.")

  gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
  faces = detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80))

  if len(faces) == 0:
    raise HTTPException(status_code=422, detail="No face detected.")

  if len(faces) > 1:
    raise HTTPException(status_code=422, detail="Multiple faces detected.")

  x, y, width, height = [int(value) for value in faces[0]]
  side = max(width, height)
  margin = int(side * 0.25)
  center_x = x + width // 2
  center_y = y + height // 2

  left = max(0, center_x - side // 2 - margin)
  top = max(0, center_y - side // 2 - margin)
  right = min(image.shape[1], center_x + side // 2 + margin)
  bottom = min(image.shape[0], center_y + side // 2 + margin)

  face_crop = image[top:bottom, left:right]
  if face_crop.size == 0:
    raise HTTPException(status_code=422, detail="Face crop is empty.")

  face_area = float(width * height)
  image_area = float(image.shape[0] * image.shape[1])
  quality_score = min(1.0, max(0.01, (face_area / image_area) * 8))

  return face_crop, quality_score


def create_embedding(face_crop: np.ndarray) -> np.ndarray:
  session = get_recognition_session()
  resized = cv2.resize(face_crop, (112, 112), interpolation=cv2.INTER_AREA)
  rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
  blob = ((rgb.astype(np.float32) - 127.5) / 127.5).transpose(2, 0, 1)
  blob = np.expand_dims(blob, axis=0)

  input_name = session.get_inputs()[0].name
  output = session.run(None, {input_name: blob})[0]
  embedding = np.asarray(output[0], dtype=np.float32)

  if embedding.shape[0] != 512:
    raise HTTPException(status_code=500, detail="Face model returned an invalid embedding size.")

  norm = np.linalg.norm(embedding)
  if not np.isfinite(norm) or norm <= 0:
    raise HTTPException(status_code=500, detail="Face model returned an invalid embedding.")

  return embedding / norm


def get_recognition_session() -> ort.InferenceSession:
  global _recognition_session

  if _recognition_session is None:
    ensure_model_file()
    _recognition_session = ort.InferenceSession(str(MODEL_PATH), providers=PROVIDERS)

  return _recognition_session


def ensure_model_file() -> None:
  if MODEL_PATH.exists():
    return

  MODEL_DIR.mkdir(parents=True, exist_ok=True)
  archive_path = MODEL_DIR / "buffalo_l.zip"

  if not archive_path.exists():
    with requests.get(MODEL_ZIP_URL, stream=True, timeout=60) as response:
      response.raise_for_status()
      with archive_path.open("wb") as archive:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
          if chunk:
            archive.write(chunk)

  with zipfile.ZipFile(archive_path) as archive:
    recognition_names = [name for name in archive.namelist() if name.endswith("w600k_r50.onnx")]
    if not recognition_names:
      raise HTTPException(status_code=500, detail="Recognition model was not found in model archive.")

    with archive.open(recognition_names[0]) as source:
      MODEL_PATH.write_bytes(source.read())


def decode_image(image_base64: str) -> bytes:
  if "," in image_base64:
    image_base64 = image_base64.split(",", 1)[1]

  try:
    return base64.b64decode(image_base64, validate=True)
  except Exception as exc:
    raise HTTPException(status_code=400, detail="Invalid base64 image.") from exc
