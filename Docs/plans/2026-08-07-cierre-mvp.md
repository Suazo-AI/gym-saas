# Plan de cierre del MVP - FitManager

Escrito 2026-08-07.
Base verificada: `origin/main` = `fc711390a599bf58a8ad7352b9637ade5ed654a3`.
Ese commit está en verde: `npm run preflight` pasa (typecheck, lint, 58 archivos / 170 tests, build).

Este documento es autocontenido.
Quien lo ejecute no participó de la conversación que lo originó, así que acá está todo lo que hace falta.

## Contexto en tres líneas

FitManager es un SaaS multi-tenant para gimnasios pequeños de Nicaragua, construido sobre Next.js App Router y Supabase.
El 2026-08-07 se auditó el tablero de Trello contra el código y aparecieron seis trabajos concretos, ordenados abajo por riesgo.
El objetivo de todos juntos es dejar el producto en condiciones de correr un piloto con un gimnasio real.

## Reglas que no se negocian

Estas valen para los seis paquetes.
Romper cualquiera invalida el trabajo entero.

1. **Nunca correr `supabase db reset`.** El stack local de Supabase es uno solo y está compartido entre 12 worktrees. Un reset le borra la base a todos los demás.
2. **Nunca editar una migración ya aplicada.** Todo cambio de base de datos es un archivo nuevo en `supabase/migrations/` con timestamp posterior al último existente.
3. **Nunca hacer push a `main` ni a `develop`.** Cada paquete va en su propia rama y termina en un Pull Request.
4. **Nunca agregar `Co-Authored-By`, "Generated with", ni firma de agente** en commits ni en descripciones de PR. Es regla explícita del dueño del repositorio.
5. **Nunca usar el em dash (U+2014) ni el en dash (U+2013)** en código, comentarios, commits, documentación ni Markdown. Guion normal siempre.
6. **Nunca tocar credenciales.** No crear cuentas, no cargar tarjetas, no pegar secretos. Si un paso las necesita, se detiene y se reporta.
7. **`npm run preflight` tiene que pasar** antes de abrir cada PR. Si no pasa, el paquete no está listo.
8. **No afirmar que algo fue probado sin haberlo ejecutado.** Si una prueba no se corrió, decirlo.

### Trampas conocidas, cuestan horas si se redescubren

- Los worktrees no traen `node_modules` ni `.env.local`. Hay que correr `npm ci` y copiar `.env.local` desde `C:\Users\Jason\gym-saas\.env.local`.
- `npm run preflight` corre typecheck, lint, vitest y build. El build necesita las tres variables `NEXT_PUBLIC_*`.
- Los tests pgTAP (148 aserciones en 16 archivos) **no** corren en `preflight`. Corren en el job `.github/workflows/db.yml`, que levanta Supabase local. Se ejecutan con `npm run test:db`.
- Los mensajes de commit con `/` seguido de texto disparan un hook de seguridad. Usar `git commit -F archivo`.
- No pasar archivos `.sql` por `Get-Content | docker exec -i psql`: corrompe los acentos y produce falsos fallos. Usar `docker cp` y después `psql -f` sobre la ruta interna.
- PowerShell no tiene `wc` ni `sort -u`. Usar `Measure-Object -Line` y `Select-Object -Unique`.
- Docker Desktop en esta máquina entra en bucle de crash. El arreglo está en `~/.claude/scripts/fix-docker.ps1`: cerrar Docker y renombrar **los dos** directorios a la vez (`AppData\Local\Docker\run` y `AppData\Local\docker-secrets-engine`). Renombrar uno solo no alcanza. Nunca usar "Reset to factory defaults": borra imágenes y volúmenes.

### Decisiones de producto ya cerradas, no re-litigar

- El MVP opera **USD y NIO**, no solo NIO. El contrato de tasa de cambio está implementado y probado con 27 aserciones pgTAP, con semilla C$36.60 por US$1.
- **No hay método QR** de entrada. El método es búsqueda manual más reconocimiento facial.
- **Caja básica queda fuera del piloto.**
- **El reconocimiento facial queda dentro del MVP.**
- Los módulos de Reportes, Exportar e Ingresos están congelados hasta que se hagan entrevistas a dueños de gimnasio. No avanzarlos.

---

## Paquete 1 - Bloquear la escritura directa a `member_payments`

