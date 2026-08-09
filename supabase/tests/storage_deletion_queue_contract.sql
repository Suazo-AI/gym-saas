begin;

select plan(26);

-- W2. Contrato de la cola de borrado de Storage y de sus tres RPC.
--
-- Hallazgos que este archivo existe para cerrar:
--
--   F002  Un trabajo que queda en 'processing' nunca se vuelve a reclamar.
--         claim_storage_deletion_jobs solo mira status in ('pending','failed'),
--         asi que un worker que muere despues de reclamar deja una fuga
--         permanente y silenciosa. Agendar la cola vuelve eso sistematico.
--
--   F003  attempts se incrementa pero nada se rinde nunca.
--         fail_storage_deletion_job reprograma siempre, sin tope. Una fila
--         imposible reintenta cada cinco minutos para siempre y contamina
--         toda corrida agendada.
--
--   F004  El worker borra del bucket que declara la fila sin validarlo.
--         La mitad TypeScript de ese hallazgo vive en
--         src/app/api/jobs/storage-deletion/storage-deletion-contract.test.ts.
--         Aca se fija la mitad de base de datos: la cola solo admite objetos
--         del unico bucket del producto. public.media_assets ya lo restringe
--         con un check propio, asi que ninguna fila existente puede violarlo;
--         la cola no lo hereda y hoy acepta cualquier bucket.
--
--   F005  Cero cobertura pgTAP de la cola. Las garantias de service_role y de
--         transicion de estados no tenian ningun oraculo.
--
-- Lo que el contrato fija, y que la implementacion no puede negociar:
--
--   * Estado terminal 'dead'. Un trabajo agotado sale de la rotacion en vez de
--     reintentarse para siempre. No se reprograma y registra processed_at.
--   * Tope de cinco intentos. El quinto fallo mata el trabajo; por debajo del
--     tope el reintento sigue funcionando igual que hoy.
--   * Reclamo por bloqueo vencido. Una fila en 'processing' con locked_at
--     vencido vuelve a la rotacion; una recien bloqueada no, para no robarle
--     el trabajo a un worker vivo. El plazo exacto queda a la implementacion:
--     el contrato exige que una hora este vencida y que un minuto no lo este.
--     La intencion es quince minutos.
--   * Una fila trabada que ademas ya agoto los intentos no puede quedarse en
--     'processing' para siempre: el propio reclamo la declara muerta.
--
-- Criterio escrito por el autor del contrato antes de delegar. El ejecutor no
-- puede modificar este archivo.

-- ---------------------------------------------------------------------------
-- Datos. La cola se vacia primero para que el contrato no dependa de lo que
-- hayan dejado el seed u otra migracion: se juzga sobre filas propias y nada mas.
-- ---------------------------------------------------------------------------

delete from public.storage_deletion_queue;

insert into public.media_assets (id, gym_id, bucket_name, object_path, mime_type, size_bytes)
select
  ('a0000000-0000-4000-8000-0000000009' || lpad(n::text, 2, '0'))::uuid,
  '20000000-0000-4000-8000-000000000001',
  'gym-media',
  '20000000-0000-4000-8000-000000000001/w2/9' || lpad(n::text, 2, '0') || '.webp',
  'image/webp',
  1024
from generate_series(1, 11) as n;

-- 901  pendiente y vencida        -> se reclama
-- 902  pendiente con espera viva  -> no se reclama
-- 903  trabada, bloqueo vencido   -> F002: se recupera
-- 904  trabada, bloqueo reciente  -> worker vivo, no se toca
-- 905  trabada y agotada          -> F002 + F003: muere en el reclamo
-- 906  en curso y agotada         -> F003: el fallo la mata
-- 907  en curso bajo el tope      -> el fallo la reprograma
-- 908  en curso                   -> se completa
insert into public.storage_deletion_queue
  (id, media_asset_id, gym_id, bucket_name, object_path,
   status, attempts, available_at, locked_at, created_at)
