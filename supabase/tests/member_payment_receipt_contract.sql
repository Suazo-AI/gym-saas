begin;

select plan(12);

select has_function(
  'private',
  'ensure_member_payment_receipt',
  array[]::text[],
  'shared receipt trigger function exists'
);

select isnt_empty(
  $$
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'member_payments'
      and t.tgname = 'trg_member_payments_ensure_receipt'
      and not t.tgisinternal
  $$,
  'every member payment insert uses the shared receipt trigger'
);

insert into public.persons (id, first_name, last_name, created_by)
values (
  '50000000-0000-4000-8000-000000000096',
  'Inicio',
  'Pagado',
  '00000000-0000-4000-8000-000000000001'
);

insert into public.gym_members (
  id,
  gym_id,
  person_id,
  home_branch_id,
  member_code,
  status,
  joined_on,
  created_by
)
values (
  '60000000-0000-4000-8000-000000000096',
  '20000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000096',
  '30000000-0000-4000-8000-000000000001',
  'M-P3-START',
  'prospect',
  current_date,
  '00000000-0000-4000-8000-000000000001'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    select public.register_member_payment(
      p_gym_id => '20000000-0000-4000-8000-000000000001',
      p_gym_member_id => '60000000-0000-4000-8000-000000000002',
      p_payment_method_id => (select id from public.payment_methods where code = 'cash'),
      p_amount => 100.00,
      p_currency => 'NIO',
      p_allocations => '[{"chargeId":"80000000-0000-4000-8000-000000000002","amount":"100.00"}]'::jsonb,
      p_external_reference => 'P3-CANONICAL'
    )
  $$,
  'canonical payment path registers a partial payment'
);

select matches(
  (select receipt_number from public.member_payments where external_reference = 'P3-CANONICAL'),
  '^R-[0-9A-F]{10}$',
  'canonical payment path uses the unified receipt format'
);

select lives_ok(
  $$
    select public.record_member_payment(
      '20000000-0000-4000-8000-000000000001',
      '80000000-0000-4000-8000-000000000002',
      (select id from public.payment_methods where code = 'cash'),
      100.00,
      'NIO',
      timezone('utc', now()),
      'P3 wrapper'
    )
  $$,
  'compatibility wrapper delegates a partial payment'
);

select matches(
  (select receipt_number from public.member_payments where notes = 'P3 wrapper'),
  '^R-[0-9A-F]{10}$',
  'compatibility wrapper uses the unified receipt format'
);

select lives_ok(
  $$
    select public.register_member_day_pass(
      p_gym_id => '20000000-0000-4000-8000-000000000001',
      p_gym_member_id => '60000000-0000-4000-8000-000000000001',
      p_payment_method_id => (select id from public.payment_methods where code = 'cash'),
      p_service_date => current_date,
      p_amount => 50.00,
      p_currency => 'NIO',
      p_notes => 'P3 day pass'
    )
  $$,
  'day pass payment path registers a payment'
);

select matches(
  (select receipt_number from public.member_payments where notes = 'P3 day pass'),
  '^R-[0-9A-F]{10}$',
  'day pass payment path uses the unified receipt format'
);

select set_config(
  'test.cash_payment_method_id',
  (select id::text from public.payment_methods where code = 'cash'),
  true
);

set local role service_role;

select lives_ok(
  $$
    select public.start_member_subscription(
      '60000000-0000-4000-8000-000000000096',
      '40000000-0000-4000-8000-000000000001',
      current_date,
      current_setting('test.cash_payment_method_id')::uuid,
      900.00,
      'NIO'
    )
  $$,
  'paid subscription path registers a payment'
);

set local role authenticated;

select matches(
  (
    select receipt_number
    from public.member_payments
    where gym_member_id = '60000000-0000-4000-8000-000000000096'
  ),
  '^R-[0-9A-F]{10}$',
  'paid subscription path uses the unified receipt format'
);

select lives_ok(
  $$
    select public.create_gym_member(
      p_gym_id => '20000000-0000-4000-8000-000000000001',
      p_first_name => 'Alta',
      p_last_name => 'Con Pago',
      p_member_code => 'M-P3-CREATE',
      p_branch_id => '30000000-0000-4000-8000-000000000001',
      p_joined_on => current_date,
      p_membership_plan_id => '40000000-0000-4000-8000-000000000001',
      p_subscription_start_date => current_date,
      p_create_initial_charge => true,
      p_payment_method_id => (select id from public.payment_methods where code = 'cash'),
      p_payment_amount => 900.00,
      p_payment_currency => 'NIO',
      p_payment_notes => 'P3 create member'
    )
  $$,
  'member creation payment path registers a payment'
);

select matches(
  (select receipt_number from public.member_payments where notes = 'P3 create member'),
  '^R-[0-9A-F]{10}$',
  'member creation payment path uses the unified receipt format'
);

select * from finish();

rollback;
