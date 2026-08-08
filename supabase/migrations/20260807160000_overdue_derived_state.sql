begin;

lock table public.membership_charges in access exclusive mode;

with paid_totals as (
  select
    mc.id,
    coalesce(sum(mpa.amount) filter (where mp.status = 'settled'), 0)::numeric(14,2) as amount_paid
  from public.membership_charges mc
  left join public.member_payment_allocations mpa
    on mpa.membership_charge_id = mc.id
  left join public.member_payments mp
    on mp.id = mpa.member_payment_id
  where mc.status = 'overdue'
  group by mc.id
)
update public.membership_charges mc
set status = case
  when paid_totals.amount_paid >= mc.amount_due then 'paid'::public.charge_status
  when paid_totals.amount_paid > 0 then 'partial'::public.charge_status
  else 'pending'::public.charge_status
end
from paid_totals
where mc.id = paid_totals.id;

create or replace function private.charge_is_overdue(
  p_status public.charge_status,
  p_due_date date,
  p_as_of date default current_date
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_status in (
    'pending'::public.charge_status,
    'partial'::public.charge_status
  ) and p_due_date < p_as_of;
$$;

revoke all on function private.charge_is_overdue(public.charge_status, date, date) from public;
grant execute on function private.charge_is_overdue(public.charge_status, date, date)
  to authenticated, service_role;

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
    and p.status = 'settled';

  update public.membership_charges
  set status = case
    when v_paid >= v_due then 'paid'::public.charge_status
    when v_paid > 0 then 'partial'::public.charge_status
    else 'pending'::public.charge_status
  end
  where id = p_charge_id;
end;
$$;

create or replace function public.generate_membership_charges(
  p_gym_id uuid,
  p_through_date date default current_date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not private.is_service_role()
     and not private.has_permission(p_gym_id, 'memberships.manage') then
    raise exception 'Insufficient permission';
  end if;

  insert into public.membership_charges(
    gym_member_id,
    member_subscription_id,
    period_start,
    period_end,
    due_date,
    amount_due,
    currency,
    status
  )
  select
    ms.gym_member_id,
    ms.id,
    gs::date,
    (gs + make_interval(months => ms.billing_cycle_months) - interval '1 day')::date,
    gs::date,
    ms.recurring_amount,
    ms.currency,
    'pending'::public.charge_status
  from public.member_subscriptions ms
  join public.gym_members gm on gm.id = ms.gym_member_id
  cross join lateral generate_series(
    ms.start_date::timestamp,
    least(coalesce(ms.end_date, p_through_date), p_through_date)::timestamp,
    make_interval(months => ms.billing_cycle_months)
  ) gs
  where gm.gym_id = p_gym_id
    and ms.status in ('trialing', 'active', 'past_due')
  on conflict (member_subscription_id, period_start) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.assign_member_subscription(
  p_gym_id uuid,
  p_gym_member_id uuid,
  p_membership_plan_id uuid,
  p_start_date date default current_date,
  p_billing_cycle_months integer default null,
  p_recurring_amount numeric default null,
  p_currency char(3) default null,
  p_auto_renew boolean default true,
  p_generate_first_charge boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.gym_members;
  v_plan public.membership_plans;
  v_subscription_id uuid;
  v_subscription_end_date date;
  v_charge_id uuid;
  v_start_date date := coalesce(p_start_date, current_date);
  v_cycle integer;
  v_amount numeric(14,2);
  v_currency char(3);
  v_actor uuid := auth.uid();
begin
  if not private.has_permission(p_gym_id, 'memberships.manage') then
    raise exception 'Insufficient permission: memberships.manage'
      using errcode = '42501';
  end if;

  select gm.*
  into v_member
  from public.gym_members gm
  where gm.id = p_gym_member_id
    and gm.gym_id = p_gym_id
    and gm.deleted_at is null
  for update;

  if not found then
    raise exception 'No encontramos el miembro en este gimnasio.'
      using errcode = 'P0002';
  end if;

  select mp.*
  into v_plan
  from public.membership_plans mp
  where mp.id = p_membership_plan_id
    and mp.gym_id = p_gym_id
    and mp.deleted_at is null
    and mp.is_active
  for share;

  if not found then
    raise exception 'El plan no pertenece a este gimnasio o no está activo.'
      using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.member_subscriptions ms
    where ms.gym_member_id = p_gym_member_id
      and ms.status in (
        'trialing'::public.subscription_status,
        'active'::public.subscription_status,
        'past_due'::public.subscription_status,
        'paused'::public.subscription_status
      )
  ) then
    raise exception 'El miembro ya tiene una membresía vigente. Cancélala antes de asignar otra.'
      using errcode = '22023';
  end if;

  if v_member.joined_on is not null and v_start_date < v_member.joined_on then
    raise exception 'La fecha de inicio no puede ser anterior al ingreso del miembro.'
      using errcode = '22023';
  end if;

  v_cycle := coalesce(p_billing_cycle_months, v_plan.billing_cycle_months);
  v_amount := coalesce(p_recurring_amount, v_plan.price);
  v_currency := coalesce(p_currency, v_plan.currency);

  if v_cycle is distinct from v_plan.billing_cycle_months then
    raise exception 'El ciclo de cobro debe ser el del plan.'
      using errcode = '22023';
  end if;

  if v_amount is distinct from v_plan.price then
    raise exception 'El monto debe ser el precio del plan.'
      using errcode = '22023';
  end if;

  if v_currency is distinct from v_plan.currency then
    raise exception 'La moneda debe ser la del plan.'
      using errcode = '22023';
  end if;

  if v_cycle <= 0 or v_amount < 0 then
    raise exception 'El ciclo de cobro y el monto deben ser válidos.'
      using errcode = '22023';
  end if;

  insert into public.member_subscriptions(
    gym_member_id,
    membership_plan_id,
    status,
    start_date,
    billing_cycle_months,
    recurring_amount,
    currency,
    auto_renew,
    created_by
  )
  values (
    p_gym_member_id,
    p_membership_plan_id,
    'active'::public.subscription_status,
    v_start_date,
    v_cycle,
    v_amount,
    v_currency,
    p_auto_renew,
    v_actor
  )
  returning id, end_date into v_subscription_id, v_subscription_end_date;

  insert into public.member_subscription_events(
    member_subscription_id,
    previous_status,
    new_status,
    reason,
    actor_user_id
  )
  values (
    v_subscription_id,
    null,
    'active'::public.subscription_status,
    'Membresía asignada.',
    v_actor
  );

  if p_generate_first_charge then
    insert into public.membership_charges(
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
      p_gym_member_id,
      v_subscription_id,
      v_start_date,
      (
        v_start_date
        + pg_catalog.make_interval(months => v_cycle)
        - interval '1 day'
      )::date,
      v_start_date,
      v_amount,
      v_currency,
      'pending'::public.charge_status
    )
    returning id into v_charge_id;
  end if;

  if v_member.status = 'prospect'::public.member_status then
    update public.gym_members
    set
      status = 'active'::public.member_status,
      updated_at = timezone('utc', now())
    where id = p_gym_member_id;
  end if;

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
    'membership.assigned',
    'member_subscriptions',
    v_subscription_id::text,
    null,
    jsonb_build_object(
      'gymMemberId', p_gym_member_id,
      'membershipPlanId', p_membership_plan_id,
      'chargeId', v_charge_id
    )
  );

  return jsonb_build_object(
    'subscriptionId', v_subscription_id,
    'gymMemberId', p_gym_member_id,
    'membershipPlanId', p_membership_plan_id,
    'planName', v_plan.name,
    'status', 'active',
    'startDate', v_start_date,
    'endDate', v_subscription_end_date,
    'billingCycleMonths', v_cycle,
    'recurringAmount', v_amount::text,
    'currency', v_currency,
    'chargeId', v_charge_id,
    'chargeAmountDue', case when v_charge_id is null then null else v_amount::text end,
    'chargeDueDate', case when v_charge_id is null then null else v_start_date end
  );
end;
$$;

create or replace function private.member_access_allowed(
  p_gym_member_id uuid,
  p_at timestamptz default timezone('utc', now())
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.gym_members gm
    where gm.id = p_gym_member_id and gm.status = 'active'
      and exists (
        select 1 from public.member_day_passes dp
        where dp.gym_member_id = gm.id and dp.service_date = p_at::date and dp.status = 'paid'
      )
  ) or exists (
    select 1
    from public.gym_members gm
    join public.member_subscriptions ms on ms.gym_member_id = gm.id
    join public.membership_plans mp on mp.id = ms.membership_plan_id
    where gm.id = p_gym_member_id and gm.status = 'active'
      and ms.status in ('trialing', 'active')
      and ms.start_date <= p_at::date
      and (ms.end_date is null or ms.end_date >= p_at::date)
      and not exists (
        select 1 from public.membership_charges mc
        where mc.gym_member_id = gm.id
          and private.charge_is_overdue(
            mc.status,
            mc.due_date + mp.grace_days,
            p_at::date
          )
      )
  );
$$;

create or replace view public.v_member_access_status
with (security_invoker = true)
as
select
  gm.gym_id,
  gm.id as gym_member_id,
  gm.member_code,
  gm.status as member_status,
  p.id as person_id,
  p.first_name,
  p.last_name,
  exists (
    select 1
    from public.member_subscriptions ms
    join public.membership_plans mp on mp.id = ms.membership_plan_id
    where ms.gym_member_id = gm.id
      and mp.deleted_at is null
      and ms.status in ('trialing', 'active')
      and ms.start_date <= current_date
      and (ms.end_date is null or ms.end_date >= current_date)
  ) as has_active_subscription,
  exists (
    select 1
    from public.membership_charges mc
    where mc.gym_member_id = gm.id
      and private.charge_is_overdue(mc.status, mc.due_date, current_date)
  ) as has_overdue_charges,
  private.member_access_allowed(gm.id, timezone('utc', now())) as access_allowed
from public.gym_members gm
join public.persons p on p.id = gm.person_id
where gm.deleted_at is null;

create or replace view public.v_gym_dashboard
with (security_invoker = true)
as
select
  g.id as gym_id,
  g.trade_name,
  (
    select count(*)
    from public.gym_members gm
    where gm.gym_id = g.id
      and gm.deleted_at is null
      and gm.status = 'active'
  ) as active_members,
  (
    select count(*)
    from public.membership_charges mc
    join public.gym_members gm on gm.id = mc.gym_member_id
    where gm.gym_id = g.id
      and gm.deleted_at is null
      and private.charge_is_overdue(mc.status, mc.due_date, current_date)
  ) as overdue_charges,
  (
    select coalesce(sum(i.amount), 0)
    from public.v_gym_income i
    where i.gym_id = g.id
      and i.currency = g.default_currency
      and i.occurred_at >= date_trunc('month', timezone('utc', now()))
      and i.occurred_at < date_trunc('month', timezone('utc', now())) + interval '1 month'
  )::numeric(14,2) as current_month_income,
  (
    select count(*)
    from public.face_recognition_events fre
    where fre.gym_id = g.id
      and fre.occurred_at >= date_trunc('day', timezone('utc', now()))
      and fre.decision = 'allowed'
  ) as successful_accesses_today,
  (
    select count(*)
    from public.gym_alerts ga
    where ga.gym_id = g.id
      and ga.status in ('open', 'acknowledged')
  ) as open_alerts
from public.gyms g
where g.deleted_at is null;

create or replace view public.api_v1_member_summaries
with (security_invoker = true)
as
select
  gm.gym_id,
  gm.id as gym_member_id,
  p.id as person_id,
  gm.member_code,
  p.first_name,
  p.last_name,
  trim(concat_ws(' ', p.first_name, nullif(p.middle_name, ''), p.last_name, nullif(p.second_last_name, ''))) as full_name,
  gm.status,
  gm.home_branch_id as branch_id,
  gb.name as branch_name,
  primary_photo.media_asset_id as primary_photo_media_asset_id,
  current_subscription.status as membership_status,
  mp.name as membership_plan_name,
  next_charge.due_date as next_payment_date,
  coalesce(overdue.overdue_amount, 0)::numeric(14,2) as overdue_amount,
  coalesce(overdue.overdue_amount, 0) > 0 as has_overdue_charges,
  gm.created_at
from public.gym_members gm
join public.persons p on p.id = gm.person_id
left join public.gym_branches gb
  on gb.id = gm.home_branch_id
 and gb.deleted_at is null
left join lateral (
  select pp.media_asset_id
  from public.person_photos pp
  where pp.gym_id = gm.gym_id
    and pp.person_id = gm.person_id
    and pp.purpose = 'profile'
    and pp.is_primary
    and pp.deleted_at is null
  order by pp.created_at desc
  limit 1
) primary_photo on true
left join lateral (
  select ms.*
  from public.member_subscriptions ms
  where ms.gym_member_id = gm.id
    and ms.status in ('trialing', 'active', 'past_due', 'paused')
  order by ms.created_at desc
  limit 1
) current_subscription on true
left join public.membership_plans mp
  on mp.id = current_subscription.membership_plan_id
 and mp.deleted_at is null
left join lateral (
  select mc.due_date
  from public.membership_charges mc
  where mc.gym_member_id = gm.id
    and mc.status in ('pending', 'partial')
  order by mc.due_date asc
  limit 1
) next_charge on true
left join lateral (
  select coalesce(sum(mc.amount_due - coalesce(paid.amount_paid, 0)), 0)::numeric(14,2) as overdue_amount
  from public.membership_charges mc
  left join lateral (
    select coalesce(sum(mpa.amount), 0)::numeric(14,2) as amount_paid
    from public.member_payment_allocations mpa
    join public.member_payments mpay on mpay.id = mpa.member_payment_id
    where mpa.membership_charge_id = mc.id
      and mpay.status = 'settled'
  ) paid on true
  where mc.gym_member_id = gm.id
    and private.charge_is_overdue(mc.status, mc.due_date, current_date)
) overdue on true
where gm.deleted_at is null;

create or replace function public.get_owner_dashboard(p_gym_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_can_members boolean;
  v_can_income boolean;
  v_can_entries boolean;
  v_can_alerts boolean;
  v_result jsonb;
begin
  if not private.has_permission(p_gym_id, 'dashboard.read') then
    raise exception 'Insufficient permission: dashboard.read' using errcode = '42501';
  end if;

  v_can_members := private.has_permission(p_gym_id, 'members.read');
  v_can_income := private.has_permission(p_gym_id, 'income.read');
  v_can_entries := private.has_permission(p_gym_id, 'faces.read');
  v_can_alerts := private.has_permission(p_gym_id, 'alerts.read');

  select jsonb_build_object(
    'activeMembers', case when v_can_members then (
      select count(*) from public.gym_members gm
      where gm.gym_id = p_gym_id and gm.deleted_at is null and gm.status = 'active'
    ) else null end,
    'expiringMemberships', case when v_can_members then (
      select count(*) from public.member_subscriptions ms
      join public.gym_members gm on gm.id = ms.gym_member_id
      where gm.gym_id = p_gym_id and gm.deleted_at is null and ms.status = 'active'
        and ms.end_date between current_date and current_date + 7
    ) else null end,
    'overdueMembers', case when v_can_members then (
      select count(distinct mc.gym_member_id) from public.membership_charges mc
      join public.gym_members gm on gm.id = mc.gym_member_id
      where gm.gym_id = p_gym_id and gm.deleted_at is null
        and private.charge_is_overdue(mc.status, mc.due_date, current_date)
    ) else null end,
    'income', case when v_can_income then jsonb_build_object(
      'today', jsonb_build_object(
        'USD', (select coalesce(sum(i.amount), 0)::numeric(14,2)::text from public.v_gym_income i where i.gym_id = p_gym_id and i.currency = 'USD' and i.occurred_at >= date_trunc('day', timezone('utc', now()))),
        'NIO', (select coalesce(sum(i.amount), 0)::numeric(14,2)::text from public.v_gym_income i where i.gym_id = p_gym_id and i.currency = 'NIO' and i.occurred_at >= date_trunc('day', timezone('utc', now())))
      ),
      'month', jsonb_build_object(
        'USD', (select coalesce(sum(i.amount), 0)::numeric(14,2)::text from public.v_gym_income i where i.gym_id = p_gym_id and i.currency = 'USD' and i.occurred_at >= date_trunc('month', timezone('utc', now()))),
        'NIO', (select coalesce(sum(i.amount), 0)::numeric(14,2)::text from public.v_gym_income i where i.gym_id = p_gym_id and i.currency = 'NIO' and i.occurred_at >= date_trunc('month', timezone('utc', now())))
      )
    ) else null end,
    'entriesToday', case when v_can_entries then (
      select count(*) from public.face_recognition_events fre
      where fre.gym_id = p_gym_id and fre.decision = 'allowed'
        and fre.occurred_at >= date_trunc('day', timezone('utc', now()))
    ) else null end,
    'openAlerts', case when v_can_alerts then (
      select count(*) from public.gym_alerts ga
      where ga.gym_id = p_gym_id and ga.status in ('open', 'acknowledged')
    ) else null end
  ) into v_result;

  return v_result;
end;
$$;

alter table public.membership_charges
  add constraint membership_charges_status_not_overdue
  check (status <> 'overdue'::public.charge_status);

comment on constraint membership_charges_status_not_overdue on public.membership_charges is
'Overdue is derived from due_date and the payable status. It is never stored.';

commit;
