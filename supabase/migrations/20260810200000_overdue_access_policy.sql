begin;

create or replace function private.member_financial_access_state(
  p_gym_member_id uuid,
  p_on_date date default current_date
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with current_subscription as (
    select ms.id, ms.start_date, mp.grace_days
    from public.member_subscriptions ms
    join public.membership_plans mp on mp.id = ms.membership_plan_id
    where ms.gym_member_id = p_gym_member_id
      and ms.status in ('trialing', 'active')
      and ms.start_date <= p_on_date
      and (ms.end_date is null or ms.end_date >= p_on_date)
    order by ms.created_at desc
    limit 1
  ), balances as (
    select
      mc.period_start,
      mc.due_date,
      cs.start_date,
      cs.grace_days,
      greatest(
        mc.amount_due - coalesce(sum(a.amount) filter (
          where p.status in ('settled', 'partially_refunded')
        ), 0),
        0
      ) as remaining
    from current_subscription cs
    join public.membership_charges mc on mc.member_subscription_id = cs.id
    left join public.member_payment_allocations a on a.membership_charge_id = mc.id
    left join public.member_payments p on p.id = a.member_payment_id
    where mc.status in ('pending', 'partial')
    group by mc.id, mc.period_start, mc.due_date, mc.amount_due,
      cs.start_date, cs.grace_days
  )
  select case
    when exists (
      select 1
      from balances
      where remaining > 0
        and period_start = start_date
        and period_start <= p_on_date
    ) then 'initial_payment_required'
    when exists (
      select 1
      from balances
      where remaining > 0
        and period_start <> start_date
        and due_date + grace_days < p_on_date
    ) then 'overdue'
    when exists (
      select 1
      from balances
      where remaining > 0
        and period_start <> start_date
        and due_date <= p_on_date
        and due_date + grace_days >= p_on_date
    ) then 'grace'
    else 'paid'
  end
$$;

revoke all on function private.member_financial_access_state(uuid, date) from public;
grant execute on function private.member_financial_access_state(uuid, date)
  to authenticated, service_role;

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
    where gm.id = p_gym_member_id and gm.status = 'active'
      and ms.status in ('trialing', 'active')
      and ms.start_date <= p_at::date
      and (ms.end_date is null or ms.end_date >= p_at::date)
      and private.member_financial_access_state(gm.id, p_at::date) in ('paid', 'grace')
  );
$$;

alter table public.member_entries
  add column financial_access_status text,
  add constraint member_entries_financial_access_status_valid
    check (financial_access_status is null or financial_access_status in (
      'paid', 'initial_payment_required', 'grace', 'overdue'
    ));

create or replace view public.v_member_access_status
with (security_invoker = true)
as
select
  gm.gym_id,
  gm.id as gym_member_id,
  gm.member_code,
  gm.status as member_status,
  p.id as person_id,
  p.first_name,
  p.last_name,
  exists (
    select 1
    from public.member_subscriptions ms
    join public.membership_plans mp on mp.id = ms.membership_plan_id
    where ms.gym_member_id = gm.id
      and mp.deleted_at is null
      and ms.status in ('trialing', 'active')
      and ms.start_date <= current_date
      and (ms.end_date is null or ms.end_date >= current_date)
  ) as has_active_subscription,
  exists (
    select 1
    from public.membership_charges mc
    where mc.gym_member_id = gm.id
      and private.charge_is_overdue(mc.status, mc.due_date, current_date)
  ) as has_overdue_charges,
  private.member_access_allowed(gm.id, timezone('utc', now())) as access_allowed,
  private.member_financial_access_state(gm.id, current_date) as financial_access_status
from public.gym_members gm
join public.persons p on p.id = gm.person_id
where gm.deleted_at is null;

