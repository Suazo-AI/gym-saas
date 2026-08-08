# Sprint 8 al 14 de agosto, parte 1 - paquetes de Jason

Escrito 2026-08-08.
Base verificada: `origin/main` = `db5aaf7`, con CI y pgTAP en verde.

Documento autocontenido. Quien lo ejecute no participó de la conversación que lo originó.

## Alcance de este documento

Solo las tarjetas asignadas a Jason en la lista `Sprint actual (8Ago - 14Ago. Parte 1)`.
Las de Bradly quedan explícitamente fuera y no se tocan.

| Paquete | Tarjeta de Trello | Estado hoy |
|---|---|---|
| S1 | Anulación y reembolso de pagos | 5/8, falta el reembolso |
| S2 | Módulo simple de ingresos | 1/5 |
| S3 | Exportar datos | 0/5 |
| S4 | Reportes esenciales | 0/7 |

Fuera del sprint pero delegado aparte: las 5 vulnerabilidades de npm, en la rama `fix/npm-audit`.

## Supuesto declarado, para que quede escrito

S3 y S4 se construyen **antes** de que existan las entrevistas a dueños de gimnasio. Es una decisión tomada a conciencia: se prefiere avanzar y aceptar retrabajo.

Consecuencia de diseño, y no es negociable: **ninguno de los dos inventa un motor nuevo.** Se construyen como una capa delgada sobre vistas y filtros que ya existen y ya están probados. Si las entrevistas cambian el requisito, se tira la capa, no los cimientos.

## Reglas que no se negocian

Idénticas a `Docs/plans/2026-08-07-cierre-mvp.md`, que ya se ejecutó completo. Resumidas:

1. Nunca `supabase db reset`: el stack local está compartido entre 12 worktrees.
2. Nunca editar una migración ya aplicada. Todo cambio de base es un archivo nuevo, con timestamp **posterior a `20260807190000`**, que es la última en main.
3. Nunca hacer push ni abrir Pull Requests. Una rama por paquete, commit local, y ahí termina.
4. Sin `Co-Authored-By`, sin "Generated with", sin firma de agente.
5. Sin em dash (U+2014) ni en dash (U+2013). Guion normal.
6. Sin credenciales: no crear cuentas, no cargar tarjetas, no pegar secretos.
7. `npm run preflight` y, si el paquete toca la base, `npm run test:db`, tienen que pasar antes de dar el paquete por terminado.
8. No afirmar que algo fue probado sin haberlo ejecutado.

Trampas de esta máquina: los worktrees no traen `node_modules` ni `.env.local` (correr `npm ci` y copiar desde `C:\Users\Jason\gym-saas\.env.local`); los mensajes de commit con `/` seguido de texto disparan un hook, usar `git commit -F archivo`; PowerShell no tiene `wc` ni `sort -u`.

---

## S1 - Reembolso de pagos y prueba real de la anulación

Rama: `feat/payment-refund`

### Lo que ya existe y funciona

`void_member_payment(uuid, text)` (`20260804034000_member_payment_management.sql:118`) anula de punta a punta: exige motivo, guarda `before_data` en `audit_logs`, y el cargo se reabre solo por el trigger `trg_member_payment_status_refresh`. La UI tiene el botón Anular en `payment-management.tsx`.

### Hueco 1: la anulación no tiene prueba de comportamiento

`supabase/tests/member_payment_management.sql` solo tiene `has_function` para el void. Nada prueba que funcione.

Agregar aserciones que cubran:
- después de anular, `member_payments.status` es `void`
- el cargo asociado vuelve a `pending` o a `partial` según corresponda
- se escribió una fila en `audit_logs` con `action = 'member_payment.voided'` y `before_data` no nulo
- un segundo void sobre el mismo pago falla
- anular un pago de otro gimnasio falla con `42501`

### Hueco 2: el reembolso no existe

`refund` aparece una sola vez en todo el repo y es la declaración del enum (`initial_schema.sql:39`). Los valores `refunded` y `partially_refunded` son letra muerta.

Crear `public.refund_member_payment(p_payment_id uuid, p_amount numeric, p_reason text)`:

