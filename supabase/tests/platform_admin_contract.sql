begin;

select plan(8);

select has_function(
  'private',
  'is_platform_admin',
  array[]::text[],
  'private.is_platform_admin exists'
);

select has_function(
  'public',
  'get_platform_dashboard',
  array[]::text[],
  'get_platform_dashboard rpc exists'
);

select has_function(
  'public',
  'get_platform_gym_detail',
  array['uuid'],
  'get_platform_gym_detail rpc exists'
);

select isnt_empty(
  $$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'get_platform_dashboard' and p.prosecdef$$,
  'get_platform_dashboard is security definer'
);

select isnt_empty(
  $$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'get_platform_gym_detail' and p.prosecdef$$,
  'get_platform_gym_detail is security definer'
);

select ok(
  has_function_privilege('authenticated', 'public.get_platform_dashboard()', 'execute'),
  'authenticated can execute dashboard rpc'
);

select ok(
  has_function_privilege('authenticated', 'public.get_platform_gym_detail(uuid)', 'execute'),
  'authenticated can execute gym detail rpc'
);

select throws_ok(
  $$select public.get_platform_dashboard()$$,
  '42501',
  null,
  'platform dashboard rejects non-platform context'
);

select * from finish();

rollback;
