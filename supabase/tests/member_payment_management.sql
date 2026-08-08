begin;
select plan(37);
select has_column('public','member_payments','applied_nio_per_usd','payments snapshot applied exchange rate');
select has_function('public','record_member_payment',array['uuid','uuid','uuid','numeric','character','timestamp with time zone','text'],'record payment rpc exists');
select has_function('public','void_member_payment',array['uuid','text'],'void payment rpc exists');
select has_function('public','list_payable_member_charges',array['uuid'],'payable charges rpc exists');
select throws_ok($$select public.record_member_payment('20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',(select id from public.payment_methods where code='cash'),900,'NIO')$$,'42501',null,'anonymous payment is rejected');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.record_member_payment('20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',(select id from public.payment_methods where code='cash'),100,'NIO')$$,'the compatibility wrapper accepts a partial payment');
select is((select status::text from public.membership_charges where id='80000000-0000-4000-8000-000000000002'),'partial','the partial payment leaves the charge partial');
select matches((select mp.receipt_number from public.member_payments mp join public.member_payment_allocations a on a.member_payment_id=mp.id where a.membership_charge_id='80000000-0000-4000-8000-000000000002' and a.amount=100 limit 1),'^R-[0-9A-F]{10}$','the wrapper uses the unified receipt format');
select throws_ok($$select public.record_member_payment('20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',(select id from public.payment_methods where code='cash'),900,'USD')$$,'22023','La moneda del pago no coincide con la del cargo.','cross currency payment uses the canonical validation');
select lives_ok($$select public.record_member_payment('20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',(select id from public.payment_methods where code='cash'),800,'NIO')$$,'remaining payment is recorded atomically');

select lives_ok(
  $$select public.void_member_payment(
    (select mp.id
     from public.member_payments mp
     join public.member_payment_allocations a on a.member_payment_id = mp.id
     where a.membership_charge_id = '80000000-0000-4000-8000-000000000002'
       and a.amount = 800
     limit 1),
    'Pago duplicado'
  )$$,
  'a settled payment can be voided'
);

select is(
  (select mp.status::text
   from public.member_payments mp
   join public.member_payment_allocations a on a.member_payment_id = mp.id
   where a.membership_charge_id = '80000000-0000-4000-8000-000000000002'
     and a.amount = 800
   limit 1),
  'void',
  'void changes the payment status'
);

select is(
  (select status::text
   from public.membership_charges
   where id = '80000000-0000-4000-8000-000000000002'),
  'partial',
  'void reopens a partially paid charge'
);

select isnt_empty(
  $$select 1
    from public.audit_logs al
    where al.action = 'member_payment.voided'
      and al.before_data is not null
      and al.entity_id = (
        select mp.id::text
        from public.member_payments mp
        join public.member_payment_allocations a on a.member_payment_id = mp.id
        where a.membership_charge_id = '80000000-0000-4000-8000-000000000002'
          and a.amount = 800
        limit 1
      )$$,
  'void writes a complete audit snapshot'
);

select throws_ok(
  $$select public.void_member_payment(
    (select mp.id
     from public.member_payments mp
     join public.member_payment_allocations a on a.member_payment_id = mp.id
     where a.membership_charge_id = '80000000-0000-4000-8000-000000000002'
       and a.amount = 800
     limit 1),
    'Segundo intento'
  )$$,
  '23514',
  'Only settled payments can be voided',
  'a payment cannot be voided twice'
);

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select throws_ok(
  $$select public.void_member_payment(
    (select mp.id
     from public.member_payments mp
     join public.member_payment_allocations a on a.member_payment_id = mp.id
     where a.membership_charge_id = '80000000-0000-4000-8000-000000000002'
       and a.amount = 100
     limit 1),
    'Otro gimnasio'
  )$$,
  '42501',
  'Payment not found or insufficient permission',
  'a user from another gym cannot void the payment'
);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);

select has_column(
  'public',
  'member_payments',
  'refunded_amount',
  'payments track the refunded amount separately'
);

select has_function(
  'public',
  'refund_member_payment',
  array['uuid', 'numeric', 'text'],
  'refund payment rpc exists'
);

select isnt_empty(
  $$select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'refund_member_payment'
      and p.prosecdef
      and p.proconfig @> array['search_path=']::text[]$$,
  'refund payment is security definer with an empty search path'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.refund_member_payment(uuid, numeric, text)',
    'execute'
  ),
  'authenticated can execute refund_member_payment'
);

