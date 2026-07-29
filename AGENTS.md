# AGENTS.md — FitManager / Gym SaaS

## Producto y forma de trabajo

SaaS multi-tenant para gimnasios pequeños de Nicaragua (aprox. 25–100
miembros). Usuarios iniciales: dueño, gerente, recepcionista y administrador
interno del SaaS. La hipótesis de pérdida de tiempo/control por papel, Excel y
WhatsApp no se considera validada hasta entrevistar al menos 10 dueños o
gerentes.

Antes de analizar o editar:

1. Leer este archivo completo.
2. Revisar `git status` y preservar cambios ajenos.
3. Confirmar que la tarea pertenece al MVP y no contradice estas decisiones.
4. Si afecta Supabase, revisar esquema y migraciones existentes.
5. Detenerse si falta una decisión sobre dinero, seguridad, permisos,
   multi-tenancy, biometría o alcance.

No existe un Trello operativo enlazado al repositorio; no exigir tarjeta hasta
que el equipo incorpore y enlace un tablero real.

Usar español simple y respuestas concisas. No ampliar alcance, cambiar
arquitectura, inventar tablas/endpoints, sobrescribir trabajo ajeno ni afirmar
que algo fue probado sin evidencia real.

## Alcance

MVP: registro/configuración de gimnasios y sucursales; aislamiento de tenants;
usuarios, roles y permisos; miembros; planes y suscripciones; cargos, pagos,
aplicación de pagos, estados de cuenta, morosidad y cancelaciones; entradas;
alertas; dashboard; ingresos simples; auditoría; USD y NIO; archivos/fotos en
Supabase Storage; borrado lógico administrativo.

El esquema soporta biometría, pero eso no obliga a implementar reconocimiento
facial en el primer flujo vertical.

Fuera del MVP: app móvil nativa, rutinas, nutrición, nómina, contabilidad
completa, inventario avanzado, puertas automáticas, grandes cadenas, portal del
entrenador y funciones no aprobadas explícitamente. El acceso propio del
miembro sigue pendiente: no implementarlo sin aprobación.

## Arquitectura fija

- Frontend: Next.js App Router, React, TypeScript/TSX, Tailwind, Vercel.
- Backend: Supabase (PostgreSQL, Auth, Storage, RLS, funciones/RPC, triggers,
  vistas `security_invoker`, Edge Functions) y `pgvector`.
- Supabase es la frontera de seguridad, no solo la DB.
- No introducir ASP.NET Core, Entity Framework, SQL Server, Somee ni otro
  backend principal sin decisión explícita.
- Separar cliente Supabase de navegador, cliente de servidor, operaciones
  privilegiadas, dominio, validación y UI. No poner reglas críticas en React.
- CRUD simple puede usar Supabase bajo RLS. Dinero, cancelaciones, permisos,
  biometría y eliminación deben ser atómicos mediante RPC, Route Handler,
  Server Action, Edge Function o servidor confiable.

## Supabase y migraciones

Scripts ya aplicados al proyecto remoto:

1. `gym_saas_supabase_schema.sql`
2. `gym_saas_storage_only_migration.sql`
3. `gym_saas_soft_delete_migration.sql`

Conservarlos versionados preferiblemente en `supabase/migrations/`. Nunca
reaplicar el esquema inicial completo en producción ni editar una migración ya
aplicada. Cada cambio futuro requiere migración incremental nueva; ningún
cambio solo en SQL Editor.

Una migración debe incluir lo necesario: tablas, índices, restricciones,
funciones, triggers, RLS, grants, vistas, comentarios, rollback viable y
consultas/pruebas de verificación. Antes de aplicar: revisar dependencias,
datos, destructividad, respaldo, entorno local/dev, RLS, permisos y aislamiento
entre gimnasios. Después: validar funciones/políticas, probar distintos tenants
y actualizar documentación.

SQL Editor sirve para diagnóstico, verificación, pruebas controladas o aplicar
una migración aprobada; todo SQL manual debe copiarse de inmediato a una
migración. Antes de SQL destructivo en producción revisar proyecto, rama,
entorno, transacción, tablas, respaldo e impacto multi-tenant.

## Seguridad, Auth y multi-tenancy

- Toda entidad comercial pertenece a un gimnasio por `gym_id` o relación
  verificable. Toda consulta respeta el gimnasio activo.
