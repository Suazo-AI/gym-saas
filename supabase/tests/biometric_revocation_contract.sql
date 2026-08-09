begin;

select plan(12);

-- W1. Hoy ningun archivo de src/ encola un borrado de Storage: la unica via es
-- soft_delete_entity('media_asset', ...) y nadie la llama con esa entidad. La
-- consecuencia es que una fotografia biometrica no tiene forma de morir, y
-- AGENTS.md promete que el consentimiento se puede revocar con retencion.
--
-- Este contrato fija un unico punto de estrangulamiento,
-- public.revoke_biometric_consent, y los tres caminos que deben llegar a el:
--   F001  revocacion explicita del consentimiento
--   F011  baja del socio
--   F006  cancelacion de la ultima membresia vigente
--
-- La RPC exige faces.manage y no debe depender de que quien la llama tenga
-- ademas media.manage: corre con security definer y hace el encolado ella
-- misma.
--
-- Criterio escrito por el autor del contrato antes de delegar. El ejecutor no
-- puede modificar este archivo.

insert into public.persons (id, first_name, last_name, created_by)
values
  ('50000000-0000-4000-8000-000000000501', 'Revoca', 'Explicita', '00000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000502', 'Control', 'Intacto', '00000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000503', 'Baja', 'Socio', '00000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000504', 'Cancela', 'Membresia', '00000000-0000-4000-8000-000000000001');

insert into public.gym_members (
  id, gym_id, person_id, home_branch_id, member_code, status, joined_on, created_by
)
values
  ('60000000-0000-4000-8000-000000000501', '20000000-0000-4000-8000-000000000001',
   '50000000-0000-4000-8000-000000000501', '30000000-0000-4000-8000-000000000001',
   'M-W1-REVOCA', 'active', current_date, '00000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000502', '20000000-0000-4000-8000-000000000001',
   '50000000-0000-4000-8000-000000000502', '30000000-0000-4000-8000-000000000001',
   'M-W1-CONTROL', 'active', current_date, '00000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000503', '20000000-0000-4000-8000-000000000001',
   '50000000-0000-4000-8000-000000000503', '30000000-0000-4000-8000-000000000001',
   'M-W1-BAJA', 'active', current_date, '00000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000504', '20000000-0000-4000-8000-000000000001',
   '50000000-0000-4000-8000-000000000504', '30000000-0000-4000-8000-000000000001',
   'M-W1-CANCELA', 'active', current_date, '00000000-0000-4000-8000-000000000001');

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  v_vector extensions.vector(128) := (
    '[' || pg_catalog.array_to_string(pg_catalog.array_fill(0.1::real, array[128]), ',') || ']'
  )::extensions.vector(128);
  v_member uuid;
begin
  -- Cuatro socios enrolados por el camino real, no por inserts a mano: si el
  -- enrolamiento cambia, este contrato se entera.
  foreach v_member in array array[
    '60000000-0000-4000-8000-000000000501'::uuid,
    '60000000-0000-4000-8000-000000000502'::uuid,
    '60000000-0000-4000-8000-000000000503'::uuid,
    '60000000-0000-4000-8000-000000000504'::uuid
  ]
  loop
    perform public.enroll_member_face(
      p_gym_id => '20000000-0000-4000-8000-000000000001',
      p_gym_member_id => v_member,
      p_object_path => '20000000-0000-4000-8000-000000000001/members/'
        || v_member::text || '/rostro.webp',
      p_mime_type => 'image/webp',
      p_size_bytes => 2048,
      p_embedding => v_vector
    );
  end loop;

end;
$$;

-- La llamada directa va en su propio bloque y tolera que la funcion todavia no
-- exista: sin esto, la corrida en rojo aborta el archivo entero y las
-- aserciones de la baja y de la cancelacion nunca llegan a evaluarse.
do $$
begin
  -- Camino 1: revocacion explicita. Llamada dos veces para exigir idempotencia.
  perform public.revoke_biometric_consent(
    '20000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000501',
    'El socio retiro su consentimiento.'
  );
  perform public.revoke_biometric_consent(
    '20000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000501',
    'Segunda llamada, no debe duplicar nada.'
  );
