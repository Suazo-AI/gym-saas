FROM python:3.11-slim AS models

ARG YUNET_URL=https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx
ARG YUNET_SHA256=8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4
ARG RECOGNITION_URL=https://huggingface.co/opencv/face_recognition_sface/resolve/main/face_recognition_sface_2021dec.onnx
ARG RECOGNITION_SHA256=0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl unzip \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /models \
  && curl --fail --location --retry 3 --output /models/face_detection_yunet_2023mar.onnx "${YUNET_URL}" \
  && echo "${YUNET_SHA256}  /models/face_detection_yunet_2023mar.onnx" | sha256sum --check - \
  && curl --fail --location --retry 3 --output /models/face_recognition_sface_2021dec.onnx "${RECOGNITION_URL}" \
  && echo "${RECOGNITION_SHA256}  /models/face_recognition_sface_2021dec.onnx" | sha256sum --check -

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
  CMD curl --fail "http://127.0.0.1:${PORT:-8010}/health" || exit 1

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8010}"]
