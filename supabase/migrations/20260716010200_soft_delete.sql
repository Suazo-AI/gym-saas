-- ============================================================================
-- GYM SaaS: soft delete, recycle bin and Storage deletion queue
-- Apply in this order:
--   1. gym_saas_supabase_schema.sql
--   2. gym_saas_storage_only_migration.sql
--   3. this migration
--
-- Soft delete is applied only to CRUD/master entities.
-- Financial and historical records are NOT soft-deleted:
-- invoices, payments, charges, subscriptions, income entries, access events,
-- alerts and audit records must use their lifecycle status instead.
-- ============================================================================

begin;

-- ============================================================================
-- 1. SOFT-DELETE COLUMNS
-- ============================================================================

alter table public.gyms
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deletion_reason text;

alter table public.gym_branches
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deletion_reason text;

alter table public.gym_users
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deletion_reason text;

alter table public.roles
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deletion_reason text;

alter table public.gym_members
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deletion_reason text;

alter table public.membership_plans
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deletion_reason text;

alter table public.membership_plan_benefits
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deletion_reason text;

alter table public.media_assets
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deletion_reason text,
  add column if not exists storage_deleted_at timestamptz;

alter table public.person_photos
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deletion_reason text;

alter table public.access_devices
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deletion_reason text;

alter table public.income_categories
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deletion_reason text;

-- ============================================================================
-- 2. PARTIAL UNIQUE INDEXES
-- Deleted rows no longer reserve business identifiers.
-- ============================================================================

alter table public.gyms
  drop constraint if exists gyms_slug_key;

create unique index if not exists uq_gyms_active_slug
  on public.gyms(lower(slug))
  where deleted_at is null;

alter table public.gym_branches
  drop constraint if exists gym_branches_gym_id_code_key;

create unique index if not exists uq_gym_branches_active_code
  on public.gym_branches(gym_id, lower(code))
  where deleted_at is null;

alter table public.gym_users
  drop constraint if exists gym_users_gym_id_auth_user_id_key,
  drop constraint if exists gym_users_gym_id_employee_code_key;

create unique index if not exists uq_gym_users_active_auth_user
  on public.gym_users(gym_id, auth_user_id)
  where deleted_at is null;

create unique index if not exists uq_gym_users_active_employee_code
  on public.gym_users(gym_id, lower(employee_code))
  where deleted_at is null and employee_code is not null;

alter table public.roles
  drop constraint if exists roles_gym_id_code_key;

create unique index if not exists uq_roles_active_code
  on public.roles(gym_id, lower(code))
  where deleted_at is null;

alter table public.gym_members
  drop constraint if exists gym_members_gym_id_person_id_key,
  drop constraint if exists gym_members_gym_id_member_code_key;

create unique index if not exists uq_gym_members_active_person
  on public.gym_members(gym_id, person_id)
  where deleted_at is null;

create unique index if not exists uq_gym_members_active_code
  on public.gym_members(gym_id, lower(member_code))
  where deleted_at is null;

alter table public.membership_plans
  drop constraint if exists membership_plans_gym_id_code_key;

create unique index if not exists uq_membership_plans_active_code
  on public.membership_plans(gym_id, lower(code))
  where deleted_at is null;

alter table public.membership_plan_benefits
  drop constraint if exists membership_plan_benefits_membership_plan_id_benefit_code_key;

create unique index if not exists uq_membership_plan_benefits_active_code
  on public.membership_plan_benefits(membership_plan_id, lower(benefit_code))
  where deleted_at is null;

drop index if exists public.uq_media_asset_hash_per_gym;
create unique index uq_media_asset_hash_per_gym
  on public.media_assets(gym_id, sha256_hex)
  where deleted_at is null and sha256_hex is not null;

drop index if exists public.uq_media_storage_object;
create unique index uq_media_storage_object
  on public.media_assets(bucket_name, object_path)
  where deleted_at is null;

alter table public.person_photos
  drop constraint if exists person_photos_gym_id_person_id_media_asset_id_purpose_key;

create unique index if not exists uq_person_photos_active_asset_purpose
  on public.person_photos(gym_id, person_id, media_asset_id, purpose)
  where deleted_at is null;

drop index if exists public.uq_primary_person_photo_per_purpose;
create unique index uq_primary_person_photo_per_purpose
  on public.person_photos(gym_id, person_id, purpose)
  where deleted_at is null and is_primary;

alter table public.access_devices
  drop constraint if exists access_devices_gym_id_code_key;

create unique index if not exists uq_access_devices_active_code
  on public.access_devices(gym_id, lower(code))
  where deleted_at is null;

alter table public.income_categories
  drop constraint if exists income_categories_gym_id_code_key;

create unique index if not exists uq_income_categories_active_code
  on public.income_categories(gym_id, lower(code))
  where deleted_at is null;

-- Query-support indexes.
create index if not exists idx_gyms_not_deleted
  on public.gyms(id) where deleted_at is null;