values
  ('b0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000901',
   '20000000-0000-4000-8000-000000000001', 'gym-media',
   '20000000-0000-4000-8000-000000000001/w2/901.webp',
   'pending', 0,
   timezone('utc', now()) - interval '1 minute', null,
   timezone('utc', now()) - interval '8 minutes'),

  ('b0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000902',
   '20000000-0000-4000-8000-000000000001', 'gym-media',
   '20000000-0000-4000-8000-000000000001/w2/902.webp',
   'pending', 0,
   timezone('utc', now()) + interval '1 hour', null,
   timezone('utc', now()) - interval '7 minutes'),

  ('b0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-000000000903',
   '20000000-0000-4000-8000-000000000001', 'gym-media',
   '20000000-0000-4000-8000-000000000001/w2/903.webp',
   'processing', 1,
   timezone('utc', now()) - interval '1 hour',
   timezone('utc', now()) - interval '1 hour',
   timezone('utc', now()) - interval '6 minutes'),

  ('b0000000-0000-4000-8000-000000000904', 'a0000000-0000-4000-8000-000000000904',
   '20000000-0000-4000-8000-000000000001', 'gym-media',
   '20000000-0000-4000-8000-000000000001/w2/904.webp',
   'processing', 1,
   timezone('utc', now()) - interval '1 hour',
   timezone('utc', now()) - interval '1 minute',
   timezone('utc', now()) - interval '5 minutes'),

  ('b0000000-0000-4000-8000-000000000905', 'a0000000-0000-4000-8000-000000000905',
   '20000000-0000-4000-8000-000000000001', 'gym-media',
   '20000000-0000-4000-8000-000000000001/w2/905.webp',
   'processing', 5,
   timezone('utc', now()) - interval '1 hour',
   timezone('utc', now()) - interval '1 hour',
   timezone('utc', now()) - interval '4 minutes'),

  ('b0000000-0000-4000-8000-000000000906', 'a0000000-0000-4000-8000-000000000906',
   '20000000-0000-4000-8000-000000000001', 'gym-media',
   '20000000-0000-4000-8000-000000000001/w2/906.webp',
   'processing', 5,
   timezone('utc', now()) - interval '1 hour',
   timezone('utc', now()),
   timezone('utc', now()) - interval '3 minutes'),

  ('b0000000-0000-4000-8000-000000000907', 'a0000000-0000-4000-8000-000000000907',
   '20000000-0000-4000-8000-000000000001', 'gym-media',
   '20000000-0000-4000-8000-000000000001/w2/907.webp',
   'processing', 1,
   timezone('utc', now()) - interval '1 hour',
   timezone('utc', now()),
   timezone('utc', now()) - interval '2 minutes'),

  ('b0000000-0000-4000-8000-000000000908', 'a0000000-0000-4000-8000-000000000908',
   '20000000-0000-4000-8000-000000000001', 'gym-media',
   '20000000-0000-4000-8000-000000000001/w2/908.webp',
   'processing', 1,
   timezone('utc', now()) - interval '1 hour',
   timezone('utc', now()),
   timezone('utc', now()) - interval '1 minute');

-- ---------------------------------------------------------------------------
-- 1. Superficie: quien puede tocar la cola
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in (
       'claim_storage_deletion_jobs',
       'complete_storage_deletion_job',
       'fail_storage_deletion_job'
     )
     and p.prosecdef
     and p.proconfig @> array['search_path=""']),
  3,
  'las tres RPC de la cola son security definer con el search_path vacio'
);

select is(
  (select count(*)::integer
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   cross join unnest(array['anon', 'authenticated']) as r(rolname)
   where n.nspname = 'public'
     and p.proname in (
       'claim_storage_deletion_jobs',
       'complete_storage_deletion_job',
       'fail_storage_deletion_job'
     )
     and has_function_privilege(r.rolname, p.oid, 'EXECUTE')),
  0,
  'ni anon ni authenticated pueden ejecutar las RPC de la cola'
);

