begin;

select plan(21);

select has_function(
  'private',
  'member_financial_access_state',
  array['uuid', 'date'],
  'canonical member financial access state exists'
);

insert into public.membership_plans (
  id, gym_id, code, name, billing_cycle_months, price, currency, grace_days
) values (
  '40000000-0000-4000-8000-000000000091',
  '20000000-0000-4000-8000-000000000001',
  'ACCESS-POLICY-TEST',
  'Access policy test',
  1,
  100,
  'USD',
  5
);

insert into public.persons (id, first_name, last_name, created_by)
select
  ('50000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'Access',
  'Policy ' || n,
  '00000000-0000-4000-8000-000000000001'
from generate_series(91, 94) n;

insert into public.gym_members (
  id, gym_id, person_id, home_branch_id, member_code, status, joined_on, created_by
)
select
  ('60000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '20000000-0000-4000-8000-000000000001',
  ('50000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '30000000-0000-4000-8000-000000000001',
  'M-ACCESS-' || n,
  'active',
  current_date - 60,
  '00000000-0000-4000-8000-000000000001'
from generate_series(91, 94) n;

insert into public.member_subscriptions (
  id, gym_member_id, membership_plan_id, status, start_date,
  billing_cycle_months, recurring_amount, currency, created_by
)
select
  ('70000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ('60000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '40000000-0000-4000-8000-000000000091',
  'active',
  current_date - 40,
  1,
  100,
  'USD',
  '00000000-0000-4000-8000-000000000001'
from generate_series(91, 94) n;

insert into public.membership_charges (
  id, gym_member_id, member_subscription_id, period_start, period_end,
  due_date, amount_due, currency, status
) values
  (
    '80000000-0000-4000-8000-000000000091',
    '60000000-0000-4000-8000-000000000091',
    '70000000-0000-4000-8000-000000000091',
    current_date - 40, current_date - 11, current_date - 40, 100, 'USD', 'pending'
  ),
  (
    '80000000-0000-4000-8000-000000000092',
    '60000000-0000-4000-8000-000000000092',
    '70000000-0000-4000-8000-000000000092',
    current_date - 10, current_date + 19, current_date - 5, 100, 'USD', 'pending'
  ),
  (
    '80000000-0000-4000-8000-000000000093',
    '60000000-0000-4000-8000-000000000093',
    '70000000-0000-4000-8000-000000000093',
    current_date - 20, current_date + 9, current_date - 10, 100, 'USD', 'partial'
  ),
  (
    '80000000-0000-4000-8000-000000000094',
    '60000000-0000-4000-8000-000000000094',
    '70000000-0000-4000-8000-000000000094',
    current_date - 40, current_date - 11, current_date - 40, 100, 'USD', 'paid'
  );

insert into public.member_payments (
  id, gym_id, gym_member_id, payment_method_id, status,
  amount, currency, receipt_number, received_by
)
select
  '90000000-0000-4000-8000-000000000093',
  '20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000093',
  pm.id,
  'settled',
  40,
  'USD',
  'R-ACCESS093',
  '00000000-0000-4000-8000-000000000001'
from public.payment_methods pm
where pm.is_active
order by pm.code
limit 1;

insert into public.member_payment_allocations (
  member_payment_id, membership_charge_id, amount
) values (
  '90000000-0000-4000-8000-000000000093',
  '80000000-0000-4000-8000-000000000093',
  40
);

select is(private.member_financial_access_state('60000000-0000-4000-8000-000000000091', current_date), 'initial_payment_required', 'unpaid first charge blocks without grace');
select is(private.member_financial_access_state('60000000-0000-4000-8000-000000000092', current_date), 'grace', 'unpaid renewal inside grace is allowed with warning');
select is(private.member_financial_access_state('60000000-0000-4000-8000-000000000093', current_date), 'overdue', 'partial renewal after grace blocks access');
select is(private.member_financial_access_state('60000000-0000-4000-8000-000000000094', current_date), 'paid', 'fully paid charges produce paid state');

select is(private.member_access_allowed('60000000-0000-4000-8000-000000000091'), false, 'initial payment required denies access');
select is(private.member_access_allowed('60000000-0000-4000-8000-000000000092'), true, 'grace allows access');
select is(private.member_access_allowed('60000000-0000-4000-8000-000000000093'), false, 'overdue renewal denies access');
select is(private.member_access_allowed('60000000-0000-4000-8000-000000000094'), true, 'paid member is allowed');

select is(private.member_financial_access_state('60000000-0000-4000-8000-000000000092', current_date), 'grace', 'grace is inclusive on due date plus grace days');
select is(private.member_financial_access_state('60000000-0000-4000-8000-000000000092', current_date + 1), 'overdue', 'the day after grace is overdue');

select has_column(
  'public',
  'member_entries',
  'financial_access_status',
  'member entries persist the financial access state'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  public.register_member_entry(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000092',
    '30000000-0000-4000-8000-000000000001',
    null
  ) ->> 'financialAccessStatus',
  'grace',
  'manual entry exposes grace state'
);

select is(
  public.register_member_entry(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000093',
    '30000000-0000-4000-8000-000000000001',
    'Autorizado por recepcion'
  ) ->> 'decision',
  'manual_review',
  'entries.manage can override overdue block with a reason'
);

select is(
  (
    select count(*)::integer
    from public.gym_alerts ga
    join public.alert_types at on at.id = ga.alert_type_id
    where ga.gym_member_id = '60000000-0000-4000-8000-000000000093'
      and at.code = 'MEMBERSHIP_UNPAID'
  ),
  1,
  'an overdue override retains a financial alert'
);

select is(
  (
    select ga.title
    from public.gym_alerts ga
    join public.alert_types at on at.id = ga.alert_type_id
    where ga.gym_member_id = '60000000-0000-4000-8000-000000000093'
      and at.code = 'MEMBERSHIP_UNPAID'
  ),
  'Entrada autorizada manualmente con deuda pendiente',
  'override alert describes the actual manual authorization'
);

select ok(
  exists(
    select 1
    from public.audit_logs
    where action = 'entry.override'
      and entity_table = 'member_entries'
  ),
  'manual override remains audited'
);

select is(
  (
    select count(*)::integer
    from public.gym_alerts ga
    join public.alert_types at on at.id = ga.alert_type_id
    where ga.gym_member_id = '60000000-0000-4000-8000-000000000092'
      and at.code = 'MEMBERSHIP_GRACE'
      and ga.severity = 'warning'
  ),
  1,
  'grace entry creates a warning alert'
);

select is(
  public.register_member_entry(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000091',
    '30000000-0000-4000-8000-000000000001',
    null
  ) ->> 'financialAccessStatus',
  'initial_payment_required',
  'initial payment denial exposes the blocking state'
);

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$
    select financial_access_status
    from public.search_entry_members(
      '20000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000091',
      1
    )
  $$,
  $$values ('initial_payment_required'::text)$$,
  'entry lookup by member id returns the canonical state'
);

reset role;

insert into public.member_payments (
  id, gym_id, gym_member_id, payment_method_id, status,
  amount, currency, receipt_number, received_by
)
select
  '90000000-0000-4000-8000-000000000094',
  '20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000093',
  pm.id,
  'settled',
  60,
  'USD',
  'R-ACCESS094',
  '00000000-0000-4000-8000-000000000001'
from public.payment_methods pm
where pm.is_active
order by pm.code
limit 1;

insert into public.member_payment_allocations (
  member_payment_id, membership_charge_id, amount
) values (
  '90000000-0000-4000-8000-000000000094',
  '80000000-0000-4000-8000-000000000093',
  60
);

select is(private.member_financial_access_state('60000000-0000-4000-8000-000000000093', current_date), 'paid', 'settling an overdue balance restores paid state');

select * from finish();
rollback;
