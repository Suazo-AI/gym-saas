-- Aislamiento multi-tenant en modificacion y borrado.
-- Tarjeta "Pruebas de aislamiento multi-tenant", item "Intentar modificar y
-- eliminar datos cruzados".
--
-- La trampa de este archivo, y por que no se escribe como los dos hermanos:
-- un update o un delete contra una fila que RLS hace invisible no lanza
-- ninguna excepcion. Afecta cero filas y sigue de largo. Una asercion que
-- espere un error falla aunque el aislamiento funcione perfecto, y una que
-- solo mire que no hubo error pasa sin probar nada.
--
-- Por eso cada caso hostil tiene dos mitades y hacen falta las dos:
--   1. contar las filas que la sentencia afecto y exigir cero;
--   2. releer la fila con el dueno 1, que si la ve, y exigir que su valor siga
--      siendo el original. Sin esto un cero podria venir de una fila que nunca
--      existio.
-- La cuenta se hace con un CTE que modifica y devuelve filas, contadas en la
-- consulta principal. Es la unica forma de ver ese numero desde una sentencia
-- suelta de pgTAP.
--
-- El bloque de control positivo tampoco es decorado: si la sesion del dueno 2
-- estuviera rota, todos los ceros saldrian solos y no probarian nada.
--
-- Identidades del seed:
--   gimnasio 1 20000000-0000-4000-8000-000000000001  Impulso Fitness
--   gimnasio 2 20000000-0000-4000-8000-000000000002  Norte Gym
--   dueno 1    00000000-0000-4000-8000-000000000001
--   dueno 2    00000000-0000-4000-8000-000000000002
-- Los dos tienen el rol owner de su gimnasio, o sea el catalogo completo de
-- permisos. Lo unico que los separa es el gimnasio.
--
-- Fixtures propios de este archivo: prefijo a3000000-.
-- El borrado fisico de member_subscriptions ya lo cubre
-- subscription_delete_protection.sql y no se repite aca.

begin;

select plan(30);

-- ---------------------------------------------------------------------------
-- Fixtures. Se cargan como dueno de la transaccion, nunca como el usuario que
-- despues se pone a prueba.
--
-- Son dos roles de mentira, uno por gimnasio, asignados a un usuario que ya
-- existe. Sirven para el unico borrado cruzado que llega a evaluarse: en
-- gym_members, membership_plans y gym_branches el delete esta revocado y el
-- rechazo llega antes de RLS, asi que ninguna de esas tres puede mostrar el
-- cero silencioso del borrado. gym_user_roles si conserva el delete.
--
-- Los roles nacen sin ningun permiso asociado, asi que asignarlos no cambia lo
-- que los duenos pueden hacer en el resto del archivo.
-- ---------------------------------------------------------------------------

insert into public.roles (id, gym_id, code, name, description)
values
  (
    'a3000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'a3-cruzado',
    'Rol de prueba del gimnasio 1',
    'Objetivo del borrado cruzado'
  ),
  (
    'a3000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'a3-legit',
    'Rol de prueba del gimnasio 2',
    'Objetivo del borrado legitimo'
  );

insert into public.gym_user_roles (gym_user_id, role_id, assigned_by)
select
  gu.id,
  'a3000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001'
from public.gym_users gu
where gu.gym_id = '20000000-0000-4000-8000-000000000001'
  and gu.auth_user_id = '00000000-0000-4000-8000-000000000001';

insert into public.gym_user_roles (gym_user_id, role_id, assigned_by)
select
  gu.id,
  'a3000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000002'
from public.gym_users gu
where gu.gym_id = '20000000-0000-4000-8000-000000000002'
  and gu.auth_user_id = '00000000-0000-4000-8000-000000000002';

-- ---------------------------------------------------------------------------
-- Bloque A. Quien rechaza que.
-- Sin este mapa, un cero no distingue "lo filtro RLS" de "no hay grant", y un
-- 42501 tampoco. En las tres tablas del alcance el update sigue concedido, asi
-- que el unico que puede filtrar es la politica, y por eso el rechazo va a ser
-- silencioso. El delete, en cambio, esta revocado: ahi el rechazo llega en el
-- chequeo de privilegios, antes de que RLS opine.
-- ---------------------------------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'public.gym_members', 'update'),
  'authenticated conserva update sobre gym_members: quien filtra es RLS'
);

select ok(
  has_table_privilege('authenticated', 'public.membership_plans', 'update'),
  'authenticated conserva update sobre membership_plans: quien filtra es RLS'
);

select ok(
  has_table_privilege('authenticated', 'public.gym_branches', 'update'),
  'authenticated conserva update sobre gym_branches: quien filtra es RLS'
);

select ok(
  not has_table_privilege('authenticated', 'public.gym_members', 'delete'),
  'el delete fisico de gym_members esta revocado para authenticated'
);

select ok(
  not has_table_privilege('authenticated', 'public.membership_plans', 'delete'),
  'el delete fisico de membership_plans esta revocado para authenticated'
);

