begin;

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
    and mc.status in ('pending', 'partial', 'overdue')
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
    and mc.status in ('pending', 'partial', 'overdue')
    and mc.due_date < current_date
) overdue on true
where gm.deleted_at is null;

create or replace view public.api_v1_member_details
with (security_invoker = true)
as
select
  s.*,
  p.middle_name,
  p.second_last_name,
  p.birth_date,
  p.sex,
  p.notes,
  coalesce(contacts.contacts, '[]'::jsonb) as contacts,
  address.primary_address,
  subscription.current_subscription,
  coalesce(charges.pending_charges, '[]'::jsonb) as pending_charges,
  payments.payment_summary
from public.api_v1_member_summaries s
join public.persons p on p.id = s.person_id
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'id', pc.id,
      'type', pc.contact_type,
      'value', pc.value,
      'isPrimary', pc.is_primary
    )
    order by pc.is_primary desc, pc.created_at asc
  ) as contacts
  from public.person_contacts pc
  where pc.person_id = s.person_id
) contacts on true
left join lateral (
  select jsonb_build_object(
    'id', pa.id,
    'countryCode', pa.country_code,
    'departmentState', pa.department_state,
    'city', pa.city,
    'district', pa.district,
    'addressLine1', pa.address_line_1,
    'addressLine2', pa.address_line_2,
    'postalCode', pa.postal_code
  ) as primary_address
  from public.person_addresses pa
  where pa.person_id = s.person_id
    and pa.is_primary
  order by pa.created_at desc
  limit 1
) address on true
left join lateral (
  select jsonb_build_object(
    'id', ms.id,
    'status', ms.status,
    'startDate', ms.start_date,
    'endDate', ms.end_date,
    'billingCycleMonths', ms.billing_cycle_months,
    'recurringAmount', ms.recurring_amount::text,
    'currency', ms.currency,
    'planId', mp.id,
    'planName', mp.name
  ) as current_subscription
  from public.member_subscriptions ms
  join public.membership_plans mp on mp.id = ms.membership_plan_id
  where ms.gym_member_id = s.gym_member_id
    and ms.status in ('trialing', 'active', 'past_due', 'paused')
    and mp.deleted_at is null
  order by ms.created_at desc
  limit 1
) subscription on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'id', mc.id,
      'periodStart', mc.period_start,
      'periodEnd', mc.period_end,
      'dueDate', mc.due_date,
      'amountDue', mc.amount_due::text,
      'currency', mc.currency,
      'status', mc.status
    )
    order by mc.due_date asc
  ) as pending_charges
  from public.membership_charges mc
  where mc.gym_member_id = s.gym_member_id
    and mc.status in ('pending', 'partial', 'overdue')
) charges on true
left join lateral (
  select jsonb_build_object(
    'settledTotal', coalesce(sum(mp.amount) filter (where mp.status = 'settled'), 0)::numeric(14,2)::text,
    'lastPaymentAt', max(mp.paid_at) filter (where mp.status = 'settled')
  ) as payment_summary
  from public.member_payments mp
  where mp.gym_member_id = s.gym_member_id
) payments on true;

