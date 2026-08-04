# Facial Recognition Precision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir el encuadre y la calidad de captura, usar OpenCV YuNet + SFace, enrolar múltiples muestras, verificar una ráfaga con presencia activa y medir FAR/FRR antes del despliegue.

**Architecture:** Un componente de captura compartido produce cuadros con geometría consistente y el servicio Python confiable realiza detección, calidad, landmarks, alineación y embeddings. Supabase conserva muestras versionadas por gimnasio, aplica consentimiento/RLS y agrega resultados conservadores; un evaluador separado calibra umbrales con datos consentidos.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Supabase/PostgreSQL/pgvector, Python, FastAPI, OpenCV, NumPy, YuNet y SFace bajo Apache 2.0.

---

## Restricción de despliegue

Los modelos YuNet y SFace deben descargarse exclusivamente de OpenCV, fijarse por versión y SHA-256, y conservar los avisos Apache 2.0. Ningún embedding InsightFace histórico de 512 dimensiones puede compararse con un embedding SFace de 128 dimensiones.

## Mapa de archivos

- Crear `src/features/faces/capture/capture-geometry.ts`: calcula el recorte mostrado y capturado.
- Crear `src/features/faces/capture/capture-geometry.test.ts`: regresiones de centrado y aspecto.
- Crear `src/features/faces/capture/face-camera.tsx`: cámara compartida, guía y ráfagas.
- Crear `src/features/faces/capture/face-camera.test.tsx`: ciclo de vida, resolución y estados.
- Modificar `src/features/members/components/member-face-enrollment-field.tsx`: cinco muestras mediante la cámara compartida.
- Modificar `src/features/entries/components/face-access-modal.tsx`: reto de presencia y tres cuadros.
- Crear `services/face-recognition/domain.py`: tipos, calidad, presencia y agregación sin I/O.
- Crear `services/face-recognition/pipeline.py`: adaptador YuNet/landmarks/alineación/SFace.
- Modificar `services/face-recognition/app.py`: endpoints versionados y guardas de licencia.
- Crear `services/face-recognition/test_domain.py`: pruebas puras del dominio.
- Crear `services/face-recognition/test_app.py`: pruebas HTTP con pipeline falso.
- Modificar `services/face-recognition/requirements.txt`: dependencias de pruebas y runtime.
- Crear `supabase/migrations/20260803010000_face_precision_samples.sql`: muestras, configuración, RPC y RLS incrementales.
- Crear `supabase/tests/face_precision_samples.sql`: consentimiento, permisos y aislamiento.
- Modificar servicios/repositorios TypeScript de enrolamiento y verificación para el contrato por lotes.
- Crear `scripts/evaluate-face-thresholds.py`: informe FAR/FRR sin imágenes en salida.
- Crear `services/face-recognition/test_evaluation.py`: cálculo y separación de calibración/evaluación.

### Task 1: Geometría única para vista previa y captura

**Files:**
- Create: `src/features/faces/capture/capture-geometry.ts`
- Create: `src/features/faces/capture/capture-geometry.test.ts`

- [ ] **Step 1: Escribir la prueba fallida de recorte centrado**

```ts
import { describe, expect, it } from "vitest";
import { coverCrop } from "./capture-geometry";

describe("coverCrop", () => {
  it("returns the centered 4:3 source region shown inside a 4:3 capture", () => {
    expect(coverCrop(1280, 720, 640, 480)).toEqual({ sx: 160, sy: 0, sw: 960, sh: 720 });
  });

  it("keeps portrait video centered without reading outside the source", () => {
    expect(coverCrop(720, 1280, 640, 480)).toEqual({ sx: 0, sy: 370, sw: 720, sh: 540 });
  });
});
```

- [ ] **Step 2: Ejecutar RED**

Run: `npm.cmd test -- src/features/faces/capture/capture-geometry.test.ts`

Expected: FAIL porque `capture-geometry` no existe.

- [ ] **Step 3: Implementar el cálculo mínimo**

