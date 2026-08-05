create or replace function public.link_invited_gym_staff_user(
  p_gym_id uuid,
  p_auth_user_id uuid,
  p_employee_code text,
  p_role_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym_user_id uuid;
  v_result jsonb;
begin
  if not private.has_permission(p_gym_id, 'staff.manage') then
    raise exception 'staff.manage permission required' using errcode = '42501';
  end if;

  if not private.has_permission(p_gym_id, 'roles.manage') then
    raise exception 'roles.manage permission required' using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_auth_user_id) then
    raise exception 'Invited authentication user was not found' using errcode = '23503';
  end if;

  if coalesce(cardinality(p_role_ids), 0) = 0 then
    raise exception 'At least one role is required' using errcode = '23514';
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

  insert into public.gym_users(
    gym_id, auth_user_id, employee_code, status, invited_by
  ) values (
    p_gym_id,
    p_auth_user_id,
    nullif(trim(p_employee_code), ''),
    'invited',
    auth.uid()
  )
  returning id into v_gym_user_id;

  insert into public.gym_user_roles(gym_user_id, role_id, assigned_by)
  select v_gym_user_id, requested.role_id, auth.uid()
  from (select distinct unnest(p_role_ids) as role_id) requested;

  v_result := jsonb_build_object(
    'id', v_gym_user_id,
    'gymId', p_gym_id,
    'authUserId', p_auth_user_id,
    'status', 'invited',
    'employeeCode', nullif(trim(p_employee_code), ''),
    'roleIds', to_jsonb(p_role_ids)
  );

  insert into public.audit_logs(
    gym_id, actor_user_id, action, entity_table, entity_id, after_data
  ) values (
    p_gym_id,
    auth.uid(),
    'STAFF_INVITED',
    'gym_users',
    v_gym_user_id::text,
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.link_invited_gym_staff_user(
  uuid, uuid, text, uuid[]
) from public;

grant execute on function public.link_invited_gym_staff_user(
  uuid, uuid, text, uuid[]
) to authenticated, service_role;

comment on function public.link_invited_gym_staff_user(
  uuid, uuid, text, uuid[]
) is 'Links a Supabase Auth invitation to one gym and assigns tenant roles atomically.';
