begin;
select plan(2);

select has_function(
  'public',
  'list_gym_staff',
  array['uuid'],
  'staff directory RPC exists'
);

select function_returns(
  'public',
  'list_gym_staff',
  array['uuid'],
  'jsonb',
  'staff directory RPC returns jsonb'
);

select * from finish();
rollback;
