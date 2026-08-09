# AGENTS.md - FitManager / Gym SaaS

## Preflight obligatorio

Antes de analizar, planificar, editar archivos, ejecutar migraciones o escribir código, el agente debe:

1. Leer completamente este `AGENTS.md`. Es corto a propósito: solo contiene reglas cuyo incumplimiento causa un daño **irreversible o silencioso**. El procedimiento vive en `Docs/guia-tecnica.md` y se lee al tocar cada área.
2. Identificar la tarjeta concreta del tablero de Trello que se trabajará.
3. Revisar su descripción, responsable, etiquetas, checklist, dependencias y criterio de terminado.
4. Confirmar que la tarjeta está dentro del MVP y no contradice una decisión de este archivo.
5. Revisar el estado actual del repositorio y preservar cambios ajenos.
6. Revisar las migraciones existentes cuando la tarea afecte Supabase.
7. No comenzar una implementación si falta una decisión que afecte dinero, seguridad, permisos, multi-tenancy, biometría o alcance.

El tablero de Trello gobierna:

* las tareas;
* los responsables;
* las prioridades;
* los bloqueos;
* el estado del trabajo;
* los checklists;
* el orden de ejecución.

Este `AGENTS.md` gobierna:

* las reglas del producto;
* la arquitectura;
* la seguridad;
* el alcance del MVP;
* las decisiones técnicas;
* los criterios generales de implementación.

Si una tarjeta de Trello contradice este archivo, el trabajo debe detenerse y la discrepancia debe informarse antes de continuar.

El archivo utilizado originalmente para preparar el tablero de Trello es solamente una referencia de planificación. No representa automáticamente el estado actual de las tarjetas ni debe utilizarse como sustituto del tablero real.


## Alcance del MVP

Incluir:

* registro y configuración de gimnasios;
* sucursales;
* separación estricta de datos entre gimnasios;
* usuarios del gimnasio;
* roles y permisos;
* registro y búsqueda de miembros;
* planes de membresía;
* suscripciones de miembros;
* cargos de membresía;
* pagos y aplicación de pagos;
* estados de cuenta y morosidad;
* cancelación de membresías;
* entradas al gimnasio;
* alertas;
* dashboard;
* módulo simple de ingresos;
* auditoría;
* operación en USD y NIO;
* archivos y fotografías mediante Supabase Storage;
* borrado lógico para entidades administrativas.

El reconocimiento facial ya está implementado y mergeado: servicio de embeddings en `services/face-recognition/`, captura y verificación en `src/features/faces` y `src/features/entries`. Sus reglas están en su propia sección.

Fuera del MVP:

* aplicación móvil nativa;
* rutinas;
* nutrición;
* nómina;
* contabilidad completa;
* inventario avanzado;
* control físico automático de puertas;
* funciones para grandes cadenas;
* portal del entrenador;
* funcionalidades que no estén respaldadas por una tarjeta aprobada.

El acceso propio del miembro sigue pendiente de decisión. No implementarlo sin aprobación explícita.


## Stack tecnológico actual

### Frontend

* Next.js con App Router.
* TypeScript y TSX.
* React.
* Tailwind CSS.
* Despliegue inicial en Vercel.

### Backend y datos

* Supabase como backend principal.
* PostgreSQL administrado por Supabase.
* Supabase Auth.
* Supabase Storage.
* Row Level Security.
* Funciones PostgreSQL y RPC.
* Triggers.
* Vistas con `security_invoker`.
* Edge Functions o funciones de servidor confiables para procesos privilegiados.
* Extensión `pgvector` para embeddings faciales.

ASP.NET Core y Entity Framework Core no forman parte de la arquitectura actual.

No introducir ASP.NET Core, Entity Framework, SQL Server, Somee ni otro backend principal sin una decisión explícita.


## Supabase como límite de seguridad

Supabase no debe tratarse únicamente como una base de datos.

Las siguientes capas forman parte de la seguridad del sistema:

* Supabase Auth;
* RLS;
* políticas de Storage;
* permisos de PostgreSQL;
* funciones privadas;
* funciones RPC;
* validaciones y restricciones;
* código de servidor;
* auditoría.

