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

`create_gym_member` es un contrato legado para el alta administrativa del miembro. No debe utilizarse para crear una suscripción activa sin pago. El flujo v2 separará el alta del miembro del inicio atómico de la membresía mediante `public.start_member_subscription(...)`.

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
- una membresía nueva requiere el pago completo del período por adelantado;
- no se admiten pagos parciales;
- el acceso se habilita solamente después de confirmar el pago completo;
- la gracia aplica únicamente a renovaciones de miembros previamente activos;
- precios, totales, moneda y tasa aplicada se derivan y validan en PostgreSQL;
- miembro duplicado queda protegido por restricciones unicas.

### Contrato prepago v2

RPC futura:

```sql
public.start_member_subscription(
  p_gym_member_id uuid,
  p_membership_plan_id uuid,
  p_start_date date,
  p_payment_method_id uuid,
  p_tendered_amount numeric,
  p_tendered_currency char(3)
)
```

La firma no acepta `gym_id`: PostgreSQL lo deriva de `p_gym_member_id` y valida que el miembro, el plan y el método de pago sean accesibles en el mismo gimnasio activo.

La operación debe ser atómica: deriva el gimnasio y el precio vigente, crea la instantánea de la suscripción, el cargo completo, el pago, su aplicación y el recibo. Si el monto no cubre exactamente el total exigible, debe rechazar toda la operación con SQLSTATE `23514` y `Full payment is required`. Los períodos configurables pueden expresarse en días, semanas o meses y siempre se cobran completos por adelantado.

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
