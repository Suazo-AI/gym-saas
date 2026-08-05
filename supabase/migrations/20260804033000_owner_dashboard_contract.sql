begin;

create or replace function public.get_owner_dashboard(p_gym_id uuid)
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
        and ms.end_date between current_date and current_date + 7
    ) else null end,
    'overdueMembers', case when v_can_members then (
      select count(distinct mc.gym_member_id) from public.membership_charges mc
      join public.gym_members gm on gm.id = mc.gym_member_id
      where gm.gym_id = p_gym_id and gm.deleted_at is null
        and mc.status in ('pending', 'partial', 'overdue') and mc.due_date < current_date
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
      select count(*) from public.face_recognition_events fre
      where fre.gym_id = p_gym_id and fre.decision = 'allowed'
        and fre.occurred_at >= date_trunc('day', timezone('utc', now()))
    ) else null end,
    'openAlerts', case when v_can_alerts then (
      select count(*) from public.gym_alerts ga
      where ga.gym_id = p_gym_id and ga.status in ('open', 'acknowledged')
    ) else null end
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_owner_dashboard(uuid) from public;
grant execute on function public.get_owner_dashboard(uuid) to authenticated, service_role;

comment on function public.get_owner_dashboard(uuid) is
'Owner operational dashboard. Requires dashboard.read and redacts metric families without their source permission. Money is aggregated in PostgreSQL and never converted or mixed across currencies.';

commit;