```ts
export type SourceCrop = { sx: number; sy: number; sw: number; sh: number };

export function coverCrop(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): SourceCrop {
  if ([sourceWidth, sourceHeight, targetWidth, targetHeight].some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("Capture dimensions must be positive finite numbers.");
  }
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  if (sourceRatio > targetRatio) {
    const sw = sourceHeight * targetRatio;
    return { sx: (sourceWidth - sw) / 2, sy: 0, sw, sh: sourceHeight };
  }
  const sh = sourceWidth / targetRatio;
  return { sx: 0, sy: (sourceHeight - sh) / 2, sw: sourceWidth, sh };
}
```

- [ ] **Step 4: Ejecutar GREEN y suite TypeScript**

Run: `npm.cmd test -- src/features/faces/capture/capture-geometry.test.ts && npm.cmd typecheck`

Expected: pruebas y typecheck exitosos.

- [ ] **Step 5: Commit**

```powershell
git add src/features/faces/capture/capture-geometry.ts src/features/faces/capture/capture-geometry.test.ts
git commit -m "fix: align facial preview and capture geometry"
```

### Task 2: Cámara compartida con resolución y ráfagas

**Files:**
- Create: `src/features/faces/capture/face-camera.tsx`
- Create: `src/features/faces/capture/face-camera.test.tsx`
- Modify: `src/features/members/components/member-face-enrollment-field.tsx`
- Modify: `src/features/entries/components/face-access-modal.tsx`

- [ ] **Step 1: Escribir pruebas fallidas para resolución, recorte y cierre**

Probar con un `MediaStream` falso que el componente solicita `{ width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }`, bloquea captura por debajo de 720p, usa `coverCrop` al dibujar y detiene todas las pistas al cerrar.

```ts
expect(request).toHaveBeenCalledWith({
  video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
  audio: false,
});
expect(screen.getByText("La cámara debe ofrecer al menos 720p.")).toBeDefined();
expect(track.stop).toHaveBeenCalledOnce();
```

- [ ] **Step 2: Ejecutar RED**

Run: `npm.cmd test -- src/features/faces/capture/face-camera.test.tsx`

Expected: FAIL porque `FaceCamera` no existe.

- [ ] **Step 3: Implementar la API mínima compartida**

```ts
export type CapturedFrame = { imageBase64: string; width: number; height: number; capturedAt: string };
export type FaceCameraProps = {
  frameCount: number;
  onCapture(frames: CapturedFrame[]): Promise<void> | void;
  onCancel(): void;
};
```

El canvas será 960×720 y dibujará exactamente `drawImage(video, sx, sy, sw, sh, 0, 0, 960, 720)`. Codificará JPEG a 0.95 para transporte temporal; Storage convertirá enrolamientos a WebP de alta calidad en el servidor. Entre cuadros esperará que `requestVideoFrameCallback` entregue cuadros distintos, con fallback a `requestAnimationFrame`.

- [ ] **Step 4: Migrar ambos consumidores**

El enrolamiento solicitará cinco cuadros y conservará sus metadatos en un JSON oculto. La verificación solicitará tres cuadros; se elimina el canvas duplicado de `FaceAccessModal`.

- [ ] **Step 5: Ejecutar GREEN**

Run: `npm.cmd test -- src/features/faces/capture/face-camera.test.tsx src/features/entries/components/face-access-modal.test.tsx && npm.cmd typecheck`

Expected: todas las pruebas exitosas.

- [ ] **Step 6: Commit**

```powershell
git add src/features/faces src/features/members/components/member-face-enrollment-field.tsx src/features/entries/components/face-access-modal.tsx
git commit -m "feat: add guided high resolution face capture"
```

### Task 3: Dominio biométrico determinista y controles de calidad

**Files:**
- Create: `services/face-recognition/domain.py`
- Create: `services/face-recognition/test_domain.py`

- [ ] **Step 1: Escribir pruebas fallidas para calidad**

```python
def test_quality_rejects_blur_darkness_small_face_and_pose():
    assert assess_quality(metrics(blur=20)).code == "FACE_BLURRY"
    assert assess_quality(metrics(brightness=25)).code == "FACE_TOO_DARK"
    assert assess_quality(metrics(inter_eye=45)).code == "FACE_TOO_SMALL"
    assert assess_quality(metrics(yaw=25)).code == "FACE_POSE_INVALID"

def test_quality_accepts_supported_capture():
    result = assess_quality(metrics(blur=140, brightness=120, inter_eye=120, yaw=4, pitch=2, roll=1))
    assert result.accepted is True
```

