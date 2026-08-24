-- Aislamiento multi-tenant en los archivos.
-- Tarjeta "Pruebas de aislamiento multi-tenant", item "Intentar acceder a
-- archivos de otro gimnasio".
--
-- Por que se prueba storage.objects y no una ruta del producto: hoy no existe
-- ningun camino de lectura de archivos en la aplicacion. No hay createSignedUrl,
-- ni getPublicUrl, ni download en todo src/. La unica escritura es la del alta
-- facial, y usa el cliente de clave publica, no service_role. O sea que el
-- control real de quien toca un archivo son las cuatro politicas de RLS sobre
-- storage.objects que instala 20260716010100_storage_only.sql, y eso es lo que
-- este archivo mide.
--
-- Las cuatro politicas deciden por el primer segmento de la ruta:
--   <gym_id>/<person_id-o-general>/<uuid>.<extension>
-- select pide media.read; insert, update y delete piden media.manage.
--
-- La trampa de este archivo es la misma que la de tenant_isolation_mutation:
-- un update o un delete contra una fila que RLS hace invisible no lanza
-- ninguna excepcion, afecta cero filas y sigue de largo. Por eso cada caso
-- hostil tiene dos mitades:
--   1. contar las filas que la sentencia afecto y exigir cero;
--   2. releer la fila con el dueno 1, que si la ve, y exigir que siga igual.
-- Sin la segunda mitad, un cero podria venir de una fila que nunca existio.
--
-- Supabase protege storage.objects con el trigger protect_objects_delete y
-- rechaza todo DELETE SQL antes de que RLS pueda decidir. La Storage API abre
-- ese paso con storage.allow_delete_query. Este archivo hace lo mismo solo
-- dentro de su transaccion, para medir la politica de delete que la API usa.
--
-- El bloque de control positivo tampoco es decorado: si la sesion del dueno 2
-- estuviera rota, o si storage.objects no existiera, todos los ceros saldrian
-- solos y no probarian nada.
--
-- Los dos ultimos bloques cubren rutas malformadas. Una ruta cuyo primer
-- segmento no es UUID debe denegarse sin lanzar 22P02. Incluso si service_role
-- deja una fila vieja malformada en el bucket, esa fila debe quedar invisible
-- para authenticated sin romper la lectura de las rutas validas.
--
-- Identidades del seed:
--   gimnasio 1 20000000-0000-4000-8000-000000000001  Impulso Fitness
--   gimnasio 2 20000000-0000-4000-8000-000000000002  Norte Gym
--   dueno 1    00000000-0000-4000-8000-000000000001
--   dueno 2    00000000-0000-4000-8000-000000000002
-- Los dos tienen el rol owner de su gimnasio, o sea el catalogo completo de
-- permisos, media.read y media.manage incluidos. Lo unico que los separa es el
-- gimnasio.
--
-- Fixtures propios de este archivo: prefijo a6000000-.
-- En storage.objects se llenan solo id, bucket_id, name y metadata: lo minimo
-- indispensable mas el unico valor que despues se relee. El resto de las
-- columnas de esa tabla quedan con el default que les pone Supabase, porque la
-- tabla es del esquema storage y no la crea ninguna migracion de este
-- repositorio.

begin;

select plan(25);

-- ---------------------------------------------------------------------------
-- Fixtures de metadatos. public.media_assets guarda la referencia al archivo,
-- no el archivo. Se cargan como dueno de la transaccion, nunca como el usuario
-- que despues se pone a prueba.
-- ---------------------------------------------------------------------------

insert into public.media_assets (
  id, gym_id, bucket_name, object_path, mime_type, size_bytes
)
values
  (
    'a6000000-0000-4000-8000-000000000011',
    '20000000-0000-4000-8000-000000000001',
    'gym-media',
    '20000000-0000-4000-8000-000000000001/general/a6000000-0000-4000-8000-000000000001.webp',
    'image/webp',
    2048
  ),
  (
    'a6000000-0000-4000-8000-000000000012',
    '20000000-0000-4000-8000-000000000002',
    'gym-media',
    '20000000-0000-4000-8000-000000000002/general/a6000000-0000-4000-8000-000000000002.webp',
    'image/webp',
    2048
  );