Ocultar botones en el frontend no sustituye autorización.

El frontend nunca debe ser considerado una fuente confiable para:

* `gym_id`;
* precios;
* totales;
* monedas;
* permisos;
* estados de pago;
* membresías activas;
* decisiones de acceso;
* identificadores de usuario;
* rutas de archivos.


## Multi-tenancy obligatorio

El sistema es multi-tenant desde el inicio.

Toda entidad comercial debe pertenecer a un gimnasio mediante `gym_id` o mediante una relación verificable con una entidad que lo posea.

Toda consulta debe respetar el gimnasio activo.

Toda inserción, actualización, RPC o eliminación lógica debe validar:

* usuario autenticado;
* gimnasio activo;
* pertenencia del usuario al gimnasio;
* estado del usuario del gimnasio;
* permiso requerido;
* estado lógico de la entidad.

Ningún usuario puede leer o modificar datos de otro gimnasio.

No confiar solamente en filtros enviados desde Next.js.

El aislamiento debe mantenerse mediante RLS, funciones seguras y validaciones de servidor.

Las operaciones con `service_role` deben validar manualmente el `gym_id`, porque `service_role` puede omitir RLS.


## Claves de Supabase

La clave pública o `anon key` puede utilizarse en el cliente.

La clave `service_role`:

* nunca debe enviarse al navegador;
* nunca debe incluirse en variables `NEXT_PUBLIC_*`;
* nunca debe escribirse en Git;
* nunca debe aparecer en logs;
* nunca debe incluirse en ejemplos;
* solamente puede utilizarse en un entorno confiable.

Los secretos deben almacenarse en variables de entorno de Vercel, Supabase o el entorno de despliegue correspondiente.


## RLS y permisos

RLS es la principal frontera de autorización de los datos accesibles mediante Supabase.

Toda tabla expuesta a usuarios autenticados debe tener políticas revisadas.

Las políticas deben utilizar funciones existentes como:

* `private.is_gym_user(...)`;
* `private.has_permission(...)`;
* `private.can_access_person(...)`;
* `private.is_service_role()`.

No crear políticas basadas únicamente en valores enviados por el cliente.

Antes de agregar una tabla nueva, definir:

1. quién puede leerla;
2. quién puede crear registros;
3. quién puede modificarlos;
4. si puede eliminarse;
5. qué permiso se necesita;
6. cómo se determina el gimnasio;
7. qué sucede con registros históricos.

Toda política nueva debe probarse con al menos:

* un usuario autorizado;
* un usuario sin permiso;
* un usuario de otro gimnasio;
* un usuario no autenticado.


## Dinero y monedas

Nunca utilizar `float`, `double` ni números de punto flotante para dinero.

En PostgreSQL utilizar `numeric` con precisión adecuada.

En TypeScript evitar cálculos monetarios críticos mediante `number` sin una estrategia segura.

Los registros financieros deben guardar como mínimo:

* monto;
* moneda;
* fecha;
* estado;
* gimnasio;
* usuario responsable cuando corresponda.

El esquema actual registra montos y monedas de forma separada.

La tasa de cambio ya está implementada (`20260804023000_gym_exchange_rate_contract.sql`). Sus reglas, que no se deducen del esquema:

* cada gimnasio tiene su propia tasa;
* la tasa aplicada se guarda en cada transacción convertida;
* cambiarla solo afecta transacciones nuevas: las históricas nunca se recalculan.


## Pagos, cargos y suscripciones

Existen dos niveles diferentes de facturación:

### Facturación del SaaS

* planes SaaS;
* suscripción del gimnasio;
* facturas SaaS;
* pagos SaaS;
* aplicación de pagos;
* cancelación de suscripción.

### Facturación de miembros

* planes de membresía;
* suscripciones de miembros;
* cargos;
* pagos de miembros;
* aplicación de pagos;
* cancelación de membresía.

No mezclar ambos niveles.

Un pago no debe eliminarse físicamente.

Los pagos deben:

* anularse;
* reembolsarse;
* corregirse mediante una operación auditada;
* conservar su historial.

No confiar en montos totales calculados por el navegador.

