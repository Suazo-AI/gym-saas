begin;

alter table public.storage_deletion_queue
  add column claim_token uuid;

create or replace function public.claim_storage_deletion_jobs(
  p_limit integer default 20
)
returns setof public.storage_deletion_queue
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := timezone('utc', now());
begin
  if not private.is_service_role() then
    raise exception 'service_role is required';
  end if;

  update public.storage_deletion_queue q
  set status = 'dead',
      claim_token = null,
      locked_at = null,
      processed_at = v_now,
      last_error = 'Se agotaron los 5 intentos y vencio el bloqueo del trabajo.'
  where q.status = 'processing'
    and q.locked_at < v_now - interval '15 minutes'
    and q.attempts >= 5;

  return query
  with jobs as (
    select q.id
    from public.storage_deletion_queue q
    where q.attempts < 5
      and (
        (
          q.status in ('pending', 'failed')
          and q.available_at <= v_now
        )
        or (
          q.status = 'processing'
          and q.locked_at < v_now - interval '15 minutes'
        )
      )
    order by q.created_at
    for update skip locked
    limit greatest(1, least(p_limit, 100))
  )
  update public.storage_deletion_queue q
  set status = 'processing',
      attempts = q.attempts + 1,
      claim_token = gen_random_uuid(),
      locked_at = v_now,
      last_error = null
  from jobs
  where q.id = jobs.id
  returning q.*;
end;
$$;

drop function public.complete_storage_deletion_job(uuid);
drop function public.fail_storage_deletion_job(uuid, text, integer);

create function public.complete_storage_deletion_job(
  p_job_id uuid,
  p_claim_token uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_media_asset_id uuid;
  v_now timestamptz := timezone('utc', now());
begin
  if not private.is_service_role() then
    raise exception 'service_role is required';
  end if;

  update public.storage_deletion_queue
  set status = 'completed',
      claim_token = null,
      processed_at = v_now,
      locked_at = null,
      last_error = null
  where id = p_job_id
    and status = 'processing'
    and claim_token = p_claim_token
  returning media_asset_id into v_media_asset_id;

  if v_media_asset_id is null then
    raise exception 'Storage deletion claim token does not match';
  end if;

  update public.media_assets
  set storage_deleted_at = v_now
  where id = v_media_asset_id;
end;
$$;

create function public.fail_storage_deletion_job(
  p_job_id uuid,
  p_claim_token uuid,
  p_error text,
  p_retry_after_seconds integer default 300
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := timezone('utc', now());
begin
  if not private.is_service_role() then
    raise exception 'service_role is required';
  end if;

  update public.storage_deletion_queue q
  set status = case when q.attempts >= 5 then 'dead' else 'failed' end,
      claim_token = null,
      available_at = case
        when q.attempts >= 5 then q.available_at
        else v_now + make_interval(secs => greatest(p_retry_after_seconds, 60))
      end,
      locked_at = null,
      processed_at = case when q.attempts >= 5 then v_now else q.processed_at end,
      last_error = left(coalesce(p_error, 'Unknown Storage deletion error'), 2000)
  where q.id = p_job_id
    and q.status = 'processing'
    and q.claim_token = p_claim_token;

  if not found then
    raise exception 'Storage deletion claim token does not match';
  end if;
end;
$$;

revoke all on function public.claim_storage_deletion_jobs(integer) from public;
revoke all on function public.complete_storage_deletion_job(uuid, uuid) from public;
revoke all on function public.fail_storage_deletion_job(uuid, uuid, text, integer) from public;

grant execute on function public.claim_storage_deletion_jobs(integer) to service_role;
grant execute on function public.complete_storage_deletion_job(uuid, uuid) to service_role;
grant execute on function public.fail_storage_deletion_job(uuid, uuid, text, integer) to service_role;

comment on column public.storage_deletion_queue.claim_token is
  'Opaque ownership token rotated on every claim and required to complete or fail the job.';

commit;
