begin;
select plan(3);

select has_function(
  'public',
  'link_invited_gym_staff_user',
  array['uuid', 'uuid', 'text', 'uuid[]'],
  'staff invitation linking RPC exists'
);

select function_returns(
  'public',
  'link_invited_gym_staff_user',
  array['uuid', 'uuid', 'text', 'uuid[]'],
  'jsonb',
  'staff invitation linking RPC returns jsonb'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.link_invited_gym_staff_user(uuid, uuid, text, uuid[])',
    'execute'
  ),
  'authenticated can execute staff invitation linking RPC'
);

select * from finish();
rollback;
