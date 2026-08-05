begin;

select plan(27);

select has_table('public', 'gym_exchange_rate_history', 'exchange-rate history exists');
select has_view('public', 'gym_exchange_rate_current', 'current exchange-rate view exists');
select has_function(
  'public',
  'update_gym_exchange_rate',
  array['numeric'],
  'owner-only exchange-rate RPC exists'
);

select is(
  (select nio_per_usd from public.gym_exchange_rate_current
   where gym_id = '20000000-0000-4000-8000-000000000001'),
  36.60::numeric,
  'existing gyms start at C$36.60 per US$1'
);

select ok(
  (select reloptions @> array['security_invoker=true']
   from pg_class where oid = 'public.gym_exchange_rate_current'::regclass),
  'current-rate view uses security invoker'
);

select ok(
  (select prosecdef from pg_proc
   where oid = 'public.update_gym_exchange_rate(numeric)'::regprocedure),
  'update RPC is security definer'
);

select ok(has_function_privilege('authenticated', 'public.update_gym_exchange_rate(numeric)', 'execute'),
  'authenticated callers may invoke the guarded RPC');
select ok(not has_function_privilege('anon', 'public.update_gym_exchange_rate(numeric)', 'execute'),
  'anonymous callers cannot execute the RPC');
select ok(has_table_privilege('authenticated', 'public.gym_exchange_rate_history', 'select'),
  'authenticated callers may read tenant-filtered history');
select ok(not has_table_privilege('authenticated', 'public.gym_exchange_rate_history', 'insert'),
  'authenticated callers cannot insert history');
select ok(not has_table_privilege('authenticated', 'public.gym_exchange_rate_history', 'update'),
  'authenticated callers cannot update history');
select ok(not has_table_privilege('authenticated', 'public.gym_exchange_rate_history', 'delete'),
  'authenticated callers cannot delete history');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$ select public.update_gym_exchange_rate(37.250000) $$,
  'active system owner can update the rate'
);
select is(
  (select nio_per_usd from public.gym_exchange_rate_current
   where gym_id = '20000000-0000-4000-8000-000000000001'),
  37.250000::numeric,
  'owner update becomes the current rate'
);
select is(
  (select count(*) from public.gym_exchange_rate_history
   where gym_id = '20000000-0000-4000-8000-000000000001'),
  2::bigint,
  'rate changes append immutable history'
);
select is(
  (select action from public.audit_logs
   where gym_id = '20000000-0000-4000-8000-000000000001'
     and action = 'GYM_EXCHANGE_RATE_UPDATED'
   order by id desc limit 1),
  'GYM_EXCHANGE_RATE_UPDATED',
  'owner update creates an audit record'
);
select results_eq(
  $$ select before_data, after_data from public.audit_logs
     where gym_id = '20000000-0000-4000-8000-000000000001'
       and action = 'GYM_EXCHANGE_RATE_UPDATED'
     order by id desc limit 1 $$,
  $$ values ('{"nio_per_usd": 36.600000}'::jsonb, '{"nio_per_usd": 37.250000}'::jsonb) $$,
  'audit payload contains only the old and new rates'
);

select throws_ok($$ select public.update_gym_exchange_rate(0) $$, '23514', 'Exchange rate must be greater than zero',
  'zero rate is rejected');
select throws_ok($$ select public.update_gym_exchange_rate(-1) $$, '23514', 'Exchange rate must be greater than zero',
  'negative rate is rejected');
select throws_ok($$ select public.update_gym_exchange_rate('NaN'::numeric) $$, '23514',
  'Exchange rate must be a finite number greater than zero', 'NaN rate is rejected');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select throws_ok($$ select public.update_gym_exchange_rate(38) $$, '42501',
  'Only an active gym owner can update the exchange rate', 'manager is rejected');

reset role;
select set_config('request.jwt.claims', '{}', true);
-- Fixture setup runs as the test transaction owner, never as the caller under test.
insert into public.gym_users (gym_id, auth_user_id, status, accepted_at)
values ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'active', now());
insert into public.gym_user_roles (gym_user_id, role_id, assigned_by)
select gu.id, r.id, '00000000-0000-4000-8000-000000000001'
from public.gym_users gu join public.roles r on r.gym_id = gu.gym_id and r.code = 'receptionist'
where gu.gym_id = '20000000-0000-4000-8000-000000000001'
  and gu.auth_user_id = '00000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok($$ select public.update_gym_exchange_rate(38) $$, '42501',
  'Only an active gym owner can update the exchange rate', 'receptionist is rejected');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*) from public.gym_exchange_rate_current
  where gym_id = '20000000-0000-4000-8000-000000000001'), 0::bigint,
  'owner from another gym cannot read the target gym rate');
select throws_ok($$ select public.update_gym_exchange_rate(38, '20000000-0000-4000-8000-000000000001'::uuid) $$,
  '42883', null, 'caller cannot supply a target gym id');

reset role;
select throws_ok($$ update public.gym_exchange_rate_history set nio_per_usd = 99 $$,
  '55000', 'Exchange-rate history is immutable', 'history cannot be rewritten even by a privileged direct update');

insert into public.gyms (id, legal_name, trade_name, slug, created_by)
values (
  '20000000-0000-4000-8000-000000000099', 'Contrato futuro S.A.',
  'Contrato futuro', 'contrato-futuro-rate', '00000000-0000-4000-8000-000000000001'
);
select is(
  (select nio_per_usd from public.gym_exchange_rate_history
   where gym_id = '20000000-0000-4000-8000-000000000099'),
  36.600000::numeric,
  'future gyms receive the initial C$36.60 rate through the trigger'
);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select public.update_gym_exchange_rate(40) $$,
  '42501', null, 'anonymous caller is rejected by execute privileges');

select * from finish();
rollback;
