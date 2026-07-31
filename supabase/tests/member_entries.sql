begin;

select plan(12);

select has_table('public', 'member_entries', 'member_entries table exists');

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'member_entries'
  ),
  'member_entries has RLS enabled'
);

select isnt_empty(
  $$select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_entries'
      and policyname = 'member_entries_read'
      and cmd = 'SELECT'$$,
  'member_entries has a select policy'
);

select isnt_empty(
  $$select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_entries'
      and policyname = 'member_entries_insert'
      and cmd = 'INSERT'$$,
  'member_entries has an insert policy'
);

select is_empty(
  $$select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_entries'
      and cmd in ('UPDATE', 'DELETE')$$,
  'member_entries has no update or delete policy'
);

select has_function(
  'public',
  'register_member_entry',
  array['uuid', 'uuid', 'uuid', 'text'],
  'register_member_entry rpc exists'
);

select isnt_empty(
  $$select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'register_member_entry'
      and p.prosecdef$$,
  'register_member_entry is security definer'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.register_member_entry(uuid, uuid, uuid, text)',
    'execute'
  ),
  'authenticated can execute register_member_entry'
);

select throws_ok(
  $$select public.register_member_entry(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001'
  )$$,
  '42501',
  'Insufficient permission: entries.manage',
  'register_member_entry rejects non-authenticated context'
);

select throws_ok(
  $$insert into public.member_entries(
      gym_id,
      gym_member_id,
      source,
      decision
    )
    values (
      '20000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000003',
      'manual',
      'denied'
    )$$,
  null,
  'Entry member does not belong to the gym',
  'tenant trigger rejects a member from another gym'
);

select has_view('public', 'v_gym_entries', 'v_gym_entries view exists');

select ok(
  has_table_privilege('authenticated', 'public.v_gym_entries', 'select'),
  'authenticated can select v_gym_entries'
);

select * from finish();

rollback;
