# Despliegue de reconocimiento facial SFace en Render

## Decisión

El servicio usará OpenCV YuNet para detección y OpenCV SFace para reconocimiento, con embeddings normalizados de 128 dimensiones. Buffalo e InsightFace quedan fuera por sus requisitos de licencia. El supervisor aprobó atender este fallo operativo sin tarjeta de Trello.

## Problema

Render ejecuta el servicio con el runtime nativo de Python. La carpeta `services/face-recognition/models/` está ignorada por Git, así que los modelos ONNX no llegan a la instancia y el proceso falla antes de abrir un puerto. El Dockerfile sí descarga y valida ambos modelos, pero Render no lo está usando.

## Diseño

El servicio se desplegará como Web Service con runtime Docker y `services/face-recognition` como directorio raíz. El Dockerfile instalará dependencias, descargará y verificará YuNet y SFace, y arrancará Uvicorn en `0.0.0.0` usando el puerto de Render.

Next.js conservará `FACE_RECOGNITION_SERVICE_URL` y autenticará `/embed` con `FACE_RECOGNITION_SERVICE_TOKEN`. El secreto será idéntico en ambos servicios, nunca público ni versionado.

## Contratos alineados

- Python devolverá exactamente 128 valores.
- Enrolamiento y verificación en Next.js exigirán 128 valores.
- PostgreSQL usará `vector(128)` mediante migración versionada.
- `AGENTS.md` y el README declararán SFace/128.

## Errores y seguridad

- El contenedor no arrancará si falta un modelo o falla su checksum.
- `/health` no declarará listo el servicio hasta cargar ambos modelos.
- `/embed` sin Bearer válido responderá `401`.
- No se registrarán imágenes, tokens ni embeddings completos.

## Verificación

1. Ejecutar pruebas de entorno, autenticación, calidad y cliente facial.
2. Construir e iniciar la imagen Docker localmente.
3. Verificar health, rechazo sin token y embedding de 128 dimensiones.
4. Actualizar Render mediante CLI y esperar el despliegue.
5. Repetir las verificaciones contra Render y desde Next.js.

## Fuera de alcance

- Buffalo o InsightFace.
- Otro cambio de dimensión.
- Eliminar la autenticación.
- Reescribir datos biométricos históricos sin migración aprobada.