create index if not exists idx_gym_branches_active_gym
  on public.gym_branches(gym_id, id) where deleted_at is null;

create index if not exists idx_gym_users_active_gym
  on public.gym_users(gym_id, auth_user_id) where deleted_at is null;

create index if not exists idx_roles_active_gym
  on public.roles(gym_id, id) where deleted_at is null;

create index if not exists idx_gym_members_active_gym
  on public.gym_members(gym_id, id) where deleted_at is null;

create index if not exists idx_membership_plans_active_gym
  on public.membership_plans(gym_id, id) where deleted_at is null;

create index if not exists idx_media_assets_active_gym
  on public.media_assets(gym_id, id) where deleted_at is null;

create index if not exists idx_person_photos_active_person
  on public.person_photos(gym_id, person_id) where deleted_at is null;

create index if not exists idx_access_devices_active_gym
  on public.access_devices(gym_id, id) where deleted_at is null;

create index if not exists idx_income_categories_active_gym
  on public.income_categories(gym_id, id) where deleted_at is null;

-- ============================================================================
-- 3. STORAGE DELETION QUEUE
-- PostgreSQL records the request. A trusted worker/Edge Function must call the
-- Supabase Storage API and then complete or fail the job through the RPCs below.
-- ============================================================================

create table if not exists public.storage_deletion_queue (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  bucket_name text not null,
  object_path text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'canceled')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default timezone('utc', now()),
  locked_at timestamptz,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists uq_storage_deletion_queue_open
  on public.storage_deletion_queue(media_asset_id)
  where status in ('pending', 'processing');

create index if not exists idx_storage_deletion_queue_claim
  on public.storage_deletion_queue(status, available_at, created_at)
  where status in ('pending', 'failed');

alter table public.storage_deletion_queue enable row level security;

drop trigger if exists trg_storage_deletion_queue_updated_at
  on public.storage_deletion_queue;

create trigger trg_storage_deletion_queue_updated_at
before update on public.storage_deletion_queue
for each row execute function private.set_updated_at();

revoke all on public.storage_deletion_queue from anon, authenticated;
grant select, insert, update, delete on public.storage_deletion_queue to service_role;

-- ============================================================================
-- 4. PROTECT SOFT-DELETE METADATA AND PHYSICAL DELETE
-- ============================================================================

create or replace function private.guard_soft_delete_metadata()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (
    new.deleted_at is distinct from old.deleted_at
    or new.deleted_by is distinct from old.deleted_by
    or new.deletion_reason is distinct from old.deletion_reason
  )
  and coalesce(current_setting('app.soft_delete_operation', true), 'off') <> 'on'
  then
    raise exception
      'Use soft_delete_entity(), restore_entity(), archive_gym() or restore_gym().';
  end if;

  return new;
end;
$$;

create or replace function private.prevent_physical_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.allow_hard_delete', true), 'off') = 'on'
     and (
       private.is_service_role()
       or current_user in ('postgres', 'supabase_admin')
     )
  then
    return old;
  end if;

  raise exception
    'Physical DELETE is blocked for %. Use the corresponding lifecycle or soft-delete RPC.',
    tg_table_name;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'gyms',
    'gym_branches',
    'gym_users',
    'roles',
    'gym_members',
    'membership_plans',
    'membership_plan_benefits',
    'media_assets',
    'person_photos',
    'access_devices',
    'income_categories'
  ]
  loop
    execute format(
      'drop trigger if exists %I on public.%I',
      'trg_' || v_table || '_guard_soft_delete',
      v_table
    );

    execute format(
      'create trigger %I
       before update of deleted_at, deleted_by, deletion_reason
       on public.%I
       for each row execute function private.guard_soft_delete_metadata()',
      'trg_' || v_table || '_guard_soft_delete',
      v_table
    );

    execute format(
      'drop trigger if exists %I on public.%I',
      'trg_' || v_table || '_prevent_delete',
      v_table
    );

    execute format(
      'create trigger %I
       before delete on public.%I
       for each row execute function private.prevent_physical_delete()',
      'trg_' || v_table || '_prevent_delete',
      v_table
    );
  end loop;
end;
$$;

revoke delete on
  public.gyms,
  public.gym_branches,
  public.gym_users,
  public.roles,
  public.gym_members,
  public.membership_plans,
  public.membership_plan_benefits,
  public.media_assets,
  public.person_photos,
  public.access_devices,
  public.income_categories
from authenticated;

-- ============================================================================
-- 5. RESTRICTIVE RLS: NORMAL QUERIES ONLY SEE NON-DELETED ROWS
-- Existing tenant/permission policies continue to apply.
-- ============================================================================

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'gyms',
    'gym_branches',
    'gym_users',
    'roles',
    'gym_members',
    'membership_plans',
    'membership_plan_benefits',
    'media_assets',
    'person_photos',
    'access_devices',
    'income_categories'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      'soft_delete_active_only',
      v_table
    );

    execute format(
      'create policy %I on public.%I
       as restrictive
       for all
       to authenticated
       using (deleted_at is null)
       with check (deleted_at is null)',
      'soft_delete_active_only',
      v_table
    );
  end loop;
