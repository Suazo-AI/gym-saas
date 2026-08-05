begin;

update public.screens set route='/entries', name='Entradas' where code='facial_access';

create function public.list_role_screen_access(p_gym_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
  if not private.has_permission(p_gym_id,'roles.manage') then raise exception 'roles.manage permission required' using errcode='42501'; end if;
  return jsonb_build_object(
    'screens',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'code',s.code,'name',s.name,'route',s.route,'permissionCodes',coalesce((select jsonb_agg(p.code order by p.code) from public.screen_permissions sp join public.permissions p on p.id=sp.permission_id where sp.screen_id=s.id),'[]'::jsonb)) order by s.sort_order) from public.screens s where s.is_active),'[]'::jsonb),
    'roles',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'code',r.code,'name',r.name,'isOwner',r.code='owner','screenIds',coalesce((select jsonb_agg(distinct sp.screen_id) from public.role_permissions rp join public.screen_permissions sp on sp.permission_id=rp.permission_id where rp.role_id=r.id),'[]'::jsonb),'permissionCodes',coalesce((select jsonb_agg(p.code order by p.code) from public.role_permissions rp join public.permissions p on p.id=rp.permission_id where rp.role_id=r.id),'[]'::jsonb)) order by r.name) from public.roles r where r.gym_id=p_gym_id and r.deleted_at is null),'[]'::jsonb)
  );
end;$$;

create function public.update_role_screen_access(p_gym_id uuid,p_role_id uuid,p_screen_ids uuid[])
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_role public.roles; v_before jsonb; v_after jsonb;
begin
  if not private.has_permission(p_gym_id,'roles.manage') then raise exception 'roles.manage permission required' using errcode='42501'; end if;
  select * into v_role from public.roles where id=p_role_id and gym_id=p_gym_id and deleted_at is null for update;
  if not found then raise exception 'Role not found in active gym' using errcode='P0002'; end if;
  if v_role.code='owner' then raise exception 'Owner role screen access cannot be reduced' using errcode='23514'; end if;
  if exists(select 1 from unnest(coalesce(p_screen_ids,'{}')) x(id) left join public.screens s on s.id=x.id and s.is_active where s.id is null) then raise exception 'Invalid screen selection' using errcode='23503'; end if;
  select coalesce(jsonb_agg(p.code order by p.code),'[]'::jsonb) into v_before from public.role_permissions rp join public.permissions p on p.id=rp.permission_id where rp.role_id=p_role_id;
  delete from public.role_permissions rp where rp.role_id=p_role_id and exists(select 1 from public.screen_permissions sp where sp.permission_id=rp.permission_id);
  insert into public.role_permissions(role_id,permission_id)
  select p_role_id,sp.permission_id from public.screen_permissions sp where sp.screen_id=any(coalesce(p_screen_ids,'{}')) on conflict do nothing;
  select coalesce(jsonb_agg(p.code order by p.code),'[]'::jsonb) into v_after from public.role_permissions rp join public.permissions p on p.id=rp.permission_id where rp.role_id=p_role_id;
  insert into public.audit_logs(gym_id,actor_user_id,action,entity_table,entity_id,before_data,after_data) values(p_gym_id,auth.uid(),'ROLE_SCREEN_ACCESS_UPDATED','roles',p_role_id::text,jsonb_build_object('permissions',v_before),jsonb_build_object('permissions',v_after,'screenIds',coalesce(to_jsonb(p_screen_ids),'[]'::jsonb)));
  return jsonb_build_object('roleId',p_role_id,'screenIds',coalesce(to_jsonb(p_screen_ids),'[]'::jsonb),'permissionCodes',v_after);
end;$$;

create function public.list_current_user_screens(p_gym_id uuid)
returns table(code text,name text,route text,sort_order integer)
language plpgsql stable security definer set search_path=''
as $$ begin
  if not private.is_gym_user(p_gym_id) then raise exception 'Active gym membership required' using errcode='42501'; end if;
  return query select distinct s.code,s.name,s.route,s.sort_order from public.screens s join public.screen_permissions sp on sp.screen_id=s.id join public.role_permissions rp on rp.permission_id=sp.permission_id join public.gym_user_roles gur on gur.role_id=rp.role_id join public.gym_users gu on gu.id=gur.gym_user_id where gu.gym_id=p_gym_id and gu.auth_user_id=auth.uid() and gu.status='active' and gu.deleted_at is null and s.is_active order by s.sort_order;
end;$$;

revoke all on function public.list_role_screen_access(uuid) from public;
revoke all on function public.update_role_screen_access(uuid,uuid,uuid[]) from public;
revoke all on function public.list_current_user_screens(uuid) from public;
grant execute on function public.list_role_screen_access(uuid),public.update_role_screen_access(uuid,uuid,uuid[]),public.list_current_user_screens(uuid) to authenticated,service_role;
commit;
