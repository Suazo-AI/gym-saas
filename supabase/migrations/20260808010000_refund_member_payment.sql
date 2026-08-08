begin;

alter table public.member_payments
  add column refunded_amount numeric(14,2) not null default 0,
  add constraint member_payments_refunded_amount_valid
    check (refunded_amount >= 0 and refunded_amount <= amount);

create or replace function private.refresh_membership_charge_status(p_charge_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due numeric(14,2);
  v_paid numeric(14,2);
  v_current_status public.charge_status;
begin
  select amount_due, status
    into v_due, v_current_status
  from public.membership_charges
  where id = p_charge_id
  for update;

  if not found or v_current_status = 'void' then
    return;
  end if;

  select coalesce(sum(a.amount), 0)
    into v_paid
  from public.member_payment_allocations a
  join public.member_payments p on p.id = a.member_payment_id
  where a.membership_charge_id = p_charge_id
    and p.status in ('settled', 'partially_refunded');

  update public.membership_charges
  set status = case
    when v_paid >= v_due then 'paid'::public.charge_status
    when v_paid > 0 then 'partial'::public.charge_status
    else 'pending'::public.charge_status
  end
  where id = p_charge_id;
end;
$$;

create or replace view public.api_v1_member_pending_charges
with (security_invoker = true)
as
select
  gm.gym_id,
  mc.gym_member_id,
  mc.id as charge_id,
  mc.member_subscription_id,
  mc.period_start,
  mc.period_end,
  mc.due_date,
  mc.amount_due,
  paid.amount_paid,
  greatest(mc.amount_due - paid.amount_paid, 0)::numeric(14,2) as amount_remaining,
  mc.currency,
  mc.status
from public.membership_charges mc
join public.gym_members gm on gm.id = mc.gym_member_id
left join lateral (
  select coalesce(
    sum(a.amount) filter (where p.status in ('settled', 'partially_refunded')),
    0
  )::numeric(14,2) as amount_paid
  from public.member_payment_allocations a
  join public.member_payments p on p.id = a.member_payment_id
  where a.membership_charge_id = mc.id
) paid on true
where mc.status in ('pending', 'partial')
  and gm.deleted_at is null
order by mc.due_date;

grant select on public.api_v1_member_pending_charges to authenticated, service_role;

create or replace function public.list_payable_member_charges(p_gym_id uuid)
returns table (
  charge_id uuid,
  gym_member_id uuid,
  member_label text,
  due_date date,
  amount_due numeric(14,2),
  currency char(3),
  status public.charge_status
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission(p_gym_id, 'payments.manage') then
    raise exception 'Insufficient permission: payments.manage' using errcode = '42501';
  end if;

  return query
  select
    mc.id,
    gm.id,
    concat(gm.member_code, ' - ', p.first_name, ' ', p.last_name),
    mc.due_date,
    (
      mc.amount_due - coalesce((
        select sum(a.amount)
        from public.member_payment_allocations a
        join public.member_payments mp on mp.id = a.member_payment_id
        where a.membership_charge_id = mc.id
          and mp.status in ('settled', 'partially_refunded')
      ), 0)
    )::numeric(14,2),
    mc.currency,
    mc.status
  from public.membership_charges mc
  join public.gym_members gm on gm.id = mc.gym_member_id
  join public.persons p on p.id = gm.person_id
  where gm.gym_id = p_gym_id
    and gm.deleted_at is null
    and mc.status in ('pending', 'partial')
  order by mc.due_date, p.first_name, p.last_name;
end;
$$;

revoke all on function public.list_payable_member_charges(uuid) from public;
grant execute on function public.list_payable_member_charges(uuid)
  to authenticated, service_role;

create or replace function public.register_member_payment(
  p_gym_id uuid,
  p_gym_member_id uuid,
  p_payment_method_id uuid,
  p_amount numeric,
  p_currency char(3),
  p_allocations jsonb,
  p_branch_id uuid default null,
  p_paid_at timestamptz default null,
  p_external_reference text default null,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_allocation jsonb;
  v_charge_id uuid;
  v_charge_ids uuid[] := array[]::uuid[];
  v_allocation_amount numeric;
  v_allocation_amounts numeric[] := array[]::numeric[];
  v_allocation_total numeric := 0;
  v_charge public.membership_charges;
  v_amount_paid numeric;
  v_remaining numeric;
  v_total_pending numeric;
  v_payment_id uuid;
  v_receipt_number text;
  v_paid_at timestamptz;
  v_attempt integer;
  v_result_allocations jsonb;
  v_remaining_balance numeric;
begin
  if not private.has_permission(p_gym_id, 'payments.manage') then
    raise exception 'Insufficient permission: payments.manage' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.gym_members gm
    where gm.id = p_gym_member_id
      and gm.gym_id = p_gym_id
      and gm.deleted_at is null
  ) then
    raise exception 'No encontramos el miembro en este gimnasio.' using errcode = 'P0002';
  end if;

  if p_branch_id is not null and not exists (
    select 1
    from public.gym_branches gb
    where gb.id = p_branch_id
      and gb.gym_id = p_gym_id
      and gb.deleted_at is null
  ) then
    raise exception 'La sucursal no pertenece a este gimnasio.' using errcode = '23503';
  end if;

  if not exists (
    select 1
    from public.payment_methods pm
    where pm.id = p_payment_method_id
      and pm.is_active
  ) then
    raise exception 'El método de pago no está disponible.' using errcode = '23503';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor que cero.' using errcode = '22023';
  end if;

  if p_amount <> round(p_amount, 2) then
    raise exception 'El monto no puede tener más de dos decimales.' using errcode = '22023';
  end if;

  if p_currency is null or p_currency not in ('NIO', 'USD') then
    raise exception 'La moneda debe ser NIO o USD.' using errcode = '22023';
  end if;

  if p_allocations is null
    or jsonb_typeof(p_allocations) <> 'array'
    or jsonb_array_length(p_allocations) = 0 then
    raise exception 'Debes indicar a qué cargos se aplica el pago.' using errcode = '22023';
  end if;

  for v_allocation in select value from jsonb_array_elements(p_allocations)
  loop
    if jsonb_typeof(v_allocation) <> 'object' then
      raise exception 'Las asignaciones del pago no son válidas.' using errcode = '22023';
    end if;

    begin
      v_charge_id := (v_allocation ->> 'chargeId')::uuid;
    exception
      when invalid_text_representation or null_value_not_allowed then
        raise exception 'Las asignaciones del pago no son válidas.' using errcode = '22023';
    end;

    if v_charge_id is null then
      raise exception 'Las asignaciones del pago no son válidas.' using errcode = '22023';
    end if;

    if v_charge_id = any(v_charge_ids) then
      raise exception 'No puedes repetir un cargo en las asignaciones.' using errcode = '22023';
    end if;

    begin
      v_allocation_amount := (v_allocation ->> 'amount')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'El monto asignado debe ser mayor que cero.' using errcode = '22023';
    end;

    if v_allocation_amount is null or v_allocation_amount <= 0 then
      raise exception 'El monto asignado debe ser mayor que cero.' using errcode = '22023';
    end if;

    if v_allocation_amount <> round(v_allocation_amount, 2) then
      raise exception 'Los montos asignados no pueden tener más de dos decimales.'
        using errcode = '22023';
    end if;

    v_charge_ids := array_append(v_charge_ids, v_charge_id);
    v_allocation_amounts := array_append(v_allocation_amounts, v_allocation_amount);
    v_allocation_total := v_allocation_total + v_allocation_amount;
  end loop;

  if p_amount <> v_allocation_total then
    raise exception 'El total asignado no coincide con el monto del pago.' using errcode = '22023';
  end if;

  perform mc.id
  from public.membership_charges mc
  where mc.id = any(v_charge_ids)
  order by mc.id
  for update;

  foreach v_charge_id in array v_charge_ids
  loop
    select mc.* into v_charge
    from public.membership_charges mc
    where mc.id = v_charge_id;

    if not found or v_charge.gym_member_id <> p_gym_member_id then
      raise exception 'El cargo no pertenece al miembro.' using errcode = '23503';
    end if;

    if v_charge.status not in ('pending', 'partial') then
      raise exception 'Uno de los cargos ya está pagado o anulado.' using errcode = '22023';
    end if;

    if v_charge.currency <> p_currency then
      raise exception 'La moneda del pago no coincide con la del cargo.' using errcode = '22023';
    end if;
  end loop;

  select coalesce(sum(balance.amount_remaining), 0)::numeric(14,2)
  into v_total_pending
  from (
    select mc.amount_due - coalesce(
      sum(a.amount) filter (where p.status in ('settled', 'partially_refunded')),
      0
    ) as amount_remaining
    from public.membership_charges mc
    left join public.member_payment_allocations a on a.membership_charge_id = mc.id
    left join public.member_payments p on p.id = a.member_payment_id
    where mc.gym_member_id = p_gym_member_id
      and mc.status in ('pending', 'partial')
      and mc.currency = p_currency
    group by mc.id, mc.amount_due
  ) balance;

  if p_amount > v_total_pending then
    raise exception '%',
      'El monto excede lo pendiente. El miembro debe ' || p_currency || ' '
      || to_char(v_total_pending, 'FM999999990.00') || '.'
      using errcode = '22023';
  end if;

  for v_attempt in 1..array_length(v_charge_ids, 1)
  loop
    v_charge_id := v_charge_ids[v_attempt];
    v_allocation_amount := v_allocation_amounts[v_attempt];

    select coalesce(
      sum(a.amount) filter (where p.status in ('settled', 'partially_refunded')),
      0
    )
    into v_amount_paid
    from public.member_payment_allocations a
    join public.member_payments p on p.id = a.member_payment_id
    where a.membership_charge_id = v_charge_id;

    select mc.* into v_charge
    from public.membership_charges mc
    where mc.id = v_charge_id;

    v_remaining := v_charge.amount_due - v_amount_paid;
    if v_allocation_amount > v_remaining then
      raise exception '%',
        'El monto asignado supera el saldo del cargo (' || v_charge.currency || ' '
        || to_char(v_remaining, 'FM999999990.00') || ').'
        using errcode = '22023';
    end if;
  end loop;

  v_paid_at := coalesce(p_paid_at, timezone('utc', now()));

  if v_paid_at > timezone('utc', now()) + interval '5 minutes' then
    raise exception 'La fecha del pago no puede estar en el futuro.' using errcode = '22023';
  end if;

  if v_paid_at < timezone('utc', now()) - interval '30 days' then
    raise exception 'La fecha del pago no puede tener más de 30 días de antigüedad.'
      using errcode = '22023';
  end if;

  for v_attempt in 1..5
  loop
    begin
      v_receipt_number := 'R-' || upper(
        substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 10)
      );

      insert into public.member_payments(
        gym_id, gym_member_id, branch_id, payment_method_id, status, amount,
        currency, receipt_number, external_reference, paid_at, received_by, notes
      ) values (
        p_gym_id, p_gym_member_id, p_branch_id, p_payment_method_id,
        'settled'::public.payment_status, p_amount, p_currency, v_receipt_number,
        nullif(trim(p_external_reference), ''), v_paid_at, v_actor,
        nullif(trim(p_notes), '')
      )
      returning id, receipt_number into v_payment_id, v_receipt_number;
      exit;
    exception
      when unique_violation then
        if v_attempt = 5 then raise; end if;
    end;
  end loop;

  for v_attempt in 1..array_length(v_charge_ids, 1)
  loop
    insert into public.member_payment_allocations(
      member_payment_id, membership_charge_id, amount
    ) values (
      v_payment_id, v_charge_ids[v_attempt], v_allocation_amounts[v_attempt]
    );
  end loop;

  insert into public.audit_logs(
    gym_id, actor_user_id, action, entity_table, entity_id, before_data, after_data
  ) values (
    p_gym_id, v_actor, 'payment.registered', 'member_payments', v_payment_id::text,
    null,
    jsonb_build_object(
      'gymMemberId', p_gym_member_id,
      'amount', p_amount::text,
      'currency', p_currency,
      'receiptNumber', v_receipt_number
    )
  );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'chargeId', selected.charge_id,
        'amount', selected.amount::text,
        'chargeStatus', mc.status
      ) order by selected.ordinality
    ),
    '[]'::jsonb
  )
  into v_result_allocations
  from unnest(v_charge_ids, v_allocation_amounts) with ordinality
    as selected(charge_id, amount, ordinality)
  join public.membership_charges mc on mc.id = selected.charge_id;

  select coalesce(sum(balance.amount_remaining), 0)::numeric(14,2)
  into v_remaining_balance
  from (
    select mc.amount_due - coalesce(
      sum(a.amount) filter (where p.status in ('settled', 'partially_refunded')),
      0
    ) as amount_remaining
    from public.membership_charges mc
    left join public.member_payment_allocations a on a.membership_charge_id = mc.id
    left join public.member_payments p on p.id = a.member_payment_id
    where mc.gym_member_id = p_gym_member_id
      and mc.status in ('pending', 'partial')
      and mc.currency = p_currency
    group by mc.id, mc.amount_due
  ) balance;

  return jsonb_build_object(
    'paymentId', v_payment_id,
    'receiptNumber', v_receipt_number,
    'amount', p_amount::text,
    'currency', p_currency,
    'paidAt', v_paid_at,
    'allocations', v_result_allocations,
    'remainingBalance', v_remaining_balance::text
  );
