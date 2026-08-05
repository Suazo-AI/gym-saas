begin;

select plan(5);

select has_function(
  'public',
  'assign_member_subscription',
  array[
    'uuid',
    'uuid',
    'uuid',
    'date',
    'integer',
    'numeric',
    'character',
    'boolean',
    'boolean'
  ],
  'assign_member_subscription rpc exists'
);

select isnt_empty(
  $$select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'assign_member_subscription'
      and p.prosecdef$$,
  'assign_member_subscription is security definer'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.assign_member_subscription(uuid, uuid, uuid, date, integer, numeric, character, boolean, boolean)',
    'execute'
  ),
  'authenticated can execute assign_member_subscription'
);

select throws_ok(
  $$select public.assign_member_subscription(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001'
  )$$,
  '42501',
  'Insufficient permission: memberships.manage',
  'assign_member_subscription rejects non-authenticated context'
);

do $$
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-4000-8000-000000000001',
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

select throws_ok(
  $$select public.assign_member_subscription(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000002'
  )$$,
  '23503',
  'El plan no pertenece a este gimnasio o no está activo.',
  'assign_member_subscription rejects a plan from another gym'
);

select * from finish();

rollback;