select lives_ok(
  $$select public.refund_member_payment(
    '90000000-0000-4000-8000-000000000001',
    300.00,
    'Devolucion parcial'
  )$$,
  'a settled payment accepts a partial refund'
);

select is(
  (select status::text from public.member_payments
   where id = '90000000-0000-4000-8000-000000000001'),
  'partially_refunded',
  'a partial refund changes the payment status'
);

select is(
  (select refunded_amount from public.member_payments
   where id = '90000000-0000-4000-8000-000000000001'),
  300.00::numeric,
  'a partial refund records the refunded amount'
);

select is(
  (select amount from public.member_payment_allocations
   where member_payment_id = '90000000-0000-4000-8000-000000000001'
     and membership_charge_id = '80000000-0000-4000-8000-000000000001'),
  600.00::numeric,
  'a partial refund reverses the charge allocation proportionally'
);

select is(
  (select status::text from public.membership_charges
   where id = '80000000-0000-4000-8000-000000000001'),
  'partial',
  'a partial refund restores charge balance'
);

select isnt_empty(
  $$select 1
    from public.audit_logs
    where action = 'member_payment.refunded'
      and entity_id = '90000000-0000-4000-8000-000000000001'
      and before_data is not null
      and after_data ->> 'amount' = '300.00'$$,
  'a refund writes a complete audit snapshot'
);

select is(
  (select amount from public.member_payments
   where id = '90000000-0000-4000-8000-000000000001'),
  900.00::numeric,
  'a refund preserves the original payment amount'
);

select is(
  (select currency::text from public.member_payments
   where id = '90000000-0000-4000-8000-000000000001'),
  'NIO',
  'a refund preserves the original payment currency'
);

select is(
  (select receipt_number from public.member_payments
   where id = '90000000-0000-4000-8000-000000000001'),
  'R-LOCAL-0001',
  'a refund preserves the original receipt number'
);

select throws_ok(
  $$select public.refund_member_payment(
    '90000000-0000-4000-8000-000000000001',
    601.00,
    'Monto excesivo'
  )$$,
  '22023',
  'Refund amount exceeds the refundable payment balance',
  'a refund cannot exceed the remaining payment amount'
);

select lives_ok(
  $$select public.refund_member_payment(
    '90000000-0000-4000-8000-000000000001',
    600.00,
    'Devolucion total'
  )$$,
  'the remaining amount can be refunded'
);

select is(
  (select status::text from public.member_payments
   where id = '90000000-0000-4000-8000-000000000001'),
  'refunded',
  'a total refund changes the payment status'
);

select is(
  (select refunded_amount from public.member_payments
   where id = '90000000-0000-4000-8000-000000000001'),
  900.00::numeric,
  'a total refund records the full amount'
);

select is(
  (select status::text from public.membership_charges
   where id = '80000000-0000-4000-8000-000000000001'),
  'pending',
  'a total refund restores the full charge balance'
);

select throws_ok(
  $$select public.refund_member_payment(
    '90000000-0000-4000-8000-000000000001',
    1.00,
    'Intento repetido'
  )$$,
  '23514',
  'Only settled payments can be refunded',
  'a fully refunded payment cannot be refunded again'
);

select throws_ok(
  $$select public.refund_member_payment(
    (select mp.id
     from public.member_payments mp
     join public.member_payment_allocations a on a.member_payment_id = mp.id
     where a.membership_charge_id = '80000000-0000-4000-8000-000000000002'
       and a.amount = 800
     limit 1),
    1.00,
    'Pago anulado'
  )$$,
  '23514',
  'Only settled payments can be refunded',
  'a voided payment cannot be refunded'
);

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select throws_ok(
  $$select public.refund_member_payment(
    (select mp.id
     from public.member_payments mp
     join public.member_payment_allocations a on a.member_payment_id = mp.id
     where a.membership_charge_id = '80000000-0000-4000-8000-000000000002'
       and a.amount = 100
     limit 1),
    1.00,
    'Otro gimnasio'
  )$$,
  '42501',
  'Payment not found or insufficient permission',
  'a user without permission cannot refund the payment'
);
select * from finish();
rollback;