- Toda inserción, actualización, RPC o eliminación lógica valida: usuario
  autenticado, gimnasio activo, pertenencia y estado del usuario, permiso y
  estado lógico de la entidad.
- Ningún usuario puede leer/modificar otro gimnasio. No confiar en filtros de
  Next.js. Mantener aislamiento con RLS, funciones seguras y servidor.
- `service_role` omite RLS: validar `gym_id` manualmente. Nunca enviarlo al
  navegador, usar `NEXT_PUBLIC_*`, guardarlo en Git/logs/ejemplos. Solo entorno
  confiable; secretos en variables del despliegue.
- Auth exclusivamente con Supabase Auth y `auth.users`; nunca guardar
  contraseñas propias. Manejar registro, login/logout, recuperación, sesión y
  expiración, invitados, suspendidos y revocados. Validar páginas protegidas en
  servidor cuando sea posible.
- El frontend no es confiable para `gym_id`, precios, totales, monedas,
  permisos, pagos, membresías activas, acceso, IDs de usuario ni rutas.
- Ocultar UI no autoriza. Validar en formulario/Zod cuando aporte UX y en
  servidor/PostgreSQL/RLS/RPC para reglas críticas.

Toda tabla expuesta requiere RLS revisada. Preferir funciones existentes:
`private.is_gym_user(...)`, `private.has_permission(...)`,
`private.can_access_person(...)`, `private.is_service_role()`. Para tabla nueva
definir lectura, creación, actualización, eliminación, permiso, determinación
de gimnasio e historial. Probar políticas con usuario autorizado, sin permiso,
de otro gimnasio y no autenticado.

Seguridad mínima: HTTPS real, RLS, Storage privado, defensas XSS/CSRF,
validación de entrada/archivos, secretos por entorno, rotación, dependencias
actualizadas, logs sin credenciales, backups/restauración probados, rate limit
en operaciones sensibles y protección especial de auth/biometría.

## Roles y permisos

El esquema contiene pantallas, permisos, relación pantalla-permiso, usuarios de
gimnasio, roles, permisos por rol y asignaciones. Roles iniciales:

- Dueño: control total de su gimnasio.
- Gerente: operación/reportes autorizados, sin propiedad SaaS.
- Recepcionista: miembros, membresías, cobros y entradas; finanzas limitadas.
- Administrador de plataforma: gestión/soporte/auditoría; acciones especiales
  siempre auditadas.

Autorizar por códigos de permiso, nunca solo por nombre de rol. No cambiar
códigos existentes sin migración y revisión frontend.

## Dinero, pagos y suscripciones

- Nunca `float`/`double` para dinero. PostgreSQL usa `numeric`; TypeScript no
  usa `number` para cálculos críticos sin estrategia segura.
- Registro financiero mínimo: monto, moneda, fecha, estado, gimnasio y usuario
  responsable cuando aplique.
- Facturación SaaS (planes/suscripción/facturas/pagos del gimnasio) y
  facturación de miembros (planes/suscripciones/cargos/pagos) son dominios
  distintos; no mezclarlos.
- No borrar pagos. Anular, reembolsar o corregir con operación auditada,
  conservando historial. No confiar en totales del navegador.
- Generar cargos, aplicar pagos y cancelar suscripciones atómicamente. Usar
  cuando corresponda: `generate_membership_charges`,
  `cancel_member_subscription`, `request_saas_subscription_cancellation`.

No implementar conversión USD/NIO hasta cerrar y migrar tasa por gimnasio. La
referencia inicial será C$36.50/US$1; guardar tasa aplicada en cada transacción,
cambios solo afectan operaciones nuevas y nunca recalcular historial.

## Borrado lógico e historial

Borrado lógico solo para entidades administrativas/CRUD: gimnasios,
sucursales, usuarios de gimnasio, roles, miembros, planes/beneficios, archivos,
fotos, dispositivos de acceso y categorías de ingreso.

Nunca actualizar directamente `deleted_at`, `deleted_by`, `deletion_reason` ni
ejecutar `DELETE` físico desde frontend. Usar `soft_delete_entity`,
`restore_entity`, `archive_gym`, `restore_gym`, `list_deleted_entities`.

Facturas, pagos, cargos, suscripciones, ingresos, eventos de acceso, alertas y
auditorías son históricos/financieros: no se borran; usan estados de ciclo de
vida.

## Storage

