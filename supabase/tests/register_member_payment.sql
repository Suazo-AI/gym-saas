begin;

select plan(10);

insert into public.membership_charges(
  id,
  gym_member_id,
  member_subscription_id,
  period_start,
  period_end,
  due_date,
  amount_due,
  currency,
  status
)
values (
  '80000000-0000-4000-8000-000000000003',
  '60000000-0000-4000-8000-000000000003',
  '70000000-0000-4000-8000-000000000003',
  current_date,
  current_date + 29,
  current_date,
  30.00,
  'USD',
  'pending'
)
on conflict do nothing;

select has_view(
  'public',
  'api_v1_member_pending_charges',
  'pending charges view exists'
);

select ok(
  has_table_privilege(
    'authenticated',
    'public.api_v1_member_pending_charges',
    'select'
  ),
  'authenticated can read pending charges'
);

select has_function(
  'public',
  'register_member_payment',
  array[
    'uuid', 'uuid', 'uuid', 'numeric', 'character', 'jsonb',
    'uuid', 'timestamp with time zone', 'text', 'text'
  ],
  'register_member_payment rpc exists'
);

select isnt_empty(
  $$select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'register_member_payment'
      and p.prosecdef$$,
  'register_member_payment is security definer'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.register_member_payment(uuid, uuid, uuid, numeric, character, jsonb, uuid, timestamptz, text, text)',
    'execute'
  ),
  'authenticated can execute register_member_payment'
);

select throws_ok(
  $$select public.register_member_payment(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000002',
    (select id from public.payment_methods where code = 'cash'),
    900.00,
    'NIO',
    '[{"chargeId":"80000000-0000-4000-8000-000000000002","amount":"900.00"}]'::jsonb
  )$$,
  '42501',
  'Insufficient permission: payments.manage',
  'register_member_payment rejects non-authenticated context'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$select public.register_member_payment(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000002',
    (select id from public.payment_methods where code = 'cash'),
    901.00,
    'NIO',
    '[{"chargeId":"80000000-0000-4000-8000-000000000002","amount":"901.00"}]'::jsonb
  )$$,
  '22023',
  'El monto excede lo pendiente. El miembro debe NIO 900.00.',
  'register_member_payment rejects overpayment with exact pending amount'
);

select throws_ok(
  $$select public.register_member_payment(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000002',
    (select id from public.payment_methods where code = 'cash'),
    10.00,
    'USD',
    '[{"chargeId":"80000000-0000-4000-8000-000000000002","amount":"10.00"}]'::jsonb
  )$$,
  '22023',
  'La moneda del pago no coincide con la del cargo.',
  'register_member_payment rejects cross-currency allocations'
);

select throws_ok(
  $$select public.register_member_payment(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000002',
    (select id from public.payment_methods where code = 'cash'),
    10.00,
    'USD',
    '[{"chargeId":"80000000-0000-4000-8000-000000000003","amount":"10.00"}]'::jsonb
  )$$,
  '23503',
  'El cargo no pertenece al miembro.',
  'register_member_payment rejects a charge from another gym'
);

select throws_ok(
  $$select public.register_member_payment(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000002',
    (select id from public.payment_methods where code = 'cash'),
    900.00,
    'NIO',
    '[{"chargeId":"80000000-0000-4000-8000-000000000002","amount":"899.00"}]'::jsonb
  )$$,
  '22023',
  'El total asignado no coincide con el monto del pago.',
  'register_member_payment rejects an allocation sum different from payment amount'
);

select * from finish();

rollback;
