begin;

select plan(4);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.permissions),
  0::bigint,
  'un usuario sin gimnasio no puede leer permissions'
);

select is(
  (select count(*) from public.screen_permissions),
  0::bigint,
  'un usuario sin gimnasio no puede leer screen_permissions'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select ok(
  (select count(*) from public.permissions) > 0,
  'un usuario activo de un gimnasio conserva acceso a permissions'
);

select ok(
  (select count(*) from public.screen_permissions) > 0,
  'un usuario activo de un gimnasio conserva acceso a screen_permissions'
);

reset role;
select set_config('request.jwt.claims', '{}', true);

select * from finish();

rollback;
