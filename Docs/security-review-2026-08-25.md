# Revisión de seguridad pre-piloto

Escrita 2026-08-25.
Base auditada: `origin/main` = `2da3895f7c4ceb6bd46d29acde0daf746b2d31a0`.

El método fue consultar el catálogo vivo de PostgreSQL, no leer las 50 migraciones.
Una migración dice lo que se quiso hacer; `pg_policies` y `information_schema` dicen lo que quedó.

Todas las consultas corrieron contra la base local de Supabase,
`supabase_db_gym-saas`, creada desde las mismas migraciones que produce el CI.

## Lo que está limpio

Cada fila es una consulta al catálogo, no una lectura de código.

| Clase | Consulta | Resultado |
|---|---|---|
| RLS | tablas de `public` con `relrowsecurity = false` | 0 filas |
| `search_path` | funciones `security definer` sin `search_path` en `proconfig` | 0 filas |
| Esquema `private` | `has_schema_privilege(rol, 'private', 'usage')` | `false` para `anon`, `authenticated` y `service_role` |
| Privilegios de `anon` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` sobre `public` | 0 filas |
| Dinero de miembros | `member_payments`, `membership_charges`, `member_payment_allocations`, `member_entries` | sin escritura para `authenticated`, el `revoke` está |
| Facturación SaaS | políticas de escritura en `saas_invoices`, `saas_payments`, `saas_payment_allocations`, `gym_saas_subscriptions` | ninguna, así que RLS niega por defecto |
| Storage | 4 políticas sobre `storage.objects` | atan ruta a `gym_id` y a permiso; `gym-media` tiene `public = false` |
| Rutas de servidor | `src/app/api/**`, 4 rutas | dos con `requireApiUser` más `requireGymPermission`, una con token Bearer y comparación de tiempo constante, una con límite de intentos |
| Secretos | `NEXT_PUBLIC_*` en `.env.example` | sólo URL, clave publicable y URL del sitio |

Las 39 funciones `private.*` que aparecen con `EXECUTE` para `PUBLIC` **no son un
hallazgo**: sin `USAGE` sobre el esquema, ningún rol de la API puede nombrarlas.

## Riesgos abiertos

### R1 - Cualquier usuario autenticado puede crear gimnasios sin límite

Gravedad: **alto**.

La política `gyms_insert` tiene `with_check (created_by = auth.uid())`.
Eso sólo exige que el creador se firme a sí mismo.

No hay tope por usuario, no hay verificación de suscripción SaaS y no hay
permiso requerido. Cada inserción dispara `private.bootstrap_new_gym`, que crea
roles, permisos y estado inicial.

Un usuario registrado puede inflar la base y saltarse la facturación del SaaS.

### R2 - Cualquier usuario autenticado puede crear personas sin límite

Gravedad: **medio-alto**.

`persons_insert` tiene el mismo `with_check (created_by = auth.uid())`.

`persons` es la tabla de identidad de miembros y de personal. Un usuario sin
gimnasio y sin ningún permiso puede insertar filas sin tope.

### R3 - `TRUNCATE` concedido a `anon` y a `authenticated`

Gravedad: **medio**.

`anon` tiene `TRUNCATE` sobre 58 tablas de `public`, `authenticated` sobre 57.

**`TRUNCATE` no pasa por RLS.** Una política correcta no lo detiene.

Hoy no es una puerta abierta, porque PostgREST no expone `TRUNCATE` y ninguna
ruta entrega SQL crudo. Es profundidad de defensa: el día que aparezca cualquier
camino a SQL arbitrario, esto pasa de medio a catastrófico.

Es la misma clase de agujero que encontró el trabajo de respaldo del 2026-08-24.

### R4 - F040, el reclamo de borrado de Storage no emite token de propiedad

Gravedad: **medio**. Ya documentado en `AGENTS.md:421`.

`claim_storage_deletion_jobs` no devuelve un token de propiedad, así que un
worker que revive pasados los 15 minutos puede completar un trabajo que ya
reclamó otro.

### R5 - Catálogo de permisos y de pantallas legible por cualquiera

Gravedad: **bajo**.

`permissions_read` y `screen_permissions_read` usan `USING true`.

Es un catálogo estático, no datos de gimnasio. Revela la forma del sistema de
permisos, nada más.

## Pendiente de verificar

`gym_user_roles_manage` valida `roles.manage` contra el gimnasio del **usuario
destino**, no contra el gimnasio del **rol** que se asigna.

Un usuario con `roles.manage` en el gimnasio X podría intentar asignarle a un
usuario de X un rol que pertenece al gimnasio Y.

Existe el trigger `private.validate_gym_user_role_tenant`, que probablemente lo
cierra. **No se ejerció.** Hace falta una prueba negativa que lo intente de
verdad y confirme que falla.
