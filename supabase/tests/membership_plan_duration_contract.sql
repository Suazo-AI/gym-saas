begin;

select plan(6);

select has_column(
  'public',
  'membership_plans',
  'duration_count',
  'membership plans store the duration quantity'
);

select has_column(
  'public',
  'membership_plans',
  'duration_unit',
  'membership plans store the duration unit'
);

select has_column(
  'public',
  'membership_plans',
  'auto_renew',
  'membership plans store their renewal mode'
);

select col_not_null(
  'public',
  'membership_plans',
  'duration_count',
  'duration quantity is required'
);

select col_not_null(
  'public',
  'membership_plans',
  'duration_unit',
  'duration unit is required'
);

select results_eq(
  $$
    select duration_count, duration_unit
    from public.membership_plans
    where id = '40000000-0000-4000-8000-000000000001'
  $$,
  $$ values (1, 'month'::text) $$,
  'existing monthly plans are backfilled without changing their duration'
);

select * from finish();
rollback;
