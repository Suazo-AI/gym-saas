-- Add the approved quantity/unit duration contract without rewriting the
-- legacy month-based fields still consumed by subscription billing RPCs.

alter table public.membership_plans
  add column duration_count integer default 1,
  add column duration_unit text default 'month',
  add column auto_renew boolean not null default true;

update public.membership_plans
set
  duration_count = billing_cycle_months,
  duration_unit = 'month';

alter table public.membership_plans
  alter column duration_count set not null,
  alter column duration_unit set not null,
  add constraint membership_plans_duration_count_positive
    check (duration_count > 0),
  add constraint membership_plans_duration_unit_valid
    check (duration_unit in ('day', 'week', 'month'));

comment on column public.membership_plans.duration_count is
  'Positive quantity for the plan duration.';
comment on column public.membership_plans.duration_unit is
  'Duration unit: day, week, or month.';
comment on column public.membership_plans.auto_renew is
  'Whether future subscriptions should renew automatically by default.';
comment on column public.membership_plans.billing_cycle_months is
  'Legacy month-based billing field retained until subscription RPCs consume duration_count and duration_unit.';

-- Rollback before creating plans that use the new contract:
-- alter table public.membership_plans drop column auto_renew,
--   drop column duration_unit, drop column duration_count;
