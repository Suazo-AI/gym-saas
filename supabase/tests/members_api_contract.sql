begin;

select plan(15);

select has_view('public', 'api_v1_member_summaries', 'member summaries view exists');
select has_view('public', 'api_v1_member_details', 'member details view exists');
select has_function(
  'public',
  'create_gym_member',
  array[
    'uuid',
    'text',
    'text',
    'text',
    'uuid',
    'text',
    'text',
    'date',
    'uuid',
    'date',
    'boolean',
    'uuid',
    'numeric',
    'character',
    'timestamp with time zone',
    'text'
  ],
  'create_gym_member rpc exists'
);
select has_function(
  'public',
  'update_gym_member_admin',
  array['uuid', 'uuid', 'text', 'text', 'text', 'uuid', 'boolean', 'text', 'boolean', 'text', 'boolean'],
  'clearable member administration rpc exists'
);
select has_function(
  'public',
  'list_deleted_gym_members',
  array['uuid', 'integer', 'integer'],
  'member paper bin rpc exists'
);
select has_function(
  'public',
  'update_gym_member',
  array['uuid', 'uuid', 'text', 'text', 'text', 'uuid', 'public.member_status', 'text', 'text'],
  'update_gym_member rpc exists'
);

select results_eq(
  $$select count(*)::integer from public.api_v1_member_summaries where gym_member_id is null$$,
  $$values (0)$$,
  'summary rows always include gym_member_id'
);

select isnt_empty(
  $$select 1 from pg_views where schemaname = 'public' and viewname = 'api_v1_member_summaries' and definition ilike '%deleted_at IS NULL%'$$,
  'summary view ignores soft-deleted members'
);

select isnt_empty(
  $$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'list_deleted_gym_members' and p.prosecdef$$,
  'member paper bin enforces permission in a security-definer boundary'
);

select throws_ok(
  $$select public.create_gym_member('20000000-0000-4000-8000-000000000001', '', 'Demo')$$,
  null,
  'create_gym_member rejects missing first name'
);

select isnt_empty(
  $$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'create_gym_member' and p.prosecdef$$,
  'create_gym_member is security definer'
);

select ok(
  has_table_privilege('authenticated', 'public.api_v1_member_summaries', 'select'),
  'authenticated can select member summaries view'
);

select ok(
  has_table_privilege('authenticated', 'public.api_v1_member_details', 'select'),
  'authenticated can select member details view'
);

insert into public.member_payments (
  id,
  gym_id,
  gym_member_id,
  branch_id,
  payment_method_id,
  status,
  amount,
  currency,
  receipt_number,
  paid_at,
  received_by
)
select
  '90000000-0000-4000-8000-000000000023',
  '20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000001',
  pm.id,
  'settled',
  450.00,
  'NIO',
  'R-LOCAL-0023',
  timezone('utc', now()),
  '00000000-0000-4000-8000-000000000001'
from public.payment_methods pm
where pm.code = 'cash';

insert into public.member_payment_allocations (
  member_payment_id,
  membership_charge_id,
  amount
)
values (
  '90000000-0000-4000-8000-000000000023',
  '80000000-0000-4000-8000-000000000002',
  450.00
);

select results_eq(
  $$select pending_charges->0->>'amountDue'
    from public.api_v1_member_details
    where gym_member_id = '60000000-0000-4000-8000-000000000002'$$,
  $$values ('450.00')$$,
  'member details preserve the remaining balance after a historical partial allocation'
);

insert into public.persons (id, first_name, last_name, created_by)
values (
  '50000000-0000-4000-8000-000000000099',
  'Contrato',
  'Prepago',
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
values (
  '60000000-0000-4000-8000-000000000099',
  '20000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000099',
  '30000000-0000-4000-8000-000000000001',
  'M-PREPAID-CONTRACT',
  'prospect',
  current_date,
  '00000000-0000-4000-8000-000000000001'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select set_config(
  'test.cash_payment_method_id',
  (select id::text from public.payment_methods where code = 'cash'),
  true
);

set local role service_role;

select throws_ok(
  $$ select public.start_member_subscription(
    '60000000-0000-4000-8000-000000000099'::uuid,
    '40000000-0000-4000-8000-000000000001'::uuid,
    current_date,
    current_setting('test.cash_payment_method_id')::uuid,
    450.00,
    'NIO'
  ) $$,
  '23514',
  'Full payment is required',
  'a partial prepaid membership is rejected'
);

select * from finish();

rollback;