-- ---------------------------------------------------------------------------
-- Bloque A. Quien rechaza que.
-- Sin este mapa un cero no distingue "lo filtro la politica" de "no hay grant"
-- ni de "la tabla no esta". Las cuatro operaciones siguen concedidas a
-- authenticated, asi que el unico que puede filtrar es RLS, y por eso el
-- rechazo del update y del delete va a ser silencioso.
-- ---------------------------------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'storage.objects', 'select')
    and has_table_privilege('authenticated', 'storage.objects', 'insert')
    and has_table_privilege('authenticated', 'storage.objects', 'update')
    and has_table_privilege('authenticated', 'storage.objects', 'delete'),
  'authenticated conserva los cuatro grants sobre storage.objects: quien filtra es RLS y no el privilegio'
);

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage'
      and c.relname = 'objects'
  ),
  'storage.objects tiene RLS activo: sin eso las cuatro politicas no filtrarian nada'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'gym media select',
        'gym media insert',
        'gym media update',
        'gym media delete'
      )
  ),
  4::bigint,
  'las cuatro politicas de gym-media siguen instaladas sobre storage.objects'
);

-- ---------------------------------------------------------------------------
-- Bloque B. El archivo del gimnasio 1, creado por su propio dueno.
-- Se carga pasando por la politica y no por atajo: asi el fixture prueba de
-- paso que el insert legitimo funciona, y el objetivo del cruce existe de
-- verdad antes de que el dueno 2 lo intente tocar.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

with propio as (
  insert into storage.objects (id, bucket_id, name, metadata)
  values (
    'a6000000-0000-4000-8000-000000000001',
    'gym-media',
    '20000000-0000-4000-8000-000000000001/general/a6000000-0000-4000-8000-000000000001.webp',
    '{"marca": "A6-ORIGINAL"}'::jsonb
  )
  returning 1 as tocada
)
select is(
  count(*),
  1::bigint,
  'el dueno 1 sube un archivo a la carpeta de su propio gimnasio'
)
from propio;

-- ---------------------------------------------------------------------------
-- Bloque C. Control positivo: el dueno 2 hace las cuatro operaciones sobre su
-- propia carpeta. Es el bloque que le da sentido a todos los ceros que vienen
-- despues.
-- ---------------------------------------------------------------------------

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

with propios as (
  insert into storage.objects (id, bucket_id, name, metadata)
  values
    (
      'a6000000-0000-4000-8000-000000000002',
      'gym-media',
      '20000000-0000-4000-8000-000000000002/general/a6000000-0000-4000-8000-000000000002.webp',
      '{"marca": "A6-G2"}'::jsonb
    ),
    (
      'a6000000-0000-4000-8000-000000000003',
      'gym-media',
      '20000000-0000-4000-8000-000000000002/general/a6000000-0000-4000-8000-000000000003.webp',
      '{"marca": "A6-G2"}'::jsonb
    )
  returning 1 as tocada
)
select is(
  count(*),
  2::bigint,
  'el dueno 2 sube archivos a la carpeta de su propio gimnasio'
)
from propios;

select is(
  (
    select count(*)
    from storage.objects
    where name like '20000000-0000-4000-8000-000000000002/%'
  ),
  2::bigint,
  'el dueno 2 lee los dos archivos de su propia carpeta'
);

with propio as (
  update storage.objects
     set metadata = '{"marca": "A6-LEGIT"}'::jsonb
   where id = 'a6000000-0000-4000-8000-000000000002'
  returning 1 as tocada
)
select is(
  count(*),
  1::bigint,
  'el dueno 2 modifica un archivo de su propio gimnasio'
)
from propio;

