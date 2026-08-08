# FitManager Face Recognition Service

Servicio privado para generar embeddings faciales de 512 dimensiones con FastAPI, ONNXRuntime CPU y OpenCV.

La imagen Docker incluye el detector YuNet y el modelo `buffalo_l` de InsightFace. Los modelos se descargan y verifican durante `docker build`. El contenedor no descarga archivos al arrancar.

## Requisitos

- Docker Desktop o un motor compatible con Docker.
- Acceso a GitHub y Hugging Face durante el build para descargar los modelos fijados.
- Un token aleatorio de al menos 32 caracteres compartido solamente entre Next.js y este servicio.

## Construir la imagen

Desde `services/face-recognition`:

```powershell
docker build --tag fitmanager-face-service:local .
```

El build verifica estos artefactos antes de copiarlos a la imagen final:

- `face_detection_yunet_2023mar.onnx`
- `buffalo_l.zip`
- `w600k_r50.onnx`

Si una descarga cambia o queda incompleta, el build falla por checksum.

## Ejecutar localmente

Definir el token en el entorno sin escribirlo en Git ni agregarlo a una variable `NEXT_PUBLIC_*`:

```powershell
$env:FACE_RECOGNITION_SERVICE_TOKEN = '<token-aleatorio-de-32-o-mas-caracteres>'
docker run --rm --name fitmanager-face-service --publish 8010:8010 --env FACE_RECOGNITION_SERVICE_TOKEN fitmanager-face-service:local
```

El proceso carga ambos modelos antes de aceptar tráfico. Si un modelo falta, está dañado o no puede abrirse, el contenedor termina con error.

## Variables

Servicio Python:

- `FACE_RECOGNITION_SERVICE_TOKEN`: obligatoria, mínimo 32 caracteres.
- `FACE_MODEL_CODE`: opcional. Por defecto `insightface-buffalo-l-w600k-r50`.
- `FACE_MODEL_DIR`: opcional. La imagen usa `/app/models`.

Next.js:

- `FACE_RECOGNITION_SERVICE_URL`: obligatoria, URL privada del contenedor.
- `FACE_RECOGNITION_SERVICE_TOKEN`: obligatoria, el mismo valor del servicio Python.

Next.js envía el token como `Authorization: Bearer <token>`. El token es solo de servidor y nunca debe exponerse al navegador.

## Verificar salud y autenticación

Con el contenedor activo:

```powershell
Invoke-RestMethod http://127.0.0.1:8010/health
```

La respuesta correcta contiene `modelReady: true`. El healthcheck confirma que ambos modelos fueron cargados, no solamente que el proceso está vivo.

Una solicitud sin token debe responder `401`:

```powershell
Invoke-WebRequest http://127.0.0.1:8010/embed -Method Post -ContentType 'application/json' -Body '{"imageBase64":"valor-invalido-pero-suficientemente-largo"}' -SkipHttpErrorCheck
```

Para probar una fotografía real:

```powershell
$imageBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\ruta\rostro.jpg'))
$body = @{ imageBase64 = $imageBase64 } | ConvertTo-Json -Compress
$headers = @{ Authorization = "Bearer $env:FACE_RECOGNITION_SERVICE_TOKEN" }
$result = Invoke-RestMethod http://127.0.0.1:8010/embed -Method Post -Headers $headers -ContentType 'application/json' -Body $body
$result.embedding.Count
```

El último comando debe devolver `512`.

## Despliegue

Publicar la imagen en una plataforma que ejecute contenedores Linux y configurar:

1. Puerto interno `8010`.
2. `FACE_RECOGNITION_SERVICE_TOKEN` como secreto del servicio.
3. Healthcheck HTTP en `/health`.
4. Al menos 2 GB de memoria para cargar los modelos con margen operativo.
5. Acceso de red restringido al backend de Next.js cuando la plataforma lo permita.
6. Reinicio automático cuando falle el healthcheck.

Después, configurar en el entorno de Next.js la URL privada y el mismo token. No desplegar si `/health` no devuelve `modelReady: true`, una llamada sin token no devuelve `401`, o un POST autenticado con una foto válida no devuelve 512 dimensiones.

La elección del host, la creación de cuentas, el medio de pago y la carga de secretos reales quedan fuera de este repositorio.

## Desarrollo sin Docker

Para ejecutar pruebas unitarias:

```powershell
cd services/face-recognition
$env:FACE_RECOGNITION_SERVICE_TOKEN = 'face-service-local-test-token-123456789'
python -m pip install -r requirements.txt
python -m unittest discover -v
```

Ejecutar la aplicación directamente requiere colocar manualmente los dos archivos ONNX válidos en `services/face-recognition/models`. Para recorridos reales se recomienda usar la imagen Docker, que ya los hornea y valida.