**Riesgo: alto. Toca dinero. Va primero.**

Rama sugerida: `fix/member-payments-direct-write`

### El problema

La política `member_payments_manage` en `supabase/migrations/20260716010000_initial_schema.sql:2500` es:

```sql
create policy member_payments_manage on public.member_payments
  for all to authenticated
  using (private.has_permission(gym_id, 'payments.manage'))
```

Es `for all`, y **no existe** ningún `revoke insert, update, delete on public.member_payments from authenticated`.

Consecuencia: cualquier usuario con el permiso `payments.manage` puede hacer `POST` o `PATCH` directo contra `/rest/v1/member_payments` desde el navegador, salteándose todo lo que valida la RPC `register_member_payment`: whitelist de moneda, coincidencia de moneda con el cargo, tope de sobrepago, fecha futura, generación del número de recibo y escritura en `audit_logs`.
Un `PATCH` puede cambiar el `amount` de un pago histórico sin dejar rastro en auditoría.

Además `receipt_number` es nullable (`initial_schema.sql:594`) y su índice es `unique (gym_id, receipt_number)` (`:601`).
PostgreSQL permite N filas con `NULL` en un índice único, así que hoy pueden existir varios pagos sin recibo.

### El patrón a copiar, ya existe en el repo

- `supabase/migrations/20260802150000_member_entries.sql:120` - `revoke insert, update, delete on public.member_entries from authenticated;`
- `supabase/migrations/20260801200552_face_verify_security_controls.sql:34` - `revoke all on table public.face_verification_rate_limits from authenticated;`
- `supabase/migrations/20260804023000_gym_exchange_rate_contract.sql:52` - trigger de inmutabilidad con `raise exception 'Exchange-rate history is immutable'`

### Qué hacer

1. Migración nueva que revoque `insert, update, delete` sobre `public.member_payments`, `public.membership_charges` y `public.member_payment_allocations` para el rol `authenticated`. Dejar el `select` intacto: la app lee esas tablas directamente en `src/features/payments/services/payment.repository.ts:41`.
2. En la misma migración, backfill de `receipt_number` para cualquier fila que lo tenga en `NULL`, y después `alter column receipt_number set not null`.
3. Verificar que las cinco RPC que insertan pagos siguen funcionando. Todas son `security definer`, así que el revoke no las afecta, pero hay que probarlo, no asumirlo. Son:
   - `register_member_payment` (`20260802140000`)
   - `record_member_payment` (`20260804034000:103`)
   - `register_member_day_pass` (`20260805010000`)
   - `start_member_subscription` (`20260804031000`)
   - `create_member_with_payment` (`20260721174500:339`)
4. Archivo pgTAP nuevo en `supabase/tests/`, siguiendo el estilo de los 16 existentes. Tiene que cubrir, como mínimo:
   - un `insert` directo a `member_payments` como `authenticated` con `payments.manage` **falla**
   - un `update` directo del `amount` de un pago existente **falla**
   - un `delete` directo **falla**
   - `register_member_payment` sigue registrando un pago correctamente
   - `void_member_payment` sigue anulando correctamente
5. Correr `npm run test:db` y confirmar que el total sube desde 148.

### Terminado cuando

`npm run preflight` pasa, `npm run test:db` pasa con el archivo nuevo incluido, y el PR describe qué se revocó y por qué.

---

## Paquete 2 - Eliminar el estado `overdue` almacenado

**Riesgo: alto. Toca una tabla financiera. Hacerlo ahora que no hay datos reales.**

Rama sugerida: `refactor/overdue-derived-state`

### El problema

`membership_charges.status` es de tipo `charge_status`, con valores `('pending','partial','paid','overdue','void')`.
El valor `overdue` depende del tiempo, y nadie lo refresca.

`private.refresh_membership_charge_status` (`initial_schema.sql:1635`) es la única función que lo escribe, y se dispara solo por dos triggers de pago:
- `trg_payment_allocations_refresh_charge` (`:1669`)
- `trg_member_payment_status_refresh` (`:1697`)

O sea: un cargo que nadie paga se queda en `pending` para siempre, aunque su `due_date` haya pasado hace meses.

Pero **ningún consumidor lee esa columna para decidir nada**. Los tres caminos de lectura calculan el vencimiento al vuelo:

