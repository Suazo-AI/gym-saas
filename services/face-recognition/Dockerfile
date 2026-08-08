FROM python:3.11-slim AS models

ARG YUNET_URL=https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx
ARG YUNET_SHA256=8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4
ARG BUFFALO_URL=https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip
ARG BUFFALO_SHA256=80ffe37d8a5940d59a7384c201a2a38d4741f2f3c51eef46ebb28218a7b0ca2f
ARG RECOGNITION_SHA256=4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl unzip \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /models \
  && curl --fail --location --retry 3 --output /models/face_detection_yunet_2023mar.onnx "${YUNET_URL}" \
  && echo "${YUNET_SHA256}  /models/face_detection_yunet_2023mar.onnx" | sha256sum --check - \
  && curl --fail --location --retry 3 --output /tmp/buffalo_l.zip "${BUFFALO_URL}" \
  && echo "${BUFFALO_SHA256}  /tmp/buffalo_l.zip" | sha256sum --check - \
  && unzip -j /tmp/buffalo_l.zip w600k_r50.onnx -d /models \
  && echo "${RECOGNITION_SHA256}  /models/w600k_r50.onnx" | sha256sum --check - \
  && rm /tmp/buffalo_l.zip

FROM python:3.11-slim

ENV FACE_MODEL_DIR=/app/models \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl libgl1 libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --uid 10001 appuser

WORKDIR /app

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --requirement requirements.txt

COPY app.py ./app.py
COPY --from=models /models ./models

USER appuser

EXPOSE 8010

HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
  CMD curl --fail http://127.0.0.1:8010/health || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8010"]