end;
$$;

revoke all on function public.register_member_payment(
  uuid, uuid, uuid, numeric, character, jsonb, uuid, timestamptz, text, text
) from public;
grant execute on function public.register_member_payment(
  uuid, uuid, uuid, numeric, character, jsonb, uuid, timestamptz, text, text
) to authenticated, service_role;

create or replace function public.refund_member_payment(
  p_payment_id uuid,
  p_amount numeric,
  p_reason text
) returns public.member_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_payment public.member_payments;
  v_before jsonb;
  v_remaining numeric(14,2);
  v_total_allocated numeric(14,2);
  v_reversal_target numeric(14,2);
  v_reversal_remaining numeric(14,2);
  v_reversal numeric(14,2);
  v_new_amount numeric(14,2);
  v_allocations_remaining integer;
  v_allocation record;
  v_reversals jsonb := '[]'::jsonb;
begin
  select mp.*
  into v_payment
  from public.member_payments mp
  where mp.id = p_payment_id
  for update;

  if not found
     or not private.has_permission(v_payment.gym_id, 'payments.manage') then
    raise exception 'Payment not found or insufficient permission' using errcode = '42501';
  end if;

  if v_payment.status not in ('settled', 'partially_refunded') then
    raise exception 'Only settled payments can be refunded' using errcode = '23514';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Refund reason is required' using errcode = '23514';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'Refund amount must be positive with at most two decimals'
      using errcode = '22023';
  end if;

  v_remaining := v_payment.amount - v_payment.refunded_amount;
  if p_amount > v_remaining then
    raise exception 'Refund amount exceeds the refundable payment balance'
      using errcode = '22023';
  end if;

  v_before := to_jsonb(v_payment);

  select coalesce(sum(a.amount), 0)::numeric(14,2), count(*)::integer
  into v_total_allocated, v_allocations_remaining
  from public.member_payment_allocations a
  where a.member_payment_id = p_payment_id;

  v_reversal_target := least(p_amount, v_total_allocated);
  v_reversal_remaining := v_reversal_target;

  if p_amount < v_remaining and v_reversal_target > 0 then
    for v_allocation in
      select a.membership_charge_id, a.amount
      from public.member_payment_allocations a
      where a.member_payment_id = p_payment_id
      order by a.membership_charge_id
      for update
    loop
      if v_allocations_remaining = 1 then
        v_reversal := v_reversal_remaining;
      else
        v_reversal := least(
          v_allocation.amount,
          round(v_reversal_target * v_allocation.amount / v_total_allocated, 2)
        );
      end if;

      v_new_amount := v_allocation.amount - v_reversal;
      if v_new_amount = 0 then
        delete from public.member_payment_allocations a
        where a.member_payment_id = p_payment_id
          and a.membership_charge_id = v_allocation.membership_charge_id;
      else
        update public.member_payment_allocations a
        set amount = v_new_amount
        where a.member_payment_id = p_payment_id
          and a.membership_charge_id = v_allocation.membership_charge_id;
      end if;

      v_reversals := v_reversals || jsonb_build_array(jsonb_build_object(
        'chargeId', v_allocation.membership_charge_id,
        'amount', v_reversal::text
      ));
      v_reversal_remaining := v_reversal_remaining - v_reversal;
      v_allocations_remaining := v_allocations_remaining - 1;
    end loop;
  elsif p_amount = v_remaining then
    select coalesce(jsonb_agg(jsonb_build_object(
      'chargeId', a.membership_charge_id,
      'amount', a.amount::text
    ) order by a.membership_charge_id), '[]'::jsonb)
    into v_reversals
    from public.member_payment_allocations a
    where a.member_payment_id = p_payment_id;
  end if;

  update public.member_payments
  set
    status = case
      when refunded_amount + p_amount = amount
        then 'refunded'::public.payment_status
      else 'partially_refunded'::public.payment_status
    end,
    refunded_amount = refunded_amount + p_amount,
    updated_at = timezone('utc', now())
  where id = p_payment_id
  returning * into v_payment;

  insert into public.audit_logs(
    gym_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    before_data,
    after_data
  ) values (
    v_payment.gym_id,
    v_actor,
    'member_payment.refunded',
    'member_payments',
    v_payment.id::text,
    v_before,
    jsonb_build_object(
      'status', v_payment.status,
      'amount', p_amount::text,
      'refundedAmount', v_payment.refunded_amount::text,
      'reason', trim(p_reason),
      'allocationReversals', v_reversals
    )
  );

  return v_payment;
end;
$$;

revoke all on function public.refund_member_payment(uuid, numeric, text) from public;
grant execute on function public.refund_member_payment(uuid, numeric, text)
  to authenticated, service_role;

create or replace view public.v_gym_income
with (security_invoker = true)
as
select
  mp.gym_id,
  mp.branch_id,
  mp.paid_at as occurred_at,
  (mp.amount - mp.refunded_amount)::numeric(14,2) as amount,
  mp.currency,
  'membership_payment'::text as source_type,
  mp.id as source_id,
  mp.receipt_number as reference
from public.member_payments mp
where mp.status in ('settled', 'partially_refunded')

union all

select
  oi.gym_id,
  oi.branch_id,
  oi.occurred_at,
  oi.amount,
  oi.currency,
  'other_income'::text as source_type,
  oi.id as source_id,
  oi.reference
from public.other_income_entries oi
where oi.status = 'posted';

commit;