La creación de cargos, aplicación de pagos y cancelación de suscripciones debe ejecutarse mediante operaciones atómicas.

Usar las RPC existentes cuando corresponda, por ejemplo:

* `generate_membership_charges`;
* `cancel_member_subscription`;
* `request_saas_subscription_cancellation`.


## Borrado lógico

El borrado lógico solamente se aplica a entidades administrativas o CRUD.

Entre las entidades con borrado lógico se encuentran:

* gimnasios;
* sucursales;
* usuarios de gimnasio;
* roles;
* miembros;
* planes de membresía;
* beneficios de planes;
* archivos;
* fotografías;
* dispositivos de acceso;
* categorías de ingreso.

No actualizar directamente:

* `deleted_at`;
* `deleted_by`;
* `deletion_reason`.

Utilizar las RPC diseñadas para ello:

* `soft_delete_entity`;
* `restore_entity`;
* `archive_gym`;
* `restore_gym`;
* `list_deleted_entities`.

No ejecutar `DELETE` físico desde el frontend.

Los registros financieros e históricos no utilizan borrado lógico.

No borrar:

* facturas;
* pagos;
* cargos;
* suscripciones;
* ingresos;
* eventos de acceso;
* alertas;
* auditorías.

Estos registros deben manejarse mediante sus estados de ciclo de vida.


## Supabase Storage

Los archivos reales se almacenan en Supabase Storage.

La tabla `media_assets` almacena únicamente metadatos y referencias.

No guardar imágenes como:

* `bytea`;
* Base64;
* cadenas dentro de JSON;
* columnas binarias.

El bucket actual es:

```text
gym-media
```

El bucket es privado.

La ruta debe comenzar con el identificador del gimnasio:

```text
<gym_id>/<person_id-o-general>/<uuid>.<extension>
```

Ejemplo:

```text
9fd6.../members/4c71.../photo.webp
```

El primer segmento de la ruta debe coincidir con el `gym_id` del registro.

Formatos permitidos actualmente:

* WebP;
* AVIF;
* JPEG;
* PNG;
* PDF.

Límite actual por archivo:

```text
10 MB
```

Las imágenes deben comprimirse antes de almacenarse.

Preferir WebP o AVIF para fotografías.

No permitir que el usuario controle libremente el nombre final del objeto.

Generar nombres únicos.

Validar:

* MIME real;
* extensión;
* tamaño;
* permisos;
* gimnasio;
* propósito;
* ruta;
* duplicados cuando corresponda.


## Eliminación de archivos

Eliminar el registro de PostgreSQL no elimina el objeto de Storage. No modificar ni eliminar directamente registros de `storage.objects`.

**El worker que procesa la cola no existe todavía.** El esquema tiene `storage_deletion_queue` y sus tres RPC (`claim`/`complete`/`fail_storage_deletion_job`, que requieren `service_role`), pero nada en `src/` las llama y no hay `supabase/functions/`. Los objetos borrados lógicamente siguen ocupando Storage.

Consecuencia que importa: hay fotografías biométricas en `gym-media` y este archivo promete que el consentimiento se puede revocar con retención. Hoy no hay camino para que esa fotografía muera. Construir el worker cuando exista su disparador real (revocación de consentimiento o baja de miembro con foto), no antes: sin caso de uso no se puede probar.


## Reconocimiento facial

Módulo implementado. El esquema cubre fotografías, consentimiento biométrico, modelos faciales, embeddings, eventos, dispositivos, alertas y búsqueda por similitud con `pgvector`.

**Los embeddings son de 128 dimensiones y usan OpenCV YuNet + SFace.** La decisión fue aprobada por el supervisor el 8 de agosto de 2026 porque Buffalo/InsightFace requiere una licencia incompatible con el despliegue actual. El número vive en cuatro contratos editables por separado: `services/face-recognition/app.py`, el `zod .length(128)` de `member-face-enrollment.repository.ts`, el chequeo de `face-verification.repository.ts` y el tipo `vector(128)` establecido por `20260808050000_sface_128_dimensions.sql`. Cambiar la dimensión exige otra decisión explícita sobre el modelo, migración completa y actualización coordinada de los cuatro contratos.

Antes de crear un embedding debe existir consentimiento biométrico válido.

