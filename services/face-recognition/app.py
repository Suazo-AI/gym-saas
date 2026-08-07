from __future__ import annotations

import base64
import hashlib
import os
import secrets
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional, Union

import cv2
import numpy as np
import onnxruntime as ort
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field


MODEL_CODE = os.getenv("FACE_MODEL_CODE", "insightface-buffalo-l-w600k-r50")
MODEL_VERSION = "buffalo_l"
MODEL_DIR = Path(os.getenv("FACE_MODEL_DIR", str(Path(__file__).resolve().parent / "models")))
YUNET_PATH = MODEL_DIR / "face_detection_yunet_2023mar.onnx"
RECOGNITION_PATH = MODEL_DIR / "w600k_r50.onnx"
YUNET_SHA256 = "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4"
RECOGNITION_SHA256 = "4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43"
PROVIDERS = ["CPUExecutionProvider"]

SERVICE_TOKEN = os.getenv("FACE_RECOGNITION_SERVICE_TOKEN", "")
if len(SERVICE_TOKEN) < 32:
  raise RuntimeError("FACE_RECOGNITION_SERVICE_TOKEN must contain at least 32 characters.")

_detector: Optional[Any] = None
_recognition_session: Optional[ort.InferenceSession] = None


@asynccontextmanager
async def lifespan(_: FastAPI):
  get_detector()
  get_recognition_session()
  yield


app = FastAPI(title="FitManager Face Recognition", lifespan=lifespan)


class EmbedRequest(BaseModel):
  imageBase64: str = Field(min_length=32)


class EmbedResponse(BaseModel):
  embedding: list[float]
  faceCount: int
  qualityScore: float
  modelCode: str
  modelVersion: str
  processingMs: int


def require_service_token(authorization: Optional[str] = Header(default=None)) -> None:
  expected = f"Bearer {SERVICE_TOKEN}"
  if authorization is None or not secrets.compare_digest(authorization, expected):
    raise HTTPException(
      status_code=401,
      detail="UNAUTHORIZED",
      headers={"WWW-Authenticate": "Bearer"},
    )


@app.get("/health")
def health() -> dict[str, Union[str, bool]]:
  model_ready = (
    _detector is not None
    and _recognition_session is not None
    and model_file_is_valid(YUNET_PATH, YUNET_SHA256)
    and model_file_is_valid(RECOGNITION_PATH, RECOGNITION_SHA256)
  )
  if not model_ready:
    raise HTTPException(status_code=503, detail="MODEL_NOT_READY")
  return {
    "status": "ok",
    "model": MODEL_CODE,
    "modelVersion": MODEL_VERSION,
    "modelReady": True,
  }


@app.post("/embed", response_model=EmbedResponse)
def embed_face(
  payload: EmbedRequest,
  _: None = Depends(require_service_token),
) -> dict[str, Any]:
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
  if (
    abs(face_center_x - image_width / 2) > image_width * 0.22
    or abs(face_center_y - image_height / 2) > image_height * 0.22
  ):
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
  return round(
    max(0.01, min(1.0, size_score * 0.4 + blur_score * 0.35 + light_score * 0.25)),
    4,
  )


def create_embedding(image: np.ndarray, face: np.ndarray) -> np.ndarray:
  aligned = align_face(image, face)
  rgb = cv2.cvtColor(aligned, cv2.COLOR_BGR2RGB)
  blob = ((rgb.astype(np.float32) - 127.5) / 127.5).transpose(2, 0, 1)
  blob = np.expand_dims(blob, axis=0)
  session = get_recognition_session()
  feature = session.run(None, {session.get_inputs()[0].name: blob})[0]
  return normalise_embedding(feature)


def align_face(image: np.ndarray, face: np.ndarray) -> np.ndarray:
  landmarks = np.asarray(face[4:14], dtype=np.float32).reshape(5, 2)
  reference = np.asarray([
    [38.2946, 51.6963],
    [73.5318, 51.5014],
    [56.0252, 71.7366],
    [41.5493, 92.3655],
    [70.7299, 92.2041],
  ], dtype=np.float32)
  transform, _ = cv2.estimateAffinePartial2D(landmarks, reference, method=cv2.LMEDS)
  if transform is None:
    raise HTTPException(status_code=422, detail="FACE_POSE_INVALID")
  return cv2.warpAffine(image, transform, (112, 112), borderValue=0)


def normalise_embedding(feature: np.ndarray) -> np.ndarray:
  embedding = np.asarray(feature, dtype=np.float32).reshape(-1)
  if embedding.shape[0] != 512:
    raise HTTPException(status_code=500, detail="Face model returned an invalid embedding size.")
  norm = float(np.linalg.norm(embedding))
  if not np.isfinite(norm) or norm <= 0:
    raise HTTPException(status_code=500, detail="Face model returned an invalid embedding.")
  return embedding / norm


def get_detector():
  global _detector
  if _detector is None:
    require_model_file(YUNET_PATH, YUNET_SHA256, "YuNet detector")
    _detector = cv2.FaceDetectorYN.create(str(YUNET_PATH), "", (960, 720), 0.90, 0.30, 5000)
  return _detector


def get_recognition_session() -> ort.InferenceSession:
  global _recognition_session
  if _recognition_session is None:
    require_model_file(RECOGNITION_PATH, RECOGNITION_SHA256, "InsightFace recognition model")
    _recognition_session = ort.InferenceSession(str(RECOGNITION_PATH), providers=PROVIDERS)
  return _recognition_session


def require_model_file(path: Path, expected_sha256: str, label: str) -> None:
  if not model_file_is_valid(path, expected_sha256):
    raise RuntimeError(f"{label} is missing or failed integrity verification: {path}")


def model_file_is_valid(path: Path, expected_sha256: str) -> bool:
  if not path.is_file():
    return False
  digest = hashlib.sha256()
  with path.open("rb") as source:
    for chunk in iter(lambda: source.read(1024 * 1024), b""):
      digest.update(chunk)
  return secrets.compare_digest(digest.hexdigest(), expected_sha256)


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
