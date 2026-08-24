-- Autorizacion dentro de un mismo gimnasio.
--
-- Las cuatro suites de aislamiento multi-tenant que ya existen mueven una sola
-- variable: el gimnasio. Todas corren con duenos, y un dueno tiene el catalogo
-- completo de permisos, asi que ninguna de ellas puede ver lo que pasa cuando
-- el usuario esta en el gimnasio correcto y le falta el permiso.
--
-- Este archivo mueve la otra variable. Mismo gimnasio, tres identidades con
-- permisos distintos, sacadas del seed:
--   dueno      00000000-0000-4000-8000-000000000001  todos los permisos
--   admin      00000000-0000-4000-8000-000000000004  todos menos billing.manage
--   recepcion  00000000-0000-4000-8000-000000000005  quince permisos
--
-- La matriz que manda es la de 20260802120000_permissions_realignment.sql, no
-- la de initial_schema: el realineamiento le agrego memberships.manage y las
-- de entries a recepcion. Se lee la ultima, como con cualquier migracion.

begin;

select plan(20);

-- ---------------------------------------------------------------------------
-- Fixtures. Se crean como dueno de la transaccion, antes de tomar ningun rol.
-- Prefijo a5000000- para no chocar con las suites hermanas.
-- ---------------------------------------------------------------------------

insert into public.gym_alerts(id, gym_id, alert_type_id, severity, title, message)
select
  'a5000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  at.id,
  at.default_severity,
  'Alerta de permisos',
  'Existe para probar quien puede gestionarla y quien no.'
from public.alert_types at
where at.code = 'DEVICE_OFFLINE';

insert into public.audit_logs(gym_id, action, entity_table, entity_id)
values (
  '20000000-0000-4000-8000-000000000001',
  'permissions.fixture',
  'gym_alerts',
  'a5000000-0000-4000-8000-000000000001'
);

-- ---------------------------------------------------------------------------
-- Bloque A. La matriz efectiva, leida por private.has_permission.
--
-- Es la funcion que llaman todas las politicas y todas las RPC, asi que es el
-- punto donde la matriz o es verdad o no lo es. Corre como dueno de la
-- transaccion y no como authenticated a proposito: authenticated no tiene
-- usage sobre el esquema private, y ese 42501 se confundiria con el de RLS.
-- auth.uid() igual sale de request.jwt.claims, que es lo que se cambia aca.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}', true);

select ok(
  private.has_permission('20000000-0000-4000-8000-000000000001', 'members.manage'),
  'recepcion si administra miembros'
);

select ok(
  private.has_permission('20000000-0000-4000-8000-000000000001', 'memberships.manage'),
  'recepcion si administra membresias, que se la dio el realineamiento'
);

select ok(
  not private.has_permission('20000000-0000-4000-8000-000000000001', 'alerts.manage'),
  'recepcion no gestiona alertas, solo las lee'
);

select ok(
  not private.has_permission('20000000-0000-4000-8000-000000000001', 'faces.manage'),
  'recepcion verifica rostros pero no los enrola ni los borra'
);

select ok(
  not private.has_permission('20000000-0000-4000-8000-000000000001', 'income.manage'),
  'recepcion no toca ingresos'
);

select ok(
  not private.has_permission('20000000-0000-4000-8000-000000000001', 'staff.read'),
  'recepcion no ve el personal'
);

select ok(
  not private.has_permission('20000000-0000-4000-8000-000000000001', 'roles.manage'),
  'recepcion no administra roles ni permisos'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);

select ok(
  not private.has_permission('20000000-0000-4000-8000-000000000001', 'billing.manage'),
  'al admin le falta billing.manage, que es lo unico que lo separa del dueno'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select ok(
  private.has_permission('20000000-0000-4000-8000-000000000001', 'billing.manage'),
  'el dueno si tiene billing.manage'
);

-- ---------------------------------------------------------------------------
-- Bloque B. Mapa de privilegios.
--
-- Sin esto un 42501 del bloque C es ambiguo: podria venir de la politica o de
-- un grant que no existe. Si el grant esta, el unico origen posible del
-- rechazo es la politica, que es lo que se quiere probar.
-- ---------------------------------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'public.roles', 'insert'),
  'authenticated si tiene el grant de insert sobre roles'
);

