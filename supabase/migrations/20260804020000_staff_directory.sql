create or replace function public.list_gym_staff(p_gym_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission(p_gym_id, 'staff.read') then
    raise exception 'staff.read permission required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(item order by item ->> 'invitedAt' desc)
    from (
      select jsonb_build_object(
        'id', gu.id,
        'authUserId', gu.auth_user_id,
        'email', au.email,
        'fullName', nullif(trim(concat_ws(' ', p.first_name, p.middle_name, p.last_name, p.second_last_name)), ''),
        'employeeCode', gu.employee_code,
        'status', gu.status,
        'invitedAt', gu.invited_at,
        'acceptedAt', gu.accepted_at,
        'roles', coalesce((
          select jsonb_agg(jsonb_build_object('id', r.id, 'code', r.code, 'name', r.name) order by r.name)
          from public.gym_user_roles gur
          join public.roles r on r.id = gur.role_id
          where gur.gym_user_id = gu.id and r.deleted_at is null
        ), '[]'::jsonb),
        'permissions', coalesce((
          select jsonb_agg(permission_code order by permission_code)
          from (
            select distinct perm.code as permission_code
            from public.gym_user_roles gur
            join public.roles r on r.id = gur.role_id and r.deleted_at is null
            join public.role_permissions rp on rp.role_id = r.id
            join public.permissions perm on perm.id = rp.permission_id
            where gur.gym_user_id = gu.id
          ) effective
        ), '[]'::jsonb)
      ) as item
      from public.gym_users gu
      join auth.users au on au.id = gu.auth_user_id
      left join public.user_profiles up on up.auth_user_id = gu.auth_user_id
      left join public.persons p on p.id = up.person_id
      where gu.gym_id = p_gym_id
        and gu.deleted_at is null
    ) directory
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_gym_staff(uuid) from public;
grant execute on function public.list_gym_staff(uuid) to authenticated, service_role;

comment on function public.list_gym_staff(uuid)
is 'Returns the active staff directory for one authorized gym, including roles and effective permission codes.';
