begin;

insert into public.face_models(code, version, vector_dimensions, default_similarity_threshold)
values ('insightface-buffalo-l-w600k-r50', '1.0.0', 512, 0.75)
on conflict (code, version) do nothing;

create or replace function public.enroll_member_face(
  p_gym_id uuid,
  p_gym_member_id uuid,
  p_object_path text,
  p_mime_type text,
  p_size_bytes bigint,
  p_width_pixels integer default null,
  p_height_pixels integer default null,
  p_sha256_hex text default null,
  p_embedding extensions.vector(512) default null,
  p_quality_score real default null,
  p_consent_version text default '2026-07-22',
  p_model_code text default 'insightface-buffalo-l-w600k-r50'
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
    and fm.vector_dimensions = 512
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
