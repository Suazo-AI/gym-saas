begin;

select plan(1);

create temp table security_review_cross_tenant_role as
select
  target_user.id as gym_user_id,
  foreign_role.id as role_id
from public.gym_users target_user
cross join public.roles foreign_role
where target_user.gym_id = '20000000-0000-4000-8000-000000000001'
  and target_user.auth_user_id = '00000000-0000-4000-8000-000000000004'
  and foreign_role.gym_id = '20000000-0000-4000-8000-000000000002'
  and foreign_role.code = 'owner';

grant select on security_review_cross_tenant_role to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$insert into public.gym_user_roles (gym_user_id, role_id, assigned_by)
    select
      fixture.gym_user_id,
      fixture.role_id,
      '00000000-0000-4000-8000-000000000001'
    from security_review_cross_tenant_role fixture$$,
  'P0001',
  'Gym user and role must belong to the same gym',
  'el trigger rechaza asignar a un usuario del gimnasio X un rol del gimnasio Y'
);

reset role;
select set_config('request.jwt.claims', '{}', true);

select * from finish();

rollback;
