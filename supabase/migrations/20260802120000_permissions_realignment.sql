-- ============================================================================
-- Realineacion de permisos: entradas y membresias en recepcion
--
-- Motivo:
--   1. AGENTS.md define que la recepcionista maneja "miembros, membresias,
--      cobros y entradas", pero private.bootstrap_new_gym() solo le otorga
--      'memberships.read'. Hoy una recepcionista no puede asignar ni renovar
--      una membresia.
--   2. El registro de entrada manual (sin camara) necesita permisos propios.
--      No existe ningun codigo 'entries.*' en el catalogo.
--
-- Esta migracion es la base compartida de las tres tareas del flujo vertical
-- (asignar membresia, registrar pago, registrar entrada). Se aplica una sola
-- vez porque `create or replace function private.bootstrap_new_gym()` no es
-- aditivo: dos migraciones que reemplacen esa funcion se pisan entre si.
--
-- Alcance: catalogo de permisos, mapa de roles de sistema para gimnasios
-- nuevos, y backfill de los gimnasios ya existentes. No crea tablas, no toca
-- datos financieros y no elimina permisos de ningun rol.
--
-- Orden de aplicacion: despues de 20260722024500_face_enrollment_contract.sql
-- ============================================================================

begin;

-- ============================================================================
-- 1. CATALOGO DE PERMISOS
-- ============================================================================

insert into public.permissions(code, name, description)
values
  ('entries.read', 'View entries', 'View member entry records'),
  ('entries.manage', 'Manage entries', 'Register member entries and overrides')
on conflict (code) do nothing;

-- ============================================================================
-- 2. MAPA DE ROLES PARA GIMNASIOS NUEVOS
--
-- Cambios respecto a 20260716010000_initial_schema.sql:
--   receptionist: + memberships.manage, + entries.read, + entries.manage
--   accountant:   + entries.read
--   trainer:      + entries.read
--   owner:        sin cambios (recibe todos los permisos del catalogo)
--   admin:        sin cambios (todos menos billing.manage)
-- ============================================================================

create or replace function private.bootstrap_new_gym()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_role uuid;
  v_admin_role uuid;
  v_reception_role uuid;
  v_accountant_role uuid;
  v_trainer_role uuid;
  v_gym_user uuid;
begin
  insert into public.roles(gym_id, code, name, description, is_system)
  values (new.id, 'owner', 'Owner', 'Full tenant control', true)
  returning id into v_owner_role;

  insert into public.roles(gym_id, code, name, description, is_system)
  values (new.id, 'admin', 'Administrator', 'Operational administration', true)
  returning id into v_admin_role;

  insert into public.roles(gym_id, code, name, description, is_system)
  values (new.id, 'receptionist', 'Receptionist', 'Members, memberships, payments and access', true)
  returning id into v_reception_role;

  insert into public.roles(gym_id, code, name, description, is_system)
  values (new.id, 'accountant', 'Accountant', 'Payments, income and reports', true)
  returning id into v_accountant_role;

  insert into public.roles(gym_id, code, name, description, is_system)
  values (new.id, 'trainer', 'Trainer', 'Read member information', true)
  returning id into v_trainer_role;

  insert into public.role_permissions(role_id, permission_id)
  select v_owner_role, id from public.permissions;

  insert into public.role_permissions(role_id, permission_id)
  select v_admin_role, id
  from public.permissions
  where code not in ('billing.manage');

  insert into public.role_permissions(role_id, permission_id)
  select v_reception_role, id
  from public.permissions
  where code in (
    'gym.read', 'members.read', 'members.manage',
    'memberships.read', 'memberships.manage',
    'payments.read', 'payments.manage',
    'entries.read', 'entries.manage',
    'faces.read', 'faces.verify', 'alerts.read', 'dashboard.read',
    'media.read', 'media.manage'
  );

  insert into public.role_permissions(role_id, permission_id)
  select v_accountant_role, id
  from public.permissions
  where code in (
    'gym.read', 'members.read', 'memberships.read',
    'payments.read', 'payments.manage', 'income.read', 'income.manage',
    'entries.read', 'dashboard.read'
  );

  insert into public.role_permissions(role_id, permission_id)
  select v_trainer_role, id
  from public.permissions
  where code in ('gym.read', 'members.read', 'entries.read', 'dashboard.read');

  insert into public.gym_users(
    gym_id, auth_user_id, status, invited_by, accepted_at
  )
  values (
    new.id, new.created_by, 'active', new.created_by, timezone('utc', now())
  )
  returning id into v_gym_user;

  insert into public.gym_user_roles(gym_user_id, role_id, assigned_by)
  values (v_gym_user, v_owner_role, new.created_by);

  insert into public.income_categories(gym_id, code, name, is_membership_related)
  values
    (new.id, 'membership', 'Membership income', true),
    (new.id, 'registration', 'Registration fees', true),
    (new.id, 'products', 'Product sales', false),
    (new.id, 'other', 'Other income', false);

  return new;
