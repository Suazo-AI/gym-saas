begin;
select plan(8);

select has_function(
  'public',
  'update_gym_staff_user',
  array['uuid', 'uuid', 'text', 'user_membership_status', 'uuid[]'],
  'staff update RPC exists'
);

select function_returns(
  'public',
  'update_gym_staff_user',
  array['uuid', 'uuid', 'text', 'user_membership_status', 'uuid[]'],
  'jsonb',
  'staff update RPC returns jsonb'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.update_gym_staff_user(uuid, uuid, text, public.user_membership_status, uuid[])',
    'execute'
  ),
  'authenticated can execute staff update RPC'
);

insert into public.gym_users (
  id, gym_id, auth_user_id, employee_code, status, invited_by, accepted_at
) values (
  '3f000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000003',
  'TEST-TRAINER',
  'active',
  '00000000-0000-4000-8000-000000000001',
  timezone('utc', now())
);

insert into public.gym_user_roles (gym_user_id, role_id, assigned_by)
select
  '3f000000-0000-4000-8000-000000000003',
  r.id,
  '00000000-0000-4000-8000-000000000001'
from public.roles r
where r.gym_id = '20000000-0000-4000-8000-000000000001'
  and r.code = 'trainer';

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.update_gym_staff_user(
    '20000000-0000-4000-8000-000000000001',
    (select id from public.gym_users where gym_id = '20000000-0000-4000-8000-000000000001' and auth_user_id = '00000000-0000-4000-8000-000000000004'),
    'ADM-LOCAL',
    'active',
    null
  )$$,
  'authorized owner can update staff in the active gym'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.update_gym_staff_user(
    '20000000-0000-4000-8000-000000000001',
    '3f000000-0000-4000-8000-000000000003',
    'TEST-TRAINER',
    'active',
    null
  )$$,
  '42501',
  'staff.manage permission required',
  'same-gym user without staff.manage is rejected'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.update_gym_staff_user(
    '20000000-0000-4000-8000-000000000001',
    '3f000000-0000-4000-8000-000000000003',
    'TEST-TRAINER',
    'active',
    null
  )$$,
  '42501',
  'staff.manage permission required',
  'owner from another gym cannot manage target-gym staff'
);

set local role postgres;
update public.gym_users
set status = 'suspended'
where gym_id = '20000000-0000-4000-8000-000000000001'
  and auth_user_id = '00000000-0000-4000-8000-000000000004';
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.update_gym_staff_user(
    '20000000-0000-4000-8000-000000000001',
    '3f000000-0000-4000-8000-000000000003',
    'TEST-TRAINER',
    'active',
    null
  )$$,
  '42501',
  'staff.manage permission required',
  'suspended gym user cannot manage staff'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.update_gym_staff_user(
    '20000000-0000-4000-8000-000000000001',
    (select id from public.gym_users where gym_id = '20000000-0000-4000-8000-000000000001' and auth_user_id = '00000000-0000-4000-8000-000000000001'),
    null,
    'suspended',
    array[(select id from public.roles where gym_id = '20000000-0000-4000-8000-000000000001' and code = 'owner')]
  )$$,
  '23514',
  'The last active owner cannot be suspended or lose the owner role',
  'last active owner cannot be suspended'
);

select * from finish();
rollback;
