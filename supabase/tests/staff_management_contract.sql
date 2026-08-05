begin;
select plan(3);

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

select * from finish();
rollback;