end;
$$;

-- ============================================================================
-- 3. BACKFILL DE GIMNASIOS EXISTENTES
--
-- Solo agrega filas faltantes en role_permissions para los roles de sistema.
-- Nunca revoca. Los roles personalizados (is_system = false) no se tocan.
-- ============================================================================

-- owner: recibe todo el catalogo, incluidos los codigos nuevos.
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'owner'
  and r.is_system
on conflict (role_id, permission_id) do nothing;

-- admin: todo menos billing.manage.
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'admin'
  and r.is_system
  and p.code not in ('billing.manage')
on conflict (role_id, permission_id) do nothing;

-- receptionist: gana memberships.manage y las entradas.
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'receptionist'
  and r.is_system
  and p.code in ('memberships.manage', 'entries.read', 'entries.manage')
on conflict (role_id, permission_id) do nothing;

-- accountant y trainer: solo lectura de entradas.
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code in ('accountant', 'trainer')
  and r.is_system
  and p.code = 'entries.read'
on conflict (role_id, permission_id) do nothing;

commit;

-- ============================================================================
-- VERIFICACION (ejecutar despues de aplicar)
-- ============================================================================
-- -- Los dos codigos nuevos existen una sola vez:
-- select code, name from public.permissions
-- where code in ('entries.read', 'entries.manage')
-- order by code;
--
-- -- Ningun rol de sistema quedo sin los permisos esperados:
-- select r.gym_id, r.code as role_code, count(*) filter (
--          where p.code in ('memberships.manage', 'entries.read', 'entries.manage')
--        ) as nuevos
-- from public.roles r
-- join public.role_permissions rp on rp.role_id = r.id
-- join public.permissions p on p.id = rp.permission_id
-- where r.is_system
-- group by r.gym_id, r.code
-- order by r.gym_id, r.code;
--
-- -- Toda recepcionista debe poder gestionar membresias:
-- select count(*) as recepcionistas_sin_permiso
-- from public.roles r
-- where r.code = 'receptionist' and r.is_system
--   and not exists (
--     select 1 from public.role_permissions rp
--     join public.permissions p on p.id = rp.permission_id
--     where rp.role_id = r.id and p.code = 'memberships.manage'
--   );
-- -- Debe devolver 0.

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- Revierte el mapa de roles y retira los permisos otorgados aqui. No borra los
-- codigos del catalogo si algun rol personalizado ya los usa.
--
-- begin;
--
-- delete from public.role_permissions rp
-- using public.roles r, public.permissions p
-- where rp.role_id = r.id
--   and rp.permission_id = p.id
--   and r.is_system
--   and (
--     (r.code = 'receptionist' and p.code in ('memberships.manage', 'entries.read', 'entries.manage'))
--     or (r.code in ('accountant', 'trainer') and p.code = 'entries.read')
--     or (r.code in ('owner', 'admin') and p.code in ('entries.read', 'entries.manage'))
--   );
--
-- delete from public.permissions
-- where code in ('entries.read', 'entries.manage')
--   and not exists (
--     select 1 from public.role_permissions rp
--     where rp.permission_id = public.permissions.id
--   );
--
-- -- Restaurar private.bootstrap_new_gym() desde
-- -- supabase/migrations/20260716010000_initial_schema.sql (linea 1100).
--
-- commit;