create or replace function public.create_gym_member(
  p_gym_id uuid,
  p_first_name text,
  p_last_name text,
  p_member_code text default null,
  p_branch_id uuid default null,
  p_phone text default null,
  p_email text default null,
  p_joined_on date default current_date,
  p_membership_plan_id uuid default null,
  p_subscription_start_date date default null,
  p_create_initial_charge boolean default false,
  p_payment_method_id uuid default null,
  p_payment_amount numeric default null,
  p_payment_currency char(3) default null,
  p_payment_paid_at timestamptz default null,
  p_payment_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_person_id uuid;
  v_member_id uuid;
  v_member_code text;
  v_plan public.membership_plans;
  v_subscription_id uuid;
  v_charge_id uuid;
  v_payment_id uuid;
  v_actor uuid := auth.uid();
begin
  if not private.has_permission(p_gym_id, 'members.manage') then
    raise exception 'Insufficient permission: members.manage';
  end if;

  if nullif(trim(p_first_name), '') is null or nullif(trim(p_last_name), '') is null then
    raise exception 'First name and last name are required';
  end if;

  if p_branch_id is not null and not exists (
    select 1 from public.gym_branches gb
    where gb.id = p_branch_id
      and gb.gym_id = p_gym_id
      and gb.deleted_at is null
  ) then
    raise exception 'Branch does not belong to this gym';
  end if;

  if p_membership_plan_id is not null then
    select *
    into v_plan
    from public.membership_plans mp
    where mp.id = p_membership_plan_id
      and mp.gym_id = p_gym_id
      and mp.deleted_at is null
      and mp.is_active
    for share;

    if not found then
      raise exception 'Membership plan does not belong to this gym';
    end if;
  end if;

  if p_payment_amount is not null and (p_payment_amount <= 0 or p_payment_method_id is null or p_membership_plan_id is null) then
    raise exception 'A positive payment amount, payment method and plan are required to create an initial payment';
  end if;

  if p_payment_method_id is not null and not exists (
    select 1 from public.payment_methods pm
    where pm.id = p_payment_method_id and pm.is_active
  ) then
    raise exception 'Payment method is not active';
  end if;

  insert into public.persons(first_name, last_name, created_by)
  values (trim(p_first_name), trim(p_last_name), v_actor)
  returning id into v_person_id;

  if nullif(trim(coalesce(p_phone, '')), '') is not null then
    insert into public.person_contacts(person_id, contact_type, value, is_primary)
    values (v_person_id, 'phone', trim(p_phone), true);
  end if;

  if nullif(trim(coalesce(p_email, '')), '') is not null then
    insert into public.person_contacts(person_id, contact_type, value, is_primary)
    values (v_person_id, 'email', lower(trim(p_email)), true);
  end if;

  v_member_code := nullif(trim(coalesce(p_member_code, '')), '');
  if v_member_code is null then
    v_member_code := 'M-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 8));
  end if;

  insert into public.gym_members(
    gym_id,
    person_id,
    home_branch_id,
    member_code,
    status,
    joined_on,
    created_by
  )
  values (
    p_gym_id,
    v_person_id,
    p_branch_id,
    v_member_code,
    case when p_membership_plan_id is null then 'prospect'::public.member_status else 'active'::public.member_status end,
    coalesce(p_joined_on, current_date),
    v_actor
  )
  returning id into v_member_id;

  if p_membership_plan_id is not null then
    insert into public.member_subscriptions(
      gym_member_id,
      membership_plan_id,
      status,
      start_date,
      billing_cycle_months,
      recurring_amount,
      currency,
      created_by
    )
    values (
      v_member_id,
      p_membership_plan_id,
      'active',
      coalesce(p_subscription_start_date, p_joined_on, current_date),
      v_plan.billing_cycle_months,
      v_plan.price,
      v_plan.currency,
      v_actor
    )
    returning id into v_subscription_id;

    if p_create_initial_charge or p_payment_amount is not null then
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
        v_member_id,
        v_subscription_id,
        coalesce(p_subscription_start_date, p_joined_on, current_date),
        (coalesce(p_subscription_start_date, p_joined_on, current_date)
          + make_interval(months => v_plan.billing_cycle_months)
          - interval '1 day')::date,
        coalesce(p_subscription_start_date, p_joined_on, current_date),
        v_plan.price,
        v_plan.currency,
        'pending'
      )
      returning id into v_charge_id;
    end if;
  end if;

  if p_payment_amount is not null then
    insert into public.member_payments(
      gym_id,
      gym_member_id,
      branch_id,
      payment_method_id,
      status,
      amount,
      currency,
      receipt_number,
      paid_at,
      received_by,
      notes
    )
    values (
      p_gym_id,
      v_member_id,
      p_branch_id,
      p_payment_method_id,
      'settled',
      p_payment_amount,
      coalesce(p_payment_currency, v_plan.currency),
      'R-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 10)),
      coalesce(p_payment_paid_at, timezone('utc', now())),
      v_actor,
      p_payment_notes
    )
    returning id into v_payment_id;

    insert into public.member_payment_allocations(member_payment_id, membership_charge_id, amount)
    values (v_payment_id, v_charge_id, least(p_payment_amount, v_plan.price));
  end if;

  insert into public.audit_logs(gym_id, actor_user_id, action, entity_table, entity_id, after_data)
  values (
    p_gym_id,
    v_actor,
    'member.created',
    'gym_members',
    v_member_id::text,
    jsonb_build_object('personId', v_person_id, 'memberCode', v_member_code)
  );

  return v_member_id;
