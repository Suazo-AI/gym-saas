-- Aislamiento multi-tenant en las operaciones con service_role.
-- Tarjeta de Trello "Pruebas de aislamiento multi-tenant", item "Revisar
-- operaciones con service_role".
--
-- Este archivo afirma algo que a primera vista suena al reves: que el bypass
-- de RLS existe. No es un descuido. service_role omite RLS por diseno, y una
-- prueba que exigiera lo contrario estaria probando algo falso. Lo que
-- AGENTS.md manda es lo otro:
--
--   "Las operaciones con service_role deben validar manualmente el gym_id,
--    porque service_role puede omitir RLS."
--
-- De ahi los cinco bloques:
--
--   A  private.is_service_role() existe con la firma que se le supone, porque
--      toda la cadena cuelga de esa funcion, y responde lo que dice el JWT.
--   B  el bypass, escrito como propiedad conocida y no como suposicion. Si
--      algun dia cambia, estas aserciones avisan.
--   C  con RLS salteado, el gym_id se sigue validando: los guardas que no son
--      politicas, como los triggers, no se enteran de quien llama.
--   D  ningun usuario autenticado alcanza las superficies de service_role.
--   E  una superficie compartida que recibe el gym_id por parametro lo acota
--      igual cuando quien llama es service_role.
--
-- Lo que este archivo NO repite: supabase/tests/storage_deletion_queue_contract.sql
-- ya tiene plan(26) sobre el ciclo de vida de la cola de borrado, o sea
-- reintentos, tope, estado dead, bloqueo vencido y lista blanca de bucket, y
-- sobre los grants de sus tres RPC. Aca se mira el angulo de tenancy y la
-- frontera de rol, no la mecanica de la cola.
--
-- Nota sobre F040, hallazgo abierto y fuera del alcance de este archivo: el
-- reclamo por bloqueo vencido no emite token de propiedad, asi que un worker
-- que revive puede completar el trabajo de otro. Es un problema de propiedad
-- del trabajo, no de tenancy, y no se toca aca.
--
-- Identidades del seed:
--   gimnasio 1 20000000-0000-4000-8000-000000000001  Impulso Fitness
--   gimnasio 2 20000000-0000-4000-8000-000000000002  Norte Gym
--   dueno 1    00000000-0000-4000-8000-000000000001
--   dueno 2    00000000-0000-4000-8000-000000000002
-- Los dos duenos tienen el rol owner de su gimnasio, o sea el catalogo
-- completo de permisos, media.read y memberships.manage incluidos.
--
-- Fixtures propios de este archivo: prefijo a4000000-.

begin;

select plan(20);

-- ---------------------------------------------------------------------------
-- Fixtures. Se cargan como dueno de la transaccion, nunca como el rol que
-- despues se pone a prueba. Un archivo por gimnasio y su trabajo de borrado.
-- ---------------------------------------------------------------------------

insert into public.media_assets (
  id, gym_id, bucket_name, object_path, mime_type, size_bytes
)
values
  (
    'a4000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'gym-media',
    '20000000-0000-4000-8000-000000000001/t4/0001.webp',
    'image/webp',
    1024
  ),
  (
    'a4000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'gym-media',
    '20000000-0000-4000-8000-000000000002/t4/0002.webp',
    'image/webp',
    1024
  );

insert into public.storage_deletion_queue (
  id, media_asset_id, gym_id, bucket_name, object_path, status
)
values
  (
    'a4000000-0000-4000-8000-000000000011',
    'a4000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'gym-media',
    '20000000-0000-4000-8000-000000000001/t4/0001.webp',
    'pending'
  ),
  (
    'a4000000-0000-4000-8000-000000000012',
    'a4000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'gym-media',
    '20000000-0000-4000-8000-000000000002/t4/0002.webp',
    'pending'
  );

-- ---------------------------------------------------------------------------
-- Bloque A. La funcion de la que cuelga toda la cadena.
--
-- private.is_service_role() decide por auth.role(), que lee request.jwt.claims.
-- Se la interroga desde el dueno de la transaccion, que si tiene usage sobre el
-- esquema private: llamarla como authenticated daria un 42501 por el esquema y
-- no probaria nada sobre la funcion.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private'
     and p.proname = 'is_service_role'
     and pg_get_function_identity_arguments(p.oid) = ''
     and p.prorettype = 'boolean'::regtype
     and p.proconfig @> array['search_path=""']),
  1,
  'private.is_service_role() existe, no toma argumentos, devuelve boolean y fija el search_path'
);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select is(
  private.is_service_role(),
  true,
  'is_service_role() reconoce al worker cuando el JWT dice service_role'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  private.is_service_role(),
  false,
  'is_service_role() no confunde a un usuario autenticado con el worker'
);

select set_config('request.jwt.claims', '{}', true);

select is(
  private.is_service_role(),
  false,
  'un JWT sin el claim role tampoco pasa por service_role'
);

