begin;

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
      'amountDue',
        greatest(
          mc.amount_due - coalesce(paid.amount_paid, 0),
          0
        )::numeric(14,2)::text,
      'currency', mc.currency,
      'status', mc.status
    )
    order by mc.due_date asc
  ) as pending_charges
  from public.membership_charges mc
  left join lateral (
    select coalesce(sum(mpa.amount), 0)::numeric(14,2) as amount_paid
    from public.member_payment_allocations mpa
    join public.member_payments mpay
      on mpay.id = mpa.member_payment_id
    where mpa.membership_charge_id = mc.id
      and mpay.status = 'settled'
  ) paid on true
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

grant select on public.api_v1_member_details to authenticated, service_role;

commit;
