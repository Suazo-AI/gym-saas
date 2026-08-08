begin;

create or replace function private.ensure_member_payment_receipt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt integer;
  v_candidate text := upper(trim(coalesce(new.receipt_number, '')));
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('member-payment-receipt:' || new.gym_id::text, 0)
  );

  if v_candidate ~ '^R-[0-9A-F]{10}$'
     and not exists (
       select 1
       from public.member_payments mp
       where mp.gym_id = new.gym_id
         and mp.receipt_number = v_candidate
     ) then
    new.receipt_number := v_candidate;
    return new;
  end if;

  for v_attempt in 1..5
  loop
    v_candidate := 'R-' || upper(
      substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 10)
    );

    exit when not exists (
      select 1
      from public.member_payments mp
      where mp.gym_id = new.gym_id
        and mp.receipt_number = v_candidate
    );
  end loop;

  if exists (
    select 1
    from public.member_payments mp
    where mp.gym_id = new.gym_id
      and mp.receipt_number = v_candidate
  ) then
    raise exception 'No se pudo generar un numero de recibo unico.'
      using errcode = '23505';
  end if;

  new.receipt_number := v_candidate;
  return new;
end;
$$;

revoke all on function private.ensure_member_payment_receipt()
  from public, anon, authenticated, service_role;

create trigger trg_member_payments_ensure_receipt
before insert on public.member_payments
for each row execute function private.ensure_member_payment_receipt();

comment on function private.ensure_member_payment_receipt() is
'Normalizes every member payment receipt to R plus 10 hexadecimal characters and retries candidate generation under a per-gym transaction lock.';

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

  for v_allocation in
    select value from jsonb_array_elements(p_allocations)
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
    select mc.*
    into v_charge
    from public.membership_charges mc
    where mc.id = v_charge_id;

    if not found or v_charge.gym_member_id <> p_gym_member_id then
      raise exception 'El cargo no pertenece al miembro.' using errcode = '23503';
    end if;

    if v_charge.status not in ('pending', 'partial', 'overdue') then
      raise exception 'Uno de los cargos ya está pagado o anulado.' using errcode = '22023';
    end if;

    if v_charge.currency <> p_currency then
      raise exception 'La moneda del pago no coincide con la del cargo.' using errcode = '22023';
    end if;
  end loop;

  select coalesce(sum(balance.amount_remaining), 0)::numeric(14,2)
  into v_total_pending
  from (
    select mc.amount_due - coalesce(sum(a.amount) filter (where p.status = 'settled'), 0) as amount_remaining
    from public.membership_charges mc
    left join public.member_payment_allocations a on a.membership_charge_id = mc.id
    left join public.member_payments p on p.id = a.member_payment_id
    where mc.gym_member_id = p_gym_member_id
      and mc.status in ('pending', 'partial', 'overdue')
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

    select coalesce(sum(a.amount) filter (where p.status = 'settled'), 0)
    into v_amount_paid
    from public.member_payment_allocations a
    join public.member_payments p on p.id = a.member_payment_id
    where a.membership_charge_id = v_charge_id;

    select mc.*
    into v_charge
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
        gym_id,
        gym_member_id,
        branch_id,
        payment_method_id,
        status,
        amount,
        currency,
        receipt_number,
        external_reference,
        paid_at,
        received_by,
        notes
      )
      values (
        p_gym_id,
        p_gym_member_id,
        p_branch_id,
        p_payment_method_id,
        'settled'::public.payment_status,
        p_amount,
        p_currency,
        v_receipt_number,
        nullif(trim(p_external_reference), ''),
        v_paid_at,
        v_actor,
        nullif(trim(p_notes), '')
      )
      returning id, receipt_number into v_payment_id, v_receipt_number;

      exit;
    exception
      when unique_violation then
        if v_attempt = 5 then
          raise;
        end if;
    end;
  end loop;

  for v_attempt in 1..array_length(v_charge_ids, 1)
  loop
    insert into public.member_payment_allocations(
      member_payment_id,
      membership_charge_id,
      amount
    )
    values (
      v_payment_id,
      v_charge_ids[v_attempt],
      v_allocation_amounts[v_attempt]
    );
  end loop;

  insert into public.audit_logs(
    gym_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    before_data,
    after_data
  )
  values (
    p_gym_id,
    v_actor,
    'payment.registered',
    'member_payments',
    v_payment_id::text,
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
      )
      order by selected.ordinality
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
    select mc.amount_due - coalesce(sum(a.amount) filter (where p.status = 'settled'), 0) as amount_remaining
    from public.membership_charges mc
    left join public.member_payment_allocations a on a.membership_charge_id = mc.id
    left join public.member_payments p on p.id = a.member_payment_id
    where mc.gym_member_id = p_gym_member_id
      and mc.status in ('pending', 'partial', 'overdue')
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

create or replace function public.record_member_payment(
  p_gym_id uuid,
  p_charge_id uuid,
  p_payment_method_id uuid,
  p_amount numeric,
  p_currency char(3),
  p_paid_at timestamptz default timezone('utc', now()),
  p_notes text default null
)
returns public.member_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_charge public.membership_charges;
  v_member public.gym_members;
  v_result jsonb;
  v_payment public.member_payments;
begin
  select mc.*
  into v_charge
  from public.membership_charges mc
  join public.gym_members gm on gm.id = mc.gym_member_id
  where mc.id = p_charge_id
    and gm.gym_id = p_gym_id
    and gm.deleted_at is null;

  if not found then
    raise exception 'Charge is not payable' using errcode = '23514';
  end if;

  select gm.*
  into v_member
  from public.gym_members gm
  where gm.id = v_charge.gym_member_id;

  v_result := public.register_member_payment(
    p_gym_id => p_gym_id,
    p_gym_member_id => v_member.id,
    p_payment_method_id => p_payment_method_id,
    p_amount => p_amount,
    p_currency => p_currency,
    p_allocations => jsonb_build_array(
      jsonb_build_object(
        'chargeId', p_charge_id,
        'amount', p_amount::text
      )
    ),
    p_branch_id => v_member.home_branch_id,
    p_paid_at => p_paid_at,
    p_external_reference => null,
    p_notes => p_notes
  );

  select mp.*
  into v_payment
  from public.member_payments mp
  where mp.id = (v_result ->> 'paymentId')::uuid;

  return v_payment;
end;
$$;

revoke all on function public.record_member_payment(
  uuid, uuid, uuid, numeric, character, timestamptz, text
) from public;

grant execute on function public.record_member_payment(
  uuid, uuid, uuid, numeric, character, timestamptz, text
) to authenticated, service_role;

comment on function public.record_member_payment(
  uuid, uuid, uuid, numeric, character, timestamptz, text
) is
'Compatibility wrapper. New callers use register_member_payment, which supports partial and multi-charge payments.';

commit;