select ok(
  has_table_privilege('authenticated', 'public.income_categories', 'insert'),
  'authenticated si tiene el grant de insert sobre income_categories'
);

select ok(
  has_table_privilege('authenticated', 'public.audit_logs', 'select'),
  'authenticated si tiene el grant de select sobre audit_logs'
);

-- ---------------------------------------------------------------------------
-- Bloque C. Recepcion contra superficies que no le corresponden.
-- Mismo gimnasio, usuario activo, lo unico que falta es el permiso.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.roles(gym_id, code, name, description, is_system)
    values ('20000000-0000-4000-8000-000000000001', 'inventado', 'Inventado', 'No deberia existir', false)$$,
  '42501',
  null,
  'recepcion no puede crear un rol en su propio gimnasio'
);

select throws_ok(
  $$insert into public.income_categories(gym_id, code, name)
    values ('20000000-0000-4000-8000-000000000001', 'inventada', 'Categoria inventada')$$,
  '42501',
  null,
  'recepcion no puede crear una categoria de ingresos'
);

select is(
  (select count(*) from public.audit_logs
    where gym_id = '20000000-0000-4000-8000-000000000001'),
  0::bigint,
  'recepcion no lee ni una fila de auditoria de su propio gimnasio'
);

-- El caso silencioso. gym_alerts_manage es for update y su using exige
-- alerts.manage, que recepcion no tiene. La fila igual es visible por
-- gym_alerts_read, asi que no hay excepcion: el update simplemente no alcanza
-- ninguna fila y sigue de largo en silencio.
--
-- No se cuentan las filas afectadas con un CTE que modifica datos, porque
-- PostgreSQL solo lo admite en el nivel superior de la sentencia y no anidado
-- en una expresion. Se mira el efecto, que es lo que importa: la fila no
-- cambio.
update public.gym_alerts
   set status = 'acknowledged'
 where id = 'a5000000-0000-4000-8000-000000000001';

select is(
  (select status::text from public.gym_alerts
    where id = 'a5000000-0000-4000-8000-000000000001'),
  'open',
  'la alerta sigue abierta para la propia recepcion que intento reconocerla'
);

reset role;
select set_config('request.jwt.claims', '{}', true);

-- La segunda mitad. Que recepcion la vea abierta no alcanza: hay que
-- confirmar sin RLS que la fila existe y no cambio, porque si no un "sigue
-- abierta" podria ser en realidad una fila ausente.
select is(
  (select status::text from public.gym_alerts
    where id = 'a5000000-0000-4000-8000-000000000001'),
  'open',
  'sin RLS la alerta tambien sigue abierta, o sea que la freno la politica'
);

-- ---------------------------------------------------------------------------
-- Bloque D. Controles positivos.
--
-- Sin estos, un archivo donde todo falla no distingue "los permisos funcionan"
-- de "la sesion esta rota" o "la tabla no existe".
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}', true);

update public.gym_members
   set blocked_reason = 'anotado por recepcion'
 where id = '60000000-0000-4000-8000-000000000001';

select is(
  (select blocked_reason from public.gym_members
    where id = '60000000-0000-4000-8000-000000000001'),
  'anotado por recepcion',
  'recepcion si puede editar un miembro, porque members.manage si la tiene'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);

update public.gym_alerts
   set status = 'acknowledged'
 where id = 'a5000000-0000-4000-8000-000000000001';

reset role;
select set_config('request.jwt.claims', '{}', true);

select is(
  (select blocked_reason from public.gym_members
    where id = '60000000-0000-4000-8000-000000000001'),
  'anotado por recepcion',
  'sin RLS el miembro tambien quedo editado, o sea que la escritura fue real'
);

select is(
  (select status::text from public.gym_alerts
    where id = 'a5000000-0000-4000-8000-000000000001'),
  'acknowledged',
  'el admin si gestiono la misma alerta que recepcion no pudo tocar'
);

select * from finish();

rollback;