create or replace function public.register_member_entry(
  p_gym_id uuid,
  p_gym_member_id uuid,
  p_branch_id uuid default null,
  p_override_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_allowed boolean;
  v_decision public.access_decision;
  v_decision_reason text;
  v_entry_id uuid;
  v_occurred_at timestamptz;
  v_member_code text;
  v_first_name text;
  v_last_name text;
  v_member_status public.member_status;
  v_has_active_subscription boolean;
  v_has_overdue_charges boolean;
  v_financial_access_status text;
  v_membership_status text;
  v_override_reason text := nullif(trim(p_override_reason), '');
begin
  if not private.has_permission(p_gym_id, 'entries.manage') then
    raise exception 'Insufficient permission: entries.manage' using errcode = '42501';
  end if;

  select status.member_code, status.first_name, status.last_name,
    status.member_status, status.has_active_subscription,
    status.has_overdue_charges, status.financial_access_status
  into v_member_code, v_first_name, v_last_name, v_member_status,
    v_has_active_subscription, v_has_overdue_charges, v_financial_access_status
  from public.v_member_access_status status
  join public.gym_members gm on gm.id = status.gym_member_id
  where status.gym_id = p_gym_id
    and status.gym_member_id = p_gym_member_id
    and gm.deleted_at is null;

  if not found then
    raise exception 'No encontramos el miembro en este gimnasio.' using errcode = 'P0002';
  end if;

  if p_branch_id is not null and not exists (
    select 1 from public.gym_branches b
    where b.id = p_branch_id and b.gym_id = p_gym_id
  ) then
    raise exception 'No encontramos la sucursal en este gimnasio.' using errcode = '23503';
  end if;

  if exists (
    select 1 from public.member_entries me
    where me.gym_member_id = p_gym_member_id
      and me.decision in ('allowed'::public.access_decision, 'manual_review'::public.access_decision)
      and me.occurred_at >= timezone('utc', now()) - interval '5 minutes'
  ) then
    raise exception 'Ya se registro una entrada de este miembro hace menos de 5 minutos.' using errcode = '22023';
  end if;

  v_allowed := private.member_access_allowed(p_gym_member_id);

  if v_member_status <> 'active'::public.member_status then
    v_membership_status := v_member_status::text;
  elsif not v_has_active_subscription then
    v_membership_status := 'expired';
  elsif v_financial_access_status = 'overdue' then
    v_membership_status := 'past_due';
  else
    v_membership_status := 'active';
  end if;

  if v_allowed then
    v_decision := 'allowed'::public.access_decision;
    v_decision_reason := case
      when v_financial_access_status = 'grace'
        then 'Renovacion pendiente dentro del periodo de gracia.'
      else null
    end;
  elsif v_override_reason is not null then
    v_decision := 'manual_review'::public.access_decision;
    v_decision_reason := v_override_reason;
  else
    v_decision := 'denied'::public.access_decision;
    v_decision_reason := case
      when v_member_status = 'prospect'::public.member_status then 'El miembro aun no tiene una membresia.'
      when v_member_status = 'inactive'::public.member_status then 'El miembro esta inactivo.'
      when v_member_status = 'suspended'::public.member_status then 'El miembro esta suspendido.'
      when v_member_status = 'blocked'::public.member_status then 'El miembro esta bloqueado.'
      when v_member_status = 'archived'::public.member_status then 'El miembro esta archivado.'
      when not v_has_active_subscription then 'El miembro no tiene una membresia vigente.'
      when v_financial_access_status = 'initial_payment_required' then 'El pago inicial esta pendiente.'
      when v_financial_access_status = 'overdue' then 'El miembro tiene cargos vencidos fuera del periodo de gracia.'
      else 'El miembro no cumple las condiciones de acceso.'
    end;
  end if;

  insert into public.member_entries(
    gym_id, gym_member_id, branch_id, source, decision, decision_reason,
    membership_status, has_overdue_charges, financial_access_status, registered_by
  ) values (
    p_gym_id, p_gym_member_id, p_branch_id, 'manual'::public.entry_source,
    v_decision, v_decision_reason, v_membership_status,
    coalesce(v_has_overdue_charges, false), v_financial_access_status, v_actor
  ) returning id, occurred_at into v_entry_id, v_occurred_at;

  if not v_allowed and v_override_reason is not null then
    insert into public.audit_logs(
      gym_id, actor_user_id, action, entity_table, entity_id, after_data
    ) values (
      p_gym_id, v_actor, 'entry.override', 'member_entries', v_entry_id::text,
      jsonb_build_object(
        'gymMemberId', p_gym_member_id,
        'decision', v_decision,
        'reason', v_override_reason,
        'financialAccessStatus', v_financial_access_status
      )
    );
  end if;

  return jsonb_build_object(
    'entryId', v_entry_id,
    'gymMemberId', p_gym_member_id,
    'decision', v_decision,
    'decisionReason', v_decision_reason,
    'accessAllowed', v_allowed,
    'occurredAt', v_occurred_at,
    'memberCode', v_member_code,
    'memberFullName', trim(concat_ws(' ', v_first_name, v_last_name)),
    'membershipStatus', v_membership_status,
    'hasOverdueCharges', v_has_overdue_charges,
    'financialAccessStatus', v_financial_access_status
  );
end;
$$;

drop function public.search_entry_members(uuid, text, integer);

create function public.search_entry_members(
  p_gym_id uuid,
  p_search text,
  p_limit integer default 10
)
returns table (
  gym_id uuid,
  gym_member_id uuid,
  member_code text,
  full_name text,
  status text,
  membership_status text,
  has_overdue_charges boolean,
  financial_access_status text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_search text := nullif(trim(p_search), '');
  v_phone_search text := regexp_replace(coalesce(p_search, ''), '[^0-9]', '', 'g');
begin
  if not public.current_user_has_gym_permission(p_gym_id, 'entries.read') then
    raise exception 'Insufficient permission: entries.read' using errcode = '42501';
  end if;
  if v_search is null then return; end if;

  return query
  select s.gym_id, s.gym_member_id, s.member_code, s.full_name,
    s.status::text, s.membership_status::text, s.has_overdue_charges,
    access.financial_access_status
  from public.api_v1_member_summaries s
  join public.v_member_access_status access on access.gym_id = s.gym_id
    and access.gym_member_id = s.gym_member_id
  where s.gym_id = p_gym_id
    and (
      s.gym_member_id::text = v_search
      or
      s.full_name ilike '%' || v_search || '%'
      or s.member_code ilike '%' || v_search || '%'
      or (
        length(v_phone_search) >= 4 and exists (
          select 1 from public.person_contacts pc
          where pc.person_id = s.person_id
            and pc.contact_type = 'phone'::public.contact_type
            and regexp_replace(pc.value, '[^0-9]', '', 'g') like '%' || v_phone_search || '%'
        )
      )
    )
  order by s.full_name, s.gym_member_id
  limit greatest(1, least(coalesce(p_limit, 10), 10));
end;
$$;

revoke all on function public.search_entry_members(uuid, text, integer) from public;
grant execute on function public.search_entry_members(uuid, text, integer) to authenticated;

create or replace view public.v_gym_entries
with (security_invoker = true)
as
select
  me.gym_id,
  me.id as entry_id,
  me.gym_member_id,
  me.source,
  me.decision,
  me.decision_reason,
  me.membership_status,
  me.has_overdue_charges,
  me.occurred_at,
  me.financial_access_status
from public.member_entries me
union all
select
  fre.gym_id,
  fre.id as entry_id,
  fre.gym_member_id,
  'face'::public.entry_source,
  fre.decision,
  fre.decision_reason,
  null::text,
  false,
  fre.occurred_at,
  null::text
from public.face_recognition_events fre
order by occurred_at desc;

insert into public.alert_types(code, name, default_severity)
values ('MEMBERSHIP_GRACE', 'Membership renewal in grace period', 'warning')
on conflict (code) do update
set name = excluded.name, default_severity = excluded.default_severity;

create or replace function private.create_alert_from_member_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alert_type_code text;
  v_alert_type_id uuid;
  v_severity public.alert_severity;
  v_title text;
begin
  if new.source <> 'manual'::public.entry_source then return new; end if;

  if new.financial_access_status = 'grace' and new.decision = 'allowed' then
    v_alert_type_code := 'MEMBERSHIP_GRACE';
    v_severity := 'warning'::public.alert_severity;
    v_title := 'Renovacion pendiente dentro del periodo de gracia';
  elsif new.decision in ('denied', 'manual_review') and (
    new.financial_access_status in ('initial_payment_required', 'overdue')
    or new.has_overdue_charges
  ) then
    v_alert_type_code := 'MEMBERSHIP_UNPAID';
    v_severity := 'critical'::public.alert_severity;
    v_title := case
      when new.decision = 'manual_review'
        then 'Entrada autorizada manualmente con deuda pendiente'
      when new.financial_access_status = 'initial_payment_required'
        then 'Entrada denegada por pago inicial pendiente'
      else 'Entrada denegada por cargos fuera del periodo de gracia'
    end;
  elsif new.decision = 'denied' and new.membership_status = 'expired' then
    v_alert_type_code := 'MEMBERSHIP_EXPIRED';
    v_title := 'Entrada denegada por membresia vencida';
  else
    return new;
  end if;

  select at.id, coalesce(v_severity, at.default_severity)
  into v_alert_type_id, v_severity
  from public.alert_types at
  where at.code = v_alert_type_code;

  if v_alert_type_id is not null and not exists (
    select 1 from public.gym_alerts ga
    where ga.gym_id = new.gym_id
      and ga.gym_member_id = new.gym_member_id
      and ga.alert_type_id = v_alert_type_id
      and ga.title = v_title
      and ga.created_at >= date_trunc('day', new.occurred_at)
      and ga.created_at < date_trunc('day', new.occurred_at) + interval '1 day'
  ) then
    insert into public.gym_alerts(
      gym_id, branch_id, alert_type_id, gym_member_id,
      severity, title, message
    ) values (
      new.gym_id, new.branch_id, v_alert_type_id, new.gym_member_id,
      v_severity, v_title,
      coalesce(new.decision_reason, 'Revisar el estado de la membresia en recepcion.')
    );
  end if;

  return new;
end;
$$;

commit;