exception
  when undefined_function then null;
end;
$$;

do $$
begin
  -- Camino 2: baja del socio.
  perform public.soft_delete_entity(
    'gym_member', '60000000-0000-4000-8000-000000000503', 'Se dio de baja.'
  );

  -- Camino 3: cancelacion de la unica membresia vigente.
  perform public.assign_member_subscription(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000504',
    '40000000-0000-4000-8000-000000000001',
    current_date, null, null, null, true, true
  );
  perform public.cancel_member_subscription(
    (select ms.id from public.member_subscriptions ms
     where ms.gym_member_id = '60000000-0000-4000-8000-000000000504'
     order by ms.created_at desc limit 1),
    'El socio se va del gimnasio.',
    false
  );
end;
$$;

reset role;

-- Se busca por nombre y aridad en pg_proc, no por regprocedure: el cast de una
-- firma inexistente lanza excepcion y tumbaria el archivo entero en la corrida
-- en rojo, en vez de dejar fallar la asercion.
select is(
  (select p.prosecdef
   from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'revoke_biometric_consent'
     and p.pronargs = 3),
  true,
  'revoke_biometric_consent corre con security definer'
);

select ok(
  (select p.proconfig
   from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'revoke_biometric_consent'
     and p.pronargs = 3)
    @> array['search_path=""'],
  'revoke_biometric_consent fija un search_path vacio'
);

select ok(
  exists (
    select 1 from public.media_assets ma
    where ma.owner_person_id = '50000000-0000-4000-8000-000000000501'
      and ma.deleted_at is not null
  ),
  'revocar borra logicamente el registro del archivo, que es lo que encola'
);

select is(
  (select bc.status::text from public.biometric_consents bc
   where bc.person_id = '50000000-0000-4000-8000-000000000501'
   order by bc.obtained_at desc limit 1),
  'revoked',
  'la revocacion deja el consentimiento en revoked'
);

select ok(
  (select bc.revoked_at from public.biometric_consents bc
   where bc.person_id = '50000000-0000-4000-8000-000000000501'
   order by bc.obtained_at desc limit 1) is not null,
  'la revocacion sella la fecha en que ocurrio'
);

select ok(
  not exists (
    select 1 from public.face_embeddings fe
    where fe.person_id = '50000000-0000-4000-8000-000000000501' and fe.is_active
  ),
  'revocar desactiva los embeddings de la persona'
);

select ok(
  exists (
    select 1 from public.person_photos pp
    where pp.person_id = '50000000-0000-4000-8000-000000000501'
      and pp.deleted_at is not null
  ),
  'revocar borra logicamente la fotografia de la persona'
);

select is(
  (select count(*)::integer
   from public.storage_deletion_queue q
   join public.media_assets ma on ma.id = q.media_asset_id
   where ma.owner_person_id = '50000000-0000-4000-8000-000000000501'),
  1,
  'revocar encola el objeto de Storage una sola vez, aunque se llame dos veces'
);

select is(
  (select q.status
   from public.storage_deletion_queue q
   join public.media_assets ma on ma.id = q.media_asset_id
   where ma.owner_person_id = '50000000-0000-4000-8000-000000000501'
   limit 1),
  'pending',
  'el trabajo encolado queda pendiente de que lo tome el worker'
);

select ok(
  exists (
    select 1
    from public.storage_deletion_queue q
    join public.media_assets ma on ma.id = q.media_asset_id
    where ma.owner_person_id = '50000000-0000-4000-8000-000000000503'
  ),
  'dar de baja al socio encola su fotografia biometrica'
);

select ok(
  exists (
    select 1
    from public.storage_deletion_queue q
    join public.media_assets ma on ma.id = q.media_asset_id
    where ma.owner_person_id = '50000000-0000-4000-8000-000000000504'
  ),
  'cancelar la ultima membresia vigente encola su fotografia biometrica'
);

select ok(
  not exists (
    select 1
    from public.storage_deletion_queue q
    join public.media_assets ma on ma.id = q.media_asset_id
    where ma.owner_person_id = '50000000-0000-4000-8000-000000000502'
  ),
  'el socio que no fue tocado conserva su fotografia'
);

select * from finish();

rollback;
