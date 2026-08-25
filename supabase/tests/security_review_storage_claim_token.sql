begin;

select plan(8);

delete from public.storage_deletion_queue;

insert into public.media_assets (id, gym_id, bucket_name, object_path, mime_type, size_bytes)
values
  ('c4000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'gym-media', '20000000-0000-4000-8000-000000000001/security-review/token-1.webp', 'image/webp', 1024),
  ('c4000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'gym-media', '20000000-0000-4000-8000-000000000001/security-review/token-2.webp', 'image/webp', 1024);

insert into public.storage_deletion_queue
  (id, media_asset_id, gym_id, bucket_name, object_path, status, attempts, available_at, created_at)
values
  ('c4100000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'gym-media', '20000000-0000-4000-8000-000000000001/security-review/token-1.webp', 'pending', 0, timezone('utc', now()) - interval '1 minute', timezone('utc', now()) - interval '2 minutes'),
  ('c4100000-0000-4000-8000-000000000002', 'c4000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'gym-media', '20000000-0000-4000-8000-000000000001/security-review/token-2.webp', 'pending', 0, timezone('utc', now()) - interval '1 minute', timezone('utc', now()) - interval '1 minute');

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

create temp table security_review_claims as
select q.id, to_jsonb(q)->>'claim_token' as claim_token
from public.claim_storage_deletion_jobs(10) q;

select is(
  (select count(*) from security_review_claims where claim_token is not null),
  2::bigint,
  'cada reclamo devuelve un token de propiedad'
);

select is(
  (select count(distinct claim_token) from security_review_claims),
  2::bigint,
  'cada trabajo reclamado recibe un token distinto'
);

select throws_ok(
  $$select public.complete_storage_deletion_job(
      'c4100000-0000-4000-8000-000000000001',
      'ffffffff-ffff-4fff-8fff-ffffffffffff'
    )$$,
  'P0001',
  'Storage deletion claim token does not match',
  'completar rechaza un token que no posee el trabajo'
);

select throws_ok(
  $$select public.fail_storage_deletion_job(
      'c4100000-0000-4000-8000-000000000002',
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      'fallo tardio de otro worker',
      300
    )$$,
  'P0001',
  'Storage deletion claim token does not match',
  'fallar rechaza un token que no posee el trabajo'
);

select lives_ok(
  format(
    'select public.complete_storage_deletion_job(%L::uuid, %L::uuid)',
    'c4100000-0000-4000-8000-000000000001',
    (select claim_token from security_review_claims where id = 'c4100000-0000-4000-8000-000000000001')
  ),
  'completar acepta el token entregado por el reclamo'
);

select lives_ok(
  format(
    'select public.fail_storage_deletion_job(%L::uuid, %L::uuid, %L, 300)',
    'c4100000-0000-4000-8000-000000000002',
    (select claim_token from security_review_claims where id = 'c4100000-0000-4000-8000-000000000002'),
    'Storage no respondio'
  ),
  'fallar acepta el token entregado por el reclamo'
);

select is(
  (select status from public.storage_deletion_queue where id = 'c4100000-0000-4000-8000-000000000001'),
  'completed',
  'el token correcto permite completar el trabajo'
);

select is(
  (select status from public.storage_deletion_queue where id = 'c4100000-0000-4000-8000-000000000002'),
  'failed',
  'el token correcto permite reprogramar el trabajo fallido'
);

select * from finish();

rollback;
