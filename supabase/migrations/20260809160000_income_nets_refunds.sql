begin;

-- 20260808010000_refund_member_payment.sql habia definido esta vista restando
-- refunded_amount y aceptando los pagos parcialmente reembolsados.
-- 20260808020000_income_module.sql, con timestamp posterior, la reemplazo con
-- create or replace y revirtio esa correccion sin que nadie lo notara: volvio
-- a filtrar por status = 'settled' y a sumar el monto bruto.
--
-- El efecto era que devolver un cordoba de un pago de novecientos borraba los
-- novecientos del corte de caja y del dashboard del dueno.
--
-- Un pago enteramente reembolsado queda en cero, no desaparece: conservar la
-- fila mantiene el rastro de que el cobro existio y que se devolvio completo.

create or replace view public.v_gym_income
with (security_invoker = true)
as
select
  mp.gym_id,
  mp.branch_id,
  mp.paid_at as occurred_at,
  (mp.amount - coalesce(mp.refunded_amount, 0))::numeric(14,2) as amount,
  mp.currency,
  'membership_payment'::text as source_type,
  mp.id as source_id,
  mp.receipt_number as reference,
  ic.id as income_category_id
from public.member_payments mp
left join public.income_categories ic
  on ic.gym_id = mp.gym_id
  and ic.code = 'membership'
  and ic.is_active
  and ic.deleted_at is null
where mp.status in ('settled', 'partially_refunded', 'refunded')

union all

select
  oi.gym_id,
  oi.branch_id,
  oi.occurred_at,
  oi.amount,
  oi.currency,
  'other_income'::text as source_type,
  oi.id as source_id,
  oi.reference,
  oi.income_category_id
from public.other_income_entries oi
where oi.status = 'posted';

comment on view public.v_gym_income
is 'Ingresos del gimnasio netos de reembolsos. Un pago devuelto por completo queda en cero y conserva su fila.';

commit;
