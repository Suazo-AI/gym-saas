begin;

select plan(17);

select has_function(
  'private',
  'charge_is_overdue',
  array['charge_status', 'date', 'date'],
  'canonical overdue function exists'
);

select is(
  private.charge_is_overdue('pending', current_date - 1, current_date),
  true,
  'a past due pending charge is overdue'
);

select is(
  private.charge_is_overdue('partial', current_date - 1, current_date),
  true,
  'a past due partial charge is overdue'
);

select is(
  private.charge_is_overdue('paid', current_date - 1, current_date),
  false,
  'a past due paid charge is not overdue'
);

select isnt_empty(
  $$
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'membership_charges'
      and c.conname = 'membership_charges_status_not_overdue'
      and c.contype = 'c'
  $$,
  'membership charges reject stored overdue status'
);

insert into public.persons (id, first_name, last_name, created_by)
values
  (
    '50000000-0000-4000-8000-000000000098',
    'Estado',
    'Derivado',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '50000000-0000-4000-8000-000000000097',
    'Cargo',
    'Generado',
    '00000000-0000-4000-8000-000000000001'
  );

insert into public.gym_members (
  id,
  gym_id,
  person_id,
  home_branch_id,
  member_code,
  status,
  joined_on,
  created_by
)
values
  (
    '60000000-0000-4000-8000-000000000098',
    '20000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000098',
    '30000000-0000-4000-8000-000000000001',
    'M-P2-DERIVED',
    'prospect',
    current_date - 30,
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '60000000-0000-4000-8000-000000000097',
    '20000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000097',
    '30000000-0000-4000-8000-000000000001',
    'M-P2-GENERATE',
    'active',
    current_date - 90,
    '00000000-0000-4000-8000-000000000001'
  );

insert into public.member_subscriptions (
  id,
  gym_member_id,
  membership_plan_id,
  status,
  start_date,
  billing_cycle_months,
  recurring_amount,
  currency,
  created_by
)
select
  '70000000-0000-4000-8000-000000000097',
  '60000000-0000-4000-8000-000000000097',
  mp.id,
  'active'::public.subscription_status,
  current_date - 60,
  mp.billing_cycle_months,
  mp.price,
  mp.currency,
  '00000000-0000-4000-8000-000000000001'
from public.membership_plans mp
where mp.id = '40000000-0000-4000-8000-000000000001';

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    select public.assign_member_subscription(
      p_gym_id => '20000000-0000-4000-8000-000000000001',
      p_gym_member_id => '60000000-0000-4000-8000-000000000098',
      p_membership_plan_id => '40000000-0000-4000-8000-000000000001',
      p_start_date => current_date - 10
    )
  $$,
  'assigning a past subscription stores a valid charge status'
);

select is(
  (
    select mc.status::text
    from public.membership_charges mc
    where mc.gym_member_id = '60000000-0000-4000-8000-000000000098'
  ),
  'pending',
  'the past charge is stored as pending'
);

select is(
  (
    select status.has_overdue_charges
    from public.v_member_access_status status
    where status.gym_member_id = '60000000-0000-4000-8000-000000000098'
  ),
  true,
  'the access view derives overdue from date and payable status'
);

select is(
  (
    select status.access_allowed
    from public.v_member_access_status status
    where status.gym_member_id = '60000000-0000-4000-8000-000000000098'
  ),
  false,
  'overdue debt still denies member access'
);

select lives_ok(
  $$
    select public.get_owner_dashboard('20000000-0000-4000-8000-000000000001')
  $$,
  'the owner dashboard reads the canonical overdue rule'
);

reset role;

select throws_ok(
  $$
    update public.membership_charges
    set status = 'overdue'
    where gym_member_id = '60000000-0000-4000-8000-000000000098'
  $$,
  '23514',
  null,
  'stored overdue status is rejected by the check constraint'
);

select lives_ok(
  $$
    update public.membership_charges
    set status = 'paid'
    where gym_member_id = '60000000-0000-4000-8000-000000000098'
  $$,
  'a past charge can transition to paid'
);

select is(
  (
    select status.has_overdue_charges
    from public.v_member_access_status status
    where status.gym_member_id = '60000000-0000-4000-8000-000000000098'
  ),
  false,
  'a paid past charge is not exposed as overdue'
);

select is(
  private.member_access_allowed('60000000-0000-4000-8000-000000000098'),
  true,
  'paying the overdue charge restores access'
);

set local role authenticated;

select lives_ok(
  $$
    select public.generate_membership_charges(
      '20000000-0000-4000-8000-000000000001',
      current_date
    )
  $$,
  'charge generation accepts billing periods in the past'
);

reset role;

select is(
  (
    select bool_and(mc.status = 'pending'::public.charge_status)
    from public.membership_charges mc
    where mc.gym_member_id = '60000000-0000-4000-8000-000000000097'
  ),
  true,
  'generated charges never store overdue status'
);

select is(
  (
    select bool_or(private.charge_is_overdue(mc.status, mc.due_date, current_date))
    from public.membership_charges mc
    where mc.gym_member_id = '60000000-0000-4000-8000-000000000097'
  ),
  true,
  'past generated charges are still derived as overdue'
);

select * from finish();

rollback;
