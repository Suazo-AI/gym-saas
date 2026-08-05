begin;

select plan(5);

select has_function('public', 'get_owner_dashboard', array['uuid'], 'owner dashboard rpc exists');
select isnt_empty(
  $$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'get_owner_dashboard' and p.prosecdef$$,
  'owner dashboard is security definer'
);
select ok(
  has_function_privilege('authenticated', 'public.get_owner_dashboard(uuid)', 'execute'),
  'authenticated can execute the protected rpc'
);
select throws_ok(
  $$select public.get_owner_dashboard('20000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'anonymous users cannot read dashboard metrics'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok(
  $$select public.get_owner_dashboard('20000000-0000-4000-8000-000000000001')$$,
  'authorized owner can read only the active gym dashboard'
);

select * from finish();
rollback;