- `v_member_access_status` (`20260716010200_soft_delete.sql:1512`):
  `mc.status in ('pending','partial','overdue') and mc.due_date < current_date`
- `v_gym_dashboard` (`20260716010200_soft_delete.sql:1537`): idéntico
- `private.member_access_allowed` (`initial_schema.sql:1722`): idéntico, más los días de gracia del plan

Por eso el resultado que ve el usuario ya es correcto.
Lo único roto es que la columna miente en una lectura cruda de la tabla, y cualquier query futura que escriba `where status = 'overdue'` va a sub-reportar morosidad en silencio.

La decisión tomada fue **no construir un cron que refresque la columna**, sino dejar de guardar un valor derivado del tiempo.

### Qué hacer

1. Migración nueva que haga backfill: `update public.membership_charges set status = 'pending' where status = 'overdue' and ...` - respetando que si tiene pagos parciales debe quedar `partial`. Reusar la lógica de `refresh_membership_charge_status` para no inventar un criterio nuevo.
2. En la misma migración, `alter table public.membership_charges add constraint ... check (status <> 'overdue')`.
3. Reemplazar `private.refresh_membership_charge_status` con una versión que ya no escriba `'overdue'`. Hoy su `case` tiene la rama `when v_due_date < current_date then 'overdue'` (`initial_schema.sql:1639`): esa rama sale.
4. Lo mismo en `generate_membership_charges` (`initial_schema.sql:1768`), que asigna `'overdue'` al crear un cargo con fecha pasada.
5. Crear **una sola** definición canónica de "vencido". Recomendado: una función `private.charge_is_overdue(...)` o una vista `v_membership_charge_status` que exponga un `effective_status`. Apuntar los tres consumidores ahí, para que la regla viva en un solo lugar.
6. Archivo pgTAP nuevo que cubra:
   - intentar escribir `status = 'overdue'` **falla** por el check
   - un cargo con `due_date` pasada y sin pagos figura como vencido en la vista canónica
   - un cargo con `due_date` pasada pero pagado **no** figura vencido
   - el acceso del miembro sigue denegándose por morosidad igual que antes

**Importante:** `'overdue'` **no** se borra del enum `charge_status`.
PostgreSQL no permite eliminar valores de un enum, y migrar el tipo de una tabla financiera es más riesgo del que vale.
Queda como vocabulario muerto, igual que `refunded` y `partially_refunded` en `payment_status`, que tampoco se escriben nunca.

### Terminado cuando

`npm run preflight` y `npm run test:db` pasan, y ninguna de las 17 aserciones de `supabase/tests/member_entries.sql` ni las 5 de `owner_dashboard_contract.sql` se rompió.

---

## Paquete 3 - Unificar las dos RPC de cobro

**Riesgo: alto. Toca dinero.**

Rama sugerida: `refactor/unify-payment-rpc`

### El problema

Conviven dos RPC de cobro con reglas contradictorias, y la pantalla desde la que entra el usuario decide qué puede hacer:

- `register_member_payment` (`20260802140000`): multi-cargo, **permite** pagos parciales, valida sobrepago, fecha futura y coincidencia de moneda. Tiene 19 aserciones pgTAP en `supabase/tests/register_member_payment.sql`. La usa la ruta `/payments/new`.
- `record_member_payment` (`20260804034000:103`): un solo cargo, **prohíbe** parciales con `raise exception 'Full remaining charge amount is required'`. La usa la ruta `/payments`.

Consecuencia práctica: desde la pantalla principal de pagos no se puede cobrar un abono, y desde la otra sí. No está documentado en ningún lado.

Además generan números de recibo con tres formatos distintos: `R-`, `PAY-` y `DAY-`.
Y solo `register_member_payment` tiene reintento ante colisión de `receipt_number` (`:281-323`, hasta 5 reintentos ante `unique_violation`); las otras fallan con el error crudo.

### Qué hacer

1. Adoptar `register_member_payment` como canónica: es la más completa y la mejor probada.
2. Migrar la UI de `/payments` (`src/features/payments/components/payment-management.tsx` y `src/features/payments/actions/payment.actions.ts`) para que use la canónica.
3. Deprecar `record_member_payment` sin borrarla de golpe: dejarla en su lugar con un `raise exception` que indique cuál usar, o mantenerla como wrapper que delega. Elegir una y documentar el porqué en el PR.
4. Unificar el formato del número de recibo y extraer la generación con reintento a una función `private` compartida, para que las cinco rutas de inserción la usen.
5. Extender el pgTAP: un pago parcial registrado desde el camino que hoy lo rechaza tiene que funcionar.