end;
$$;

-- ============================================================================
-- 6. AUTHORIZATION HELPERS UPDATED FOR SOFT DELETE
-- ============================================================================

create or replace function private.is_gym_user(p_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_service_role()
    or exists (
      select 1
      from public.gyms g
      join public.gym_users gu on gu.gym_id = g.id
      where g.id = p_gym_id
        and g.deleted_at is null
        and gu.deleted_at is null
        and gu.auth_user_id = auth.uid()
        and gu.status = 'active'
    );
$$;

create or replace function private.has_permission(
  p_gym_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_service_role()
    or exists (
      select 1
      from public.gyms g
      join public.gym_users gu on gu.gym_id = g.id
      join public.gym_user_roles gur on gur.gym_user_id = gu.id
      join public.roles r on r.id = gur.role_id
      join public.role_permissions rp on rp.role_id = r.id
      join public.permissions p on p.id = rp.permission_id
      where g.id = p_gym_id
        and g.deleted_at is null
        and gu.deleted_at is null
        and r.deleted_at is null
        and gu.auth_user_id = auth.uid()
        and gu.status = 'active'
        and p.code = p_permission_code
    );
$$;

create or replace function private.can_access_person(p_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_service_role()
    or exists (
      select 1
      from public.user_profiles up
      where up.auth_user_id = auth.uid()
        and up.person_id = p_person_id
    )
    or exists (
      select 1
      from public.gym_members gm
      join public.gyms g on g.id = gm.gym_id
      where gm.person_id = p_person_id
        and gm.deleted_at is null
        and g.deleted_at is null
        and private.has_permission(gm.gym_id, 'members.read')
    )
    or exists (
      select 1
      from public.gym_users gu
      join public.gyms g on g.id = gu.gym_id
      join public.user_profiles up on up.auth_user_id = gu.auth_user_id
      where up.person_id = p_person_id
        and gu.deleted_at is null
        and g.deleted_at is null
        and private.has_permission(gu.gym_id, 'staff.read')
    )
    or exists (
      select 1
      from public.persons p
      where p.id = p_person_id
        and p.created_by = auth.uid()
    );
$$;

create or replace function private.member_access_allowed(
  p_gym_member_id uuid,
  p_at timestamptz default timezone('utc', now())
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.gym_members gm
    join public.gyms g on g.id = gm.gym_id
    join public.member_subscriptions ms on ms.gym_member_id = gm.id
    join public.membership_plans mp on mp.id = ms.membership_plan_id
    where gm.id = p_gym_member_id
      and g.deleted_at is null
      and gm.deleted_at is null
      and mp.deleted_at is null
      and gm.status = 'active'
      and ms.status in ('trialing', 'active')
      and ms.start_date <= p_at::date
      and (ms.end_date is null or ms.end_date >= p_at::date)
      and not exists (
        select 1
        from public.membership_charges mc
        where mc.gym_member_id = gm.id
          and mc.status <> 'void'
          and mc.due_date + mp.grace_days < p_at::date
          and mc.status in ('pending', 'partial', 'overdue')
      )
  );
$$;

-- ============================================================================
-- 7. SAFE TARGET RESOLUTION
-- Only these entity codes may be soft-deleted from the application.
-- ============================================================================

create or replace function private.resolve_soft_delete_target(
  p_entity text,
  p_id uuid
)
returns table (
  table_name text,
  gym_id uuid,
  permission_code text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  case p_entity
    when 'gym_branch' then
      return query
      select 'gym_branches'::text, gb.gym_id, 'gym.manage'::text
      from public.gym_branches gb
      where gb.id = p_id;

    when 'gym_user' then
      return query
      select 'gym_users'::text, gu.gym_id, 'staff.manage'::text
      from public.gym_users gu
      where gu.id = p_id;

    when 'role' then
      return query
      select 'roles'::text, r.gym_id, 'roles.manage'::text
      from public.roles r
      where r.id = p_id;

    when 'gym_member' then
      return query
      select 'gym_members'::text, gm.gym_id, 'members.manage'::text
      from public.gym_members gm
      where gm.id = p_id;

    when 'membership_plan' then
      return query
      select 'membership_plans'::text, mp.gym_id, 'memberships.manage'::text
      from public.membership_plans mp
      where mp.id = p_id;

    when 'membership_plan_benefit' then
      return query
      select 'membership_plan_benefits'::text, mp.gym_id, 'memberships.manage'::text
      from public.membership_plan_benefits b
      join public.membership_plans mp on mp.id = b.membership_plan_id
      where b.id = p_id;

    when 'media_asset' then
      return query
      select 'media_assets'::text, ma.gym_id, 'media.manage'::text
      from public.media_assets ma
      where ma.id = p_id;

    when 'person_photo' then
      return query
      select
        'person_photos'::text,
        pp.gym_id,
        case
          when pp.purpose = 'face_enrollment'
            then 'faces.manage'::text
          else 'media.manage'::text
        end
      from public.person_photos pp
      where pp.id = p_id;

    when 'access_device' then
      return query
      select 'access_devices'::text, ad.gym_id, 'faces.manage'::text
      from public.access_devices ad
      where ad.id = p_id;

    when 'income_category' then
      return query
      select 'income_categories'::text, ic.gym_id, 'income.manage'::text
      from public.income_categories ic
      where ic.id = p_id;

    else
      raise exception 'Unsupported soft-delete entity: %', p_entity;
  end case;
end;
$$;

-- ============================================================================
-- 8. SOFT DELETE RPC
-- ============================================================================

create or replace function public.soft_delete_entity(
  p_entity text,
  p_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target record;
  v_deleted_at timestamptz;
  v_before jsonb;
  v_now timestamptz := timezone('utc', now());
  v_actor uuid := auth.uid();
  v_owner_count integer;
begin
  select *
  into v_target
  from private.resolve_soft_delete_target(p_entity, p_id);

  if not found then
    raise exception '% with id % was not found', p_entity, p_id;
  end if;

  if not private.has_permission(v_target.gym_id, v_target.permission_code) then
    raise exception 'Insufficient permission: %', v_target.permission_code;
  end if;

  execute format(
    'select deleted_at, to_jsonb(t)
     from public.%I t
     where id = $1
     for update',
    v_target.table_name
  )
  into v_deleted_at, v_before
  using p_id;

  if v_deleted_at is not null then
    return jsonb_build_object(
      'entity', p_entity,
      'id', p_id,
      'deletedAt', v_deleted_at,
      'alreadyDeleted', true
    );
  end if;

  -- Dependency and business-rule checks.
  case p_entity
    when 'gym_branch' then
      if exists (
        select 1
        from public.access_devices ad
        where ad.branch_id = p_id
          and ad.deleted_at is null
      ) then
        raise exception 'Reassign or delete active access devices before deleting the branch';
      end if;

      if exists (
        select 1
        from public.gym_members gm
        where gm.home_branch_id = p_id
          and gm.deleted_at is null
          and gm.status in ('prospect', 'active', 'suspended', 'blocked')
      ) then
        raise exception 'Reassign active members before deleting the branch';
      end if;

    when 'gym_user' then
      if exists (
        select 1
        from public.gym_user_roles gur
        join public.roles r on r.id = gur.role_id
        where gur.gym_user_id = p_id
          and r.code = 'owner'
          and r.deleted_at is null
      ) then
        select count(*)
        into v_owner_count
        from public.gym_users gu
        join public.gym_user_roles gur on gur.gym_user_id = gu.id
        join public.roles r on r.id = gur.role_id
        where gu.gym_id = v_target.gym_id
          and gu.deleted_at is null
          and gu.status = 'active'
          and r.deleted_at is null
          and r.code = 'owner';

        if v_owner_count <= 1 then
          raise exception 'The last active owner cannot be deleted';
        end if;
      end if;

    when 'role' then
      if exists (
        select 1
        from public.roles r
        where r.id = p_id
          and r.is_system
      ) then
        raise exception 'System roles cannot be deleted';
      end if;

      if exists (
        select 1
        from public.gym_user_roles gur
        join public.gym_users gu on gu.id = gur.gym_user_id
        where gur.role_id = p_id
          and gu.deleted_at is null
          and gu.status = 'active'
      ) then
        raise exception 'Remove this role from active users before deleting it';
      end if;

    when 'gym_member' then
      if exists (
        select 1
        from public.member_subscriptions ms
        where ms.gym_member_id = p_id
          and ms.status in ('trialing', 'active', 'past_due', 'paused')
      ) then
        raise exception 'Cancel or expire the active membership before deleting the member';
      end if;

    when 'membership_plan' then
      if exists (
        select 1
        from public.member_subscriptions ms
        where ms.membership_plan_id = p_id
          and ms.status in ('trialing', 'active', 'past_due', 'paused')
      ) then
        raise exception 'The plan has current subscriptions and cannot be deleted';
      end if;

    when 'media_asset' then
      if exists (
        select 1
        from public.person_photos pp
        where pp.media_asset_id = p_id
          and pp.deleted_at is null
      ) then
        raise exception 'Delete the active person_photo reference before deleting the media asset';
      end if;

    when 'income_category' then
      if exists (
        select 1
        from public.income_categories ic
        where ic.id = p_id
          and ic.is_membership_related
      ) then
        raise exception 'System membership income categories cannot be deleted';
      end if;

    else
      null;
  end case;

  perform set_config('app.soft_delete_operation', 'on', true);

  execute format(
    'update public.%I
     set deleted_at = $2,
         deleted_by = $3,
         deletion_reason = nullif(trim($4), '''')
     where id = $1',
    v_target.table_name
  )
  using p_id, v_now, v_actor, p_reason;

  if p_entity = 'person_photo' then
    update public.face_embeddings
    set is_active = false,
        updated_at = v_now
    where person_photo_id = p_id
      and is_active;
  end if;

  if p_entity = 'media_asset' then
    insert into public.storage_deletion_queue(
      media_asset_id,
      gym_id,
      bucket_name,
      object_path
    )
    select
      ma.id,
      ma.gym_id,
      ma.bucket_name,
      ma.object_path
    from public.media_assets ma
    where ma.id = p_id
      and ma.storage_deleted_at is null
    on conflict do nothing;
  end if;

  insert into public.audit_logs(
    gym_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    before_data,
    after_data
  )
  values (
    v_target.gym_id,
    v_actor,
    'SOFT_DELETE',
    v_target.table_name,
    p_id::text,
    v_before,
    jsonb_build_object(
      'deleted_at', v_now,
      'deleted_by', v_actor,
      'deletion_reason', p_reason
    )
  );

  return jsonb_build_object(
    'entity', p_entity,
    'id', p_id,
    'gymId', v_target.gym_id,
    'deletedAt', v_now,
    'alreadyDeleted', false
  );
end;
$$;

-- ============================================================================
-- 9. RESTORE RPC
-- ============================================================================

create or replace function public.restore_entity(
  p_entity text,
  p_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target record;
  v_deleted_at timestamptz;
  v_before jsonb;
  v_now timestamptz := timezone('utc', now());
  v_actor uuid := auth.uid();
begin
  select *
  into v_target
  from private.resolve_soft_delete_target(p_entity, p_id);

  if not found then
    raise exception '% with id % was not found', p_entity, p_id;
  end if;

  if not private.has_permission(v_target.gym_id, v_target.permission_code) then
    raise exception 'Insufficient permission: %', v_target.permission_code;
  end if;

  execute format(
    'select deleted_at, to_jsonb(t)
     from public.%I t
     where id = $1
     for update',
    v_target.table_name
  )
  into v_deleted_at, v_before
  using p_id;

  if v_deleted_at is null then
    return jsonb_build_object(
      'entity', p_entity,
      'id', p_id,
      'restored', false,
      'alreadyActive', true
    );
  end if;

  if p_entity = 'media_asset' then
    if exists (
      select 1
      from public.storage_deletion_queue q
      where q.media_asset_id = p_id
        and q.status = 'completed'
    ) or exists (
      select 1
      from public.media_assets ma
      where ma.id = p_id
        and ma.storage_deleted_at is not null
    ) then
      raise exception 'The Storage object was already deleted and cannot be restored';
    end if;

    update public.storage_deletion_queue
    set status = 'canceled',
        processed_at = v_now
    where media_asset_id = p_id
      and status in ('pending', 'failed');
  end if;

  perform set_config('app.soft_delete_operation', 'on', true);

  execute format(
    'update public.%I
     set deleted_at = null,
         deleted_by = null,
         deletion_reason = null
     where id = $1',
    v_target.table_name
  )
  using p_id;

  insert into public.audit_logs(
    gym_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    before_data,
    after_data
  )
  values (
    v_target.gym_id,
    v_actor,
    'RESTORE',
    v_target.table_name,
    p_id::text,
    v_before,
    jsonb_build_object(
      'deleted_at', null,
      'deleted_by', null,
      'deletion_reason', null
    )
  );

  return jsonb_build_object(
    'entity', p_entity,
    'id', p_id,
    'gymId', v_target.gym_id,
    'restored', true,
    'restoredAt', v_now
  );
exception
  when unique_violation then
    raise exception
      'The record cannot be restored because an active record now uses the same unique code or identifier';
end;
$$;

-- ============================================================================
-- 10. GYM ARCHIVE / RESTORE
-- Gym deletion is intentionally separate from ordinary entity deletion.
-- ============================================================================

create or replace function public.archive_gym(
  p_gym_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_actor uuid := auth.uid();
  v_before jsonb;
begin
  if not private.has_permission(p_gym_id, 'gym.manage')
     or not private.has_permission(p_gym_id, 'billing.manage')
  then
    raise exception 'gym.manage and billing.manage permissions are required';
  end if;

  select to_jsonb(g)
  into v_before
  from public.gyms g
  where g.id = p_gym_id
  for update;

  if not found then
    raise exception 'Gym not found';
  end if;

  if (v_before ->> 'deleted_at') is not null then
    return jsonb_build_object(
      'gymId', p_gym_id,
      'alreadyArchived', true,
      'deletedAt', v_before ->> 'deleted_at'
    );
  end if;

  if exists (
    select 1
    from public.gym_saas_subscriptions s
    where s.gym_id = p_gym_id
      and s.status in ('trialing', 'active', 'past_due', 'paused')
  ) then
    raise exception 'Cancel the current SaaS subscription before archiving the gym';
  end if;

  perform set_config('app.soft_delete_operation', 'on', true);

  update public.gyms
  set deleted_at = v_now,
      deleted_by = v_actor,
      deletion_reason = nullif(trim(p_reason), ''),
      status = 'deleted'
  where id = p_gym_id;

  insert into public.audit_logs(
    gym_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    before_data,
    after_data
  )
  values (
    p_gym_id,
    v_actor,
    'ARCHIVE_GYM',
    'gyms',
    p_gym_id::text,
    v_before,
    jsonb_build_object(
      'deleted_at', v_now,
      'deleted_by', v_actor,
      'deletion_reason', p_reason,
      'status', 'deleted'
    )
  );

  return jsonb_build_object(
    'gymId', p_gym_id,
    'archivedAt', v_now
  );
end;
$$;

create or replace function public.restore_gym(
  p_gym_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_actor uuid := auth.uid();
  v_created_by uuid;
  v_deleted_at timestamptz;
  v_before jsonb;
begin
  select g.created_by, g.deleted_at, to_jsonb(g)
  into v_created_by, v_deleted_at, v_before
  from public.gyms g
  where g.id = p_gym_id
  for update;

  if not found then
    raise exception 'Gym not found';
  end if;

  if not private.is_service_role() and v_created_by <> auth.uid() then
    raise exception 'Only the original owner or the service role can restore an archived gym';
  end if;

  if v_deleted_at is null then
    return jsonb_build_object(
      'gymId', p_gym_id,
      'restored', false,
      'alreadyActive', true
    );
  end if;

  perform set_config('app.soft_delete_operation', 'on', true);

  update public.gyms
  set deleted_at = null,
      deleted_by = null,
      deletion_reason = null,
      status = 'inactive'
  where id = p_gym_id;

  insert into public.audit_logs(
    gym_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    before_data,
    after_data
  )
  values (
    p_gym_id,
    v_actor,
    'RESTORE_GYM',
    'gyms',
    p_gym_id::text,
    v_before,
    jsonb_build_object(
      'deleted_at', null,
      'deleted_by', null,
      'deletion_reason', null,
      'status', 'inactive'
    )
  );

  return jsonb_build_object(
    'gymId', p_gym_id,
    'restored', true,
    'restoredAt', v_now,
    'status', 'inactive'
  );
exception
  when unique_violation then
    raise exception 'The gym slug is already being used by another active gym';
end;
$$;

-- ============================================================================
-- 11. RECYCLE BIN
-- Requires audit.read or gym.manage.
-- ============================================================================

create or replace function public.list_deleted_entities(
  p_gym_id uuid,
  p_entity text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  entity_type text,
  id uuid,
  label text,
  deleted_at timestamptz,
  deleted_by uuid,
  deletion_reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (
    private.has_permission(p_gym_id, 'audit.read')
    or private.has_permission(p_gym_id, 'gym.manage')
  ) then
    raise exception 'audit.read or gym.manage permission is required';
  end if;

  return query
  select *
  from (
    select
      'gym_branch'::text,
      gb.id,
      concat(gb.code, ' - ', gb.name),
      gb.deleted_at,
      gb.deleted_by,
      gb.deletion_reason
    from public.gym_branches gb
    where gb.gym_id = p_gym_id and gb.deleted_at is not null

    union all

    select
      'gym_user',
      gu.id,
      coalesce(gu.employee_code, gu.auth_user_id::text),
      gu.deleted_at,
      gu.deleted_by,
      gu.deletion_reason
    from public.gym_users gu
    where gu.gym_id = p_gym_id and gu.deleted_at is not null

    union all

    select
      'role',
      r.id,
      concat(r.code, ' - ', r.name),
      r.deleted_at,
      r.deleted_by,
      r.deletion_reason
    from public.roles r
    where r.gym_id = p_gym_id and r.deleted_at is not null

    union all

    select
      'gym_member',
      gm.id,
      concat(gm.member_code, ' - ', p.first_name, ' ', p.last_name),
      gm.deleted_at,
      gm.deleted_by,
      gm.deletion_reason
    from public.gym_members gm
    join public.persons p on p.id = gm.person_id
    where gm.gym_id = p_gym_id and gm.deleted_at is not null

    union all

    select
      'membership_plan',
      mp.id,
      concat(mp.code, ' - ', mp.name),
      mp.deleted_at,
      mp.deleted_by,
      mp.deletion_reason
    from public.membership_plans mp
    where mp.gym_id = p_gym_id and mp.deleted_at is not null

    union all

    select
      'membership_plan_benefit',
      b.id,
      concat(b.benefit_code, ' - ', b.description),
      b.deleted_at,
      b.deleted_by,
      b.deletion_reason
    from public.membership_plan_benefits b
    join public.membership_plans mp on mp.id = b.membership_plan_id
    where mp.gym_id = p_gym_id and b.deleted_at is not null

    union all

    select
      'media_asset',
      ma.id,
      coalesce(ma.original_filename, ma.object_path),
      ma.deleted_at,
      ma.deleted_by,
      ma.deletion_reason
    from public.media_assets ma
    where ma.gym_id = p_gym_id and ma.deleted_at is not null

    union all

    select
      'person_photo',
      pp.id,
      concat(pp.purpose::text, ' - ', pp.person_id::text),
      pp.deleted_at,
      pp.deleted_by,
      pp.deletion_reason
    from public.person_photos pp
    where pp.gym_id = p_gym_id and pp.deleted_at is not null

    union all

    select
      'access_device',
      ad.id,
      concat(ad.code, ' - ', ad.name),
      ad.deleted_at,
      ad.deleted_by,
      ad.deletion_reason
    from public.access_devices ad
    where ad.gym_id = p_gym_id and ad.deleted_at is not null

    union all

    select
      'income_category',
      ic.id,
      concat(ic.code, ' - ', ic.name),
      ic.deleted_at,
      ic.deleted_by,
      ic.deletion_reason
    from public.income_categories ic
    where ic.gym_id = p_gym_id and ic.deleted_at is not null
  ) d
  where p_entity is null or d.entity_type = p_entity
  order by d.deleted_at desc
  limit greatest(1, least(p_limit, 200))
  offset greatest(p_offset, 0);
end;
$$;

-- ============================================================================
-- 12. STORAGE QUEUE WORKER RPCs
-- Call only from a trusted backend/Edge Function using the service role.
-- ============================================================================

create or replace function public.claim_storage_deletion_jobs(
  p_limit integer default 20
)
returns setof public.storage_deletion_queue
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_service_role() then
    raise exception 'service_role is required';
  end if;

  return query
  with jobs as (
    select q.id
    from public.storage_deletion_queue q
    where q.status in ('pending', 'failed')
      and q.available_at <= timezone('utc', now())
    order by q.created_at
    for update skip locked
    limit greatest(1, least(p_limit, 100))
  )
  update public.storage_deletion_queue q
  set status = 'processing',
      attempts = q.attempts + 1,
      locked_at = timezone('utc', now()),
      last_error = null
  from jobs
  where q.id = jobs.id
  returning q.*;
end;
$$;

create or replace function public.complete_storage_deletion_job(
  p_job_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_media_asset_id uuid;
  v_now timestamptz := timezone('utc', now());
begin
  if not private.is_service_role() then
    raise exception 'service_role is required';
  end if;

  update public.storage_deletion_queue
  set status = 'completed',
      processed_at = v_now,
      locked_at = null,
      last_error = null
  where id = p_job_id
    and status = 'processing'
  returning media_asset_id into v_media_asset_id;

  if v_media_asset_id is null then
    raise exception 'Processing Storage deletion job not found';
  end if;

  update public.media_assets
  set storage_deleted_at = v_now
  where id = v_media_asset_id;
end;
$$;

create or replace function public.fail_storage_deletion_job(
  p_job_id uuid,
  p_error text,
  p_retry_after_seconds integer default 300
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_service_role() then
    raise exception 'service_role is required';
  end if;

  update public.storage_deletion_queue
  set status = 'failed',
      available_at = timezone('utc', now())
        + make_interval(secs => greatest(p_retry_after_seconds, 60)),
      locked_at = null,
      last_error = left(coalesce(p_error, 'Unknown Storage deletion error'), 2000)
  where id = p_job_id
    and status = 'processing';

  if not found then
    raise exception 'Processing Storage deletion job not found';
  end if;
end;
$$;

-- ============================================================================
-- 13. FACIAL MATCHING UPDATED TO IGNORE SOFT-DELETED RECORDS
-- ============================================================================

create or replace function public.match_face_candidates(
  p_gym_id uuid,
  p_embedding extensions.vector(512),
  p_similarity_threshold real default 0.75,
  p_limit integer default 3
)
returns table (
  face_embedding_id uuid,
  person_id uuid,
  gym_member_id uuid,
  similarity real,
  access_allowed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    fe.id,
    fe.person_id,
    gm.id,
    (1 - (fe.embedding OPERATOR(extensions.<=>) p_embedding))::real,
    private.member_access_allowed(gm.id, timezone('utc', now()))
  from public.face_embeddings fe
  join public.person_photos pp
    on pp.id = fe.person_photo_id
   and pp.deleted_at is null
  join public.gym_members gm
    on gm.gym_id = fe.gym_id
   and gm.person_id = fe.person_id
   and gm.deleted_at is null
  where fe.gym_id = p_gym_id
    and fe.is_active
    and (
      private.is_service_role()
      or private.has_permission(p_gym_id, 'faces.verify')
    )
    and exists (
      select 1
      from public.biometric_consents bc
      where bc.gym_id = fe.gym_id
        and bc.person_id = fe.person_id
        and bc.status = 'granted'
        and (bc.expires_at is null or bc.expires_at > timezone('utc', now()))
        and (bc.retention_until is null or bc.retention_until > timezone('utc', now()))
    )
    and (1 - (fe.embedding OPERATOR(extensions.<=>) p_embedding))
      >= p_similarity_threshold
  order by fe.embedding OPERATOR(extensions.<=>) p_embedding
  limit greatest(1, least(p_limit, 10));
$$;

-- ============================================================================
-- 14. SECURITY-INVOKER VIEWS UPDATED
-- ============================================================================

create or replace view public.v_member_access_status
with (security_invoker = true)
as
select
  gm.gym_id,
  gm.id as gym_member_id,
  gm.member_code,
  gm.status as member_status,
  p.id as person_id,
  p.first_name,
  p.last_name,
  exists (
    select 1
    from public.member_subscriptions ms
    join public.membership_plans mp on mp.id = ms.membership_plan_id
    where ms.gym_member_id = gm.id
      and mp.deleted_at is null
      and ms.status in ('trialing', 'active')
      and ms.start_date <= current_date
      and (ms.end_date is null or ms.end_date >= current_date)
  ) as has_active_subscription,
  exists (
    select 1
    from public.membership_charges mc
    where mc.gym_member_id = gm.id
      and mc.status in ('pending', 'partial', 'overdue')
      and mc.due_date < current_date
  ) as has_overdue_charges,
  private.member_access_allowed(gm.id, timezone('utc', now())) as access_allowed
from public.gym_members gm
join public.persons p on p.id = gm.person_id
where gm.deleted_at is null;

create or replace view public.v_gym_dashboard
with (security_invoker = true)
as
select
  g.id as gym_id,
  g.trade_name,
  (
    select count(*)
    from public.gym_members gm
    where gm.gym_id = g.id
      and gm.deleted_at is null
      and gm.status = 'active'
  ) as active_members,
  (
    select count(*)
    from public.membership_charges mc
    join public.gym_members gm on gm.id = mc.gym_member_id
    where gm.gym_id = g.id
      and gm.deleted_at is null
      and mc.status in ('pending', 'partial', 'overdue')
      and mc.due_date < current_date
  ) as overdue_charges,
  (
    select coalesce(sum(i.amount), 0)
    from public.v_gym_income i
    where i.gym_id = g.id
      and i.currency = g.default_currency
      and i.occurred_at >= date_trunc('month', timezone('utc', now()))
      and i.occurred_at < date_trunc('month', timezone('utc', now()))
        + interval '1 month'
  )::numeric(14,2) as current_month_income,
  (
    select count(*)
    from public.face_recognition_events fre
    where fre.gym_id = g.id
      and fre.occurred_at >= date_trunc('day', timezone('utc', now()))
      and fre.decision = 'allowed'
  ) as successful_accesses_today,
  (
    select count(*)
    from public.gym_alerts ga
    where ga.gym_id = g.id
      and ga.status in ('open', 'acknowledged')
  ) as open_alerts
from public.gyms g
where g.deleted_at is null;

-- ============================================================================
-- 15. FUNCTION PRIVILEGES
-- PUBLIC receives EXECUTE on new functions by default, so revoke explicitly.
-- ============================================================================

revoke all on function public.soft_delete_entity(text, uuid, text) from public;
revoke all on function public.restore_entity(text, uuid) from public;
revoke all on function public.archive_gym(uuid, text) from public;
revoke all on function public.restore_gym(uuid) from public;
revoke all on function public.list_deleted_entities(uuid, text, integer, integer) from public;
revoke all on function public.claim_storage_deletion_jobs(integer) from public;
revoke all on function public.complete_storage_deletion_job(uuid) from public;
revoke all on function public.fail_storage_deletion_job(uuid, text, integer) from public;

grant execute on function public.soft_delete_entity(text, uuid, text)
  to authenticated;
grant execute on function public.restore_entity(text, uuid)
  to authenticated;
grant execute on function public.archive_gym(uuid, text)
  to authenticated;
grant execute on function public.restore_gym(uuid)
  to authenticated;
grant execute on function public.list_deleted_entities(uuid, text, integer, integer)
  to authenticated;

grant execute on function public.claim_storage_deletion_jobs(integer)
  to service_role;
grant execute on function public.complete_storage_deletion_job(uuid)
  to service_role;
grant execute on function public.fail_storage_deletion_job(uuid, text, integer)
  to service_role;

commit;

-- ============================================================================
-- FRONTEND RPC EXAMPLES
-- ============================================================================
--
-- Delete:
--   supabase.rpc('soft_delete_entity', {
--     p_entity: 'gym_member',
--     p_id: memberId,
--     p_reason: 'Duplicate registration'
--   })
--
-- Restore:
--   supabase.rpc('restore_entity', {
--     p_entity: 'gym_member',
--     p_id: memberId
--   })
--
-- Recycle bin:
--   supabase.rpc('list_deleted_entities', {
--     p_gym_id: gymId,
--     p_entity: null,
--     p_limit: 50,
--     p_offset: 0
--   })
--
-- Supported p_entity values:
--   gym_branch
--   gym_user
--   role
--   gym_member
--   membership_plan
--   membership_plan_benefit
--   media_asset
--   person_photo
--   access_device
--   income_category
--
-- Do not expose service-role Storage queue functions in browser code.
-- ============================================================================