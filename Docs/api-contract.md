# Fit Manager API Contract

## Principios

- CRUD simple puede usar Supabase directo bajo RLS.
- Operaciones sensibles usan RPC o servidor confiable.
- El cliente nunca es fuente confiable de `gym_id`, permisos, precios, totales ni estados financieros.
- PostgreSQL mantiene snake_case.
- DTOs de frontend usan camelCase.
- Montos monetarios viajan como string decimal en DTOs.

## Errores

Los componentes no reciben errores crudos de Supabase. Se normalizan con:

- `VALIDATION_ERROR`
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `BUSINESS_RULE_VIOLATION`
- `RATE_LIMITED`
- `EXTERNAL_SERVICE_ERROR`
- `INTERNAL_ERROR`

Detalles internos de PostgreSQL quedan en `internalMessage`, no en mensajes de usuario.

## Paginacion

Entrada:

- `page`: inicia en 1.
- `pageSize`: default 20, maximo 100.
- orden determinista con columna principal y `gym_member_id`.

Salida:

- `page`
- `pageSize`
- `total`
- `pageCount`
- `hasNextPage`
- `hasPreviousPage`

## Autenticacion

Rutas implementadas:

- `/login`
- `/forgot-password`
- `/reset-password`
- `/auth/callback`
- `/dashboard`

El dashboard valida usuario en servidor. El cierre de sesion usa Server Action.

## Gimnasio Activo

Servicios:

- `getUserGyms()`
- `getActiveGym()`

El gimnasio activo se deriva de `gym_users` activos y `gyms` no eliminados logicamente. Si hay varios gimnasios, el contrato queda preparado para seleccionar uno; por ahora usa el primero.

## Miembros

### Listado

Vista: `public.api_v1_member_summaries`

Campos principales:

- `gym_id`
- `gym_member_id`
- `person_id`
- `member_code`
- `first_name`
- `last_name`
- `full_name`
- `status`
- `branch_id`
- `branch_name`
- `primary_photo_media_asset_id`
- `membership_status`
- `membership_plan_name`
- `next_payment_date`
- `overdue_amount`
- `has_overdue_charges`
- `created_at`

### Detalle

Vista: `public.api_v1_member_details`

Incluye resumen, persona, contactos, direccion principal, suscripcion actual, mensualidades pendientes y resumen de pagos. Relaciones multivaluadas se agregan como JSON.

### Crear

RPC: `public.create_gym_member(...)`

Puede crear en una transaccion:

- `persons`
- `person_contacts`
- `gym_members`
- `member_subscriptions`
- `membership_charges`
- `member_payments`
- `member_payment_allocations`
- `audit_logs`

Permiso requerido: `members.manage`.

Validaciones:

- sucursal pertenece al gimnasio;
- plan pertenece al gimnasio;
- metodo de pago activo;
- nombres obligatorios;
- pago inicial requiere plan, metodo y monto positivo;
- miembro duplicado queda protegido por restricciones unicas.

### Actualizar

RPC: `public.update_gym_member(...)`

Actualiza persona, miembro y contactos primarios enviados. No modifica pagos ni suscripciones.

Permiso requerido: `members.manage`.

### Borrado Logico y Restauracion

- Borrar: `soft_delete_entity('gym_member', id, reason)`.
- Restaurar: `restore_entity('gym_member', id)`.

No se usa `DELETE` fisico desde el frontend.

## Edge Functions Futuras

Reservadas para:

- procesamiento de imagenes;
- eliminacion fisica de Storage;
- embeddings faciales;
- webhooks externos;
- operaciones con secretos.

No se usan como reemplazo de CRUD normal bajo RLS.
