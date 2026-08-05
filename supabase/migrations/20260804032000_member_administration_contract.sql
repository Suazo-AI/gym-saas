begin;

create or replace function public.update_gym_member_admin(
  p_gym_id uuid,
  p_gym_member_id uuid,
  p_first_name text default null,
  p_last_name text default null,
  p_member_code text default null,
  p_branch_id uuid default null,
  p_clear_branch boolean default false,
  p_phone text default null,
  p_clear_phone boolean default false,
  p_email text default null,
  p_clear_email boolean default false
)
returns public.api_v1_member_summaries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.api_v1_member_summaries;
  v_person_id uuid;
begin
  v_member := public.update_gym_member(
    p_gym_id,
    p_gym_member_id,
    p_first_name,
    p_last_name,
    p_member_code,
    case when p_clear_branch then null else p_branch_id end,
    null,
    case when p_clear_phone then '' else p_phone end,
    case when p_clear_email then '' else p_email end
  );

  select gm.person_id
  into v_person_id
  from public.gym_members gm
  where gm.id = p_gym_member_id
    and gm.gym_id = p_gym_id
    and gm.deleted_at is null;

  if p_clear_branch then
    update public.gym_members
    set home_branch_id = null,
        updated_at = timezone('utc', now())
    where id = p_gym_member_id and gym_id = p_gym_id;
  end if;

  if p_clear_phone then
    delete from public.person_contacts
    where person_id = v_person_id and contact_type = 'phone' and is_primary;
  end if;

  if p_clear_email then
    delete from public.person_contacts
    where person_id = v_person_id and contact_type = 'email' and is_primary;
  end if;

  select *
  into v_member
  from public.api_v1_member_summaries s
  where s.gym_member_id = p_gym_member_id and s.gym_id = p_gym_id;

  return v_member;
end;
$$;

revoke all on function public.update_gym_member_admin(
  uuid, uuid, text, text, text, uuid, boolean, text, boolean, text, boolean
) from public;
grant execute on function public.update_gym_member_admin(
  uuid, uuid, text, text, text, uuid, boolean, text, boolean, text, boolean
) to authenticated, service_role;

create or replace function public.list_deleted_gym_members(
  p_gym_id uuid,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
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
  if not private.has_permission(p_gym_id, 'members.manage') then
    raise exception 'Insufficient permission: members.manage' using errcode = '42501';
  end if;

  return query
  select
    gm.id,
    concat(gm.member_code, ' - ', p.first_name, ' ', p.last_name),
    gm.deleted_at,
    gm.deleted_by,
    gm.deletion_reason
  from public.gym_members gm
  join public.persons p on p.id = gm.person_id
  where gm.gym_id = p_gym_id
    and gm.deleted_at is not null
  order by gm.deleted_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.list_deleted_gym_members(uuid, integer, integer) from public;
grant execute on function public.list_deleted_gym_members(uuid, integer, integer)
to authenticated, service_role;

comment on function public.update_gym_member_admin(
  uuid, uuid, text, text, text, uuid, boolean, text, boolean, text, boolean
) is 'Updates a member and explicitly supports clearing optional branch and primary contacts.';
comment on function public.list_deleted_gym_members(uuid, integer, integer)
is 'Lists soft-deleted members for the active gym under members.manage authorization.';

commit;
