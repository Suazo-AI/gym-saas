begin;

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
  select d.entity_type, d.id, d.label, d.deleted_at, d.deleted_by, d.deletion_reason
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
  ) as d(entity_type, id, label, deleted_at, deleted_by, deletion_reason)
  where p_entity is null or d.entity_type = p_entity
  order by d.deleted_at desc
  limit greatest(1, least(p_limit, 200))
  offset greatest(p_offset, 0);
end;
$$;

comment on function public.list_deleted_entities(uuid, text, integer, integer) is
  'Lists soft-deleted tenant entities with stable output aliases for filtering and ordering.';

commit;

-- Rollback: restore the previous list_deleted_entities definition.
