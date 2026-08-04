-- Atomic staff editing contract. Invitation through Supabase Auth is implemented
-- in trusted server code; this RPC manages the tenant membership and roles.

create or replace function public.update_gym_staff_user(
  p_gym_id uuid,
  p_gym_user_id uuid,
  p_employee_code text,
  p_status public.user_membership_status,
  p_role_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_current_is_owner boolean;
  v_next_is_owner boolean;
  v_other_active_owners integer;
begin
  if not private.has_permission(p_gym_id, 'staff.manage') then
    raise exception 'staff.manage permission required' using errcode = '42501';
  end if;

  select to_jsonb(gu)
  into v_before
  from public.gym_users gu
  where gu.id = p_gym_user_id
    and gu.gym_id = p_gym_id
    and gu.deleted_at is null
  for update;

  if v_before is null then
    raise exception 'Staff user was not found in the active gym' using errcode = 'P0002';
  end if;

  if p_role_ids is not null then
    if not private.has_permission(p_gym_id, 'roles.manage') then
      raise exception 'roles.manage permission required' using errcode = '42501';
    end if;

    if exists (
      select 1
      from unnest(p_role_ids) requested(role_id)
      left join public.roles r
        on r.id = requested.role_id
       and r.gym_id = p_gym_id
       and r.deleted_at is null
      where r.id is null
    ) then
      raise exception 'A selected role does not belong to the active gym' using errcode = '23503';
    end if;
  end if;

  select exists (
    select 1
    from public.gym_user_roles gur
    join public.roles r on r.id = gur.role_id
    where gur.gym_user_id = p_gym_user_id
      and r.gym_id = p_gym_id
      and r.code = 'owner'
      and r.deleted_at is null
  ) into v_current_is_owner;

  select case
    when p_role_ids is null then v_current_is_owner
    else exists (
      select 1
      from unnest(p_role_ids) requested(role_id)
      join public.roles r on r.id = requested.role_id
      where r.gym_id = p_gym_id
        and r.code = 'owner'
        and r.deleted_at is null
    )
  end into v_next_is_owner;

  if v_current_is_owner and (p_status <> 'active' or not v_next_is_owner) then
    select count(distinct gu.id)
    into v_other_active_owners
    from public.gym_users gu
    join public.gym_user_roles gur on gur.gym_user_id = gu.id
    join public.roles r on r.id = gur.role_id
    where gu.gym_id = p_gym_id
      and gu.id <> p_gym_user_id
      and gu.status = 'active'
      and gu.deleted_at is null
      and r.code = 'owner'
      and r.deleted_at is null;

    if v_other_active_owners = 0 then
      raise exception 'The last active owner cannot be suspended or lose the owner role'
        using errcode = '23514';
    end if;
  end if;

  update public.gym_users
  set employee_code = nullif(trim(p_employee_code), ''),
      status = p_status,
      accepted_at = case
        when p_status = 'active' then coalesce(accepted_at, timezone('utc', now()))
        else accepted_at
      end,
      updated_at = timezone('utc', now())
  where id = p_gym_user_id;

  if p_role_ids is not null then
    delete from public.gym_user_roles where gym_user_id = p_gym_user_id;

    insert into public.gym_user_roles(gym_user_id, role_id, assigned_by)
    select p_gym_user_id, requested.role_id, auth.uid()
    from (select distinct unnest(p_role_ids) as role_id) requested;
  end if;

  select jsonb_build_object(
    'id', gu.id,
    'gymId', gu.gym_id,
    'employeeCode', gu.employee_code,
    'status', gu.status,
    'roleIds', coalesce((
      select jsonb_agg(gur.role_id order by gur.role_id)
      from public.gym_user_roles gur
      where gur.gym_user_id = gu.id
    ), '[]'::jsonb)
  )
  into v_after
  from public.gym_users gu
  where gu.id = p_gym_user_id;

  insert into public.audit_logs(
    gym_id, actor_user_id, action, entity_table, entity_id, before_data, after_data
  ) values (
    p_gym_id, auth.uid(), 'STAFF_UPDATED', 'gym_users', p_gym_user_id::text,
    jsonb_build_object(
      'employeeCode', v_before -> 'employee_code',
      'status', v_before -> 'status'
    ),
    v_after
  );

  return v_after;
end;
$$;

revoke all on function public.update_gym_staff_user(
  uuid, uuid, text, public.user_membership_status, uuid[]
) from public;

grant execute on function public.update_gym_staff_user(
  uuid, uuid, text, public.user_membership_status, uuid[]
) to authenticated, service_role;

comment on function public.update_gym_staff_user(
  uuid, uuid, text, public.user_membership_status, uuid[]
) is 'Atomically edits a gym staff membership and optional role assignments with tenant, permission and last-owner checks.';
