begin;

create or replace function private.belongs_to_active_gym()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.gyms g
    join public.gym_users gu on gu.gym_id = g.id
    where gu.auth_user_id = auth.uid()
      and gu.status = 'active'
      and gu.deleted_at is null
      and g.deleted_at is null
  );
$$;

create or replace function private.can_create_person()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.gyms g
    join public.gym_users gu on gu.gym_id = g.id
    join public.gym_user_roles gur on gur.gym_user_id = gu.id
    join public.roles r on r.id = gur.role_id and r.gym_id = gu.gym_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where gu.auth_user_id = auth.uid()
      and gu.status = 'active'
      and gu.deleted_at is null
      and g.deleted_at is null
      and r.deleted_at is null
      and p.code in ('members.manage', 'staff.manage')
  );
$$;

create or replace function private.can_create_self_service_gym(
  p_created_by uuid,
  p_created_at timestamptz
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_recent_gym_count integer;
begin
  if p_created_by is null or p_created_by is distinct from auth.uid() then
    return false;
  end if;

  if p_created_at < now() - interval '5 minutes'
     or p_created_at > now() + interval '5 minutes' then
    return false;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('gym-self-service:' || p_created_by::text, 0)
  );

  select count(*)
  into v_recent_gym_count
  from public.gyms g
  where g.created_by = p_created_by
    and g.created_at >= now() - interval '24 hours';

  return v_recent_gym_count < 3;
end;
$$;

drop policy gyms_insert on public.gyms;
create policy gyms_insert on public.gyms
for insert to authenticated
with check (
  private.can_create_self_service_gym(created_by, created_at)
);

drop policy persons_insert on public.persons;
create policy persons_insert on public.persons
for insert to authenticated
with check (
  created_by = auth.uid()
  and private.can_create_person()
);

drop policy permissions_read on public.permissions;
create policy permissions_read on public.permissions
for select to authenticated
using (private.belongs_to_active_gym());

drop policy screen_permissions_read on public.screen_permissions;
create policy screen_permissions_read on public.screen_permissions
for select to authenticated
using (private.belongs_to_active_gym());

revoke truncate on all tables in schema public from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke truncate on tables from anon, authenticated;

comment on function private.can_create_self_service_gym(uuid, timestamptz) is
  'Allows at most 3 self-service gym creations per auth user in a rolling 24-hour window.';

commit;