select ok(
  not has_table_privilege('anon', 'public.storage_deletion_queue', 'select')
    and not has_table_privilege('authenticated', 'public.storage_deletion_queue', 'select')
    and not has_table_privilege('authenticated', 'public.storage_deletion_queue', 'update')
    and not has_table_privilege('authenticated', 'public.storage_deletion_queue', 'insert'),
  'ni anon ni authenticated leen ni escriben la cola de borrado'
);

-- F004, mitad de base de datos. El worker corre con service_role y saltea RLS:
-- la fila no es fuente confiable. media_assets ya restringe el bucket con un
-- check propio, y la cola tiene que exigir lo mismo.
select throws_ok(
  $$
    insert into public.storage_deletion_queue
      (media_asset_id, gym_id, bucket_name, object_path, status)
    values (
      'a0000000-0000-4000-8000-000000000909',
      '20000000-0000-4000-8000-000000000001',
      'bucket-ajeno',
      '20000000-0000-4000-8000-000000000001/w2/909.webp',
      'completed'
    )
  $$,
  '23514',
  null,
  'la cola rechaza un objeto que no vive en el bucket gym-media'
);

-- ---------------------------------------------------------------------------
-- 2. Estados admitidos
-- ---------------------------------------------------------------------------

select lives_ok(
  $$
    insert into public.storage_deletion_queue
      (media_asset_id, gym_id, bucket_name, object_path, status, attempts)
    values (
      'a0000000-0000-4000-8000-000000000910',
      '20000000-0000-4000-8000-000000000001',
      'gym-media',
      '20000000-0000-4000-8000-000000000001/w2/910.webp',
      'dead',
      5
    )
  $$,
  'dead es un estado terminal admitido por la cola'
);

select throws_ok(
  $$
    insert into public.storage_deletion_queue
      (media_asset_id, gym_id, bucket_name, object_path, status)
    values (
      'a0000000-0000-4000-8000-000000000911',
      '20000000-0000-4000-8000-000000000001',
      'gym-media',
      '20000000-0000-4000-8000-000000000001/w2/911.webp',
      'inventado'
    )
  $$,
  '23514',
  null,
  'la cola sigue rechazando un estado que no existe'
);

-- ---------------------------------------------------------------------------
-- 3. Reclamo
-- ---------------------------------------------------------------------------

-- private.is_service_role() decide por auth.role(), que lee estos claims. No
-- hace falta cambiar de rol de PostgreSQL para pararse del lado del worker.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

create temp table w2_reclamo_1 as
select q.id from public.claim_storage_deletion_jobs(100) q;

select is(
  (select status from public.storage_deletion_queue
   where id = 'b0000000-0000-4000-8000-000000000901'),
  'processing',
  'el reclamo toma la fila pendiente cuya espera ya vencio'
);

select is(
  (select attempts from public.storage_deletion_queue
   where id = 'b0000000-0000-4000-8000-000000000901'),
  1,
  'el reclamo cuenta el intento'
);

select ok(
  (select locked_at is not null from public.storage_deletion_queue
   where id = 'b0000000-0000-4000-8000-000000000901'),
  'el reclamo sella el bloqueo con locked_at'
);

select is(
  (select status from public.storage_deletion_queue
   where id = 'b0000000-0000-4000-8000-000000000902'),
  'pending',
  'el reclamo no adelanta una fila cuya espera todavia no vencio'
);

-- F002: el corazon del hallazgo.
select is(
  (select attempts from public.storage_deletion_queue
   where id = 'b0000000-0000-4000-8000-000000000903'),
  2,
  'el reclamo recupera una fila trabada en processing con el bloqueo vencido'
);

select is(
  (select attempts from public.storage_deletion_queue
   where id = 'b0000000-0000-4000-8000-000000000904'),
  1,
  'el reclamo no le roba el trabajo a un worker vivo: bloqueo reciente, intacta'
);

select is(
  (select coalesce(string_agg(right(id::text, 3), ',' order by id), '(vacio)')
   from w2_reclamo_1),
  '901,903',
  'el reclamo devuelve exactamente las dos filas reclamables y ninguna otra'
);