- [ ] **Step 2: Ejecutar RED**

Run: `python -m pytest services/face-recognition/test_domain.py -q`

Expected: FAIL porque `domain` no existe.

- [ ] **Step 3: Implementar tipos y configuración versionada**

```python
@dataclass(frozen=True)
class QualityThresholds:
    min_blur: float = 100.0
    min_brightness: float = 45.0
    max_brightness: float = 215.0
    min_inter_eye_pixels: float = 80.0
    max_abs_yaw: float = 18.0
    max_abs_pitch: float = 15.0
    max_abs_roll: float = 12.0

@dataclass(frozen=True)
class QualityResult:
    accepted: bool
    code: str
    score: float
```

`assess_quality` devolverá el primer defecto accionable y un score normalizado. Los números son configuración inicial de captura, no umbrales de identidad; se validarán con fixtures y piloto.

- [ ] **Step 4: Escribir y pasar pruebas de agregación**

La función `aggregate_probe_embeddings` rechazará menos de tres embeddings, dimensiones distintas de 128 o baja consistencia; normalizará el centroide de tres vectores válidos.

Run: `python -m pytest services/face-recognition/test_domain.py -q`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add services/face-recognition/domain.py services/face-recognition/test_domain.py
git commit -m "feat: validate facial image quality and probe consistency"
```

### Task 4: Pipeline YuNet, landmarks, alineación y SFace

**Files:**
- Create: `services/face-recognition/pipeline.py`
- Create: `services/face-recognition/test_pipeline.py`
- Modify: `services/face-recognition/app.py`
- Modify: `services/face-recognition/requirements.txt`
- Modify: `services/face-recognition/README.md`

- [ ] **Step 1: Escribir pruebas fallidas del pipeline con sesiones ONNX falsas**

Las pruebas suministrarán una detección YuNet con cinco landmarks y un vector conocido. Deben demostrar que `alignCrop` produce la entrada esperada por SFace y que la salida final tiene norma uno y 128 elementos.

```python
assert aligned.shape == (112, 112, 3)
assert embedding.shape == (128,)
assert np.linalg.norm(embedding) == pytest.approx(1.0)
```

- [ ] **Step 2: Ejecutar RED**

Run: `python -m pytest services/face-recognition/test_pipeline.py -q`

Expected: FAIL porque `pipeline` no existe.

- [ ] **Step 3: Implementar adaptadores enfocados**

Crear `YunetDetector`, `SFaceEmbedder` y `FacePipeline` sobre `cv2.FaceDetectorYN` y `cv2.FaceRecognizerSF`. Cargar los ONNX fijados una sola vez, verificar sus SHA-256 al inicio y usar los cinco landmarks de YuNet para `alignCrop` antes de `feature`.

- [ ] **Step 4: Sustituir `/embed` por contratos por lotes**

```python
class BatchEmbedRequest(BaseModel):
    imagesBase64: list[str] = Field(min_length=3, max_length=5)
    purpose: Literal["enrollment", "verification"]

class EmbeddedSample(BaseModel):
    embedding: list[float]
    qualityScore: float
    qualityCode: str
    modelCode: str
    modelVersion: str
