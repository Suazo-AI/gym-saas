begin;

select plan(19);

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

-- ============================================================================
-- Centavos y fecha: lo que el cliente manda y el servidor no debe aceptar
-- ============================================================================

select throws_ok(
  $$select public.register_member_payment(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000002',
    (select id from public.payment_methods where code = 'cash'),
    19.988,
    'NIO',
    '[{"chargeId":"80000000-0000-4000-8000-000000000002","amount":"19.988"}]'::jsonb
  )$$,
  '22023',
  'El monto no puede tener más de dos decimales.',
  'register_member_payment rejects sub-cent amounts that would round on disk'
);

select throws_ok(
  $$select public.register_member_payment(
    p_gym_id => '20000000-0000-4000-8000-000000000001',
    p_gym_member_id => '60000000-0000-4000-8000-000000000002',
    p_payment_method_id => (select id from public.payment_methods where code = 'cash'),
    p_amount => 400.00,
    p_currency => 'NIO',
    p_allocations => '[{"chargeId":"80000000-0000-4000-8000-000000000002","amount":"400.00"}]'::jsonb,
    p_paid_at => timezone('utc', now()) + interval '2 days'
  )$$,
  '22023',
  'La fecha del pago no puede estar en el futuro.',
  'register_member_payment rejects a payment dated in the future'
);

-- ============================================================================
-- Camino feliz: el dinero se registra, se aplica y queda auditado
-- ============================================================================

select lives_ok(
  $$select public.register_member_payment(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000002',
    (select id from public.payment_methods where code = 'cash'),
    400.00,
    'NIO',
    '[{"chargeId":"80000000-0000-4000-8000-000000000002","amount":"400.00"}]'::jsonb
  )$$,
  'register_member_payment accepts a partial payment'
);

select is(
  (select mc.status::text
   from public.membership_charges mc
   where mc.id = '80000000-0000-4000-8000-000000000002'),
  'partial',
  'a partial payment leaves the charge as partial'
);

select is(
  (select count(*)::int
   from public.member_payment_allocations a
   where a.membership_charge_id = '80000000-0000-4000-8000-000000000002'),
  1,
  'the allocation row was written'
);

select isnt_empty(
  $$select 1 from public.audit_logs
    where action = 'payment.registered'
      and gym_id = '20000000-0000-4000-8000-000000000001'$$,
  'the payment was audited'
);

select lives_ok(
  $$select public.register_member_payment(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000002',
    (select id from public.payment_methods where code = 'cash'),
    500.00,
    'NIO',
    '[{"chargeId":"80000000-0000-4000-8000-000000000002","amount":"500.00"}]'::jsonb
  )$$,
  'register_member_payment accepts the payment that completes the charge'
);

select is(
  (select mc.status::text
   from public.membership_charges mc
   where mc.id = '80000000-0000-4000-8000-000000000002'),
  'paid',
  'completing the balance leaves the charge as paid'
);

select is(
  (select coalesce(sum(amount_remaining), 0)::numeric(14,2)
   from public.api_v1_member_pending_charges
   where charge_id = '80000000-0000-4000-8000-000000000002'),
  0::numeric(14,2),
  'a settled charge no longer shows a pending balance'
);

select * from finish();

rollback;
