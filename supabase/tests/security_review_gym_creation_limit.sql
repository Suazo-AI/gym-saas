begin;

select plan(2);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);

select lives_ok(
  $$insert into public.gyms (id, legal_name, trade_name, slug, created_by)
    values
      ('c1000000-0000-4000-8000-000000000001', 'Prueba Uno S.A.', 'Prueba Uno', 'security-review-r1-uno', '00000000-0000-4000-8000-000000000003'),
      ('c1000000-0000-4000-8000-000000000002', 'Prueba Dos S.A.', 'Prueba Dos', 'security-review-r1-dos', '00000000-0000-4000-8000-000000000003'),
      ('c1000000-0000-4000-8000-000000000003', 'Prueba Tres S.A.', 'Prueba Tres', 'security-review-r1-tres', '00000000-0000-4000-8000-000000000003')$$,
  'el alta self-service permite crear hasta tres gimnasios en 24 horas'
);

select throws_ok(
  $$insert into public.gyms (id, legal_name, trade_name, slug, created_by)
    values ('c1000000-0000-4000-8000-000000000004', 'Prueba Cuatro S.A.', 'Prueba Cuatro', 'security-review-r1-cuatro', '00000000-0000-4000-8000-000000000003')$$,
  '42501',
  null,
  'el cuarto gimnasio del mismo usuario y ventana queda bloqueado'
);

reset role;
select set_config('request.jwt.claims', '{}', true);

select * from finish();

rollback;
