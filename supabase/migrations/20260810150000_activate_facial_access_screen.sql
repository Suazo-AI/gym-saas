-- Activa la pantalla facial solamente después de que /facial-access existe.
-- La pantalla conserva faces.read como permiso de navegación; la operación
-- biométrica sigue protegida por faces.verify en el Route Handler.

begin;

update public.screens
set
  name = 'Acceso facial',
  route = '/facial-access',
  is_active = true
where code = 'facial_access';

delete from public.screen_permissions sp
using public.screens s, public.permissions p
where sp.screen_id = s.id
  and sp.permission_id = p.id
  and s.code = 'facial_access'
  and p.code <> 'faces.read';

insert into public.screen_permissions (screen_id, permission_id)
select s.id, p.id
from public.screens s
join public.permissions p on p.code = 'faces.read'
where s.code = 'facial_access'
on conflict (screen_id, permission_id) do nothing;

commit;
