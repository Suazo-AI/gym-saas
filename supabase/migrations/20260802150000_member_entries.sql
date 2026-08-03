-- ============================================================================
-- Registro manual e historial unificado de entradas
--
-- Motivo:
--   La recepcion necesita registrar intentos de entrada sin convertirlos en
--   eventos faciales. Las entradas son historial inmutable y su autorizacion
--   se resuelve de forma atomica en PostgreSQL.
--
-- Alcance: enum de origen, tabla historica, integridad multi-tenant, RLS, RPC
-- de registro manual, vista unificada y catalogo de pantalla.
-- ============================================================================

begin;

-- ============================================================================
-- 1. ORIGEN Y TABLA HISTORICA
-- ============================================================================

create type public.entry_source as enum ('manual', 'face');

create table if not exists public.member_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  gym_member_id uuid not null references public.gym_members(id) on delete restrict,
  branch_id uuid references public.gym_branches(id) on delete set null,
  source public.entry_source not null,
  decision public.access_decision not null,
  decision_reason text,
  -- Retrato del miembro en el momento de la entrada. Se guarda en la fila en vez
  -- de resolverse por join al consultar: el historial es inmutable y debe seguir
  -- explicando por que se decidio lo que se decidio, aunque el miembro pague
  -- manana y su estado actual cambie.
  membership_status text,
  has_overdue_charges boolean not null default false,
  face_recognition_event_id uuid references public.face_recognition_events(id) on delete set null,
  registered_by uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_member_entries_gym_time
  on public.member_entries(gym_id, occurred_at desc);

create index idx_member_entries_member_time
  on public.member_entries(gym_member_id, occurred_at desc);

-- ============================================================================
-- 2. INTEGRIDAD MULTI-TENANT
-- ============================================================================

create or replace function private.validate_member_entry_tenant()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.gym_members gm
    where gm.id = new.gym_member_id
      and gm.gym_id = new.gym_id
  ) then
    raise exception 'Entry member does not belong to the gym';
  end if;

  if new.branch_id is not null and not exists (
    select 1
    from public.gym_branches b
    where b.id = new.branch_id
      and b.gym_id = new.gym_id
  ) then
    raise exception 'Entry branch does not belong to the gym';
  end if;

  if new.face_recognition_event_id is not null and not exists (
    select 1
    from public.face_recognition_events fre
    where fre.id = new.face_recognition_event_id
      and fre.gym_id = new.gym_id
  ) then
    raise exception 'Entry face event does not belong to the gym';
  end if;

  return new;
end;
$$;

create trigger trg_member_entries_validate_tenant
before insert or update of gym_id, gym_member_id, branch_id, face_recognition_event_id
on public.member_entries
for each row execute function private.validate_member_entry_tenant();

-- ============================================================================
-- 3. RLS Y PRIVILEGIOS INMUTABLES
-- ============================================================================

alter table public.member_entries enable row level security;

create policy member_entries_read on public.member_entries
  for select to authenticated
  using (private.has_permission(gym_id, 'entries.read'));

create policy member_entries_insert on public.member_entries
  for insert to authenticated
  with check (private.has_permission(gym_id, 'entries.manage'));

-- La RPC public.register_member_entry es la UNICA puerta de escritura. Sin este
-- revoke, cualquiera con 'entries.manage' podria hacer un POST directo a
-- /rest/v1/member_entries y fabricar historial: poner a otro como responsable,
-- declarar decision='allowed' para un moroso, marcar source='face' para una
-- entrada facial que nunca ocurrio o fechar hacia atras. Como la tabla es
-- inmutable, esa fila falsa no se podria corregir despues.
-- La politica member_entries_insert se conserva como defensa por si algun dia
-- alguien re-otorga el grant por error.
-- Si en el futuro el flujo facial necesita escribir aqui, debe hacerlo por una
-- RPC propia, no por PostgREST.
grant select on public.member_entries to authenticated;
revoke insert, update, delete on public.member_entries from authenticated;

-- ============================================================================
-- 4. RPC ATOMICA DE REGISTRO MANUAL
-- ============================================================================