-- Contar filas afectadas no alcanza ni siquiera del lado legitimo: hay que ver
-- el valor nuevo ya escrito.
select is(
  (
    select metadata->>'marca'
    from storage.objects
    where id = 'a6000000-0000-4000-8000-000000000002'
  ),
  'A6-LEGIT'::text,
  'la modificacion propia quedo efectivamente escrita'
);

select set_config('storage.allow_delete_query', 'true', true);

with propio as (
  delete from storage.objects
   where id = 'a6000000-0000-4000-8000-000000000003'
  returning 1 as tocada
)
select is(
  count(*),
  1::bigint,
  'el dueno 2 borra un archivo de su propio gimnasio'
)
from propio;

select is(
  (
    select count(*)
    from storage.objects
    where id = 'a6000000-0000-4000-8000-000000000003'
  ),
  0::bigint,
  'el archivo que borro su propio dueno ya no esta'
);

-- ---------------------------------------------------------------------------
-- Bloque D. El caso hostil. Misma sesion del dueno 2, ahora contra la carpeta
-- del gimnasio 1. El update y el delete no lanzan nada: el aislamiento se ve
-- en el cero, y recien se completa en el bloque F.
-- ---------------------------------------------------------------------------

select is(
  (
    select count(*)
    from storage.objects
    where name like '20000000-0000-4000-8000-000000000001/%'
  ),
  0::bigint,
  'el dueno 2 no lee ningun archivo de la carpeta del gimnasio 1'
);

select throws_ok(
  $$
    insert into storage.objects (id, bucket_id, name)
    values (
      'a6000000-0000-4000-8000-000000000006',
      'gym-media',
      '20000000-0000-4000-8000-000000000001/general/a6000000-0000-4000-8000-000000000006.webp'
    )
  $$,
  '42501',
  null,
  'el dueno 2 no puede subir un archivo a la carpeta del gimnasio 1'
);

with cruzado as (
  update storage.objects
     set metadata = '{"marca": "A6-CRUZADO"}'::jsonb
   where id = 'a6000000-0000-4000-8000-000000000001'
  returning 1 as tocada
)
select is(
  count(*),
  0::bigint,
  'el dueno 2 no modifica ningun archivo del gimnasio 1, y sin error'
)
from cruzado;

with cruzado as (
  delete from storage.objects
   where id = 'a6000000-0000-4000-8000-000000000001'
  returning 1 as tocada
)
select is(
  count(*),
  0::bigint,
  'el dueno 2 no borra ningun archivo del gimnasio 1, y sin error'
)
from cruzado;

select set_config('storage.allow_delete_query', 'false', true);

-- La otra direccion: mudar un archivo propio a la carpeta del gimnasio 1. Aca
-- el using pasa, porque la fila vieja es suya, y quien rechaza es el with check
-- sobre la ruta nueva. Ese rechazo si es una excepcion.
select throws_ok(
  $$
    update storage.objects
       set name = '20000000-0000-4000-8000-000000000001/general/a6000000-0000-4000-8000-000000000002.webp'
     where id = 'a6000000-0000-4000-8000-000000000002'
  $$,
  '42501',
  null,
  'el dueno 2 no puede mudar un archivo suyo a la carpeta del gimnasio 1'
);

-- El metadato tambien es parte del archivo: si se filtrara, el dueno 2 sabria
-- la ruta exacta del objeto ajeno.
select is(
  (
    select count(*)
    from public.media_assets
    where id = 'a6000000-0000-4000-8000-000000000011'
  ),
  0::bigint,
  'el dueno 2 tampoco ve la fila de media_assets del gimnasio 1'
);

