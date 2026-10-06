-- ============================================================================
-- Biometria del ambiente de DEMOSTRACION.
--
-- ADVERTENCIA, LEER ANTES DE MOSTRAR ESTO A ALGUIEN:
--
--   Los embeddings que crea este archivo son numeros al azar. No salieron de
--   ninguna cara. Sirven para que el panel muestre "72 socios con cara
--   registrada", para que el indice HNSW tenga con que trabajar y para que
--   match_face_candidates devuelva algo.
--
--   NO reconocen a nadie. Si abris la pantalla de acceso facial y te parás
--   frente a la camara, el sistema va a responder "no reconocido", y va a
--   estar en lo cierto: tu cara no esta en esta tabla.
--
--   Para probar el reconocimiento de verdad hacen falta fotos de caras reales
--   o generadas, pasadas por el servicio de Render, que es el unico que
--   produce un embedding que significa algo.
--
--   Cada fila queda marcada con quality_score = 0.111 y el consentimiento
--   lleva consent_version 'DEMO-SINTETICO'. Es a proposito: cualquiera que
--   mire la tabla tiene que poder darse cuenta de que esto no es biometria.
--
-- Depende de seed-demo.sql. Correr despues.
-- ============================================================================

begin;

do $faces$
declare
  v_gym    uuid := 'a2000000-0000-4000-8000-000000000001';
  v_owner  uuid := 'a0000000-0000-4000-8000-000000000001';
  v_model  uuid;
  v_dims   int;
  r        record;
  v_asset  uuid;
  v_photo  uuid;
  v_vec    extensions.vector;
begin
  select id, vector_dimensions into v_model, v_dims
  from public.face_models
  where code = 'opencv-sface' and is_active
  order by created_at desc
  limit 1;

  if v_model is null then
    raise exception 'seed-demo-faces: no hay un modelo facial activo';
  end if;

  if exists (select 1 from public.face_embeddings where gym_id = v_gym) then
    raise notice 'seed-demo-faces: ya existen embeddings, no se vuelve a generar';
    return;
  end if;

  -- Solo los socios activos. Un inactivo o un prospecto no tiene por que
  -- tener biometria guardada: es justamente el dato que hay que borrar antes.
  for r in
    select gm.id as member_id, gm.person_id, gm.member_code
    from public.gym_members gm
    where gm.gym_id = v_gym
      and gm.status = 'active'
    order by gm.member_code
  loop
    insert into public.biometric_consents (
      gym_id, person_id, status, purpose, consent_version,
      obtained_by, obtained_at, retention_until
    )
    values (
      v_gym, r.person_id, 'granted', 'gym_access_verification',
      'DEMO-SINTETICO',
      v_owner,
      timezone('utc', now()) - interval '30 days',
      timezone('utc', now()) + interval '2 years'
    );

    v_asset := extensions.gen_random_uuid();

    insert into public.media_assets (
      id, gym_id, owner_person_id, bucket_name, object_path,
      original_filename, mime_type, compression_codec,
      width_pixels, height_pixels, size_bytes, created_by
    )
    values (
      v_asset, v_gym, r.person_id, 'gym-media',
      v_gym::text || '/' || r.person_id::text || '/' || v_asset::text || '.webp',
      r.member_code || '.webp', 'image/webp', 'webp',
      512, 512, 48000, v_owner
    );

    v_photo := extensions.gen_random_uuid();

    insert into public.person_photos (
      id, gym_id, person_id, media_asset_id, purpose, is_primary, captured_at
    )
    values (
      v_photo, v_gym, r.person_id, v_asset, 'face_enrollment', true,
      timezone('utc', now()) - interval '30 days'
    );

    -- Vector al azar, normalizado a norma 1 como los que devuelve SFace.
    -- Dos vectores al azar de 128 dimensiones son casi perpendiculares, asi
    -- que la similitud entre dos socios cualesquiera ronda 0 y nunca alcanza
    -- el umbral de 0.363. Traducido: esta tabla no produce falsos positivos
    -- porque no produce ningun positivo.
    select (
      '[' || string_agg(to_char(v / n, 'FM0.999999999'), ',') || ']'
    )::extensions.vector
    into v_vec
    from (
      select
        val as v,
        sqrt(sum(val * val) over ()) as n
      from (
        select random() - 0.5 as val
        from generate_series(1, v_dims)
      ) raw
    ) norm;

    insert into public.face_embeddings (
      gym_id, person_id, person_photo_id, face_model_id,
      embedding, quality_score, is_active
    )
    values (
      v_gym, r.person_id, v_photo, v_model,
      v_vec,
      0.111,
      true
    );
  end loop;

  raise notice 'seed-demo-faces: biometria sintetica generada';
end;
$faces$;

commit;
