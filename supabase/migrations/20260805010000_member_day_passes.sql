begin;

create table public.member_day_passes (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  gym_member_id uuid not null references public.gym_members(id) on delete restrict,
  branch_id uuid references public.gym_branches(id) on delete set null,
  payment_id uuid not null unique references public.member_payments(id) on delete restrict,
  service_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null,
  status text not null default 'paid' check (status in ('paid', 'void')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index member_day_passes_one_paid_per_day
  on public.member_day_passes(gym_member_id, service_date)
  where status = 'paid';
create index member_day_passes_gym_date_idx
  on public.member_day_passes(gym_id, service_date desc);

alter table public.member_day_passes enable row level security;
grant select on public.member_day_passes to authenticated;

create policy member_day_passes_read on public.member_day_passes
  for select to authenticated
  using (private.has_permission(gym_id, 'payments.read'));

create or replace function private.sync_day_pass_payment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    update public.member_day_passes
    set status = case when new.status = 'settled' then 'paid' else 'void' end,
        updated_at = timezone('utc', now())
    where payment_id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_sync_day_pass_payment_status
after update of status on public.member_payments
for each row execute function private.sync_day_pass_payment_status();

create or replace function public.register_member_day_pass(
  p_gym_id uuid,
  p_gym_member_id uuid,
  p_payment_method_id uuid,
  p_service_date date,
  p_amount numeric,
  p_currency char(3),
  p_branch_id uuid default null,
  p_paid_at timestamptz default timezone('utc', now()),
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_member public.gym_members;
  v_payment public.member_payments;
  v_pass public.member_day_passes;
  v_id uuid := gen_random_uuid();
begin
  if not private.has_permission(p_gym_id, 'payments.manage') then
    raise exception 'Insufficient permission: payments.manage' using errcode = '42501';
  end if;

  select * into v_member
  from public.gym_members
  where id = p_gym_member_id and gym_id = p_gym_id and deleted_at is null
  for update;
  if not found then
    raise exception 'No encontramos el miembro en este gimnasio.' using errcode = 'P0002';
  end if;
  if v_member.status <> 'active' then
    raise exception 'El miembro no está activo.' using errcode = '23514';
  end if;
  if p_service_date is null or p_amount is null or p_amount <= 0 then
    raise exception 'Fecha y monto válidos son obligatorios.' using errcode = '22023';
  end if;
  if p_currency not in ('USD', 'NIO') then
    raise exception 'Moneda no válida.' using errcode = '22023';
  end if;
  if p_branch_id is not null and not exists (
    select 1 from public.gym_branches b where b.id = p_branch_id and b.gym_id = p_gym_id
  ) then
    raise exception 'No encontramos la sucursal en este gimnasio.' using errcode = '23503';
  end if;
  if not exists (select 1 from public.payment_methods pm where pm.id = p_payment_method_id and pm.is_active) then
    raise exception 'Payment method is not active' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.member_day_passes dp
    where dp.gym_member_id = p_gym_member_id and dp.service_date = p_service_date and dp.status = 'paid'
  ) then
    raise exception 'El miembro ya tiene un pase diario pagado para esa fecha.' using errcode = '23505';
  end if;

  insert into public.member_payments(
    id, gym_id, gym_member_id, branch_id, payment_method_id, status, amount, currency,
    receipt_number, paid_at, received_by, notes
  ) values (
    v_id, p_gym_id, p_gym_member_id, coalesce(p_branch_id, v_member.home_branch_id),
    p_payment_method_id, 'settled', p_amount, p_currency,
    'DAY-' || to_char(timezone('utc', coalesce(p_paid_at, timezone('utc', now()))), 'YYYYMMDD') ||
      '-' || upper(substr(replace(v_id::text, '-', ''), 1, 10)),
    coalesce(p_paid_at, timezone('utc', now())), v_actor, nullif(trim(p_notes), '')
  ) returning * into v_payment;

  insert into public.member_day_passes(
    gym_id, gym_member_id, branch_id, payment_id, service_date, amount, currency, created_by
  ) values (
    p_gym_id, p_gym_member_id, coalesce(p_branch_id, v_member.home_branch_id),
    v_payment.id, p_service_date, p_amount, p_currency, v_actor
  ) returning * into v_pass;

  insert into public.audit_logs(gym_id, actor_user_id, action, entity_table, entity_id, after_data)
  values (
    p_gym_id, v_actor, 'member_day_pass.recorded', 'member_day_passes', v_pass.id::text,
    jsonb_build_object('payment_id', v_payment.id, 'gym_member_id', p_gym_member_id,
      'service_date', v_pass.service_date, 'amount', v_pass.amount,
      'currency', v_pass.currency, 'receipt_number', v_payment.receipt_number)
  );

  return jsonb_build_object(
    'pass_id', v_pass.id, 'payment_id', v_payment.id,
    'receipt_number', v_payment.receipt_number, 'service_date', v_pass.service_date,
    'amount', v_pass.amount, 'currency', v_pass.currency,
    'applied_nio_per_usd', v_payment.applied_nio_per_usd
  );
end;
$$;

create or replace function public.list_member_day_passes(p_gym_id uuid, p_gym_member_id uuid)
returns table (
  id uuid, gym_member_id uuid, service_date date, amount numeric(14,2), currency char(3),
  status text, receipt_number text, payment_id uuid
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.has_permission(p_gym_id, 'payments.read') then
    raise exception 'Insufficient permission: payments.read' using errcode = '42501';
  end if;
  return query
  select dp.id, dp.gym_member_id, dp.service_date, dp.amount, dp.currency, dp.status,
    mp.receipt_number, dp.payment_id
  from public.member_day_passes dp
  join public.member_payments mp on mp.id = dp.payment_id
  where dp.gym_id = p_gym_id and dp.gym_member_id = p_gym_member_id
  order by dp.service_date desc, dp.created_at desc;
end;
$$;

create or replace function private.member_access_allowed(
  p_gym_member_id uuid,
  p_at timestamptz default timezone('utc', now())
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.gym_members gm
    where gm.id = p_gym_member_id and gm.status = 'active'
      and exists (
        select 1 from public.member_day_passes dp
        where dp.gym_member_id = gm.id and dp.service_date = p_at::date and dp.status = 'paid'
      )
  ) or exists (
    select 1
    from public.gym_members gm
    join public.member_subscriptions ms on ms.gym_member_id = gm.id
    join public.membership_plans mp on mp.id = ms.membership_plan_id
    where gm.id = p_gym_member_id and gm.status = 'active'
      and ms.status in ('trialing', 'active')
      and ms.start_date <= p_at::date
      and (ms.end_date is null or ms.end_date >= p_at::date)
      and not exists (
        select 1 from public.membership_charges mc
        where mc.gym_member_id = gm.id and mc.status <> 'void'
          and mc.due_date + mp.grace_days < p_at::date
          and mc.status in ('pending', 'partial', 'overdue')
      )
  );
$$;

revoke all on function public.register_member_day_pass(uuid,uuid,uuid,date,numeric,char,uuid,timestamptz,text) from public;
revoke all on function public.list_member_day_passes(uuid,uuid) from public;
grant execute on function public.register_member_day_pass(uuid,uuid,uuid,date,numeric,char,uuid,timestamptz,text) to authenticated, service_role;
grant execute on function public.list_member_day_passes(uuid,uuid) to authenticated, service_role;

commit;