select ok(
  not has_table_privilege('authenticated', 'public.gym_branches', 'delete'),
  'el delete fisico de gym_branches esta revocado para authenticated'
);

select ok(
  has_table_privilege('authenticated', 'public.gym_user_roles', 'delete'),
  'authenticated conserva delete sobre gym_user_roles: quien filtra es RLS'
);

-- ---------------------------------------------------------------------------
-- Bloque B. Control positivo: el dueno 2 si modifica y si borra lo suyo.
-- Es el bloque que le da sentido a todos los ceros que vienen despues.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

with propio as (
  update public.gym_members
     set member_code = 'A3-LEGIT'
   where id = '60000000-0000-4000-8000-000000000003'
  returning 1 as tocada
)
select is(
  count(*),
  1::bigint,
  'el dueno 2 modifica una fila de gym_members de su propio gimnasio'
)
from propio;

with propio as (
  update public.membership_plans
     set price = 11.00
   where id = '40000000-0000-4000-8000-000000000002'
  returning 1 as tocada
)
select is(
  count(*),
  1::bigint,
  'el dueno 2 modifica una fila de membership_plans de su propio gimnasio'
)
from propio;

with propio as (
  update public.gym_branches
     set name = 'Sucursal Legitima'
   where id = '30000000-0000-4000-8000-000000000002'
  returning 1 as tocada
)
select is(
  count(*),
  1::bigint,
  'el dueno 2 modifica una fila de gym_branches de su propio gimnasio'
)
from propio;

with propio as (
  delete from public.gym_user_roles
   where role_id = 'a3000000-0000-4000-8000-000000000002'
  returning 1 as tocada
)
select is(
  count(*),
  1::bigint,
  'el dueno 2 borra una asignacion de rol de su propio gimnasio'
)
from propio;

-- Contar filas afectadas no alcanza ni siquiera del lado legitimo: hay que ver
-- el valor nuevo ya escrito.
select is(
  (
    (select count(*) from public.gym_members
      where id = '60000000-0000-4000-8000-000000000003'
        and member_code = 'A3-LEGIT')
    + (select count(*) from public.membership_plans
        where id = '40000000-0000-4000-8000-000000000002'
          and price = 11.00)
    + (select count(*) from public.gym_branches
        where id = '30000000-0000-4000-8000-000000000002'
          and name = 'Sucursal Legitima')
  ),
  3::bigint,
  'las tres modificaciones propias quedaron efectivamente escritas'
);

-- ---------------------------------------------------------------------------
-- Bloque C. El caso hostil del update. Misma sesion del dueno 2, ahora contra
-- filas del gimnasio 1. Ninguna de estas tres sentencias lanza excepcion: el
-- aislamiento se ve en el cero, y recien se completa en el bloque G.
-- ---------------------------------------------------------------------------

with cruzado as (
  update public.gym_members
     set member_code = 'A3-CRUZADO'
   where id = '60000000-0000-4000-8000-000000000001'
  returning 1 as tocada
)
select is(
  count(*),
  0::bigint,
  'el dueno 2 no modifica ninguna fila de gym_members del gimnasio 1'
)
from cruzado;

with cruzado as (
  update public.membership_plans
     set price = 1.00
   where id = '40000000-0000-4000-8000-000000000001'
  returning 1 as tocada
)
select is(
  count(*),
  0::bigint,
  'el dueno 2 no modifica ninguna fila de membership_plans del gimnasio 1'
)
from cruzado;

with cruzado as (
  update public.gym_branches
     set name = 'Sucursal Cruzada'
   where id = '30000000-0000-4000-8000-000000000001'
  returning 1 as tocada
)
select is(
  count(*),
  0::bigint,
  'el dueno 2 no modifica ninguna fila de gym_branches del gimnasio 1'
)
from cruzado;

-- ---------------------------------------------------------------------------
-- Bloque D. El caso hostil del delete.
-- Las tres primeras cortan en el chequeo de privilegios, que corre antes que
-- RLS: por eso aca si hay excepcion, y es 42501. La cuarta es la que muestra
-- la trampa entera, porque en gym_user_roles el grant sigue vivo y el borrado
-- cruzado se va en silencio afectando cero filas.
-- Se afirma el SQLSTATE y no el texto del mensaje, que cambia entre versiones
-- de PostgreSQL.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ delete from public.gym_members
      where id = '60000000-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'el dueno 2 no puede borrar fisicamente un miembro del gimnasio 1'
);

select throws_ok(
  $$ delete from public.membership_plans
      where id = '40000000-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'el dueno 2 no puede borrar fisicamente un plan del gimnasio 1'
);

select throws_ok(
  $$ delete from public.gym_branches
      where id = '30000000-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'el dueno 2 no puede borrar fisicamente una sucursal del gimnasio 1'
);

