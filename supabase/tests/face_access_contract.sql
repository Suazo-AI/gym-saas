begin;

select plan(6);

select has_function(
  'public',
  'verify_face_access',
  array['uuid', 'extensions.vector', 'uuid', 'uuid', 'real', 'integer', 'text'],
  'verify_face_access rpc exists'
);

select isnt_empty(
  $$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'verify_face_access' and p.prosecdef$$,
  'verify_face_access is security definer'
);

select ok(
  has_function_privilege('authenticated', 'public.verify_face_access(uuid, extensions.vector, uuid, uuid, real, integer, text)', 'execute'),
  'authenticated can execute verify_face_access'
);

select throws_ok(
  $$select public.verify_face_access(
    '20000000-0000-4000-8000-000000000001',
    array_fill(0.0::real, array[512])::extensions.vector,
    null,
    null,
    0.75,
    15,
    'insightface-buffalo-l'
  )$$,
  '42501',
  null,
  'verify_face_access rejects non-authenticated context'
);

select lives_ok(
  $$insert into public.face_recognition_events(gym_id, decision, decision_reason, model_code)
    values ('20000000-0000-4000-8000-000000000001', 'no_match', 'No enrolled face matched.', 'test')$$,
  'face recognition event can record no_match decisions'
);

select isnt_empty(
  $$select 1 from public.face_recognition_events where decision = 'no_match' and model_code = 'test'$$,
  'no_match event was recorded'
);

select * from finish();

rollback;
