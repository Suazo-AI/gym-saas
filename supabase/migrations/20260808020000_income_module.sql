begin;

create or replace function public.record_other_income(
  p_gym_id uuid,
  p_income_category_id uuid,
  p_amount numeric,
  p_currency char(3),
  p_branch_id uuid default null,
  p_reference text default null,
  p_description text default null,
  p_occurred_at timestamptz default timezone('utc', now())
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_entry public.other_income_entries;
begin
  if not private.has_permission(p_gym_id, 'income.manage') then
    raise exception 'Insufficient permission: income.manage' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.gyms g
    where g.id = p_gym_id
      and g.status = 'active'
      and g.deleted_at is null
  ) then
    raise exception 'No encontramos un gimnasio activo.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.income_categories c
    where c.id = p_income_category_id
      and c.gym_id = p_gym_id
      and c.is_active
      and c.deleted_at is null
  ) then
    raise exception 'La categoría no pertenece a este gimnasio.' using errcode = '23503';
  end if;

  if p_branch_id is not null and not exists (
    select 1
    from public.gym_branches b
    where b.id = p_branch_id
      and b.gym_id = p_gym_id
      and b.status = 'active'
      and b.deleted_at is null
  ) then
    raise exception 'La sucursal no pertenece a este gimnasio.' using errcode = '23503';
  end if;

  if p_amount is null or p_amount = 'NaN'::numeric or p_amount <= 0 then
    raise exception 'El monto debe ser mayor que cero.' using errcode = '22023';
  end if;

  if p_amount <> round(p_amount, 2) then
    raise exception 'El monto no puede tener más de dos decimales.' using errcode = '22023';
  end if;

  if p_currency is null or p_currency not in ('NIO', 'USD') then
    raise exception 'La moneda debe ser NIO o USD.' using errcode = '22023';
  end if;

  if p_occurred_at is null then
    raise exception 'La fecha del ingreso es obligatoria.' using errcode = '22023';
  end if;

  insert into public.other_income_entries(
    gym_id,
    branch_id,
    income_category_id,
    status,
    amount,
    currency,
    occurred_at,
    reference,
    description,
    recorded_by
  )
  values (
    p_gym_id,
    p_branch_id,
    p_income_category_id,
    'posted',
    p_amount,
    p_currency,
    p_occurred_at,
    nullif(trim(p_reference), ''),
    nullif(trim(p_description), ''),
    v_actor
  )
  returning * into v_entry;

  insert into public.audit_logs(
    gym_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    after_data
  )
  values (
    p_gym_id,
    v_actor,
    'other_income.recorded',
    'other_income_entries',
    v_entry.id::text,
    jsonb_build_object(
      'branch_id', v_entry.branch_id,
      'income_category_id', v_entry.income_category_id,
      'amount', v_entry.amount,
      'currency', v_entry.currency,
      'occurred_at', v_entry.occurred_at,
      'reference', v_entry.reference
    )
  );

  return jsonb_build_object(
    'id', v_entry.id,
    'amount', v_entry.amount,
    'currency', v_entry.currency,
    'occurred_at', v_entry.occurred_at
  );
end;
$$;

revoke all on function public.record_other_income(uuid, uuid, numeric, character, uuid, text, text, timestamptz) from public;
grant execute on function public.record_other_income(uuid, uuid, numeric, character, uuid, text, text, timestamptz)
  to authenticated, service_role;

revoke insert, update, delete on public.other_income_entries from authenticated;

create or replace view public.v_gym_income
with (security_invoker = true)
as
select
  mp.gym_id,
  mp.branch_id,
  mp.paid_at as occurred_at,
  mp.amount,
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
where mp.status = 'settled'

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

create or replace view public.v_gym_income_daily
with (security_invoker = true)
as
select
  i.gym_id,
  (i.occurred_at at time zone g.timezone)::date as income_date,
  i.currency,
  sum(i.amount)::numeric(14,2) as total_income
from public.v_gym_income i
join public.gyms g on g.id = i.gym_id
group by i.gym_id, (i.occurred_at at time zone g.timezone)::date, i.currency;

create view public.v_gym_income_monthly
with (security_invoker = true)
as
select
  i.gym_id,
  date_trunc('month', i.occurred_at at time zone g.timezone)::date as income_month,
  i.currency,
  sum(i.amount)::numeric(14,2) as total_income
from public.v_gym_income i
join public.gyms g on g.id = i.gym_id
group by i.gym_id, date_trunc('month', i.occurred_at at time zone g.timezone)::date, i.currency;

grant select on public.v_gym_income_monthly to authenticated;

comment on function public.record_other_income(uuid, uuid, numeric, character, uuid, text, text, timestamptz)
is 'Records an audited non-membership income entry after validating income.manage and tenant ownership.';

comment on view public.v_gym_income_monthly
is 'Monthly gym income totals grouped in each gym local timezone.';

commit;
