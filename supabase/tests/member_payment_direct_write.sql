begin;

select plan(28);

insert into public.persons (id, first_name, last_name, created_by)
values (
  '50000000-0000-4000-8000-000000000099',
  'Paquete',
  'Uno',
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
  '60000000-0000-4000-8000-000000000099',
  '20000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000099',
  '30000000-0000-4000-8000-000000000001',
  'M-P1-SUBSCRIPTION',
  'prospect',
  current_date,
  '00000000-0000-4000-8000-000000000001'
);

select col_not_null(
  'public',
  'member_payments',
  'receipt_number',
  'member payment receipt number is required'
);

select ok(
  has_table_privilege('authenticated', 'public.member_payments', 'select'),
  'authenticated keeps select on member payments'
);

select ok(
  has_table_privilege('authenticated', 'public.membership_charges', 'select'),
  'authenticated keeps select on membership charges'
);

select ok(
  has_table_privilege('authenticated', 'public.member_payment_allocations', 'select'),
  'authenticated keeps select on payment allocations'
);

select ok(
  not has_table_privilege('authenticated', 'public.member_payments', 'insert'),
  'authenticated cannot insert member payments directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.member_payments', 'update'),
  'authenticated cannot update member payments directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.member_payments', 'delete'),
  'authenticated cannot delete member payments directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.membership_charges', 'insert'),
  'authenticated cannot insert membership charges directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.membership_charges', 'update'),
  'authenticated cannot update membership charges directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.membership_charges', 'delete'),
  'authenticated cannot delete membership charges directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.member_payment_allocations', 'insert'),
  'authenticated cannot insert payment allocations directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.member_payment_allocations', 'update'),
  'authenticated cannot update payment allocations directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.member_payment_allocations', 'delete'),
  'authenticated cannot delete payment allocations directly'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$
    insert into public.member_payments (
      gym_id,
      gym_member_id,
      payment_method_id,
      amount,
      currency,
      receipt_number
    ) values (
      '20000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000002',
      (select id from public.payment_methods where code = 'cash'),
      1.00,
      'NIO',
      'R-DIRECT-INSERT'
    )
  $$,
  '42501',
  'permission denied for table member_payments',
  'payments manager cannot insert a member payment directly'
);

select throws_ok(
  $$
    update public.member_payments
    set amount = 1.00
    where id = '90000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'permission denied for table member_payments',
  'payments manager cannot update a member payment directly'
);

select throws_ok(
  $$
    delete from public.member_payments
    where id = '90000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'permission denied for table member_payments',
  'payments manager cannot delete a member payment directly'
);

select lives_ok(
  $$
    select public.register_member_payment(
      p_gym_id => '20000000-0000-4000-8000-000000000001',
      p_gym_member_id => '60000000-0000-4000-8000-000000000002',
      p_payment_method_id => (select id from public.payment_methods where code = 'cash'),
      p_amount => 100.00,
      p_currency => 'NIO',
      p_allocations => '[{"chargeId":"80000000-0000-4000-8000-000000000002","amount":"100.00"}]'::jsonb,
      p_external_reference => 'P1-REGISTER'
    )
  $$,
  'register_member_payment still inserts a payment through its security definer contract'
);

select isnt_empty(
  $$
    select 1
    from public.member_payments
    where external_reference = 'P1-REGISTER'
      and receipt_number is not null
  $$,
  'register_member_payment creates a payment with a receipt'
);

select lives_ok(
  $$
    select public.void_member_payment(
      (select id from public.member_payments where external_reference = 'P1-REGISTER'),
      'Paquete 1 test'
    )
  $$,
  'void_member_payment still updates a payment through its security definer contract'
);

select is(
  (
    select status::text
    from public.member_payments
    where external_reference = 'P1-REGISTER'
  ),
  'void',
  'void_member_payment leaves the payment voided'
);

select lives_ok(
  $$
    select public.record_member_payment(
      '20000000-0000-4000-8000-000000000001',
      '80000000-0000-4000-8000-000000000002',
      (select id from public.payment_methods where code = 'cash'),
      900.00,
      'NIO',
      timezone('utc', now()),
      'P1 record payment'
    )
  $$,
  'record_member_payment still inserts a payment through its security definer contract'
);

select isnt_empty(
  $$
    select 1
    from public.member_payments
    where notes = 'P1 record payment'
      and receipt_number like 'PAY-%'
  $$,
  'record_member_payment creates its payment and receipt'
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
      p_notes => 'P1 day pass'
    )
  $$,
  'register_member_day_pass still inserts a payment through its security definer contract'
);

select isnt_empty(
  $$
    select 1
    from public.member_payments
    where notes = 'P1 day pass'
      and receipt_number like 'DAY-%'
  $$,
  'register_member_day_pass creates its payment and receipt'
);

select lives_ok(
  $$
    select public.start_member_subscription(
      '60000000-0000-4000-8000-000000000099',
      '40000000-0000-4000-8000-000000000001',
      current_date,
      (select id from public.payment_methods where code = 'cash'),
      900.00,
      'NIO'
    )
  $$,
  'start_member_subscription still inserts a payment through its security definer contract'
);

select isnt_empty(
  $$
    select 1
    from public.member_payments
    where gym_member_id = '60000000-0000-4000-8000-000000000099'
      and receipt_number like 'R-%'
  $$,
  'start_member_subscription creates its payment and receipt'
);

select lives_ok(
  $$
    select public.create_gym_member(
      p_gym_id => '20000000-0000-4000-8000-000000000001',
      p_first_name => 'Pago',
      p_last_name => 'Inicial',
      p_member_code => 'M-P1-CREATE',
      p_branch_id => '30000000-0000-4000-8000-000000000001',
      p_joined_on => current_date,
      p_membership_plan_id => '40000000-0000-4000-8000-000000000001',
      p_subscription_start_date => current_date,
      p_create_initial_charge => true,
      p_payment_method_id => (select id from public.payment_methods where code = 'cash'),
      p_payment_amount => 900.00,
      p_payment_currency => 'NIO',
      p_payment_notes => 'P1 create member payment'
    )
  $$,
  'create_gym_member with payment still inserts through its security definer contract'
);

select isnt_empty(
  $$
    select 1
    from public.member_payments mp
    join public.gym_members gm on gm.id = mp.gym_member_id
    where gm.member_code = 'M-P1-CREATE'
      and mp.notes = 'P1 create member payment'
      and mp.receipt_number like 'R-%'
  $$,
  'create_gym_member with payment creates its payment and receipt'
);

select * from finish();

rollback;
