begin;

select plan(15);

-- R-sec-a. Tres superficies de escritura que hoy estan abiertas de mas, mas el
-- catalogo de pantallas, que ofrece lo que no existe y esconde lo que si.
--
--   F013  RLS permite escribir directo en face_embeddings y biometric_consents
--         con faces.manage. Desde PostgREST se insertan templates y se otorgan
--         consentimientos propios, sin foto y sin auditoria. Las cuatro RPC
--         biometricas son security definer, asi que restringir estas politicas
--         no rompe ningun camino legitimo: se verifico en pg_proc y ningun
--         archivo de src/ escribe a esas tablas por PostgREST.
--
--   F034  El catalogo inserta /roles, /billing y /audit, que no tienen ruta en
--         src/app. El dueno cree conceder una pantalla y en realidad concede
--         roles.manage, que reconfigura todos los roles desde /staff.
--
--   F037  start_member_subscription esta concedida a authenticated y no tiene
--         un solo llamador en src/. Superficie de escritura viva que crea
--         suscripcion, cargo, pago y auditoria sin que ningun flujo la use.
--
--   Ademas, el espejo de F034, que no estaba en el ledger: facial_access esta
--   desactivada en el catalogo aunque el modulo este implementado y mergeado,
--   asi que el acceso facial no se le puede conceder a nadie desde la matriz
--   de roles.
--
-- Criterio escrito por el autor del contrato antes de delegar. El ejecutor no
-- puede modificar este archivo.

-- ---------------------------------------------------------------------------
-- F013. Escritura biometrica solo desde funciones confiables
-- ---------------------------------------------------------------------------

-- owner1 tiene los 26 permisos del gimnasio 1, faces.manage incluido. Si
-- alguien puede escribir directo, es el.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$
    insert into public.biometric_consents (gym_id, person_id, granted_at, status)
    values (
      '20000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      timezone('utc', now()),
      'granted'
    )
  $$,
  '42501',
  null,
  'faces.manage ya no alcanza para otorgarse un consentimiento a mano'
);

select throws_ok(
  $$
    update public.biometric_consents
    set status = 'granted'
    where gym_id = '20000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  null,
  'faces.manage ya no alcanza para revivir un consentimiento a mano'
);

select throws_ok(
  $$
    delete from public.biometric_consents
    where gym_id = '20000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  null,
  'un consentimiento biometrico no se borra desde PostgREST'
);

select throws_ok(
  $$
    update public.face_embeddings
    set is_active = true
    where gym_id = '20000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  null,
  'faces.manage ya no alcanza para reactivar un template a mano'
);

select throws_ok(
  $$
    delete from public.face_embeddings
    where gym_id = '20000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  null,
  'un template facial no se borra desde PostgREST'
);

-- La lectura no se toca: la revision manual de casos dudosos la necesita.
select lives_ok(
  $$select count(*) from public.biometric_consents
    where gym_id = '20000000-0000-4000-8000-000000000001'$$,
  'faces.read sigue viendo los consentimientos de su gimnasio'
);

select lives_ok(
  $$select count(*) from public.face_embeddings
    where gym_id = '20000000-0000-4000-8000-000000000001'$$,
  'faces.read sigue viendo los templates de su gimnasio'
);

reset role;

-- El camino legitimo tiene que seguir funcionando. Si esta asercion se cae, la
-- restriccion se llevo puesto el enrolamiento y no sirve.
select lives_ok(
  $$
    select public.enroll_member_face(
      p_gym_id => '20000000-0000-4000-8000-000000000001',
      p_gym_member_id => '60000000-0000-4000-8000-000000000001',
      p_object_path => '20000000-0000-4000-8000-000000000001/members/rsec/rostro.webp',
      p_mime_type => 'image/webp',
      p_size_bytes => 2048,
      p_embedding => (
        '[' || pg_catalog.array_to_string(
          pg_catalog.array_fill(0.1::real, array[128]), ','
        ) || ']'
      )::extensions.vector(128)
    )
  $$,
  'enroll_member_face sigue enrolando: la restriccion no toco el camino legitimo'
);

select ok(
  exists (
    select 1 from public.face_embeddings
    where gym_id = '20000000-0000-4000-8000-000000000001'
      and is_active
  ),
  'el enrolamiento por la RPC si deja el template escrito'
);

-- ---------------------------------------------------------------------------
-- F034 y su espejo. El catalogo de pantallas dice la verdad
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from public.screens
   where code in ('roles', 'saas_billing', 'audit') and is_active),
  0,
  'las tres pantallas sin ruta en src/app quedan fuera del catalogo activo'
);

select ok(
  (select is_active from public.screens where code = 'facial_access'),
  'el acceso facial se puede conceder: el modulo existe desde hace dos PR'
);

-- Toda pantalla ofrecida tiene que existir. Esta es la regla, no la lista.
select is(
  (select coalesce(string_agg(code, ',' order by code), '(ninguna)')
   from public.screens where is_active),
  'alerts,dashboard,entries,facial_access,income,members,memberships,payments,settings,staff',
  'el catalogo activo es exactamente el conjunto de pantallas que tienen ruta'
);

-- Desactivar la pantalla no puede ser la unica defensa: el permiso que la
-- acompanaba sigue existiendo y se concede por otro lado.
select ok(
  exists (select 1 from public.permissions where code = 'roles.manage'),
  'roles.manage sigue existiendo: se saca del catalogo de pantallas, no del sistema'
);

-- ---------------------------------------------------------------------------
-- F037. RPC sin llamador, sin ejecucion
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   cross join unnest(array['anon', 'authenticated']) as r(rolname)
   where n.nspname = 'public'
     and p.proname = 'start_member_subscription'
     and has_function_privilege(r.rolname, p.oid, 'EXECUTE')),
  0,
  'start_member_subscription deja de ser ejecutable por cualquier autenticado'
);

-- No se borra: si manana aparece su flujo, la logica esta. Se le quita la
-- ejecucion, que es lo que la hacia superficie de ataque.
select has_function(
  'public',
  'start_member_subscription',
  'la funcion sigue existiendo, solo pierde el grant'
);

select * from finish();

rollback;