end;
$$;

create or replace function public.update_gym_member(
  p_gym_id uuid,
  p_gym_member_id uuid,
  p_first_name text default null,
  p_last_name text default null,
  p_member_code text default null,
  p_branch_id uuid default null,
  p_status public.member_status default null,
  p_phone text default null,
  p_email text default null
)
returns public.api_v1_member_summaries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.gym_members;
  v_person_id uuid;
  v_before jsonb;
  v_after public.api_v1_member_summaries;
  v_actor uuid := auth.uid();
begin
  if not private.has_permission(p_gym_id, 'members.manage') then
    raise exception 'Insufficient permission: members.manage';
  end if;

  select gm.*
  into v_member
  from public.gym_members gm
  where gm.id = p_gym_member_id
    and gm.gym_id = p_gym_id
    and gm.deleted_at is null
  for update;

  if not found then
    raise exception 'Member not found';
  end if;

  v_before := to_jsonb(v_member);
  v_person_id := v_member.person_id;

  if p_branch_id is not null and not exists (
    select 1 from public.gym_branches gb
    where gb.id = p_branch_id
      and gb.gym_id = p_gym_id
      and gb.deleted_at is null
  ) then
    raise exception 'Branch does not belong to this gym';
  end if;

  update public.persons
  set
    first_name = coalesce(nullif(trim(p_first_name), ''), first_name),
    last_name = coalesce(nullif(trim(p_last_name), ''), last_name),
    updated_at = timezone('utc', now())
  where id = v_person_id;

  update public.gym_members
  set
    member_code = coalesce(nullif(trim(p_member_code), ''), member_code),
    home_branch_id = coalesce(p_branch_id, home_branch_id),
    status = coalesce(p_status, status),
    updated_at = timezone('utc', now())
  where id = p_gym_member_id;

  if p_phone is not null then
    delete from public.person_contacts
    where person_id = v_person_id and contact_type = 'phone' and is_primary;

    if nullif(trim(p_phone), '') is not null then
      insert into public.person_contacts(person_id, contact_type, value, is_primary)
      values (v_person_id, 'phone', trim(p_phone), true);
    end if;
  end if;

  if p_email is not null then
    delete from public.person_contacts
    where person_id = v_person_id and contact_type = 'email' and is_primary;

    if nullif(trim(p_email), '') is not null then
      insert into public.person_contacts(person_id, contact_type, value, is_primary)
      values (v_person_id, 'email', lower(trim(p_email)), true);
    end if;
  end if;

  insert into public.audit_logs(gym_id, actor_user_id, action, entity_table, entity_id, before_data)
  values (p_gym_id, v_actor, 'member.updated', 'gym_members', p_gym_member_id::text, v_before);

  select *
  into v_after
  from public.api_v1_member_summaries s
  where s.gym_member_id = p_gym_member_id;

  return v_after;
end;
$$;

revoke all on function public.create_gym_member(
  uuid, text, text, text, uuid, text, text, date, uuid, date, boolean, uuid, numeric, char(3), timestamptz, text
) from public;
revoke all on function public.update_gym_member(
  uuid, uuid, text, text, text, uuid, public.member_status, text, text
) from public;

grant execute on function public.create_gym_member(
  uuid, text, text, text, uuid, text, text, date, uuid, date, boolean, uuid, numeric, char(3), timestamptz, text
) to authenticated, service_role;
grant execute on function public.update_gym_member(
  uuid, uuid, text, text, text, uuid, public.member_status, text, text
) to authenticated, service_role;

commit;
