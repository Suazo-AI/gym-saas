begin;

select plan(4);

insert into public.membership_plans (
  id,
  gym_id,
  code,
  name,
  price,
  currency
)
values (
  '4de1e7ed-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'PGTAP-TRASH',
  'Plan papelera pgTAP',
  1.00,
  'NIO'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.soft_delete_entity(
    'membership_plan',
    '4de1e7ed-0000-4000-8000-000000000001',
    'Prueba de papelera'
  )$$,
  'authorized owner can retire the test membership plan'
);

select lives_ok(
  $$select * from public.list_deleted_entities(
    '20000000-0000-4000-8000-000000000001',
    'membership_plan',
    50,
    0
  )$$,
  'recycle-bin query executes at runtime'
);

select results_eq(
  $$select entity_type from public.list_deleted_entities(
    '20000000-0000-4000-8000-000000000001',
    'membership_plan',
    50,
    0
  ) where id = '4de1e7ed-0000-4000-8000-000000000001'$$,
  $$values ('membership_plan'::text)$$,
  'recycle-bin filtering returns the retired plan'
);

select throws_ok(
  $$select * from public.list_deleted_entities(
    '20000000-0000-4000-8000-000000000002',
    'membership_plan',
    50,
    0
  )$$,
  'P0001',
  'audit.read or gym.manage permission is required',
  'owner cannot inspect another gym recycle bin'
);

select * from finish();
rollback;
