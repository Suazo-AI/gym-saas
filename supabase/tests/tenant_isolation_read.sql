-- Aislamiento multi-tenant en lectura.
-- Tarjeta de Trello "Pruebas de aislamiento multi-tenant", item "Intentar leer
-- datos cruzados".
--
-- Lo que se prueba: un usuario autenticado del gimnasio 2 no lee ninguna fila
-- del gimnasio 1, y un visitante anonimo no lee nada.
--
-- Los dos bloques de control positivo no son decorado. Sin ellos un cero puede
-- venir de una tabla vacia o de una identidad mal armada, y la prueba pasaria
-- sin probar nada. Primero se demuestra que las filas existen y que el dueno
-- legitimo las ve, y recien despues se exige el cero al inquilino ajeno.
--
-- Identidades del seed:
--   gimnasio 1 20000000-0000-4000-8000-000000000001  Impulso Fitness
--   gimnasio 2 20000000-0000-4000-8000-000000000002  Norte Gym
--   dueno 1    00000000-0000-4000-8000-000000000001
--   dueno 2    00000000-0000-4000-8000-000000000002
-- Los dos duenos tienen el rol owner de su gimnasio, o sea el catalogo
-- completo de permisos. Lo unico que los separa es el gimnasio.

begin;

select plan(21);

-- ---------------------------------------------------------------------------
-- Fixtures. Solo lo que el seed no trae: el seed no carga ningun ingreso
-- adicional, y no carga pagos del gimnasio 2. Se insertan como dueno de la
-- transaccion, nunca como el usuario que despues se pone a prueba.
-- ---------------------------------------------------------------------------

insert into public.other_income_entries (
  id, gym_id, income_category_id, amount, currency, reference, recorded_by
)
select
  'a1000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  ic.id,
  500.00,
  'NIO',
  'AISLAMIENTO-G1',
  '00000000-0000-4000-8000-000000000001'
from public.income_categories ic
where ic.gym_id = '20000000-0000-4000-8000-000000000001'
  and ic.code = 'other';

insert into public.other_income_entries (
  id, gym_id, income_category_id, amount, currency, reference, recorded_by
)
select
  'a1000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000002',
  ic.id,
  25.00,
  'USD',
  'AISLAMIENTO-G2',
  '00000000-0000-4000-8000-000000000002'
from public.income_categories ic
where ic.gym_id = '20000000-0000-4000-8000-000000000002'
  and ic.code = 'other';

-- receipt_number va en null a proposito: el trigger de la tabla reescribe todo
-- recibo al formato R mas diez hexadecimales, asi que fijarlo no serviria.
insert into public.member_payments (
  id, gym_id, gym_member_id, payment_method_id, status,
  amount, currency, receipt_number, received_by
)
select
  'a1000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000002',
  '60000000-0000-4000-8000-000000000003',
  pm.id,
  'settled',
  30.00,
  'USD',
  null,
  '00000000-0000-4000-8000-000000000002'
from public.payment_methods pm
where pm.code = 'cash';

-- ---------------------------------------------------------------------------
-- Bloque A. Control positivo: el dueno 1 si ve los datos del gimnasio 1.
-- Prueba que las filas existen y son alcanzables por RLS, para que el cero del
-- bloque C signifique aislamiento y no una tabla vacia.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select ok(
  (select count(*) from public.gym_members
   where gym_id = '20000000-0000-4000-8000-000000000001') > 0,
  'el dueno 1 ve miembros de su gimnasio'
);

select ok(
  (select count(*) from public.member_subscriptions
   where id in (
     '70000000-0000-4000-8000-000000000001',
     '70000000-0000-4000-8000-000000000002'
   )) > 0,
  'el dueno 1 ve suscripciones de su gimnasio'
);

select ok(
  (select count(*) from public.member_payments
   where gym_id = '20000000-0000-4000-8000-000000000001') > 0,
  'el dueno 1 ve pagos de su gimnasio'
);

select ok(
  (select count(*) from public.membership_plans
   where gym_id = '20000000-0000-4000-8000-000000000001') > 0,
  'el dueno 1 ve planes de su gimnasio'
);

select ok(
  (select count(*) from public.gym_branches
   where gym_id = '20000000-0000-4000-8000-000000000001') > 0,
  'el dueno 1 ve sucursales de su gimnasio'
);

select ok(
  (select count(*) from public.other_income_entries
   where gym_id = '20000000-0000-4000-8000-000000000001') > 0,
  'el dueno 1 ve ingresos de su gimnasio'
);

reset role;

