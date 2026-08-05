-- Per-gym USD/NIO exchange rates. History is append-only; converted
-- transactions must snapshot the selected history row in their own contract.

create table public.gym_exchange_rate_history (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete restrict,
  nio_per_usd numeric(14,6) not null
    constraint gym_exchange_rate_positive check (nio_per_usd > 0),
  effective_at timestamptz not null default timezone('utc', now()),
  changed_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create index gym_exchange_rate_history_current_idx
  on public.gym_exchange_rate_history (gym_id, effective_at desc, created_at desc, id desc);

comment on table public.gym_exchange_rate_history is
  'Immutable per-gym exchange-rate history, expressed as NIO per USD.';
comment on column public.gym_exchange_rate_history.nio_per_usd is
  'Cordobas per US dollar. Converted transactions must persist the rate they used.';

insert into public.gym_exchange_rate_history (gym_id, nio_per_usd, changed_by)
select g.id, 36.600000, g.created_by
from public.gyms g
where not exists (
  select 1 from public.gym_exchange_rate_history h where h.gym_id = g.id
);

create function private.initialize_gym_exchange_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.gym_exchange_rate_history (gym_id, nio_per_usd, changed_by)
  values (new.id, 36.600000, new.created_by);
  return new;
end;
$$;

create trigger trg_gyms_initialize_exchange_rate
after insert on public.gyms
for each row execute function private.initialize_gym_exchange_rate();

create function private.reject_exchange_rate_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Exchange-rate history is immutable' using errcode = '55000';
end;
$$;

create trigger trg_exchange_rate_history_immutable
before update or delete on public.gym_exchange_rate_history
for each row execute function private.reject_exchange_rate_history_mutation();

alter table public.gym_exchange_rate_history enable row level security;

create policy gym_exchange_rate_history_read
on public.gym_exchange_rate_history
for select to authenticated
using (private.has_permission(gym_id, 'gym.read'));

create view public.gym_exchange_rate_current
with (security_invoker = true)
as
select distinct on (h.gym_id)
  h.id,
  h.gym_id,
  h.nio_per_usd,
  h.effective_at,
  h.changed_by,
  h.created_at
from public.gym_exchange_rate_history h
order by h.gym_id, h.effective_at desc, h.created_at desc, h.id desc;

comment on view public.gym_exchange_rate_current is
  'Current tenant-filtered rate; security_invoker preserves history-table RLS.';

create function public.update_gym_exchange_rate(p_nio_per_usd numeric)
returns public.gym_exchange_rate_history
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_gym_id uuid;
  v_owner_count integer;
  v_previous public.gym_exchange_rate_history%rowtype;
  v_created public.gym_exchange_rate_history%rowtype;
begin
  if p_nio_per_usd is null or p_nio_per_usd = 'NaN'::numeric or p_nio_per_usd <= 0 then
    if p_nio_per_usd = 'NaN'::numeric then
      raise exception 'Exchange rate must be a finite number greater than zero' using errcode = '23514';
    end if;
    raise exception 'Exchange rate must be greater than zero' using errcode = '23514';
  end if;

  select count(*), min(gu.gym_id::text)::uuid
  into v_owner_count, v_gym_id
  from public.gym_users gu
  join public.gym_user_roles gur on gur.gym_user_id = gu.id
  join public.roles r
    on r.id = gur.role_id
   and r.gym_id = gu.gym_id
  join public.gyms g on g.id = gu.gym_id
  where gu.auth_user_id = v_actor
    and gu.status = 'active'
    and g.status = 'active'
    and r.code = 'owner'
    and r.is_system;

  if v_actor is null or v_owner_count <> 1 then
    raise exception 'Only an active gym owner can update the exchange rate'
      using errcode = '42501';
  end if;

  select h.* into v_previous
  from public.gym_exchange_rate_history h
  where h.gym_id = v_gym_id
  order by h.effective_at desc, h.created_at desc, h.id desc
  limit 1
  for update;

  insert into public.gym_exchange_rate_history (gym_id, nio_per_usd, changed_by)
  values (v_gym_id, p_nio_per_usd, v_actor)
  returning * into v_created;

  insert into public.audit_logs (
    gym_id, actor_user_id, action, entity_table, entity_id, before_data, after_data
  ) values (
    v_gym_id,
    v_actor,
    'GYM_EXCHANGE_RATE_UPDATED',
    'gym_exchange_rate_history',
    v_created.id::text,
    jsonb_build_object('nio_per_usd', v_previous.nio_per_usd),
    jsonb_build_object('nio_per_usd', v_created.nio_per_usd)
  );

  return v_created;
end;
$$;

comment on function public.update_gym_exchange_rate(numeric) is
  'Appends a rate for the caller''s single active system-owner gym and records a compact audit event.';

revoke all on public.gym_exchange_rate_history from public, anon, authenticated;
grant select on public.gym_exchange_rate_history to authenticated;

revoke all on public.gym_exchange_rate_current from public, anon, authenticated;
grant select on public.gym_exchange_rate_current to authenticated;

revoke all on function public.update_gym_exchange_rate(numeric) from public, anon;
grant execute on function public.update_gym_exchange_rate(numeric) to authenticated;

-- Rollback (only before financial transactions reference this history): drop the
-- RPC/view/triggers/functions/table in dependency order. Never delete rate rows
-- once a converted transaction stores a reference to them.