- `security definer` con `set search_path = ''`, igual que las demás.
- Exige el permiso `payments.manage`, error `42501` si falta.
- Solo sobre pagos en estado `settled`.
- Exige motivo de 3 caracteres como mínimo.
- `p_amount` no puede superar el monto del pago menos lo ya reembolsado.
- Monto igual al total: el pago queda `refunded`. Monto menor: queda `partially_refunded`.
- **No modifica `amount`, `currency`, `paid_at`, `receipt_number` ni `applied_nio_per_usd` del pago original.** El histórico no se toca.
- Revierte las asignaciones a cargos de forma proporcional, para que el cargo vuelva a quedar con saldo.
- Escribe en `audit_logs` con `before_data` completo y `action = 'member_payment.refunded'`.
- `revoke all on function ... from public` más `grant execute ... to authenticated, service_role`.

Diferencia con la anulación, que hay que respetar: **anular dice "este pago nunca debió existir"; reembolsar dice "el pago existió y se devolvió la plata".** Por eso el reembolso no borra ni oculta el pago, le agrega un evento encima.

Cadena en `src/features/payments/`: repository, action, schema Zod y UI, siguiendo exactamente el patrón de `voidPayment`.

pgTAP nuevo que cubra: reembolso total, reembolso parcial, reembolso que excede el monto (falla), reembolso sobre pago ya anulado (falla), reembolso sin permiso (`42501`), y que el cargo recupere saldo.

### Terminado cuando

`preflight` y `test:db` en verde, y el total de aserciones pgTAP sube al menos 12.

---

## S2 - Completar el módulo de ingresos

Rama: `feat/income-module`

### Estado

`src/features/income/` tiene dos archivos: `services/income.repository.ts` y `types/income.dto.ts`. Solo lectura agregada. Cero tests pgTAP tocan ingresos.

### Lo que ya existe en la base y hay que usar, no recrear

- `other_income_entries` (`initial_schema.sql:877`) con RLS por `income.read` e `income.manage` (`:2647`), y trigger de coherencia de tenant (`:1486`).
- `income_categories` (`:866`), sembrada con 4 categorías por gimnasio al crear el gimnasio (`:1177`): `membership`, `registration`, `products`, `other`.
- `v_gym_income` (`:2694`): union de `member_payments` con status `settled` y `other_income_entries` con status `posted`, con una columna `source_type`.
- `v_gym_income_daily` (`:2723`): agrega por gimnasio, día y moneda.

### Los cuatro huecos

1. **Otros ingresos: no hay forma de crear uno.** Falta la RPC de inserción, la server action y el formulario. La RPC exige `income.manage`, valida que la categoría y la sucursal pertenezcan al gimnasio, monto mayor que cero con dos decimales como máximo, y moneda en `('NIO','USD')` igual que el resto del sistema.
2. **Categorías: existen y no se ven.** Falta exponerlas, y falta que `v_gym_income` proyecte `income_category_id` para poder agrupar. Ojo: modificar una vista existente se hace con una migración nueva que la reemplaza, nunca editando la vieja.
3. **Filtros por fecha: no existen.** `listDailyIncome(gymId, limit = 30)` no acepta rango. Agregar `from` y `to`, con `searchParams` en la page y controles en la UI, siguiendo el patrón de `src/features/app/components/persisted-search-form.tsx`.
4. **Total mensual: no existe en este módulo.** Lo único mensual del repo es `current_month_income` del dashboard, con el mes corriente hardcodeado. Hace falta una serie mensual consultable por rango.

**Trampa de zona horaria, importante.** `v_gym_income_daily` agrupa por `occurred_at::date` sin `at time zone`, o sea en UTC. Nicaragua es UTC-6, así que el "día" de ingresos corta a las 18:00 hora local. La agregación nueva tiene que usar la zona horaria del gimnasio, que ya está en `gyms.timezone`. Corregir también la vista diaria existente.

pgTAP nuevo: crear un ingreso, rechazarlo sin `income.manage`, rechazar categoría de otro gimnasio, y que la agregación diaria y la mensual den el número correcto con datos conocidos.

### Terminado cuando

El dueño puede consultar ingresos del día y del mes con rango de fechas, y crear un ingreso que no venga de un pago de membresía.

---

## S3 - Exportar datos a CSV

Rama: `feat/data-export`

