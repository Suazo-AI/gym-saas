begin;

select plan(25);

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

select has_function(
  'public',
  'search_entry_members',
  array['uuid', 'text', 'integer'],
  'entry member search rpc exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.search_entry_members(uuid, text, integer)',
    'execute'
  ),
  'authenticated can execute entry member search'
);

select is_empty(
  $$select argument_name
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral unnest(p.proargnames) as argument_name
    where n.nspname = 'public'
      and p.proname = 'search_entry_members'
      and argument_name ilike '%phone%'$$,
  'entry member search does not return a phone column'
);

select throws_ok(
  $$select * from public.search_entry_members(
    '20000000-0000-4000-8000-000000000001', 'Ana', 10
  )$$,
  '42501',
  'Insufficient permission: entries.read',
  'entry member search rejects a caller without entries.read'
);

-- ============================================================================
-- La RPC es la unica puerta de escritura
-- ============================================================================

select ok(
  not has_table_privilege('authenticated', 'public.member_entries', 'insert'),
  'authenticated cannot insert into member_entries directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.member_entries', 'update')
  and not has_table_privilege('authenticated', 'public.member_entries', 'delete'),
  'member_entries history cannot be rewritten or erased'
);

-- ============================================================================
-- Aislamiento real entre gimnasios, con una sesion autenticada de verdad
--
-- Los casos de arriba prueban el trigger y los privilegios. Estos prueban la
-- RLS: un usuario del gimnasio 1 no puede ver ni escribir entradas del 2.
-- ============================================================================

-- Una entrada del gimnasio 2, insertada saltando la RLS a proposito para tener
-- algo que el usuario del gimnasio 1 NO deberia poder ver.
insert into public.member_entries(gym_id, gym_member_id, source, decision)
select
  gm.gym_id,
  gm.id,
  'manual'::public.entry_source,
  'allowed'::public.access_decision
from public.gym_members gm
where gm.gym_id = '20000000-0000-4000-8000-000000000002'
limit 1;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$select member_code from public.search_entry_members(
    '20000000-0000-4000-8000-000000000001', 'Ana', 10
  )$$,
  $$values ('M-0001'::text)$$,
  'entry search finds a same-gym member by name'
);

select results_eq(
  $$select member_code from public.search_entry_members(
    '20000000-0000-4000-8000-000000000001', 'M-0002', 10
  )$$,
  $$values ('M-0002'::text)$$,
  'entry search finds a same-gym member by code'
);

select results_eq(
  $$select member_code from public.search_entry_members(
    '20000000-0000-4000-8000-000000000001', '88880001', 10
  )$$,
  $$values ('M-0001'::text)$$,
  'entry search normalizes and matches a same-gym phone'
);

select is_empty(
  $$select * from public.search_entry_members(
    '20000000-0000-4000-8000-000000000001', '88880003', 10
  )$$,
  'entry search does not reveal another gym phone'
);

select is(
  (select count(*) from public.member_entries
   where gym_id = '20000000-0000-4000-8000-000000000002')::int,
  0,
  'a gym 1 user cannot read gym 2 entries through RLS'
);

select is(
  (select count(*) from public.v_gym_entries
   where gym_id = '20000000-0000-4000-8000-000000000002')::int,
  0,
  'a gym 1 user cannot read gym 2 entries through the unified view'
);

select throws_ok(
  $$select public.register_member_entry(
    '20000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000003'
  )$$,
  '42501',
  'Insufficient permission: entries.manage',
  'a gym 1 user cannot register an entry in gym 2'
);

reset role;

select * from finish();

rollback;
