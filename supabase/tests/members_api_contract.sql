begin;

select plan(10);

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

select * from finish();

rollback;
