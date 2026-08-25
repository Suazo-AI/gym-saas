begin;

select plan(2);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);

select throws_ok(
  $$insert into public.persons (id, first_name, last_name, created_by)
    values ('c2000000-0000-4000-8000-000000000001', 'Sin', 'Gimnasio', '00000000-0000-4000-8000-000000000003')$$,
  '42501',
  null,
  'un usuario sin gimnasio ni permiso no puede crear personas'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}',
  true
);

select lives_ok(
  $$insert into public.persons (id, first_name, last_name, created_by)
    values ('c2000000-0000-4000-8000-000000000002', 'Con', 'Permiso', '00000000-0000-4000-8000-000000000005')$$,
  'recepcion conserva el alta de personas porque tiene members.manage'
);

reset role;
select set_config('request.jwt.claims', '{}', true);

select * from finish();

rollback;