### Terminado cuando

Se puede cobrar un abono desde `/payments`, `preflight` y `test:db` pasan, y el PR explica qué pasó con la RPC deprecada.

---

## Paquete 4 - Pantalla de alertas y alertas de entrada

**Riesgo: medio.**

Rama sugerida: `feat/alerts-screen`

### Lo que ya existe, no reconstruir

El esquema está completo en `supabase/migrations/20260716010000_initial_schema.sql`:

- `alert_types` (`:823`), `gym_alerts` (`:831`), `gym_alert_recipients` (`:854`)
- enums `alert_severity` y `alert_status` (`:56`)
- RLS con los permisos `alerts.read` y `alerts.manage` (`:2596`)
- seis tipos sembrados (`:993`): `FACE_NO_MATCH`, `FACE_ACCESS_DENIED`, `MEMBERSHIP_UNPAID`, `MEMBERSHIP_EXPIRED`, `DEVICE_OFFLINE`, `SAAS_PAYMENT_FAILED`
- la pantalla `alerts` ya está en el catálogo con ruta `/alerts` y permiso `alerts.read` (`:966` y `:984`)

### Los tres huecos

1. `register_member_entry` (`20260802150000:253`) no inserta ninguna alerta, ni siquiera al denegar el acceso por morosidad o membresía vencida, aunque `MEMBERSHIP_UNPAID` y `MEMBERSHIP_EXPIRED` existen justo para eso. El único camino que escribe `gym_alerts` en todo el repo es el trigger `trg_face_event_create_alert` (`:2051`), que solo cubre eventos faciales.
2. El usuario nunca ve una alerta. Solo existe el contador `openAlerts` del dashboard. `grep gym_alerts src/` da cero. No hay ruta `/alerts` en `src/app`.
3. **Trampa crítica:** `src/features/app/components/app-shell.tsx:8` tiene un `Set` hardcodeado llamado `supportedRoutes`, y el menú se arma con `screens.filter(s => supportedRoutes.has(s.route))`. `/alerts` no está en ese Set. Agregar la pantalla a la tabla `screens` y darle permisos **no alcanza**: si no se agrega la ruta a ese `Set`, la pantalla nunca aparece en el menú. Este mismo bug ya mordió una vez con `facial_access`.

`grep -i alert supabase/tests/` da cero en los 16 archivos: no hay ninguna cobertura pgTAP de alertas.

### Qué hacer

1. Ruta `src/app/(gym)/alerts/` con listado, severidad, filtro por estado, y los estados de carga, vacío y error que usan las demás pantallas.
2. Agregar `/alerts` a `supportedRoutes` en `app-shell.tsx:8`.
3. Acciones de `acknowledge` y `resolve`, que la política `gym_alerts_manage` ya autoriza a nivel de base de datos.
4. Hacer que `register_member_entry` emita una alerta cuando deniega por morosidad o por membresía vencida.
5. pgTAP nuevo de `gym_alerts`: RLS, el trigger facial, la alerta de entrada denegada, y aislamiento entre gimnasios.

### Terminado cuando

Un usuario con `alerts.read` ve la pantalla en el menú y su contenido, uno sin el permiso no, y uno de otro gimnasio no ve alertas ajenas. Probado con los tres.

---

## Paquete 5 - Cablear los filtros de miembros

**Riesgo: bajo. Es el mejor ratio de valor por esfuerzo del tablero.**

Rama sugerida: `feat/member-filters-ui`

### El problema

`listMembers` ya acepta y valida con Zod los filtros `status`, `membershipStatus` y `hasOverdueCharges` (`src/features/members/schemas/member.schema.ts:16-18`), y la vista `api_v1_member_summaries` ya expone las columnas necesarias, incluidas `overdue_amount` y `has_overdue_charges` (`20260721174500_members_api_contract.sql:21-22`). Hay 15 aserciones pgTAP sobre esa vista.

Pero `src/app/(gym)/members/page.tsx:22` solo le pasa `gymId`, `page` y `search`.
Los filtros están construidos, validados y desconectados de la interfaz.

### Qué hacer

