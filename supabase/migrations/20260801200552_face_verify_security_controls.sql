begin;

create or replace function public.current_user_has_gym_permission(
  p_gym_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_permission(p_gym_id, p_permission_code);
$$;

revoke all on function public.current_user_has_gym_permission(uuid, text)
from public;

grant execute on function public.current_user_has_gym_permission(uuid, text)
to authenticated, service_role;

create table if not exists public.face_verification_rate_limits (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  window_start timestamptz not null default timezone('utc', now()),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (auth_user_id, gym_id)
);

alter table public.face_verification_rate_limits enable row level security;

revoke all on table public.face_verification_rate_limits from public;
revoke all on table public.face_verification_rate_limits from authenticated;

create or replace function public.reserve_face_verification_attempt(
  p_gym_id uuid,
  p_limit integer default 10,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
  v_allowed boolean;
begin
  if v_actor is null then
    return false;
  end if;

  if p_limit <= 0 or p_window_seconds <= 0 then
    raise exception 'Rate limit configuration must be positive';
  end if;

  insert into public.face_verification_rate_limits (
    auth_user_id,
    gym_id,
    window_start,
    attempt_count,
    updated_at
  )
  values (
    v_actor,
    p_gym_id,
    v_now,
    1,
    v_now
  )
  on conflict (auth_user_id, gym_id)
  do update
  set
    window_start = case
      when public.face_verification_rate_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
        then v_now
      else public.face_verification_rate_limits.window_start
    end,
    attempt_count = case
      when public.face_verification_rate_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
        then 1
      else public.face_verification_rate_limits.attempt_count + 1
    end,
    updated_at = v_now
  where public.face_verification_rate_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
     or public.face_verification_rate_limits.attempt_count < p_limit
  returning attempt_count <= p_limit into v_allowed;

  return coalesce(v_allowed, false);
end;
$$;

revoke all on function public.reserve_face_verification_attempt(uuid, integer, integer)
from public;

grant execute on function public.reserve_face_verification_attempt(uuid, integer, integer)
to authenticated, service_role;

comment on table public.face_verification_rate_limits
is 'Per-auth-user, per-gym fixed-window counters for face verification attempts.';

comment on function public.current_user_has_gym_permission(uuid, text)
is 'Checks the current authenticated user permission in a gym before sensitive server work.';

comment on function public.reserve_face_verification_attempt(uuid, integer, integer)
is 'Atomically reserves one face verification attempt for the current user and gym.';

commit;
