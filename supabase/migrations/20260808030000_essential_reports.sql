begin;

create or replace function public.get_owner_dashboard(
  p_gym_id uuid,
  p_expiring_days integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_can_members boolean;
  v_can_income boolean;
  v_can_entries boolean;
  v_can_alerts boolean;
  v_result jsonb;
begin
  if p_expiring_days is null or p_expiring_days < 0 then
    raise exception 'Expiration window must be zero or greater' using errcode = '22023';
  end if;

  if not private.has_permission(p_gym_id, 'dashboard.read') then
    raise exception 'Insufficient permission: dashboard.read' using errcode = '42501';
  end if;

  v_can_members := private.has_permission(p_gym_id, 'members.read');
  v_can_income := private.has_permission(p_gym_id, 'income.read');
  v_can_entries := private.has_permission(p_gym_id, 'faces.read');
  v_can_alerts := private.has_permission(p_gym_id, 'alerts.read');

  select jsonb_build_object(
    'activeMembers', case when v_can_members then (
      select count(*) from public.gym_members gm
      where gm.gym_id = p_gym_id and gm.deleted_at is null and gm.status = 'active'
    ) else null end,
    'expiringMemberships', case when v_can_members then (
      select count(*) from public.member_subscriptions ms
      join public.gym_members gm on gm.id = ms.gym_member_id
      where gm.gym_id = p_gym_id and gm.deleted_at is null and ms.status = 'active'
        and ms.end_date between current_date and current_date + p_expiring_days
    ) else null end,
    'overdueMembers', case when v_can_members then (
      select count(distinct mc.gym_member_id) from public.membership_charges mc
      join public.gym_members gm on gm.id = mc.gym_member_id
      where gm.gym_id = p_gym_id and gm.deleted_at is null
        and private.charge_is_overdue(mc.status, mc.due_date, current_date)
    ) else null end,
    'income', case when v_can_income then jsonb_build_object(
      'today', jsonb_build_object(
        'USD', (select coalesce(sum(i.amount), 0)::numeric(14,2)::text from public.v_gym_income i where i.gym_id = p_gym_id and i.currency = 'USD' and i.occurred_at >= date_trunc('day', timezone('utc', now()))),
        'NIO', (select coalesce(sum(i.amount), 0)::numeric(14,2)::text from public.v_gym_income i where i.gym_id = p_gym_id and i.currency = 'NIO' and i.occurred_at >= date_trunc('day', timezone('utc', now())))
      ),
      'month', jsonb_build_object(
        'USD', (select coalesce(sum(i.amount), 0)::numeric(14,2)::text from public.v_gym_income i where i.gym_id = p_gym_id and i.currency = 'USD' and i.occurred_at >= date_trunc('month', timezone('utc', now()))),
        'NIO', (select coalesce(sum(i.amount), 0)::numeric(14,2)::text from public.v_gym_income i where i.gym_id = p_gym_id and i.currency = 'NIO' and i.occurred_at >= date_trunc('month', timezone('utc', now())))
      )
    ) else null end,
    'entriesToday', case when v_can_entries then (
      select count(*) from public.v_gym_entries e
      where e.gym_id = p_gym_id and e.decision = 'allowed'
        and e.occurred_at >= date_trunc('day', timezone('utc', now()))
    ) else null end,
    'openAlerts', case when v_can_alerts then (
      select count(*) from public.gym_alerts ga
      where ga.gym_id = p_gym_id and ga.status in ('open', 'acknowledged')
    ) else null end
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.get_owner_dashboard(p_gym_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_owner_dashboard(p_gym_id, 7);
$$;

revoke all on function public.get_owner_dashboard(uuid, integer) from public;
revoke all on function public.get_owner_dashboard(uuid) from public;
grant execute on function public.get_owner_dashboard(uuid, integer) to authenticated, service_role;
grant execute on function public.get_owner_dashboard(uuid) to authenticated, service_role;

comment on function public.get_owner_dashboard(uuid, integer) is
'Owner operational dashboard with a configurable membership expiration window. Requires dashboard.read and redacts metric families without their source permission.';

comment on function public.get_owner_dashboard(uuid) is
'Owner operational dashboard with the default seven day membership expiration window.';

commit;