create or replace function public.register_member_entry(
  p_gym_id uuid,
  p_gym_member_id uuid,
  p_branch_id uuid default null,
  p_override_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_allowed boolean;
  v_decision public.access_decision;
  v_decision_reason text;
  v_entry_id uuid;
  v_occurred_at timestamptz;
  v_member_code text;
  v_first_name text;
  v_last_name text;
  v_member_status public.member_status;
  v_has_active_subscription boolean;
  v_has_overdue_charges boolean;
  v_membership_status text;
  v_override_reason text := nullif(trim(p_override_reason), '');
begin
  if not private.has_permission(p_gym_id, 'entries.manage') then
    raise exception 'Insufficient permission: entries.manage'
      using errcode = '42501';
  end if;

  select
    status.member_code,
    status.first_name,
    status.last_name,
    status.member_status,
    status.has_active_subscription,
    status.has_overdue_charges
  into
    v_member_code,
    v_first_name,
    v_last_name,
    v_member_status,
    v_has_active_subscription,
    v_has_overdue_charges
  from public.v_member_access_status status
  join public.gym_members gm on gm.id = status.gym_member_id
  where status.gym_id = p_gym_id
    and status.gym_member_id = p_gym_member_id
    and gm.deleted_at is null;

  if not found then
    raise exception 'No encontramos el miembro en este gimnasio.'
      using errcode = 'P0002';
  end if;

  if p_branch_id is not null and not exists (
    select 1
    from public.gym_branches b
    where b.id = p_branch_id
      and b.gym_id = p_gym_id
  ) then
    raise exception 'No encontramos la sucursal en este gimnasio.'
      using errcode = '23503';
  end if;

  -- Solo cuentan como duplicado las entradas donde el miembro SI paso. Repetir un
  -- intento rechazado es legitimo: es exactamente lo que hace la recepcion cuando
  -- vuelve a intentar con un motivo para autorizarlo. Si contaramos los rechazos,
  -- el override seria imposible de registrar.
  if exists (
    select 1
    from public.member_entries me
    where me.gym_member_id = p_gym_member_id
      and me.decision in (
        'allowed'::public.access_decision,
        'manual_review'::public.access_decision
      )
      and me.occurred_at >= timezone('utc', now()) - interval '5 minutes'
  ) then
    raise exception 'Ya se registró una entrada de este miembro hace menos de 5 minutos.'
      using errcode = '22023';
  end if;

  v_allowed := private.member_access_allowed(p_gym_member_id);

  if v_member_status <> 'active'::public.member_status then
    v_membership_status := v_member_status::text;
  elsif not v_has_active_subscription then
    v_membership_status := 'expired';
  elsif v_has_overdue_charges then
    v_membership_status := 'past_due';
  else
    v_membership_status := 'active';
  end if;

  if v_allowed then
    v_decision := 'allowed'::public.access_decision;
    v_decision_reason := null;
  elsif v_override_reason is not null then
    v_decision := 'manual_review'::public.access_decision;
    v_decision_reason := v_override_reason;
  else
    v_decision := 'denied'::public.access_decision;
    -- El motivo queda guardado para siempre en el historial, asi que distingue
    -- cada estado: un prospecto que nunca compro una membresia no puede quedar
    -- registrado como si estuviera bloqueado.
    v_decision_reason := case
      when v_member_status = 'prospect'::public.member_status
        then 'El miembro aún no tiene una membresía.'
      when v_member_status = 'inactive'::public.member_status
        then 'El miembro está inactivo.'
      when v_member_status = 'suspended'::public.member_status
        then 'El miembro está suspendido.'
      when v_member_status = 'blocked'::public.member_status
        then 'El miembro está bloqueado.'
      when v_member_status = 'archived'::public.member_status
        then 'El miembro está archivado.'
      when not v_has_active_subscription
        then 'El miembro no tiene una membresía vigente.'
      when v_has_overdue_charges
        then 'El miembro tiene cargos vencidos fuera del período de gracia.'
      else 'El miembro no cumple las condiciones de acceso.'
    end;
  end if;

  insert into public.member_entries(
    gym_id,
    gym_member_id,
    branch_id,
    source,
    decision,
    decision_reason,
    membership_status,
    has_overdue_charges,
    registered_by
  )
  values (
    p_gym_id,
    p_gym_member_id,
    p_branch_id,
    'manual'::public.entry_source,
    v_decision,
    v_decision_reason,
    v_membership_status,
    coalesce(v_has_overdue_charges, false),
    v_actor
  )
  returning id, occurred_at into v_entry_id, v_occurred_at;

  if not v_allowed and v_override_reason is not null then
    insert into public.audit_logs(
      gym_id,
      actor_user_id,
      action,
      entity_table,
      entity_id,
      after_data
    )
    values (
      p_gym_id,
      v_actor,
      'entry.override',
      'member_entries',
      v_entry_id::text,
      jsonb_build_object(
        'gymMemberId', p_gym_member_id,
        'decision', v_decision,
        'reason', v_override_reason
      )
    );
  end if;

  return jsonb_build_object(
    'entryId', v_entry_id,
    'gymMemberId', p_gym_member_id,
    'decision', v_decision,
    'decisionReason', v_decision_reason,
    'accessAllowed', v_allowed,
    'occurredAt', v_occurred_at,
    'memberCode', v_member_code,
    'memberFullName', trim(concat_ws(' ', v_first_name, v_last_name)),
    'membershipStatus', v_membership_status,
    'hasOverdueCharges', v_has_overdue_charges
  );
end;
$$;

revoke all on function public.register_member_entry(uuid, uuid, uuid, text) from public;
grant execute on function public.register_member_entry(uuid, uuid, uuid, text)
  to authenticated, service_role;

-- ============================================================================
-- 5. VISTA UNIFICADA
-- ============================================================================

create or replace view public.v_gym_entries
with (security_invoker = true)
as
select
  me.gym_id,
  me.id as entry_id,
  me.gym_member_id,
  me.source,
  me.decision,
  me.decision_reason,
  me.membership_status,
  me.has_overdue_charges,
  me.occurred_at
from public.member_entries me

union all

select
  fre.gym_id,
  fre.id as entry_id,
  fre.gym_member_id,
  'face'::public.entry_source as source,
  fre.decision,
  fre.decision_reason,
  -- Los eventos faciales no guardan el estado del miembro; el historial los
  -- muestra con el motivo que si registraron.
  null::text as membership_status,
  false as has_overdue_charges,
  fre.occurred_at
from public.face_recognition_events fre
order by occurred_at desc;

grant select on public.v_gym_entries to authenticated, service_role;

-- ============================================================================
-- 6. CATALOGO DE PANTALLAS
-- ============================================================================

insert into public.screens(code, name, route, is_active)
values ('entries', 'Entries', '/entries', true)
on conflict do nothing;

insert into public.screen_permissions(screen_id, permission_id)
select s.id, p.id
from public.screens s
join public.permissions p on (
  s.code = 'entries'
  and p.code in ('entries.read', 'entries.manage')
)
on conflict (screen_id, permission_id) do nothing;

commit;

-- ============================================================================
-- VERIFICACION (ejecutar despues de aplicar)
-- ============================================================================
-- -- La tabla tiene RLS y solo politicas de lectura e insercion:
-- select c.relrowsecurity, p.policyname, p.cmd
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- left join pg_policies p on p.schemaname = n.nspname and p.tablename = c.relname
-- where n.nspname = 'public' and c.relname = 'member_entries';
--
-- -- La RPC es security definer y tiene search_path vacio:
-- select p.prosecdef, p.proconfig
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname = 'register_member_entry';
--
-- -- La pantalla tiene ambos permisos:
-- select s.code, p.code
-- from public.screens s
-- join public.screen_permissions sp on sp.screen_id = s.id
-- join public.permissions p on p.id = sp.permission_id
-- where s.code = 'entries'
-- order by p.code;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- begin;
--
-- delete from public.screen_permissions
-- where screen_id = (select id from public.screens where code = 'entries');
-- delete from public.screens where code = 'entries';
-- drop view if exists public.v_gym_entries;
-- drop function if exists public.register_member_entry(uuid, uuid, uuid, text);
-- drop trigger if exists trg_member_entries_validate_tenant on public.member_entries;
-- drop function if exists private.validate_member_entry_tenant();
-- drop table if exists public.member_entries;
-- drop type if exists public.entry_source;
--
-- commit;