-- ---------------------------------------------------------------------------
-- Bloque B. El bypass existe, y se afirma a proposito.
--
-- La demostracion se hace sobre la cola de borrado y no sobre cualquier tabla,
-- porque la cola deja el argumento cerrado: tiene RLS activo y cero politicas,
-- asi que un rol que respetara RLS veria cero filas por mas grants que tuviera.
-- Si service_role ve las dos, es por el bypass y por nada mas.
--
-- Ese es tambien el motivo por el que AGENTS.md exige validar el gym_id a mano:
-- un solo worker ve los trabajos de todos los gimnasios y la fila no es fuente
-- confiable.
--
-- El bypass no es ilimitado, y la segunda mitad del bloque lo deja escrito: en
-- este esquema service_role no recibe grants por defecto, porque config.toml
-- deja auto_expose_new_tables sin definir. Omitir RLS no sirve de nada sobre
-- una tabla que el rol no puede tocar.
-- ---------------------------------------------------------------------------

select ok(
  (select coalesce(bool_and(r.rolbypassrls), false)
   from pg_roles r
   where r.rolname = 'service_role')
  and (select coalesce(bool_and(not r.rolbypassrls), false)
       from pg_roles r
       where r.rolname = 'authenticated'),
  'service_role omite RLS por atributo del rol y authenticated no'
);

select ok(
  (select c.relrowsecurity
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'storage_deletion_queue')
  and not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'storage_deletion_queue'
  ),
  'la cola tiene RLS activo y ninguna politica: sin bypass no se lee ni una fila'
);

select ok(
  has_table_privilege('service_role', 'public.storage_deletion_queue', 'select')
    and has_table_privilege('service_role', 'public.storage_deletion_queue', 'update'),
  'service_role si tiene los grants de la cola, que es lo que vuelve util a su bypass'
);

select ok(
  not has_table_privilege('service_role', 'public.media_assets', 'select')
    and not has_table_privilege('service_role', 'public.member_payments', 'select'),
  'lo que acota el alcance de service_role es el grant, no RLS: no llega directo a las tablas del negocio'
);

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select is(
  (select count(distinct gym_id) from public.storage_deletion_queue
   where id in (
     'a4000000-0000-4000-8000-000000000011',
     'a4000000-0000-4000-8000-000000000012'
   )),
  2::bigint,
  'un worker con service_role ve trabajos de los dos gimnasios en la misma cola'
);

reset role;

-- ---------------------------------------------------------------------------
-- Bloque C. El gym_id se valida por fuera de RLS, asi que ningun bypass lo
-- esquiva.
--
-- La regla del bucket de AGENTS.md, que el primer segmento de la ruta sea el
-- gimnasio del registro, no vive en una politica sino en un trigger. Un trigger
-- no pregunta quien llama: corre igual para un rol que omite RLS. Esto es lo
-- que separa una superficie validada de una que confia en RLS y se queda sin
-- red apenas aparece service_role.
--
-- Se ejercita desde el dueno de la transaccion, que omite RLS igual que
-- service_role, y no desde service_role mismo, porque como acaba de quedar
-- asentado en el bloque B ese rol no tiene ningun grant sobre media_assets. El
-- punto de este bloque es el guarda, no el rol que lo choca.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
   from pg_trigger t
   join pg_class c on c.oid = t.tgrelid
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'media_assets'
     and t.tgname = 'trg_media_assets_validate_storage_path'
     and not t.tgisinternal),
  1,
  'la ruta de Storage la vigila un trigger de media_assets, no una politica'
);

select throws_ok(
  $$
    insert into public.media_assets (
      id, gym_id, bucket_name, object_path, mime_type, size_bytes
    ) values (
      'a4000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000001',
      'gym-media',
      '20000000-0000-4000-8000-000000000002/t4/0003.webp',
      'image/webp',
      1024
    )
  $$,
  'P0001',
  'object_path must begin with the same gym_id',
  'con RLS fuera de juego no se guarda igual un archivo del gimnasio 1 en la carpeta del gimnasio 2'
);

-- Control positivo. Sin el, el rechazo de arriba podria venir de cualquier otra
-- cosa, por ejemplo de una columna obligatoria vacia, y no probaria nada sobre
-- el gym_id.
select lives_ok(
  $$
    insert into public.media_assets (
      id, gym_id, bucket_name, object_path, mime_type, size_bytes
    ) values (
      'a4000000-0000-4000-8000-000000000004',
      '20000000-0000-4000-8000-000000000001',
      'gym-media',
      '20000000-0000-4000-8000-000000000001/t4/0004.webp',
      'image/webp',
      1024
    )
  $$,
  'el mismo archivo con la ruta de su propio gimnasio si se guarda'
);