- Objetos en bucket privado `gym-media`; `media_assets` solo guarda metadatos.
- Nunca `bytea`, Base64, JSON binario ni imágenes dentro de PostgreSQL.
- Ruta: `<gym_id>/<person_id-o-general>/<uuid>.<extension>`; primer segmento
  debe coincidir con `gym_id`. Usuario no controla nombre final.
- Formatos: WebP, AVIF, JPEG, PNG, PDF. Máximo 10 MB. Comprimir imágenes y
  preferir WebP/AVIF.
- Validar MIME real, extensión, tamaño, permisos, gimnasio, propósito, ruta y
  duplicados aplicables.

Borrar metadatos no borra Storage. Flujo: solicitar borrado lógico → crear
trabajo en `storage_deletion_queue` → worker/Edge Function confiable reclama →
API de Storage elimina → trabajo queda completado/fallido. RPC de cola requiere
`service_role`. Nunca manipular directamente `storage.objects`.

## Biometría

- Embeddings actuales: 512 dimensiones; cambiar requiere migración completa y
  decisión de modelo.
- Requiere consentimiento válido antes de crear embedding; debe poder
  otorgarse, revocarse, expirar y definir retención.
- Foto original en Storage; embedding en PostgreSQL. Generación solo en Edge
  Function, servicio Python confiable o servidor seguro; nunca decisión crítica
  solo en navegador.
- Flujo: captura/subida → compresión → Storage → metadatos → consentimiento →
  embedding → guardar → `match_face_candidates` → validar membresía/morosidad →
  evento → alerta aplicable.
- Reconocimiento facial nunca es única evidencia irreversible; revisión manual
  en casos dudosos.

Implementarlo solo después del flujo básico de miembros, membresías, pagos y
entradas.

## Auditoría

Auditar roles/permisos, usuarios creados o suspendidos, pagos/anulaciones,
cancelaciones, membresías, borrado/restauración/archivo, configuración,
biometría y acceso administrativo. Nunca auditar contraseñas, tokens, claves,
imágenes o embeddings completos ni datos sensibles innecesarios. No afirmar
auditoría sin comprobar el registro.

## Frontend, Realtime y Edge Functions

Construir UI desde contratos reales de Supabase. Antes de una pantalla,
identificar tablas/vistas/RPC, permisos, estados, RLS, validación, carga, vacío,
errores, actualización y offline si aplica. No inventar campos ni consultar
tablas históricas complejas cuando exista vista/RPC. Usar vistas preparadas
para estado de acceso, ingresos, ingresos diarios y dashboard.

Realtime solo por necesidad concreta (alertas, accesos recientes, recepción,
cambios relevantes), respetando RLS y limpiando suscripciones al desmontar.

Usar Edge Functions/servicio confiable para `service_role`, imágenes,
embeddings, correo, webhooks, tareas programadas, eliminación física de
Storage, pagos externos y secretos. No reemplazar CRUD normal innecesariamente.

## Pruebas y terminado

Pruebas proporcionales al riesgo:

- Bajo: UI, textos, estados vacíos.
- Medio: formularios, filtros, búsqueda, archivos y CRUD administrativo.
- Alto: pagos, membresías, cancelaciones, roles/permisos, RLS, multi-tenancy,
  biometría, `service_role`, eliminación y migraciones.

Multi-tenancy debe intentar acceso cruzado entre dos gimnasios. Una función
está terminada solo si cumple el MVP y criterios funcionales; respeta tenant y
permisos; maneja carga/éxito/vacío/validación/error; tiene pruebas y recorrido
realista; no expone secretos ni datos cruzados; actualiza docs; incluye
migración y revisión RLS cuando aplica; conserva historial; procesa trabajos de
Storage y no depende solo de validación frontend.

## Prioridad inmediata

1. Entrevistar 10 dueños/gerentes y confirmar el dolor.
2. Cerrar reglas de membresías, cargos y pagos.
3. Definir tasa USD/NIO y migración.
4. Decidir acceso propio del miembro.
5. Versionar las tres migraciones aplicadas.
6. Configurar Next.js con Supabase Auth.
7. Crear matriz inicial de roles/permisos.
8. Flujo vertical: registrar miembro → asignar membresía → generar cargo →
   registrar pago → consultar estado → registrar entrada.
9. Probar con dos gimnasios y confirmar aislamiento total.