Agregar `searchParams` a la page, pasarlos al repository, y poner los controles en la UI siguiendo el patrón de `src/features/app/components/persisted-search-form.tsx`, que ya existe.

Sin migración y sin RPC nueva.

### Terminado cuando

Se puede filtrar por estado, estado de membresía y morosidad desde `/members`, y `preflight` pasa.

---

## Paquete 6 - Hacer desplegable el servicio de reconocimiento facial

**Riesgo: alto. Es bloqueante del piloto.**

Rama sugerida: `feat/face-service-deployable`

### El problema

`services/face-recognition/` contiene exactamente cuatro archivos: `app.py`, `requirements.txt`, `test_quality.py` y `README.md`.
No hay `Dockerfile`, ni `docker-compose`, ni `fly.toml`, ni `railway.json`, ni `render.yaml`, ni `Procfile`, ni `vercel.json` en **todo** el repositorio.
Hoy el servicio se corre a mano con `uvicorn`.

Y falla en silencio: `FACE_RECOGNITION_SERVICE_URL` está declarada como `.optional()` en `src/lib/env.ts:7`.
Next.js compila y despliega perfecto con el servicio facial muerto.
En producción el reconocimiento simplemente no responde, y nadie se entera hasta que una recepcionista lo intenta con un socio adelante.

Como el reconocimiento facial quedó dentro del MVP, sin esto el único método de entrada que funciona en producción es la búsqueda manual.

### Qué hacer

1. **Dockerfile.** Iterar hasta que `docker build` y `docker run` levanten y un `POST` real a `/embed` con una foto devuelva un embedding de 512 dimensiones. Esperar fallos por librerías de sistema: `opencv` necesita `libgl1` y `libglib2.0-0`, y `onnxruntime` puede necesitar herramientas de compilación. Es un ciclo de build, error, arreglo, rebuild: insistir hasta que pase.
2. **Modelo horneado en la imagen.** `app.py:27` descarga `buffalo_l.zip` al arrancar. Decidido: el modelo va dentro de la imagen. Un servicio que depende de una descarga externa para levantar es un servicio que se cae sin motivo. Bajarlo en tiempo de build, no en tiempo de arranque.
3. **Autenticar `/embed`.** Hoy el endpoint no valida quién le pega. Es un endpoint biométrico: cualquiera con la URL puede mandar caras y obtener embeddings. Agregar un secreto compartido por header, leído de variable de entorno en los dos lados, y que `src/features/entries/services/face-embedding.service.ts:20` lo mande.
4. **Fallar ruidoso.** Cambiar `FACE_RECOGNITION_SERVICE_URL` de `.optional()` a requerida en `src/lib/env.ts`, o agregar una verificación de arranque que falle si falta. Ajustar el CI, que hoy usa valores placeholder, para que siga pasando.
5. **Healthcheck.** Endpoint `/health` que confirme que el modelo cargó, no solo que el proceso vive.
6. **Runbook** en `services/face-recognition/README.md`: cómo se construye, cómo se despliega, qué variables necesita, cómo se verifica que quedó bien.

### Lo que este paquete NO incluye

Elegir el host, crear la cuenta, cargar el medio de pago y desplegar.
Eso requiere credenciales y lo hace el dueño del repositorio.
El paquete termina con una imagen que corre localmente y una rama lista.

### Terminado cuando

`docker build` produce una imagen, `docker run` la levanta, un `POST` autenticado a `/embed` devuelve 512 dimensiones, un `POST` sin autenticar es rechazado, `preflight` pasa y el runbook está escrito.

---

## Orden de ejecución

Los paquetes 1, 2, 5 y 6 son independientes entre sí y se pueden hacer en cualquier orden.
El 3 conviene después del 1, porque los dos tocan `member_payments` y así se evita resolver conflictos.
El 4 es independiente.

Orden recomendado por riesgo: **1, 2, 3, 6, 4, 5.**

Un Pull Request por paquete.
Nunca mezclar dos paquetes en la misma rama.

## Cómo se verifica cada entrega

Antes de dar un paquete por terminado:

1. `npm run preflight` en verde.
2. `npm run test:db` en verde, si el paquete tocó la base de datos.
3. La rama no contiene cambios ajenos al paquete.
4. Ninguna migración previamente aplicada fue modificada.
5. El PR describe qué cambió, por qué, y qué se probó de verdad.