with cruzado as (
  delete from public.gym_user_roles
   where role_id = 'a3000000-0000-4000-8000-000000000001'
  returning 1 as tocada
)
select is(
  count(*),
  0::bigint,
  'el dueno 2 no borra ninguna asignacion de rol del gimnasio 1, y sin error'
)
from cruzado;

-- ---------------------------------------------------------------------------
-- Bloque E. La otra direccion: mudar una fila propia al gimnasio 1.
-- Aca el using pasa, porque la fila vieja es suya, y quien rechaza es el with
-- check sobre la fila nueva. Ese rechazo si es una excepcion.
-- En gym_members se manda home_branch_id en null a proposito: dejando la
-- sucursal del gimnasio 2 saltaria antes el trigger de integridad cruzada y el
-- rechazo no probaria nada sobre RLS.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$
    update public.gym_members
       set gym_id = '20000000-0000-4000-8000-000000000001',
           home_branch_id = null
     where id = '60000000-0000-4000-8000-000000000003'
  $$,
  '42501',
  null,
  'el dueno 2 no puede mudar un miembro suyo al gimnasio 1'
);

select throws_ok(
  $$
    update public.membership_plans
       set gym_id = '20000000-0000-4000-8000-000000000001'
     where id = '40000000-0000-4000-8000-000000000002'
  $$,
  '42501',
  null,
  'el dueno 2 no puede mudar un plan suyo al gimnasio 1'
);

-- ---------------------------------------------------------------------------
-- Bloque F. Borrado logico.
-- AGENTS.md prohibe tocar deleted_at a mano y manda pasar por
-- soft_delete_entity. Las dos vias se prueban contra el gimnasio 1.
--
-- La rpc es security definer y resuelve el objetivo sin RLS, asi que llega a
-- ver la fila ajena y la corta el chequeo de permiso: eso da P0001, no 42501.
-- El update directo, en cambio, muestra otra vez la trampa: sobre una fila
-- propia el trigger guardian salta con P0001, pero sobre una fila del gimnasio
-- 1 no salta nunca, porque RLS ya la habia sacado de la sentencia.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.soft_delete_entity(
       'gym_member',
       '60000000-0000-4000-8000-000000000001'::uuid
     ) $$,
  'P0001',
  null,
  'la rpc de borrado logico rechaza un miembro del gimnasio 1'
);

select throws_ok(
  $$ select public.soft_delete_entity(
       'membership_plan',
       '40000000-0000-4000-8000-000000000001'::uuid
     ) $$,
  'P0001',
  null,
  'la rpc de borrado logico rechaza un plan del gimnasio 1'
);

select throws_ok(
  $$ select public.soft_delete_entity(
       'gym_branch',
       '30000000-0000-4000-8000-000000000001'::uuid
     ) $$,
  'P0001',
  null,
  'la rpc de borrado logico rechaza una sucursal del gimnasio 1'
);

select throws_ok(
  $$
    update public.gym_members
       set deleted_at = timezone('utc', now())
     where id = '60000000-0000-4000-8000-000000000003'
  $$,
  'P0001',
  null,
  'ni sobre su propio miembro puede el dueno 2 escribir deleted_at a mano'
);

with cruzado as (
  update public.gym_members
     set deleted_at = timezone('utc', now())
   where id = '60000000-0000-4000-8000-000000000001'
  returning 1 as tocada
)
select is(
  count(*),
  0::bigint,
  'el borrado logico a mano contra el gimnasio 1 afecta cero filas, y sin error'
)
from cruzado;

-- ---------------------------------------------------------------------------
-- Bloque G. La segunda mitad, y la que convierte los ceros en prueba.
-- Se cambia de identidad al dueno 1, que si ve las filas del gimnasio 1, y se
-- exige que sigan con su valor original. Un cero mas una fila intacta si es
-- aislamiento; un cero solo podria ser una fila que nunca existio.
-- Que la fila se lea prueba ademas que no quedo borrada logicamente: la
-- politica restrictiva de soft delete esconde toda fila con deleted_at.
-- ---------------------------------------------------------------------------

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (select member_code from public.gym_members
    where id = '60000000-0000-4000-8000-000000000001'),
  'M-0001'::text,
  'el miembro del gimnasio 1 sigue con su codigo original'
);

select is(
  (select price from public.membership_plans
    where id = '40000000-0000-4000-8000-000000000001'),
  900.00::numeric,
  'el plan del gimnasio 1 sigue con su precio original'
);

select is(
  (select name from public.gym_branches
    where id = '30000000-0000-4000-8000-000000000001'),
  'Sucursal Central'::text,
  'la sucursal del gimnasio 1 sigue con su nombre original'
);

select is(
  (select count(*) from public.gym_user_roles
    where role_id = 'a3000000-0000-4000-8000-000000000001'),
  1::bigint,
  'la asignacion de rol del gimnasio 1 sigue existiendo'
);

reset role;
select set_config('request.jwt.claims', '{}', true);

select * from finish();

rollback;
