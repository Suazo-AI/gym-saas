# Pantalla propia de acceso facial

## Objetivo

Crear `/facial-access` como pantalla operativa independiente, accesible desde el menú sin 404 y protegida por los permisos biométricos existentes. La pantalla reutilizará la captura y verificación actuales; no duplicará generación de embeddings ni decisiones de acceso.

## Alcance

- Crear una ruta propia dentro del área autenticada del gimnasio.
- Integrar la cámara directamente en la página mediante `FaceCamera`.
- Reutilizar `POST /api/face/verify` para rate limit, embedding, búsqueda y decisión.
- Activar `facial_access` en `screens` mediante una migración incremental.
- Incorporar `/facial-access` al conjunto de rutas soportadas por el menú.
- Corregir la etiqueta localizada a `Acceso facial` / `Facial access`.
- Probar usuario autorizado, usuario del mismo gimnasio sin permiso y usuario de otro gimnasio.

Quedan fuera de alcance el enrolamiento, cambios al modelo SFace, cambios de dimensión, nuevas tablas, nuevas RPC y modificaciones al modal de Entradas que no sean necesarias para compartir presentación o tipos.

## Permisos

`faces.read` controla la existencia de la pantalla en el menú y el acceso a la ruta. La fila `facial_access` conservará exclusivamente ese permiso de pantalla; no recuperará `entries.read` ni `entries.manage`.

`faces.verify` controla la operación de captura y verificación. Un usuario con `faces.read` pero sin `faces.verify` puede abrir la pantalla en modo lectura y recibe una explicación clara, pero no ve controles de cámara. `POST /api/face/verify` seguirá exigiendo `faces.verify` como frontera definitiva de servidor.

Un usuario sin `faces.read`, incluso si pertenece al gimnasio, no puede abrir la pantalla ni recibirla en el menú. Un usuario de otro gimnasio no puede usar su pertenencia o permisos para consultar ni operar sobre el gimnasio activo objetivo.

## Arquitectura

La ruta será un Server Component. Resolverá el gimnasio activo, exigirá `faces.read` y consultará `faces.verify` antes de renderizar. La autorización crítica se mantendrá en Supabase mediante `current_user_has_gym_permission`; ocultar controles será solamente una mejora de experiencia.

Un componente cliente específico de la pantalla recibirá si la operación está permitida. Cuando lo esté, renderizará `FaceCamera` con una captura y enviará el frame a `/api/face/verify`. Mostrará estados de cámara, verificación, error y resultado sin tomar decisiones biométricas en el navegador.

La respuesta se presentará con las decisiones existentes: `allowed`, `denied`, `manual_review` y `no_match`. Los casos dudosos conservarán revisión manual; el reconocimiento no se presentará como evidencia irreversible de identidad.

## Datos y seguridad

La imagen viajará únicamente al Route Handler existente. El navegador no generará embeddings ni decidirá acceso. No se registrarán imágenes, tokens ni embeddings completos en logs o pruebas.

La migración nueva:

- fijará `facial_access.route = '/facial-access'`;
- fijará un nombre coherente y `is_active = true`;
- garantizará la asociación con `faces.read`;
- eliminará cualquier asociación residual con permisos distintos de `faces.read` para esa pantalla;
- no modificará permisos, estados o rutas de `entries`.

## Manejo de errores

- Sin sesión o gimnasio activo: seguir el patrón de redirección autenticada existente.
- Sin `faces.read`: denegar la ruta sin renderizar datos biométricos.
- Sin `faces.verify`: renderizar modo lectura sin cámara.
- Cámara no disponible o sin 720p: mostrar los mensajes existentes de `FaceCamera`.
- API `401`, `403`, `413`, `422` o `429`: mostrar el error controlado devuelto por el servidor.
- Error inesperado: mostrar un mensaje genérico sin detalles sensibles.

## Pruebas

### TypeScript y componentes

- La ruta exige `faces.read` para el gimnasio activo.
- Con `faces.read` y `faces.verify`, la página muestra la experiencia de captura.
- Con `faces.read` sin `faces.verify`, la página muestra modo lectura y no expone controles de cámara.
- `AppShell` acepta `/facial-access` cuando Supabase la devuelve.
- La navegación presenta `Acceso facial` y `Facial access` según idioma.
- El componente envía una única captura a `/api/face/verify` y representa respuestas permitida, denegada, revisión manual y sin coincidencia.

### pgTAP

- `facial_access` está activa, apunta a `/facial-access` y tiene únicamente `faces.read`.
- Un usuario autorizado obtiene `true` para `faces.read` en su gimnasio.
- Un usuario del mismo gimnasio sin el permiso obtiene `false`.
- Un usuario de otro gimnasio obtiene `false` para el gimnasio objetivo.
- Las pruebas usan identidades y gimnasios aislados y revierten sus datos al terminar.

## Criterio de terminado

La ruta existe, aparece en el menú y no produce 404. La pantalla se abre solamente con `faces.read`; la cámara requiere además `faces.verify`. Las pruebas automatizadas demuestran el usuario autorizado, el usuario sin permiso y el usuario de otro gimnasio. La suite relevante, typecheck, lint, build y pgTAP terminan correctamente.
