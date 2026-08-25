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

## Riesgos cerrados

### R1 - Cualquier usuario autenticado puede crear gimnasios sin límite

Gravedad original: **alto**. Estado final: **cerrado**.

La política `gyms_insert` tiene `with_check (created_by = auth.uid())`.
Eso sólo exige que el creador se firme a sí mismo.

No hay tope por usuario, no hay verificación de suscripción SaaS y no hay
permiso requerido. Cada inserción dispara `private.bootstrap_new_gym`, que crea
roles, permisos y estado inicial.

La migración `20260825010000_security_review_access_hardening.sql` mantiene el
alta self-service y permite hasta 3 gimnasios por usuario en 24 horas. Un
bloqueo de transacción evita carreras entre altas simultáneas. La política
también rechaza fechas de creación manipuladas.

La vigila `security_review_gym_creation_limit.sql`. La prueba deja crear los
primeros 3 gimnasios y exige que el cuarto falle con `42501`.

### R2 - Cualquier usuario autenticado puede crear personas sin límite

Gravedad original: **medio-alto**. Estado final: **cerrado**.

`persons_insert` tiene el mismo `with_check (created_by = auth.uid())`.

`persons` es la tabla de identidad de miembros y de personal. La migración
`20260825010000_security_review_access_hardening.sql` exige una membresía activa
en un gimnasio y el permiso `members.manage` o `staff.manage`.

La vigila `security_review_person_creation.sql`. La prueba rechaza al usuario
sin gimnasio y conserva el alta para recepción con `members.manage`.

### R3 - `TRUNCATE` concedido a `anon` y a `authenticated`

Gravedad original: **medio**. Estado final: **cerrado**.

`anon` tiene `TRUNCATE` sobre 58 tablas de `public`, `authenticated` sobre 57.

**`TRUNCATE` no pasa por RLS.** Una política correcta no lo detiene.

Hoy no es una puerta abierta, porque PostgREST no expone `TRUNCATE` y ninguna
ruta entrega SQL crudo. Es profundidad de defensa: el día que aparezca cualquier
camino a SQL arbitrario, esto pasa de medio a catastrófico.

La migración `20260825010000_security_review_access_hardening.sql` quita
`TRUNCATE` de todas las tablas actuales para `anon` y `authenticated`. También
lo quita de los privilegios por defecto del rol `postgres`, que es el dueño que
crea las tablas de las migraciones del proyecto.

La vigila `security_review_truncate_privileges.sql`. La prueba revisa las tablas
actuales, el valor por defecto y una tabla futura creada dentro de la prueba.

### R4 - F040, el reclamo de borrado de Storage no emite token de propiedad

Gravedad original: **medio**. Estado final: **cerrado**.

`claim_storage_deletion_jobs` no devuelve un token de propiedad, así que un
worker que revive pasados los 15 minutos puede completar un trabajo que ya
reclamó otro.

La migración `20260825020000_storage_deletion_claim_tokens.sql` añade
`claim_token`. Cada reclamo lo rota. Las RPC de completar y fallar exigen el
token vigente. El worker lo pasa en ambas llamadas.

La vigila `security_review_storage_claim_token.sql`. La prueba rechaza tokens
ajenos y acepta los dos tokens entregados por el reclamo.

### R5 - Catálogo de permisos y de pantallas legible por cualquiera

Gravedad original: **bajo**. Estado final: **cerrado**.

`permissions_read` y `screen_permissions_read` usan `USING true`.

La migración `20260825010000_security_review_access_hardening.sql` permite leer
ambos catálogos solo a usuarios activos de algún gimnasio.

La vigila `security_review_permission_catalog.sql`. La prueba oculta ambos
catálogos al usuario sin gimnasio y conserva la lectura para un dueño activo.

## Verificación pendiente ejercida

`gym_user_roles_manage` valida `roles.manage` contra el gimnasio del **usuario
destino**, no contra el gimnasio del **rol** que se asigna.

Un usuario con `roles.manage` en el gimnasio X podría intentar asignarle a un
usuario de X un rol que pertenece al gimnasio Y.

La prueba `security_review_role_tenant.sql` intentó esa asignación como un dueño
con `roles.manage`. El trigger `private.validate_gym_user_role_tenant` la
rechazó con `P0001` y `Gym user and role must belong to the same gym`.

Gravedad final: **sin riesgo abierto**. No hizo falta una migración para este
punto. La prueba queda fija para impedir una regresión.

## Resultado pendiente

No queda ningún riesgo abierto de esta revisión. Falta solamente ejecutar los
dos comandos finales de verificación en el mismo commit y guardar su salida en
`Docs/evidence/security-review-2026-08-25.txt`.
