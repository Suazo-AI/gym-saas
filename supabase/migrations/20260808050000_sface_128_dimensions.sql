begin;

-- Embeddings from different recognition models are not comparable.
delete from public.face_embeddings;

drop index public.idx_face_embeddings_hnsw_cosine;

alter table public.face_embeddings
  alter column embedding type extensions.vector(128)
  using embedding::extensions.vector(128);

create index idx_face_embeddings_hnsw_cosine
  on public.face_embeddings
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- The old model catalog is no longer valid after replacing the embedding model.
delete from public.face_models;

alter table public.face_models
  alter column vector_dimensions set default 128,
  drop constraint face_models_vector_dimensions_check,
  add constraint face_models_vector_dimensions_check check (vector_dimensions = 128);

alter table public.face_models
  alter column default_similarity_threshold set default 0.363;

-- 0.363 is OpenCV's reference cosine threshold for SFace.
-- It remains pending calibration with real photos.
insert into public.face_models(code, version, vector_dimensions, default_similarity_threshold)
values ('opencv-sface', '2021dec', 128, 0.363);

create or replace function public.match_face_candidates(
  p_gym_id uuid,
  p_embedding extensions.vector(128),
  p_similarity_threshold real default 0.363,
  p_limit integer default 3
)
returns table (
  face_embedding_id uuid,
  person_id uuid,
  gym_member_id uuid,
  similarity real,
  access_allowed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    fe.id,
    fe.person_id,
    gm.id,
    (1 - (fe.embedding OPERATOR(extensions.<=>) p_embedding))::real,
    private.member_access_allowed(gm.id, timezone('utc', now()))
  from public.face_embeddings fe
  join public.person_photos pp
    on pp.id = fe.person_photo_id
   and pp.deleted_at is null
  join public.gym_members gm
    on gm.gym_id = fe.gym_id
   and gm.person_id = fe.person_id
   and gm.deleted_at is null
  where fe.gym_id = p_gym_id
    and fe.is_active
    and (
      private.is_service_role()
      or private.has_permission(p_gym_id, 'faces.verify')
    )
    and exists (
      select 1
      from public.biometric_consents bc
      where bc.gym_id = fe.gym_id
        and bc.person_id = fe.person_id
        and bc.status = 'granted'
        and (bc.expires_at is null or bc.expires_at > timezone('utc', now()))
        and (bc.retention_until is null or bc.retention_until > timezone('utc', now()))
    )
    and (1 - (fe.embedding OPERATOR(extensions.<=>) p_embedding))
      >= p_similarity_threshold
  order by fe.embedding OPERATOR(extensions.<=>) p_embedding
  limit greatest(1, least(p_limit, 10));
$$;

revoke all on function public.match_face_candidates(
  uuid, extensions.vector, real, integer
) from public;

grant execute on function public.match_face_candidates(
  uuid, extensions.vector, real, integer
) to authenticated, service_role;

create or replace function public.verify_face_access(
  p_gym_id uuid,
  p_embedding extensions.vector(128),
  p_branch_id uuid default null,
  p_device_id uuid default null,
  p_similarity_threshold real default 0.363,
  p_processing_ms integer default null,
  p_model_code text default 'opencv-sface'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_top record;
  v_second record;
  v_decision public.access_decision;
  v_reason text;
  v_event_id uuid;
  v_review_margin real := 0.03;
begin
  if not private.has_permission(p_gym_id, 'faces.verify') then
    raise exception 'faces.verify permission required'
      using errcode = '42501';
  end if;

  if p_branch_id is not null and not exists (
    select 1
    from public.gym_branches b
    where b.id = p_branch_id
      and b.gym_id = p_gym_id
      and b.deleted_at is null
  ) then
    raise exception 'Branch does not belong to the gym'
      using errcode = '23503';
  end if;

  if p_device_id is not null and not exists (
    select 1
    from public.access_devices d
    where d.id = p_device_id
      and d.gym_id = p_gym_id
      and d.status = 'active'
      and d.deleted_at is null
  ) then
    raise exception 'Device does not belong to the gym'
      using errcode = '23503';
  end if;

  select *
  into v_top
  from public.match_face_candidates(
    p_gym_id,
    p_embedding,
    greatest(0.01, least(coalesce(p_similarity_threshold, 0.363), 1)),
    2
  )
  limit 1;

  select *
  into v_second
  from (
    select *, row_number() over (order by similarity desc) as rn
    from public.match_face_candidates(
      p_gym_id,
      p_embedding,
      greatest(0.01, least(coalesce(p_similarity_threshold, 0.363), 1)),
      2
    )
  ) candidates
  where rn = 2;

  if v_top.face_embedding_id is null then
    v_decision := 'no_match';
    v_reason := 'No enrolled face matched.';
  elsif v_second.face_embedding_id is not null
      and (v_top.similarity - v_second.similarity) < v_review_margin then
    v_decision := 'manual_review';
    v_reason := 'Ambiguous match requires manual review.';
  elsif v_top.access_allowed then
    v_decision := 'allowed';
    v_reason := 'Active subscription verified.';
  else
    v_decision := 'denied';
    v_reason := 'Member does not have active access.';
  end if;

  insert into public.face_recognition_events (
    gym_id,
    branch_id,
    device_id,
    matched_face_embedding_id,
    matched_person_id,
    gym_member_id,
    similarity_score,
    decision,
    decision_reason,
    model_code,
    processing_ms,
    metadata
  )
  values (
    p_gym_id,
    p_branch_id,
    p_device_id,
    v_top.face_embedding_id,
    v_top.person_id,
    v_top.gym_member_id,
    v_top.similarity,
    v_decision,
    v_reason,
    p_model_code,
    p_processing_ms,
    jsonb_build_object(
      'similarityThreshold', p_similarity_threshold,
      'reviewMargin', v_review_margin,
      'automatic', true
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'eventId', v_event_id,
    'decision', v_decision,
    'decisionReason', v_reason,
    'gymMemberId', v_top.gym_member_id,
    'personId', v_top.person_id,
    'faceEmbeddingId', v_top.face_embedding_id,
    'similarity', v_top.similarity,
    'accessAllowed', v_decision = 'allowed'
  );
end;
$$;

revoke all on function public.verify_face_access(
  uuid,
  extensions.vector,
  uuid,
  uuid,
  real,
  integer,
  text
) from public;

grant execute on function public.verify_face_access(
  uuid,
  extensions.vector,
  uuid,
  uuid,
  real,
  integer,
  text
) to authenticated, service_role;

create or replace function public.enroll_member_face(
  p_gym_id uuid,
  p_gym_member_id uuid,
  p_object_path text,
  p_mime_type text,
  p_size_bytes bigint,
  p_width_pixels integer default null,
  p_height_pixels integer default null,
  p_sha256_hex text default null,
  p_embedding extensions.vector(128) default null,
  p_quality_score real default null,
  p_consent_version text default '2026-07-22',
  p_model_code text default 'opencv-sface'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_person_id uuid;
  v_media_asset_id uuid;
  v_profile_photo_id uuid;
  v_face_photo_id uuid;
  v_face_model_id uuid;
  v_embedding_id uuid;
  v_consent_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not private.has_permission(p_gym_id, 'members.manage') then
    raise exception 'members.manage permission required'
      using errcode = '42501';
  end if;

  if not private.has_permission(p_gym_id, 'faces.manage') then
    raise exception 'faces.manage permission required'
      using errcode = '42501';
  end if;

  if p_object_path is null or split_part(p_object_path, '/', 1) <> p_gym_id::text then
    raise exception 'Photo path must begin with the gym id'
      using errcode = '22023';
  end if;

  if p_mime_type not in ('image/webp', 'image/jpeg', 'image/png') then
    raise exception 'Unsupported member photo MIME type'
      using errcode = '22023';
  end if;

  if p_size_bytes is null or p_size_bytes <= 0 or p_size_bytes > 10485760 then
    raise exception 'Member photo size is invalid'
      using errcode = '22023';
  end if;

  select gm.person_id
    into v_person_id
  from public.gym_members gm
  where gm.id = p_gym_member_id
    and gm.gym_id = p_gym_id
    and gm.deleted_at is null;

  if v_person_id is null then
    raise exception 'Member does not belong to this gym'
      using errcode = 'P0002';
  end if;

  select fm.id
    into v_face_model_id
  from public.face_models fm
  where fm.code = p_model_code
    and fm.vector_dimensions = 128
    and fm.is_active
  order by fm.created_at desc
  limit 1;

  if v_face_model_id is null then
    raise exception 'Face model is not configured'
      using errcode = 'P0001';
  end if;

  update public.person_photos
  set is_primary = false
  where gym_id = p_gym_id
    and person_id = v_person_id
    and purpose in ('profile', 'face_enrollment')
    and is_primary;

  update public.face_embeddings
  set is_active = false,
      updated_at = timezone('utc', now())
  where gym_id = p_gym_id
    and person_id = v_person_id
    and face_model_id = v_face_model_id
    and is_active;

  insert into public.media_assets(
    gym_id,
    owner_person_id,
    bucket_name,
    object_path,
    original_filename,
    mime_type,
    compression_codec,
    width_pixels,
    height_pixels,
    size_bytes,
    sha256_hex,
    created_by
  )
  values (
    p_gym_id,
    v_person_id,
    'gym-media',
    p_object_path,
    'member-face.webp',
    p_mime_type,
    case when p_mime_type = 'image/webp' then 'webp' else null end,
    p_width_pixels,
    p_height_pixels,
    p_size_bytes,
    p_sha256_hex,
    v_actor
  )
  returning id into v_media_asset_id;

  insert into public.person_photos(
    gym_id,
    person_id,
    media_asset_id,
    purpose,
    is_primary,
    captured_at
  )
  values (
    p_gym_id,
    v_person_id,
    v_media_asset_id,
    'profile',
    true,
    timezone('utc', now())
  )
  returning id into v_profile_photo_id;

  insert into public.person_photos(
    gym_id,
    person_id,
    media_asset_id,
    purpose,
    is_primary,
    captured_at
  )
  values (
    p_gym_id,
    v_person_id,
    v_media_asset_id,
    'face_enrollment',
    true,
    timezone('utc', now())
  )
  returning id into v_face_photo_id;

  insert into public.biometric_consents(
    gym_id,
    person_id,
    status,
    purpose,
    consent_version,
    obtained_by,
    evidence_media_asset_id
  )
  values (
    p_gym_id,
    v_person_id,
    'granted',
    'gym_access_verification',
    p_consent_version,
    v_actor,
    v_media_asset_id
  )
  returning id into v_consent_id;

  insert into public.face_embeddings(
    gym_id,
    person_id,
    person_photo_id,
    face_model_id,
    embedding,
    quality_score,
    is_active
  )
  values (
    p_gym_id,
    v_person_id,
    v_face_photo_id,
    v_face_model_id,
    p_embedding,
    p_quality_score,
    true
  )
  returning id into v_embedding_id;

  insert into public.audit_logs(
    gym_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    after_data
  )
  values (
    p_gym_id,
    v_actor,
    'member.face_enrolled',
    'face_embeddings',
    v_embedding_id::text,
    jsonb_build_object(
      'gym_member_id', p_gym_member_id,
      'person_id', v_person_id,
      'media_asset_id', v_media_asset_id,
      'person_photo_id', v_face_photo_id,
      'face_model_id', v_face_model_id,
      'quality_score', p_quality_score
    )
  );

  return jsonb_build_object(
    'mediaAssetId', v_media_asset_id,
    'profilePhotoId', v_profile_photo_id,
    'personPhotoId', v_face_photo_id,
    'faceEmbeddingId', v_embedding_id,
    'consentId', v_consent_id
  );
end;
$$;

revoke all on function public.enroll_member_face(
  uuid,
  uuid,
  text,
  text,
  bigint,
  integer,
  integer,
  text,
  extensions.vector,
  real,
  text,
  text
) from public;

grant execute on function public.enroll_member_face(
  uuid,
  uuid,
  text,
  text,
  bigint,
  integer,
  integer,
  text,
  extensions.vector,
  real,
  text,
  text
) to authenticated, service_role;

commit;
