-- Consolida el catalogo de pantallas de Entradas.
--
-- Habia dos filas compitiendo por la ruta /entries:
--
--   'entries'        creada por 20260802150000_member_entries.sql, con los
--                    permisos del modulo (entries.read, entries.manage) y una
--                    ruta que existe en src/app/(gym)/entries.
--   'facial_access'  creada por el esquema inicial, con permiso faces.read y
--                    ruta /facial-access, que no existe en la aplicacion.
--
-- 20260804035000 intento renombrar 'facial_access' a /entries sin ver que
-- 'entries' ya ocupaba esa ruta. screens.route es UNIQUE, asi que la cadena
-- fallaba desde cero.
--
-- El reconocimiento facial hoy no es una pantalla propia: vive dentro de
-- Entradas como modal (src/features/entries/components/face-access-modal.tsx).
-- Por eso la pantalla que sobrevive es 'entries'.
--
-- Esta migracion es idempotente y converge al mismo estado final tanto desde
-- una base vacia como desde produccion, donde 20260804035000 ya corrio y dejo
-- 'facial_access' ocupando /entries.

begin;

-- 1. Liberar la ruta si en este entorno la tomo 'facial_access'.
update public.screens
set route = '/facial-access'
where code = 'facial_access'
  and route = '/entries';

-- 2. Garantizar que la pantalla correcta exista, con su nombre en espanol.
insert into public.screens (code, name, route, is_active)
values ('entries', 'Entradas', '/entries', true)
on conflict (code) do update
set name = 'Entradas',
    route = '/entries',
    is_active = true;

-- 3. Asegurar sus permisos.
insert into public.screen_permissions (screen_id, permission_id)
select s.id, p.id
from public.screens s
join public.permissions p on p.code in ('entries.read', 'entries.manage')
where s.code = 'entries'
on conflict (screen_id, permission_id) do nothing;

-- 4. Retirar la pantalla legacy del menu. No se borra: conserva el historial de
--    screen_permissions y de accesos por rol. Su ruta no existe en la app, asi
--    que dejarla activa producia un enlace roto en el nav.
--    Se restaura tambien el nombre original, que 20260804035000 habia cambiado
--    a 'Entradas': sin esto el estado final difiere segun el entorno venga de
--    una base vacia o de produccion.
update public.screens
set is_active = false,
    name = 'Facial access'
where code = 'facial_access';

commit;

-- ============================================================================
-- VERIFICACION
-- ============================================================================
--
-- select code, name, route, is_active from public.screens
-- where code in ('entries', 'facial_access');
--
-- Esperado:
--   entries        | Entradas       | /entries        | true
--   facial_access  | Facial access  | /facial-access  | false