```

`POST /embed-batch` requerirá cinco muestras para enrolamiento y tres para verificación. No devolverá imágenes ni landmarks.

- [ ] **Step 5: Ejecutar GREEN y comprobar arranque bloqueado sin licencia**

Run: `python -m pytest services/face-recognition -q`

Expected: PASS; el test de configuración confirma error claro si falta aceptación de licencia.

- [ ] **Step 6: Commit**

```powershell
git add services/face-recognition
git commit -m "feat: align faces with OpenCV SFace pipeline"
```

### Task 5: Múltiples muestras, configuración y RLS

**Files:**
- Create: `supabase/migrations/20260803010000_face_precision_samples.sql`
- Create: `supabase/tests/face_precision_samples.sql`

- [ ] **Step 1: Escribir primero las pruebas SQL fallidas**

Cubrir:

```sql
-- usuario autorizado puede enrolar exactamente cinco muestras;
-- usuario sin faces.manage no puede enrolar;
-- usuario de gym B no puede leer ni comparar muestras de gym A;
-- consentimiento revocado desactiva todas las muestras;
-- versiones incompatibles nunca se comparan;
-- la configuración conserva high_threshold > review_threshold y positive margin.
```

Run: `npx.cmd supabase test db`

Expected: FAIL porque las nuevas funciones/columnas no existen.

- [ ] **Step 2: Crear migración incremental**

Agregar `face_model_configs` con `gym_id`, modelo/versión, dimensión, umbral alto, umbral de revisión, margen mínimo, estado y timestamps. Crear `face_embedding_samples` con `embedding vector(128)`, `sample_index`, `quality_score`, `revoked_at`, claves de gimnasio/persona/foto/modelo y constraint de índices 1..5. No alterar ni reutilizar `face_embeddings.embedding vector(512)`. Reemplazar `enroll_member_face` mediante una nueva firma que reciba `jsonb` con cinco muestras y valide consentimiento dentro de la transacción.

- [ ] **Step 3: Implementar verificación conservadora**

La RPC recibirá tres embeddings o un embedding agregado con evidencia de consistencia, filtrará gimnasio/modelo/consentimiento/estado, agregará scores por persona y aplicará umbral alto, zona de revisión y margen respecto al segundo candidato. Toda decisión creará evento sin almacenar cuadros temporales.

- [ ] **Step 4: Ejecutar GREEN y regenerar tipos**

Run: `npx.cmd supabase test db`

Run: `npx.cmd supabase gen types typescript --local > src/types/database.types.ts`

Expected: pruebas SQL exitosas y tipos actualizados.

- [ ] **Step 5: Commit**

```powershell
git add supabase/migrations/20260803010000_face_precision_samples.sql supabase/tests/face_precision_samples.sql src/types/database.types.ts
git commit -m "feat: persist versioned facial enrollment samples"
```

### Task 6: Contratos Next.js por lotes y presencia activa

**Files:**
- Modify: `src/features/members/services/member-face-enrollment.service.ts`
- Modify: `src/features/members/services/member-face-enrollment.repository.ts`
- Modify: `src/features/members/actions/member.actions.ts`
- Modify: `src/app/api/face/verify/route.ts`
- Modify: `src/features/entries/services/face-embedding.service.ts`
- Modify: `src/features/entries/services/face-verification.repository.ts`
- Modify corresponding `*.test.ts`

- [ ] **Step 1: Escribir RED para lotes y consentimiento**

Probar que enrolamiento rechaza cualquier cantidad distinta de cinco antes de Storage/RPC, verificación rechaza cualquier cantidad distinta de tres antes del servicio, y consentimiento revocado evita generar embeddings.

- [ ] **Step 2: Ejecutar RED**

Run: `npm.cmd test -- src/features/members/services/member-face-enrollment.service.test.ts src/app/api/face/verify/route.test.ts`

Expected: FAIL por contrato actual de imagen única.

- [ ] **Step 3: Implementar DTOs Zod y repositorios mínimos**

```ts
const enrollmentFramesSchema = z.array(capturedFrameSchema).length(5);
const verificationFramesSchema = z.array(capturedFrameSchema).length(3);
```

Enviar únicamente desde servidor a `/embed-batch`; comprobar modelo, versión, 128 dimensiones, calidad aceptada y consistencia. La ruta exige sesión, gimnasio activo, `faces.verify` y rate limit antes de enviar imágenes.

- [ ] **Step 4: Implementar reto activo**

Generar con `crypto.getRandomValues` dirección izquierda/derecha. El servicio devuelve solo `livenessPassed` y un código; los cuadros se liberan al completar o cancelar. Un fallo produce revisión manual o reintento, no `denied` biométrico.

- [ ] **Step 5: Ejecutar GREEN**

Run: `npm.cmd test && npm.cmd typecheck && npm.cmd lint`

Expected: suite, tipos y lint exitosos.

- [ ] **Step 6: Commit**

```powershell
git add src/app/api/face src/features/entries src/features/members
git commit -m "feat: verify consistent facial bursts with active presence"
```

### Task 7: Evaluación FAR/FRR y calibración separada

**Files:**
- Create: `scripts/evaluate-face-thresholds.py`
- Create: `services/face-recognition/evaluation.py`
- Create: `services/face-recognition/test_evaluation.py`
- Create: `docs/facial-recognition-evaluation.md`

- [ ] **Step 1: Escribir RED para métricas**

```python
def test_metrics_count_false_accepts_and_false_rejects():
    result = evaluate(scores=[(0.92, True), (0.70, True), (0.85, False), (0.20, False)], threshold=0.80)
    assert result.far == 0.5
    assert result.frr == 0.5
