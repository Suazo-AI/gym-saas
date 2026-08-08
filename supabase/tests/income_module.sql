begin;

select plan(17);

select has_function(
  'public',
  'record_other_income',
  array['uuid', 'uuid', 'numeric', 'character', 'uuid', 'text', 'text', 'timestamp with time zone'],
  'record_other_income rpc exists'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public.record_other_income(uuid,uuid,numeric,character,uuid,text,text,timestamptz)'::regprocedure),
  'record_other_income is security definer'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.record_other_income(uuid,uuid,numeric,character,uuid,text,text,timestamptz)',
    'execute'
  ),
  'authenticated can execute the guarded rpc'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.record_other_income(uuid,uuid,numeric,character,uuid,text,text,timestamptz)',
    'execute'
  ),
  'anonymous callers cannot execute the rpc'
);

select ok(
  not has_table_privilege('authenticated', 'public.other_income_entries', 'insert')
  and not has_table_privilege('authenticated', 'public.other_income_entries', 'update')
  and not has_table_privilege('authenticated', 'public.other_income_entries', 'delete'),
  'other income history can only be written through guarded operations'
);

insert into public.gym_users(gym_id, auth_user_id, status, accepted_at)
values (
  '20000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000003',
  'active',
  timezone('utc', now())
);

insert into public.gym_user_roles(gym_user_id, role_id, assigned_by)
select gu.id, r.id, '00000000-0000-4000-8000-000000000001'
from public.gym_users gu
join public.roles r on r.gym_id = gu.gym_id and r.code = 'trainer'
where gu.gym_id = '20000000-0000-4000-8000-000000000001'
  and gu.auth_user_id = '00000000-0000-4000-8000-000000000003';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);

select throws_ok(
  $$select public.record_other_income(
    '20000000-0000-4000-8000-000000000001',
    (select id from public.income_categories where gym_id = '20000000-0000-4000-8000-000000000001' and code = 'products' and deleted_at is null),
    25.00,
    'NIO'
  )$$,
  '42501',
  'Insufficient permission: income.manage',
  'a caller without income.manage is rejected'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$select public.record_other_income(
    '20000000-0000-4000-8000-000000000001',
    (select id from public.income_categories where gym_id = '20000000-0000-4000-8000-000000000001' and code = 'products' and deleted_at is null),
    125.50,
    'NIO',
    '30000000-0000-4000-8000-000000000001',
    'S2-INCOME-TEST',
    'Venta de producto'
  )$$,
  'an authorized owner records other income'
);

select results_eq(
  $$select amount, currency::text, recorded_by
    from public.other_income_entries
    where reference = 'S2-INCOME-TEST'$$,
  $$values (125.50::numeric, 'NIO'::text, '00000000-0000-4000-8000-000000000001'::uuid)$$,
  'the rpc stores the verified amount, currency and actor'
);

select is(
  (select action from public.audit_logs where action = 'other_income.recorded' and after_data ->> 'reference' = 'S2-INCOME-TEST' order by id desc limit 1),
  'other_income.recorded',
  'recording other income creates an audit event'
);

select throws_ok(
  $$select public.record_other_income(
    '20000000-0000-4000-8000-000000000001',
    (select id from public.income_categories where gym_id = '20000000-0000-4000-8000-000000000002' and code = 'products' and deleted_at is null),
    10.00,
    'NIO'
  )$$,
  '23503',
  'La categoría no pertenece a este gimnasio.',
  'a category from another gym is rejected'
);

select throws_ok(
  $$select public.record_other_income(
    '20000000-0000-4000-8000-000000000001',
    (select id from public.income_categories where gym_id = '20000000-0000-4000-8000-000000000001' and code = 'products' and deleted_at is null),
    10.00,
    'NIO',
    '30000000-0000-4000-8000-000000000002'
  )$$,
  '23503',
  'La sucursal no pertenece a este gimnasio.',
  'a branch from another gym is rejected'
);

select throws_ok(
  $$select public.record_other_income(
    '20000000-0000-4000-8000-000000000001',
    (select id from public.income_categories where gym_id = '20000000-0000-4000-8000-000000000001' and code = 'products' and deleted_at is null),
    10.001,
    'NIO'
  )$$,
  '22023',
  'El monto no puede tener más de dos decimales.',
  'amounts with more than two decimals are rejected'
);

select throws_ok(
  $$select public.record_other_income(
    '20000000-0000-4000-8000-000000000001',
    (select id from public.income_categories where gym_id = '20000000-0000-4000-8000-000000000001' and code = 'products' and deleted_at is null),
    10.00,
    'EUR'
  )$$,
  '22023',
  'La moneda debe ser NIO o USD.',
  'unsupported currencies are rejected'
);

reset role;
select set_config('request.jwt.claims', '{}', true);

insert into public.other_income_entries(
  gym_id, branch_id, income_category_id, amount, currency, occurred_at, reference
)
select
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  c.id,
  fixture.amount,
  fixture.currency,
  fixture.occurred_at,
  fixture.reference
from public.income_categories c
cross join (values
  (10.00::numeric, 'NIO'::char(3), '2035-08-01 04:30:00+00'::timestamptz, 'S2-TZ-JULY'),
  (20.00::numeric, 'NIO'::char(3), '2035-08-01 06:30:00+00'::timestamptz, 'S2-TZ-AUGUST'),
  (5.00::numeric, 'USD'::char(3), '2035-08-15 12:00:00+00'::timestamptz, 'S2-TZ-USD')
) as fixture(amount, currency, occurred_at, reference)
where c.gym_id = '20000000-0000-4000-8000-000000000001'
  and c.code = 'other'
  and c.deleted_at is null;

select results_eq(
  $$select income_date, currency::text, total_income
    from public.v_gym_income_daily
    where gym_id = '20000000-0000-4000-8000-000000000001'
      and income_date between '2035-07-31' and '2035-08-01'
    order by income_date, currency$$,
  $$values
    ('2035-07-31'::date, 'NIO'::text, 10.00::numeric),
    ('2035-08-01'::date, 'NIO'::text, 20.00::numeric)$$,
  'daily income uses the gym timezone instead of UTC'
);

select results_eq(
  $$select income_month, currency::text, total_income
    from public.v_gym_income_monthly
    where gym_id = '20000000-0000-4000-8000-000000000001'
      and income_month between '2035-07-01' and '2035-08-01'
    order by income_month, currency$$,
  $$values
    ('2035-07-01'::date, 'NIO'::text, 10.00::numeric),
    ('2035-08-01'::date, 'NIO'::text, 20.00::numeric),
    ('2035-08-01'::date, 'USD'::text, 5.00::numeric)$$,
  'monthly income returns known totals by local month and currency'
);

select is(
  (select income_category_id
    from public.v_gym_income
    where source_type = 'other_income' and reference = 'S2-TZ-JULY'),
  (select id from public.income_categories where gym_id = '20000000-0000-4000-8000-000000000001' and code = 'other' and deleted_at is null),
  'v_gym_income exposes the income category id'
);

select ok(
  (select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.v_gym_income_monthly'::regclass),
  'monthly income view uses security invoker'
);

select * from finish();
rollback;