**Este es el paquete de mayor riesgo del sprint.** Una exportación mal hecha filtra la base de miembros de otro gimnasio en un solo click.

### Diseño decidido

- Dos route handlers en `src/app/api/export/`: `members/route.ts` y `payments/route.ts`. Método GET, respuesta `text/csv` con `Content-Disposition: attachment`.
- **Permisos: se reutilizan los existentes, no se inventan.** El CSV de miembros exige `members.read`; el de pagos exige `payments.read`. El criterio: si podés ver el dato en pantalla, podés exportarlo. Un permiso `export.*` nuevo obligaría a sembrarlo en todos los roles y a migrar la matriz, sin ganar nada.
- El `gym_id` **nunca** se lee de la query string. Sale de `getActiveGym()`, igual que en `src/app/api/face/verify/route.ts`, que es el único route handler existente y el patrón a copiar.
- Los datos salen de las vistas ya probadas: `api_v1_member_summaries` para miembros, y la consulta de pagos que ya usa `payment.repository.ts`.
- Filtros por rango de fechas en el CSV de pagos, y los mismos filtros de `listMembers` en el de miembros.
- Tope de filas por exportación, para que una petición no tumbe el servidor. Si se supera, se responde con un error claro, no con un CSV truncado en silencio.

### Riesgo de CSV injection

Un miembro llamado `=cmd|...` se convierte en fórmula al abrir el archivo en Excel. Toda celda que empiece con `=`, `+`, `-` o `@` se prefija con una comilla simple. Esto va probado.

### Criterios de aceptación congelados

Están escritos de antemano en `supabase/tests/export_contract.sql` y su `sha256` está registrado en `verification/packages.json`. **El ejecutor no puede modificar ese archivo.** Si lo toca, el verificador rechaza el paquete completo.

Hacen falta además pruebas de vitest sobre los route handlers que cubran: sin sesión responde 401, sin permiso responde 403, y un usuario del gimnasio A no obtiene ni una fila del gimnasio B.

### Terminado cuando

Un usuario autorizado descarga el CSV de su gimnasio, uno sin permiso recibe 403, y uno de otro gimnasio no ve ni una fila ajena, todo probado.

---

## S4 - Reportes esenciales

Rama: `feat/essential-reports`

### Lo que NO hay que hacer

No construir un motor de reportes. No inventar el permiso `reports.read`. No crear vistas nuevas si una existente sirve con un parámetro más.

Recordar el supuesto declarado arriba: esto se construye sin saber qué pidieron los dueños. Capa delgada.

### Los siete ítems y de dónde sale cada dato

| Reporte | Fuente que ya existe | Qué falta |
|---|---|---|
| Miembros activos | `api_v1_member_summaries.status`, filtro ya cableado a la UI | nada, ya está |
| Membresías por vencer | `membership_status` y `next_payment_date` en la misma vista | ventana configurable, hoy son 7 días fijos en el dashboard |
| Morosos | `has_overdue_charges` y `overdue_amount`, filtro ya cableado | nada, ya está |
| Pagos por periodo | `listRecentPayments(gymId, limit)` | parámetros `from` y `to` |
| Entradas por periodo | `listGymEntries(gymId, limit)` | parámetros `from` y `to`. Ojo: `entriesToday` del dashboard cuenta solo eventos faciales e ignora las entradas manuales, eso es un defecto |
| Ingresos por periodo | lo entrega S2 | depende de S2 |
| Cierre de caja | descartado del MVP el 2026-08-07 | nada, no aplica |

Tres de los siete ya están cubiertos por los filtros de miembros que se mergearon en el PR #46. Lo que falta de verdad es agregar rango de fechas a pagos y a entradas, y corregir el conteo de entradas para que incluya las manuales.

### Terminado cuando

Cada cifra tiene definición, consulta y filtros documentados en la descripción de la tarjeta, y los rangos de fecha funcionan en pagos y en entradas.

---

## Orden y dependencias

S4 depende de S2 para el ítem de ingresos por periodo. El resto son independientes.

Orden recomendado: **S1, S3, S2, S4.** Primero lo que toca dinero, después lo que puede filtrar datos, y al final lo que depende de otro.

Una rama por paquete. Nunca dos paquetes en la misma rama.
