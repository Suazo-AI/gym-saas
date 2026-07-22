create or replace function public.verify_face_access(
  p_gym_id uuid,
  p_embedding extensions.vector(512),
  p_branch_id uuid default null,
  p_device_id uuid default null,
  p_similarity_threshold real default 0.75,
  p_processing_ms integer default null,
  p_model_code text default 'insightface-buffalo-l'
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
    greatest(0.01, least(coalesce(p_similarity_threshold, 0.75), 1)),
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
      greatest(0.01, least(coalesce(p_similarity_threshold, 0.75), 1)),
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
