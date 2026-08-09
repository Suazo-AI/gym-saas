begin;

select plan(4);

-- F019. La vista public.v_gym_income filtra por mp.status = 'settled' y suma
-- mp.amount. La migracion 20260808010000_refund_member_payment.sql la habia
-- definido restando mp.refunded_amount, y 20260808020000_income_module.sql,
-- que tiene timestamp posterior, la reemplazo con create or replace y revirtio
-- esa correccion en silencio.
--
-- Consecuencia: reembolsar un cordoba de un pago de novecientos hace
-- desaparecer los novecientos del corte de caja y del dashboard del dueno.
--
-- Criterio escrito por el autor del contrato antes de delegar. El ejecutor no
-- puede modificar este archivo.

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
begin
  -- El pago del seed es de 900.00 NIO y esta settled. Se devuelven 100.
  perform public.refund_member_payment(
    '90000000-0000-4000-8000-000000000001',
    100.00,
    'Devolucion parcial por dias no usados.'
  );
end;
$$;

reset role;

select ok(
  exists (
    select 1 from public.v_gym_income vi
    where vi.source_id = '90000000-0000-4000-8000-000000000001'
  ),
  'un pago con reembolso parcial sigue contando como ingreso'
);

select is(
  (select vi.amount from public.v_gym_income vi
   where vi.source_id = '90000000-0000-4000-8000-000000000001'),
  800.00::numeric,
  'el ingreso es el neto: novecientos cobrados menos cien devueltos'
);

-- Se devuelve el resto. Un pago enteramente reembolsado no es ingreso, ya sea
-- porque la vista lo excluye o porque lo muestra en cero: las dos formas son
-- correctas y la asercion acepta ambas.
set local role authenticated;

do $$
begin
  perform public.refund_member_payment(
    '90000000-0000-4000-8000-000000000001',
    800.00,
    'Devolucion del resto.'
  );
end;
$$;

reset role;

select is(
  (select coalesce(sum(vi.amount), 0)::numeric
   from public.v_gym_income vi
   where vi.source_id = '90000000-0000-4000-8000-000000000001'),
  0::numeric,
  'un pago devuelto por completo no aporta ingresos'
);

select ok(
  exists (
    select 1 from public.v_gym_income vi
    where vi.source_type = 'other_income'
  ) or not exists (
    select 1 from public.other_income_entries
  ),
  'la otra mitad de la union, los ingresos que no son de membresia, sigue viva'
);

select * from finish();

rollback;
