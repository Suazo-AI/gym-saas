begin;

select plan(12);

-- ---------------------------------------------------------------------------
-- Contrato del codigo de miembro secuencial (20260823010000).
--
-- El codigo no es una frontera de seguridad: la identidad la da gym_members.id
-- y el aislamiento lo da RLS por gym_id. Lo que se prueba aca es que el numero
-- que ve una persona sea legible, unico dentro de su gimnasio, y que no se
-- pise con uno escrito a mano.
-- ---------------------------------------------------------------------------

select has_table('private', 'member_code_counters', 'existe el contador por gimnasio');
select has_function('private', 'format_member_code', array['bigint'], 'existe el formateador');
select has_function('private', 'next_member_code', array['uuid'], 'existe el generador');

select col_is_pk(
  'private',
  'member_code_counters',
  'gym_id',
  'el contador tiene una sola fila por gimnasio'
);

-- El formato es lo unico que una persona ve. Seis digitos con relleno.
select is(private.format_member_code(1), 'M-000001', 'el uno se rellena a seis digitos');
select is(private.format_member_code(42), 'M-000042', 'el cuarenta y dos se rellena a seis digitos');
select is(private.format_member_code(999999), 'M-999999', 'el tope de seis digitos no se recorta');

-- Dos gimnasios de prueba, para que la numeracion no dependa del seed.
insert into public.gyms (id, legal_name, trade_name, slug, created_by)
values
  ('aa000000-0000-4000-8000-000000000001', 'Codigo Uno S.A.', 'Codigo Uno', 'codigo-uno-test', '00000000-0000-4000-8000-000000000001'),
  ('aa000000-0000-4000-8000-000000000002', 'Codigo Dos S.A.', 'Codigo Dos', 'codigo-dos-test', '00000000-0000-4000-8000-000000000001');

-- Un gimnasio recien creado empieza en uno y avanza de a uno.
select is(
  private.next_member_code('aa000000-0000-4000-8000-000000000001'),
  'M-000001',
  'un gimnasio nuevo entrega el primer codigo'
);
select is(
  private.next_member_code('aa000000-0000-4000-8000-000000000001'),
  'M-000002',
  'el segundo codigo del mismo gimnasio avanza de a uno'
);

-- La numeracion es por gimnasio: el segundo gimnasio vuelve a empezar en uno.
-- Esto es deliberado. Dos gimnasios distintos pueden tener el socio M-000001 y
-- eso no es una colision: el indice unico es (gym_id, lower(member_code)).
select is(
  private.next_member_code('aa000000-0000-4000-8000-000000000002'),
  'M-000001',
  'cada gimnasio numera por su cuenta'
);

-- Un codigo escrito a mano ocupa el numero que el contador iba a entregar.
-- El generador tiene que saltearlo, no chocar.
with p as (
  insert into public.persons (first_name, last_name) values ('Ocupa', 'Manual') returning id
)
insert into public.gym_members (gym_id, person_id, member_code, status)
select 'aa000000-0000-4000-8000-000000000001', p.id, 'M-000003', 'prospect' from p;

select is(
  private.next_member_code('aa000000-0000-4000-8000-000000000001'),
  'M-000004',
  'el generador saltea un codigo ya ocupado a mano'
);

-- El mismo codigo en otro gimnasio no estorba.
with p as (
  insert into public.persons (first_name, last_name) values ('Otro', 'Gimnasio') returning id
)
insert into public.gym_members (gym_id, person_id, member_code, status)
select 'aa000000-0000-4000-8000-000000000002', p.id, 'M-000002', 'prospect' from p;

select is(
  private.next_member_code('aa000000-0000-4000-8000-000000000001'),
  'M-000005',
  'un codigo igual en otro gimnasio no altera esta numeracion'
);

select * from finish();

rollback;
