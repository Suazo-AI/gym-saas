begin;

select plan(16);

select has_function(
  'public',
  'create_platform_gym_with_owner',
  array['uuid', 'text', 'text', 'text', 'text', 'text', 'text'],
  'platform gym onboarding rpc exists'
);

select isnt_empty(
  $$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'create_platform_gym_with_owner' and p.prosecdef$$,
  'platform gym onboarding is security definer'
);

select ok(
  has_function_privilege('authenticated', 'public.create_platform_gym_with_owner(uuid,text,text,text,text,text,text)', 'execute'),
  'authenticated can execute the guarded rpc'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.create_platform_gym_with_owner('00000000-0000-4000-8000-000000000004', 'Contrato QA, S.A.', 'Contrato QA', 'contrato-qa', null, 'NIO', 'America/Managua')$$,
  '42501',
  'platform admin permission required',
  'tenant owner cannot provision a new platform tenant'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"platform_role":"admin"}}',
  true
);

create temporary table onboarding_result on commit drop as
select public.create_platform_gym_with_owner(
  '00000000-0000-4000-8000-000000000004',
  'Contrato QA, S.A.',
  'Contrato QA',
  'contrato-qa',
  'J031000000001',
  'NIO',
  'America/Managua'
) as payload;

select ok((select (payload ->> 'gymId')::uuid is not null from onboarding_result), 'rpc returns the new gym id');

reset role;

select ok(
  exists (
    select 1 from public.gyms g
    where g.id = (select (payload ->> 'gymId')::uuid from onboarding_result)
      and g.created_by = '00000000-0000-4000-8000-000000000004'
      and g.slug = 'contrato-qa'
  ),
  'gym belongs to the invited owner identity'
);

select ok(
  exists (
    select 1
    from public.gym_users gu
    join public.gym_user_roles gur on gur.gym_user_id = gu.id
    join public.roles r on r.id = gur.role_id
    where gu.gym_id = (select (payload ->> 'gymId')::uuid from onboarding_result)
      and gu.auth_user_id = '00000000-0000-4000-8000-000000000004'
      and gu.status = 'active'
      and r.code = 'owner'
  ),
  'bootstrap creates the active owner assignment'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    where r.gym_id = (select (payload ->> 'gymId')::uuid from onboarding_result)
      and r.code = 'owner'
  ),
  (select count(*)::integer from public.permissions),
  'new owner receives the complete permission catalog'
);

select ok(
  exists (
    select 1 from public.audit_logs a
    where a.gym_id = (select (payload ->> 'gymId')::uuid from onboarding_result)
      and a.actor_user_id = '00000000-0000-4000-8000-000000000003'
      and a.action = 'PLATFORM_GYM_CREATED_WITH_OWNER'
  ),
  'platform actor is recorded in audit'
);

select ok(
  not exists (
    select 1 from public.audit_logs a
    where a.gym_id = (select (payload ->> 'gymId')::uuid from onboarding_result)
      and a.action = 'PLATFORM_GYM_CREATED_WITH_OWNER'
      and a.after_data ? 'ownerEmail'
  ),
  'audit payload does not store the owner email'
);

select ok(
  exists (
    select 1 from public.gym_exchange_rate_history h
    where h.gym_id = (select (payload ->> 'gymId')::uuid from onboarding_result)
  ),
  'gym exchange rate is initialized by the tenant bootstrap'
);

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.gyms where slug = 'contrato-qa'),
  0,
  'another gym owner cannot read the new tenant'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.gyms where slug = 'contrato-qa'),
  1,
  'the invited owner can read the new tenant'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"platform_role":"admin"}}',
  true
);

select throws_ok(
  $$select public.create_platform_gym_with_owner('ffffffff-ffff-4fff-8fff-ffffffffffff', 'Sin dueño, S.A.', 'Sin dueño', 'sin-dueno', null, 'NIO', 'America/Managua')$$,
  '23503',
  'Invited owner authentication user was not found',
  'unknown owner identity is rejected'
);

select throws_ok(
  $$select public.create_platform_gym_with_owner('00000000-0000-4000-8000-000000000004', 'Duplicado, S.A.', 'Duplicado', 'contrato-qa', null, 'NIO', 'America/Managua')$$,
  '23505',
  null,
  'duplicate active slug is rejected'
);

select throws_ok(
  $$select public.create_platform_gym_with_owner('00000000-0000-4000-8000-000000000004', 'Moneda, S.A.', 'Moneda', 'moneda-invalida', null, 'EUR', 'America/Managua')$$,
  '23514',
  'La moneda debe ser NIO o USD.',
  'unsupported currency is rejected'
);

select * from finish();

rollback;