select throws_ok(
  $$
    update public.media_assets
    set object_path = '20000000-0000-4000-8000-000000000002/t4/0004.webp'
    where id = 'a4000000-0000-4000-8000-000000000004'
  $$,
  'P0001',
  'object_path must begin with the same gym_id',
  'tampoco se puede mudar un archivo ya guardado a la carpeta de otro gimnasio'
);

-- ---------------------------------------------------------------------------
-- Bloque D. Ningun autenticado alcanza las superficies de service_role.
--
-- Hay dos cerraduras distintas y conviene no confundirlas. La primera es el
-- grant: las tres RPC de la cola solo tienen execute para service_role, y un
-- llamador autenticado se estrella ahi con 42501. Esa cerradura ya esta
-- congelada de forma estatica en storage_deletion_queue_contract.sql, asi que
-- aca se la ejercita una sola vez, para ver el rechazo de verdad y no en el
-- catalogo.
--
-- La segunda cerradura es el chequeo de is_service_role() adentro de cada
-- funcion, y no hay forma de observarla mientras el grant rechaza primero. Se
-- la aisla al reves: se toma el rol de PostgreSQL service_role, que si tiene el
-- grant, y se le da un JWT de usuario comun. Si la funcion se apoyara solo en el
-- grant, el llamado pasaria.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$ select * from public.claim_storage_deletion_jobs(1) $$,
  '42501',
  null,
  'un usuario autenticado comun ni siquiera tiene permiso de ejecucion sobre el reclamo de la cola'
);

reset role;

set local role service_role;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$ select * from public.claim_storage_deletion_jobs(1) $$,
  'P0001',
  'service_role is required',
  'reclamar trabajos exige un JWT de service_role, no alcanza con tener el grant'
);

select throws_ok(
  $$ select public.complete_storage_deletion_job(
       'a4000000-0000-4000-8000-000000000011'
     ) $$,
  'P0001',
  'service_role is required',
  'completar un trabajo exige un JWT de service_role, no alcanza con tener el grant'
);

select throws_ok(
  $$ select public.fail_storage_deletion_job(
       'a4000000-0000-4000-8000-000000000011',
       'intento desde un JWT que no es del worker',
       300
     ) $$,
  'P0001',
  'service_role is required',
  'fallar un trabajo exige un JWT de service_role, no alcanza con tener el grant'
);

reset role;
select set_config('request.jwt.claims', '{}', true);

-- ---------------------------------------------------------------------------
-- Bloque E. Una superficie compartida que recibe el gym_id por parametro.
--
-- generate_membership_charges es de las pocas RPC que aceptan tanto a un
-- usuario con memberships.manage como a service_role. Para el usuario, el
-- gym_id lo acota has_permission. Para service_role ese chequeo se saltea
-- entero, y lo unico que queda acotando el alcance es el filtro por gym_id
-- adentro de la propia consulta. Eso es, literalmente, la validacion manual del
-- gym_id que exige AGENTS.md, y es lo que se prueba aca.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.generate_membership_charges(
      '20000000-0000-4000-8000-000000000001',
      current_date
    )
  $$,
  'P0001',
  'Insufficient permission',
  'el dueno del gimnasio 2 no puede generar cargos del gimnasio 1'
);

reset role;

-- Fotos previas, tomadas como dueno de la transaccion para que ninguna politica
-- recorte el conteo.
select set_config(
  'test.t4_cargos_gimnasio_1',
  (select count(*)::text
   from public.membership_charges mc
   join public.gym_members gm on gm.id = mc.gym_member_id
   where gm.gym_id = '20000000-0000-4000-8000-000000000001'),
  true
);

select set_config(
  'test.t4_cargos_gimnasio_2',
  (select count(*)::text
   from public.membership_charges mc
   join public.gym_members gm on gm.id = mc.gym_member_id
   where gm.gym_id = '20000000-0000-4000-8000-000000000002'),
  true
);

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select public.generate_membership_charges(
  '20000000-0000-4000-8000-000000000001',
  current_date
);

reset role;
select set_config('request.jwt.claims', '{}', true);

select is(
  (select count(*)
   from public.membership_charges mc
   join public.gym_members gm on gm.id = mc.gym_member_id
   where gm.gym_id = '20000000-0000-4000-8000-000000000002'),
  current_setting('test.t4_cargos_gimnasio_2')::bigint,
  'generar cargos del gimnasio 1 con service_role no crea ni un cargo en el gimnasio 2'
);

-- Control positivo. Sin el, el conteo intacto del gimnasio 2 tambien lo daria
-- una corrida que no hizo absolutamente nada.
select ok(
  (select count(*)
   from public.membership_charges mc
   join public.gym_members gm on gm.id = mc.gym_member_id
   where gm.gym_id = '20000000-0000-4000-8000-000000000001')
  > current_setting('test.t4_cargos_gimnasio_1')::bigint,
  'esa misma llamada si genero cargos en el gimnasio 1'
);

select * from finish();

rollback;