-- ---------------------------------------------------------------------------
-- Bloque B. Control positivo: el dueno 2 es una identidad que funciona.
-- Es el control que mas importa. Si la sesion del dueno 2 estuviera rota, por
-- ejemplo sin fila en gym_users, los seis ceros del bloque C pasarian solos y
-- no probarian ningun aislamiento.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select ok(
  (select count(*) from public.gym_members
   where gym_id = '20000000-0000-4000-8000-000000000002') > 0,
  'el dueno 2 ve miembros de su propio gimnasio'
);

select ok(
  (select count(*) from public.member_subscriptions
   where id = '70000000-0000-4000-8000-000000000003') > 0,
  'el dueno 2 ve suscripciones de su propio gimnasio'
);

select ok(
  (select count(*) from public.member_payments
   where gym_id = '20000000-0000-4000-8000-000000000002') > 0,
  'el dueno 2 ve pagos de su propio gimnasio'
);

select ok(
  (select count(*) from public.membership_plans
   where gym_id = '20000000-0000-4000-8000-000000000002') > 0,
  'el dueno 2 ve planes de su propio gimnasio'
);

select ok(
  (select count(*) from public.gym_branches
   where gym_id = '20000000-0000-4000-8000-000000000002') > 0,
  'el dueno 2 ve sucursales de su propio gimnasio'
);

select ok(
  (select count(*) from public.other_income_entries
   where gym_id = '20000000-0000-4000-8000-000000000002') > 0,
  'el dueno 2 ve ingresos de su propio gimnasio'
);

-- ---------------------------------------------------------------------------
-- Bloque C. El aislamiento. Misma sesion del dueno 2, ahora preguntando por el
-- gimnasio 1. Cada consulta filtra por la tabla bajo prueba y no se cuelga de
-- otra tabla protegida, para que el cero venga de la politica de esa tabla.
-- member_subscriptions no tiene gym_id, asi que se la interroga por los id de
-- las suscripciones del gimnasio 1 en vez de unir contra gym_members.
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from public.gym_members
   where gym_id = '20000000-0000-4000-8000-000000000001'),
  0::bigint,
  'el dueno 2 no lee ningun miembro del gimnasio 1'
);

select is(
  (select count(*) from public.member_subscriptions
   where id in (
     '70000000-0000-4000-8000-000000000001',
     '70000000-0000-4000-8000-000000000002'
   )),
  0::bigint,
  'el dueno 2 no lee ninguna suscripcion del gimnasio 1'
);

select is(
  (select count(*) from public.member_payments
   where gym_id = '20000000-0000-4000-8000-000000000001'),
  0::bigint,
  'el dueno 2 no lee ningun pago del gimnasio 1'
);

select is(
  (select count(*) from public.membership_plans
   where gym_id = '20000000-0000-4000-8000-000000000001'),
  0::bigint,
  'el dueno 2 no lee ningun plan del gimnasio 1'
);

select is(
  (select count(*) from public.gym_branches
   where gym_id = '20000000-0000-4000-8000-000000000001'),
  0::bigint,
  'el dueno 2 no lee ninguna sucursal del gimnasio 1'
);

select is(
  (select count(*) from public.other_income_entries
   where gym_id = '20000000-0000-4000-8000-000000000001'),
  0::bigint,
  'el dueno 2 no lee ningun ingreso del gimnasio 1'
);

reset role;
select set_config('request.jwt.claims', '{}', true);

-- ---------------------------------------------------------------------------
-- Bloque D. El visitante anonimo.
-- Primero la forma: ninguna politica de las seis tablas nombra a anon ni a
-- public, asi que aunque anon llegara a tener el grant no encontraria ninguna
-- politica permisiva y leeria cero filas. Despues el hecho: hoy ni siquiera
-- tiene el grant, porque el esquema solo se lo da a authenticated y
-- config.toml deja auto_expose_new_tables sin definir.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
   from pg_policies p
   where p.schemaname = 'public'
     and p.tablename in (
       'gym_members',
       'member_subscriptions',
       'member_payments',
       'membership_plans',
       'gym_branches',
       'other_income_entries'
     )
     and exists (
       select 1
       from unnest(p.roles) as r(rolname)
       where r.rolname in ('anon', 'public')
     )),
  0,
  'ninguna politica de las seis tablas alcanza al rol anonimo ni a public'
);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$ select count(*) from public.gym_members
     where gym_id = '20000000-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'el visitante anonimo no puede ni consultar gym_members'
);

select throws_ok(
  $$ select count(*) from public.member_payments
     where gym_id = '20000000-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'el visitante anonimo no puede ni consultar member_payments'
);

reset role;

select * from finish();
rollback;