El consentimiento debe poder:

* otorgarse;
* revocarse;
* expirar;
* definir retención.

La fotografía original se almacena en Supabase Storage.

El embedding se almacena en PostgreSQL.

La generación del embedding debe ejecutarse en:

* Edge Function;
* servicio Python confiable;
* servidor seguro.

Nunca generar o validar decisiones críticas únicamente en el navegador.

El flujo recomendado es:

1. capturar o subir fotografía;
2. comprimirla;
3. guardarla en Storage;
4. registrar metadatos;
5. verificar consentimiento;
6. generar embedding en un servicio confiable;
7. guardar embedding;
8. ejecutar `match_face_candidates`;
9. validar membresía y morosidad;
10. registrar el evento;
11. generar alerta cuando corresponda.

No utilizar reconocimiento facial como única evidencia irreversible de identidad.

Debe existir revisión manual para casos dudosos.


## Auditoría

Registrar acciones críticas como:

* cambios de roles;
* cambios de permisos;
* creación o suspensión de usuarios;
* pagos;
* anulaciones;
* cancelaciones;
* cambios de membresía;
* borrado lógico;
* restauraciones;
* archivado de gimnasios;
* cambios de configuración;
* operaciones biométricas;
* acceso administrativo de plataforma.

No guardar en auditoría:

* contraseñas;
* tokens;
* claves;
* imágenes completas;
* embeddings completos;
* información sensible innecesaria.

No afirmar que una acción fue auditada sin verificar que realmente se creó el registro.


## Seguridad, más allá de lo ya dicho

RLS, Storage privado, manejo de claves y desconfianza del frontend están en sus propias secciones y no se repiten acá. Lo que no aparece en ninguna otra:

* protección contra XSS y contra CSRF donde aplique;
* rotación de secretos comprometidos y dependencias actualizadas;
* logs sin credenciales;
* backups verificados, con una restauración probada antes del piloto;
* rate limiting en autenticación y en reconocimiento facial.

Sobre validación: puede vivir en el formulario, en Zod, en el servidor, en una restricción de PostgreSQL, en RLS o en una RPC. La del cliente mejora la experiencia y no protege nada; **toda regla crítica debe existir además en PostgreSQL o en una función confiable.**


## Reglas para agentes Codex

* Leer `AGENTS.md` y `Docs/trello-board-template.md`.
* Trabajar una tarjeta a la vez.
* No ampliar el MVP silenciosamente.
* No cambiar la arquitectura Supabase-first.
* No introducir otro backend sin aprobación.
* No inventar tablas o endpoints.
* Revisar migraciones antes de modificar datos.
* No editar producción sin una migración versionada.
* No exponer `service_role`.
* No omitir RLS.
* No usar `DELETE` físico desde la aplicación.
* No modificar datos históricos para ocultar errores.
* No incluir secretos.
* No afirmar que algo fue probado sin ejecutar la prueba.
* No sobrescribir cambios ajenos.
* Usar español simple y respuestas concisas.
* Informar brechas reales entre frontend, migraciones y producto.
* Detener la implementación cuando falte una decisión crítica de dinero, seguridad, permisos o biometría.


## Estado y prioridades

El orden del trabajo, su estado y sus dependencias viven en el tablero de Trello, no en este archivo. Una lista de prioridades escrita acá se desactualiza sin que nadie lo note: la que había en su lugar daba por pendientes la tasa de cambio, la matriz de roles, el flujo vertical completo y el reconocimiento facial, todos ya implementados y mergeados.

Decisiones de alcance que siguen abiertas y que ningún tablero reemplaza:

* validar la hipótesis principal con al menos 10 dueños o gerentes;
* decidir si el miembro tendrá acceso propio.

## Guía técnica

Lo que sigue vive en `Docs/guia-tecnica.md` y se lee al tocar cada área, no al
empezar una sesión: objetivo y usuarios del producto, autenticación, acceso a
datos desde Next.js, catálogo de roles y permisos, procedimiento de migraciones,
uso del SQL Editor, desarrollo del frontend, Realtime, Edge Functions,
estrategia de pruebas, forma de trabajo del equipo y criterio de terminado.
