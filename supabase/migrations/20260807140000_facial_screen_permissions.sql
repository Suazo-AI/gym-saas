-- Deja la pantalla de reconocimiento facial con sus permisos propios.
--
-- Mientras 'facial_access' se uso como si fuera la pantalla de Entradas se le
-- colgaron los permisos del otro modulo. Hoy acepta tres:
--
--   faces.read       le corresponde
--   entries.read     heredado del uso anterior
--   entries.manage   heredado del uso anterior
--
-- En este esquema un rol no se conecta a una pantalla directamente: se conecta
-- por permisos (ver list_role_screen_access). Con los tres colgados, dar acceso
-- a la pantalla facial arrastraria permisos de entradas, y al reves. Es una
-- fuga silenciosa: no produce ningun error, solo permisos de mas.
--
-- No se pierde nada al quitarlos. La pantalla 'entries' tiene sus propios
-- entries.read y entries.manage, asi que los roles siguen viendo Entradas igual.
--
-- La pantalla 'facial_access' se conserva, inactiva y con faces.read intacto,
-- esperando que exista su ruta en src/app. El modulo va a construirse: esta
-- limpieza es justamente para que se construya sobre permisos correctos.

begin;

delete from public.screen_permissions sp
using public.screens s, public.permissions p
where sp.screen_id = s.id
  and sp.permission_id = p.id
  and s.code = 'facial_access'
  and p.code in ('entries.read', 'entries.manage');

-- Garantizar que conserve el suyo.
insert into public.screen_permissions (screen_id, permission_id)
select s.id, p.id
from public.screens s
join public.permissions p on p.code = 'faces.read'
where s.code = 'facial_access'
on conflict (screen_id, permission_id) do nothing;

commit;

-- ============================================================================
-- VERIFICACION
-- ============================================================================
--
-- select s.code, p.code
-- from public.screens s
-- join public.screen_permissions sp on sp.screen_id = s.id
-- join public.permissions p on p.id = sp.permission_id
-- where s.code in ('entries', 'facial_access')
-- order by s.code, p.code;
--
-- Esperado:
--   entries       | entries.manage
--   entries       | entries.read
--   facial_access | faces.read
