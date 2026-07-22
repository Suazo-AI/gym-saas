begin;

select plan(4);

select has_function(
  'public',
  'enroll_member_face',
  array['uuid', 'uuid', 'text', 'text', 'bigint', 'integer', 'integer', 'text', 'extensions.vector', 'real', 'text', 'text'],
  'enroll_member_face rpc exists'
);

select isnt_empty(
  $$select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'enroll_member_face' and p.prosecdef$$,
  'enroll_member_face is security definer'
);

select ok(
  has_function_privilege('authenticated', 'public.enroll_member_face(uuid, uuid, text, text, bigint, integer, integer, text, extensions.vector, real, text, text)', 'execute'),
  'authenticated can execute enroll_member_face'
);

select throws_ok(
  $$select public.enroll_member_face(
    '20000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001/members/40000000-0000-4000-8000-000000000001/photo.webp',
    'image/webp',
    12345,
    320,
    240,
    repeat('a', 64),
    array_fill(0.0::real, array[512])::extensions.vector,
    0.8,
    '2026-07-22',
    'insightface-buffalo-l-w600k-r50'
  )$$,
  '42501',
  null,
  'enroll_member_face rejects non-authenticated context'
);

select * from finish();

rollback;
