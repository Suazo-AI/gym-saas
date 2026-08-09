begin;

alter table public.storage_deletion_queue
  drop constraint storage_deletion_queue_status_check;

alter table public.storage_deletion_queue
  add constraint storage_deletion_queue_status_check
  check (status in ('pending', 'processing', 'completed', 'failed', 'canceled', 'dead'));

alter table public.storage_deletion_queue
  add constraint storage_deletion_queue_bucket_name_check
  check (bucket_name = 'gym-media');

drop index if exists public.idx_storage_deletion_queue_claim;

create index idx_storage_deletion_queue_claim
  on public.storage_deletion_queue(status, available_at, locked_at, created_at)
  where status in ('pending', 'failed', 'processing')
    and attempts < 5;

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
      locked_at = v_now,
      last_error = null
  from jobs
  where q.id = jobs.id
  returning q.*;
end;
$$;

create or replace function public.fail_storage_deletion_job(
  p_job_id uuid,
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
      available_at = case
        when q.attempts >= 5 then q.available_at
        else v_now + make_interval(secs => greatest(p_retry_after_seconds, 60))
      end,
      locked_at = null,
      processed_at = case when q.attempts >= 5 then v_now else q.processed_at end,
      last_error = left(coalesce(p_error, 'Unknown Storage deletion error'), 2000)
  where q.id = p_job_id
    and q.status = 'processing';

  if not found then
    raise exception 'Processing Storage deletion job not found';
  end if;
end;
$$;

commit;