-- F002 junto con F003: una fila trabada que ademas agoto los intentos no puede
-- quedarse en processing para siempre. El reclamo la declara muerta.
select is(
  (select status from public.storage_deletion_queue
   where id = 'b0000000-0000-4000-8000-000000000905'),
  'dead',
  'la fila trabada que ya agoto los intentos queda muerta, no en processing eterno'
);

select ok(
  (select locked_at is null from public.storage_deletion_queue
   where id = 'b0000000-0000-4000-8000-000000000905'),
  'la fila declarada muerta por el reclamo suelta su bloqueo'
);

-- ---------------------------------------------------------------------------
-- 4. Tope de intentos
-- ---------------------------------------------------------------------------

select public.fail_storage_deletion_job(
  'b0000000-0000-4000-8000-000000000906',
  'El objeto no existe y nunca va a existir.',
  300
);

select public.fail_storage_deletion_job(
  'b0000000-0000-4000-8000-000000000907',
  'Storage no respondio.',
  300
);

-- F003: el corazon del hallazgo.
select is(
  (select status from public.storage_deletion_queue
   where id = 'b0000000-0000-4000-8000-000000000906'),
  'dead',
  'fallar en el ultimo intento permitido mata el trabajo en vez de reprogramarlo'
);

select ok(
  (select available_at <= timezone('utc', now()) from public.storage_deletion_queue
   where id = 'b0000000-0000-4000-8000-000000000906'),
  'un trabajo muerto no se reprograma hacia el futuro'
);

select ok(
  (select processed_at is not null from public.storage_deletion_queue
   where id = 'b0000000-0000-4000-8000-000000000906'),
  'un trabajo muerto registra cuando se dejo de intentar'
);

select ok(
  (select last_error is not null from public.storage_deletion_queue
   where id = 'b0000000-0000-4000-8000-000000000906'),
  'un trabajo muerto conserva el motivo por el que se rindio'
);

select is(
  (select status from public.storage_deletion_queue
   where id = 'b0000000-0000-4000-8000-000000000907'),
  'failed',
  'fallar por debajo del tope sigue reprogramando el trabajo'
);

select ok(
  (select available_at > timezone('utc', now()) from public.storage_deletion_queue
   where id = 'b0000000-0000-4000-8000-000000000907'),
  'el trabajo reprogramado espera antes de volver a la rotacion'
);

-- Ninguna fila muerta vuelve nunca: ni la que mato el reclamo, ni la que mato
-- el fallo, ni la que se inserto ya muerta.
create temp table w2_reclamo_2 as
select q.id from public.claim_storage_deletion_jobs(100) q;

select is(
  (select coalesce(string_agg(right(id::text, 3), ',' order by id), '(vacio)')
   from w2_reclamo_2),
  '(vacio)',
  'un segundo reclamo no devuelve trabajos muertos, en curso ni reprogramados'
);

-- ---------------------------------------------------------------------------
-- 5. Completado
-- ---------------------------------------------------------------------------

select public.complete_storage_deletion_job('b0000000-0000-4000-8000-000000000908');

select is(
  (select status from public.storage_deletion_queue
   where id = 'b0000000-0000-4000-8000-000000000908'),
  'completed',
  'completar cierra el trabajo'
);

select ok(
  (select storage_deleted_at is not null from public.media_assets
   where id = 'a0000000-0000-4000-8000-000000000908'),
  'completar sella el objeto en media_assets'
);

select throws_ok(
  $$select public.complete_storage_deletion_job('b0000000-0000-4000-8000-000000000902')$$,
  'P0001',
  'Processing Storage deletion job not found',
  'no se puede completar un trabajo que no esta en curso'
);

select throws_ok(
  $$select public.fail_storage_deletion_job(
      'b0000000-0000-4000-8000-000000000906',
      'ya estaba muerto',
      300
    )$$,
  'P0001',
  'Processing Storage deletion job not found',
  'no se puede fallar un trabajo que ya salio de la rotacion'
);

select * from finish();

rollback;