```

Probar también que una identidad no puede aparecer en calibración y evaluación al mismo tiempo.

- [ ] **Step 2: Ejecutar RED**

Run: `python -m pytest services/face-recognition/test_evaluation.py -q`

Expected: FAIL porque `evaluation` no existe.

- [ ] **Step 3: Implementar evaluación sin datos biométricos en salida**

El CLI leerá un manifiesto local ignorado por Git, calculará scores mediante el pipeline, separará identidades con semilla registrada y escribirá JSON/Markdown con conteos, FAR, FRR, intervalo de revisión y versión del modelo. El informe no contendrá rutas originales, imágenes, Base64 ni embeddings.

- [ ] **Step 4: Ejecutar GREEN con fixtures sintéticos**

Run: `python -m pytest services/face-recognition/test_evaluation.py -q`

Expected: PASS.

- [ ] **Step 5: Documentar el comando real**

```powershell
python scripts/evaluate-face-thresholds.py --manifest .private/face-pilot/manifest.json --target-far 0.001 --target-frr 0.03 --output .private/face-pilot/report.json
```

El documento indicará que solo el conjunto consentido del piloto puede determinar aceptación; fixtures no prueban precisión.

- [ ] **Step 6: Commit**

```powershell
git add scripts/evaluate-face-thresholds.py services/face-recognition/evaluation.py services/face-recognition/test_evaluation.py docs/facial-recognition-evaluation.md .gitignore
git commit -m "test: measure facial false accept and reject rates"
```

### Task 8: Verificación integral y documentación operativa

**Files:**
- Modify: `services/face-recognition/README.md`
- Modify: `README.md`
- Modify: `docs/api-contract.md`

- [ ] **Step 1: Ejecutar todas las verificaciones locales**

Run: `npm.cmd test`

Run: `npm.cmd typecheck`

Run: `npm.cmd lint`

Run: `npm.cmd build`

Run: `python -m pytest services/face-recognition -q`

Run: `npx.cmd supabase test db`

Expected: todos exitosos sin secretos ni imágenes en salida.

- [ ] **Step 2: Probar recorrido con dos gimnasios**

Con fixtures locales, demostrar enrolamiento autorizado en gimnasio A, rechazo de lectura/verificación desde gimnasio B, revocación inmediata y creación de cola de Storage. Registrar consultas y resultados sanitizados en documentación.

- [ ] **Step 3: Verificar cámara en navegador**

Recorrer webcam de escritorio 720p y cámara frontal móvil: encuadre coincidente, cinco capturas, tres cuadros, reto aleatorio, errores accionables, cancelación y liberación de la cámara.

- [ ] **Step 4: Documentar bloqueos de producción**

Registrar licencias Apache 2.0, hashes de YuNet/SFace, worker de eliminación, evaluación FAR/FRR y configuración de modelo como puertas obligatorias. No marcar la tarjeta terminada mientras una permanezca abierta.

- [ ] **Step 5: Commit**

```powershell
git add README.md services/face-recognition/README.md docs/api-contract.md
git commit -m "docs: document secure facial recognition operations"
```

## Criterio de cierre

La implementación técnica puede finalizar con pruebas automatizadas y fixtures, pero la tarjeta solo puede pasar a terminado después de:

1. avisos Apache 2.0 y hashes de modelos registrados;
2. prueba real con dos gimnasios;
3. worker de eliminación operativo;
4. conjunto piloto consentido separado;
5. informe que confirme FAR ≤ 0.1 % y FRR ≤ 3 %.
