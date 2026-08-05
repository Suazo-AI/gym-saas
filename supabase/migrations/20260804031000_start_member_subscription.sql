-- Atomically start a paid membership while snapshotting the plan terms.

alter table public.member_subscriptions
  add column duration_count integer default 1,
  add column duration_unit text default 'month';

update public.member_subscriptions
set duration_count = billing_cycle_months,
    duration_unit = 'month';

alter table public.member_subscriptions
  alter column duration_count set not null,
  alter column duration_unit set not null,
  add constraint member_subscriptions_duration_count_positive check (duration_count > 0),
  add constraint member_subscriptions_duration_unit_valid check (duration_unit in ('day', 'week', 'month'));

create function public.start_member_subscription(
  p_gym_member_id uuid,
  p_membership_plan_id uuid,
  p_start_date date,
  p_payment_method_id uuid,
  p_payment_amount numeric,
  p_payment_currency text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_member public.gym_members%rowtype;
  v_plan public.membership_plans%rowtype;
  v_subscription_id uuid;
  v_charge_id uuid;
  v_payment_id uuid;
  v_period_end date;
begin
  select gm.* into v_member
  from public.gym_members gm
  where gm.id = p_gym_member_id
    and gm.deleted_at is null
  for update;

  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;

  if not private.has_permission(v_member.gym_id, 'memberships.manage')
     or not private.has_permission(v_member.gym_id, 'payments.manage') then
    raise exception 'Insufficient permission to start a paid membership' using errcode = '42501';
  end if;

  select mp.* into v_plan
  from public.membership_plans mp
  where mp.id = p_membership_plan_id
    and mp.gym_id = v_member.gym_id
    and mp.deleted_at is null
    and mp.is_active
  for share;

  if not found then
    raise exception 'Membership plan does not belong to this gym' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.member_subscriptions ms
    where ms.gym_member_id = v_member.id
      and ms.status in ('trialing', 'active', 'past_due', 'paused')
  ) then
    raise exception 'Member already has a current subscription' using errcode = '23505';
  end if;

  if p_payment_amount is null or p_payment_amount <> v_plan.price then
    raise exception 'Full payment is required' using errcode = '23514';
  end if;

  if p_payment_currency is null or upper(trim(p_payment_currency)) <> v_plan.currency then
    raise exception 'Payment currency must match the plan currency' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.payment_methods pm
    where pm.id = p_payment_method_id and pm.is_active
  ) then
    raise exception 'Payment method is not active' using errcode = '23514';
  end if;

  v_period_end := case v_plan.duration_unit
    when 'day' then (p_start_date + make_interval(days => v_plan.duration_count) - interval '1 day')::date
    when 'week' then (p_start_date + make_interval(weeks => v_plan.duration_count) - interval '1 day')::date
    else (p_start_date + make_interval(months => v_plan.duration_count) - interval '1 day')::date
  end;

  insert into public.member_subscriptions (
    gym_member_id, membership_plan_id, status, start_date, end_date,
    billing_cycle_months, duration_count, duration_unit, recurring_amount,
    currency, auto_renew, created_by
  ) values (
    v_member.id, v_plan.id, 'active', p_start_date, v_period_end,
    case when v_plan.duration_unit = 'month' then v_plan.duration_count else 1 end,
    v_plan.duration_count, v_plan.duration_unit, v_plan.price,
    v_plan.currency, v_plan.auto_renew, v_actor
  ) returning id into v_subscription_id;

  insert into public.membership_charges (
    gym_member_id, member_subscription_id, period_start, period_end,
    due_date, amount_due, currency, status
  ) values (
    v_member.id, v_subscription_id, p_start_date, v_period_end,
    p_start_date, v_plan.price, v_plan.currency, 'paid'
  ) returning id into v_charge_id;

  insert into public.member_payments (
    gym_id, gym_member_id, branch_id, payment_method_id, status, amount,
    currency, receipt_number, paid_at, received_by
  ) values (
    v_member.gym_id, v_member.id, v_member.home_branch_id, p_payment_method_id,
    'settled', v_plan.price, v_plan.currency,
    'R-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 10)),
    timezone('utc', now()), v_actor
  ) returning id into v_payment_id;

  insert into public.member_payment_allocations (member_payment_id, membership_charge_id, amount)
  values (v_payment_id, v_charge_id, v_plan.price);

  insert into public.member_subscription_events (
    member_subscription_id, previous_status, new_status, reason, actor_user_id
  ) values (v_subscription_id, null, 'active', 'Initial membership paid in full', v_actor);

  update public.gym_members
  set status = 'active'
  where id = v_member.id;

  insert into public.audit_logs (gym_id, actor_user_id, action, entity_table, entity_id, after_data)
  values (
    v_member.gym_id, v_actor, 'MEMBER_SUBSCRIPTION_STARTED', 'member_subscriptions',
    v_subscription_id::text,
    jsonb_build_object('plan_id', v_plan.id, 'amount', v_plan.price, 'currency', v_plan.currency)
  );

  return v_subscription_id;
end;
$$;

revoke all on function public.start_member_subscription(uuid, uuid, date, uuid, numeric, text) from public, anon;
grant execute on function public.start_member_subscription(uuid, uuid, date, uuid, numeric, text) to authenticated;

comment on function public.start_member_subscription(uuid, uuid, date, uuid, numeric, text) is
  'Atomically creates a paid subscription, charge, payment, allocation, event, and compact audit record.';

-- Rollback: drop the function, then drop duration_unit and duration_count from
-- member_subscriptions only if no subscription has been created with this contract.
