begin;

select plan(11);

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

select has_function(
  'public',
  'current_user_has_gym_permission',
  array['uuid', 'text'],
  'current_user_has_gym_permission rpc exists'
);

select isnt_empty(
  $$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'current_user_has_gym_permission' and p.prosecdef$$,
  'current_user_has_gym_permission is security definer'
);

select ok(
  has_function_privilege('authenticated', 'public.current_user_has_gym_permission(uuid, text)', 'execute'),
  'authenticated can execute current_user_has_gym_permission'
);

select has_function(
  'public',
  'reserve_face_verification_attempt',
  array['uuid', 'integer', 'integer'],
  'reserve_face_verification_attempt rpc exists'
);

select ok(
  not has_table_privilege('authenticated', 'public.face_verification_rate_limits', 'select'),
  'authenticated cannot read raw face verification rate limit counters'
);

select throws_ok(
  $$select public.verify_face_access(
    '20000000-0000-4000-8000-000000000001',
    array_fill(0.0::real, array[128])::extensions.vector,
    null,
    null,
    0.363,
    15,
    'opencv-sface'
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
