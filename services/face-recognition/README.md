# FitManager Face Recognition Service

Servicio local/confiable para generar embeddings faciales de 512 dimensiones.

Usa librerias gratuitas:

- FastAPI
- ONNXRuntime CPU
- OpenCV

El primer reconocimiento descarga el modelo gratuito `buffalo_l` de InsightFace y usa `w600k_r50.onnx` para generar embeddings de 512 dimensiones. El detector local usa OpenCV para evitar compilar dependencias nativas en Windows.

## Uso local

```bash
cd services/face-recognition
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8010
```

Configurar Next.js:

```env
FACE_RECOGNITION_SERVICE_URL=http://127.0.0.1:8010
```

La imagen de camara nunca se procesa en el navegador para decisiones criticas. El navegador captura la foto, Next.js la envia a este servicio, el servicio devuelve el embedding y Supabase valida permiso, coincidencia y suscripcion activa mediante RPC.