-- ---------------------------------------------------------------------------
-- Bloque E. El borde de la ruta, todavia como dueno 2.
-- Las dos rutas son invalidas y ninguna debe entrar. Ambas se deniegan limpio
-- con 42501. Una ruta malformada nunca debe filtrar un 22P02 desde la politica.
-- Ninguna de las dos crea filas, asi que este bloque no ensucia los anteriores.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$
    insert into storage.objects (id, bucket_id, name)
    values (
      'a6000000-0000-4000-8000-000000000004',
      'gym-media',
      'no-es-uuid/a6000000-0000-4000-8000-000000000004.webp'
    )
  $$,
  '42501',
  null,
  'una ruta con primer segmento que no es UUID se deniega sin romper la politica'
);

select throws_ok(
  $$
    insert into storage.objects (id, bucket_id, name)
    values (
      'a6000000-0000-4000-8000-000000000005',
      'gym-media',
      'a6000000-0000-4000-8000-000000000005.webp'
    )
  $$,
  '42501',
  null,
  'una ruta sin ninguna carpeta si se deniega limpio, por el guardia is not null del insert'
);

-- ---------------------------------------------------------------------------
-- Bloque F. La segunda mitad, y la que convierte los ceros en prueba.
-- Se cambia de identidad al dueno 1, que si ve lo suyo, y se exige que siga
-- igual. Un cero mas una fila intacta si es aislamiento; un cero solo podria
-- ser una fila que nunca existio.
-- ---------------------------------------------------------------------------

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (
    select metadata->>'marca'
    from storage.objects
    where id = 'a6000000-0000-4000-8000-000000000001'
  ),
  'A6-ORIGINAL'::text,
  'el archivo del gimnasio 1 conserva su metadata original'
);

select is(
  (
    select count(*)
    from storage.objects
    where name like '20000000-0000-4000-8000-000000000001/%'
  ),
  1::bigint,
  'el archivo del gimnasio 1 sigue en su carpeta, o sea que el delete cruzado no lo alcanzo'
);

select is(
  (
    select count(*)
    from public.media_assets
    where id = 'a6000000-0000-4000-8000-000000000011'
  ),
  1::bigint,
  'la fila de media_assets del gimnasio 1 si la ve su propio dueno'
);

-- ---------------------------------------------------------------------------
-- Bloque G. Defensa ante una fila heredada con ruta malformada.
-- service_role omite RLS por atributo del rol, asi que puede dejar en el bucket
-- una ruta que ninguna politica habria aceptado. Con esa fila adentro, la
-- politica de select debe ignorarla y seguir mostrando las rutas validas del
-- gimnasio autenticado. Una fila ajena no puede romper la consulta completa.
--
-- El insert va con lives_ok a proposito: si algun dia service_role perdiera el
-- grant sobre storage.objects, esto tiene que salir rojo con su diagnostico y
-- no abortar el archivo entero.
-- ---------------------------------------------------------------------------

reset role;

set local role service_role;

select lives_ok(
  $$
    insert into storage.objects (id, bucket_id, name)
    values (
      'a6000000-0000-4000-8000-000000000004',
      'gym-media',
      'no-es-uuid/a6000000-0000-4000-8000-000000000004.webp'
    )
  $$,
  'service_role si deja una ruta malformada en el bucket, porque omite RLS'
);

select is(
  (
    select count(*)
    from storage.objects
    where id in (
      'a6000000-0000-4000-8000-000000000001',
      'a6000000-0000-4000-8000-000000000002',
      'a6000000-0000-4000-8000-000000000004'
    )
  ),
  3::bigint,
  'service_role lee las tres filas, la malformada incluida, porque no evalua la politica'
);

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select lives_ok(
  $$ select count(*) from storage.objects $$,
  'una ruta malformada heredada no rompe la lectura de un inquilino'
);

select is(
  (select count(*) from storage.objects),
  1::bigint,
  'el dueno 2 ve su ruta valida y la ruta malformada queda invisible'
);

reset role;
select set_config('request.jwt.claims', '{}', true);

select * from finish();

rollback;
