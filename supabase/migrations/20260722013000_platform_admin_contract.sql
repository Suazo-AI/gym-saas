create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(auth.role() = 'service_role', false)
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'platform_role', '') = 'admin';
$$;

create or replace function public.get_platform_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin permission required'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'metrics', jsonb_build_object(
      'totalGyms', (select count(*) from public.gyms g where g.deleted_at is null),
      'activeGyms', (select count(*) from public.gyms g where g.deleted_at is null and g.status = 'active'),
      'trialingSubscriptions', (
        select count(*) from public.gym_saas_subscriptions s where s.status = 'trialing'
      ),
      'activeSubscriptions', (
        select count(*) from public.gym_saas_subscriptions s where s.status = 'active'
      ),
      'pastDueSubscriptions', (
        select count(*) from public.gym_saas_subscriptions s where s.status = 'past_due'
      ),
      'openInvoices', (
        select count(*) from public.saas_invoices i where i.status in ('draft', 'open', 'partially_paid')
      ),
      'overdueInvoices', (
        select count(*)
        from public.saas_invoices i
        where i.status in ('open', 'partially_paid')
          and i.due_at < timezone('utc', now())
      ),
      'settledSaasPayments', (
        select coalesce(sum(p.amount), 0)::text
        from public.saas_payments p
        where p.status = 'settled'
      )
    ),
    'gyms', coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t."createdAt" desc)
      from (
        select
          g.id as "gymId",
          g.trade_name as "tradeName",
          g.legal_name as "legalName",
          g.slug,
          g.status,
          g.default_currency as "defaultCurrency",
          g.timezone,
          g.created_at as "createdAt",
          s.status as "subscriptionStatus",
          sp.name as "saasPlanName",
          s.current_period_end as "currentPeriodEnd",
          (
            select count(*)
            from public.gym_branches b
            where b.gym_id = g.id and b.deleted_at is null
          ) as "branchCount",
          (
            select count(*)
            from public.gym_members gm
            where gm.gym_id = g.id and gm.deleted_at is null
          ) as "memberCount",
          (
            select count(*)
            from public.gym_users gu
            where gu.gym_id = g.id and gu.deleted_at is null and gu.status = 'active'
          ) as "staffCount"
        from public.gyms g
        left join public.gym_saas_subscriptions s
          on s.gym_id = g.id
          and s.status in ('trialing', 'active', 'past_due', 'paused')
        left join public.saas_plans sp on sp.id = s.saas_plan_id
        where g.deleted_at is null
        order by g.created_at desc
        limit 50
      ) t
    ), '[]'::jsonb),
    'subscriptions', coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t."createdAt" desc)
      from (
        select
          s.id as "subscriptionId",
          s.gym_id as "gymId",
          g.trade_name as "gymName",
          sp.name as "planName",
          s.status,
          s.current_period_start as "currentPeriodStart",
          s.current_period_end as "currentPeriodEnd",
          s.cancel_at_period_end as "cancelAtPeriodEnd",
          s.created_at as "createdAt"
        from public.gym_saas_subscriptions s
        join public.gyms g on g.id = s.gym_id
        join public.saas_plans sp on sp.id = s.saas_plan_id
        order by s.created_at desc
        limit 50
      ) t
    ), '[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t."createdAt" desc)
      from (
        select
          i.id as "invoiceId",
          i.gym_id as "gymId",
          g.trade_name as "gymName",
          i.invoice_number as "invoiceNumber",
          i.status,
          i.currency,
          i.total_amount::text as "totalAmount",
          i.amount_paid::text as "amountPaid",
          i.due_at as "dueAt",
          i.created_at as "createdAt"
        from public.saas_invoices i
        join public.gyms g on g.id = i.gym_id
        order by i.created_at desc
        limit 50
      ) t
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t."createdAt" desc)
      from (
        select
          p.id as "paymentId",
          p.gym_id as "gymId",
          g.trade_name as "gymName",
          p.status,
          p.amount::text,
          p.currency,
          p.provider,
          p.paid_at as "paidAt",
          p.created_at as "createdAt"
        from public.saas_payments p
        join public.gyms g on g.id = p.gym_id
        order by p.created_at desc
        limit 50
      ) t
    ), '[]'::jsonb),
    'auditLogs', coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t."occurredAt" desc)
      from (
        select
          a.id as "auditLogId",
          a.gym_id as "gymId",
          g.trade_name as "gymName",
          a.actor_user_id as "actorUserId",
          a.action,
          a.entity_table as "entityTable",
          a.entity_id as "entityId",
          a.occurred_at as "occurredAt"
        from public.audit_logs a
        left join public.gyms g on g.id = a.gym_id
        order by a.occurred_at desc
        limit 50
      ) t
    ), '[]'::jsonb)
  )
  into v_payload;

  return v_payload;
end;
$$;

create or replace function public.get_platform_gym_detail(p_gym_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin permission required'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'gym', to_jsonb(g),
    'subscription', (
      select to_jsonb(t)
      from (
        select
          s.id as "subscriptionId",
          s.status,
          sp.name as "planName",
          sp.price::text as "planPrice",
          sp.currency as "planCurrency",
          s.current_period_start as "currentPeriodStart",
          s.current_period_end as "currentPeriodEnd",
          s.cancel_at_period_end as "cancelAtPeriodEnd"
        from public.gym_saas_subscriptions s
        join public.saas_plans sp on sp.id = s.saas_plan_id
        where s.gym_id = g.id
        order by s.created_at desc
        limit 1
      ) t
    ),
    'branches', coalesce((
      select jsonb_agg(row_to_json(b)::jsonb order by b.name)
      from (
        select id, code, name, city, status, created_at as "createdAt"
        from public.gym_branches
        where gym_id = g.id and deleted_at is null
      ) b
    ), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t."createdAt" desc)
      from (
        select
          gu.id as "gymUserId",
          gu.auth_user_id as "authUserId",
          gu.employee_code as "employeeCode",
          gu.status,
          gu.created_at as "createdAt",
          coalesce(jsonb_agg(r.code order by r.code) filter (where r.code is not null), '[]'::jsonb) as roles
        from public.gym_users gu
        left join public.gym_user_roles gur on gur.gym_user_id = gu.id
        left join public.roles r on r.id = gur.role_id
        where gu.gym_id = g.id and gu.deleted_at is null
        group by gu.id
        order by gu.created_at desc
      ) t
    ), '[]'::jsonb),
    'memberCount', (
      select count(*)
      from public.gym_members gm
      where gm.gym_id = g.id and gm.deleted_at is null
    ),
    'recentAuditLogs', coalesce((
      select jsonb_agg(row_to_json(a)::jsonb order by a."occurredAt" desc)
      from (
        select
          id as "auditLogId",
          action,
          entity_table as "entityTable",
          entity_id as "entityId",
          occurred_at as "occurredAt"
        from public.audit_logs
        where gym_id = g.id
        order by occurred_at desc
        limit 20
      ) a
    ), '[]'::jsonb)
  )
  into v_payload
  from public.gyms g
  where g.id = p_gym_id
    and g.deleted_at is null;

  if v_payload is null then
    raise exception 'gym not found'
      using errcode = 'P0002';
  end if;

  return v_payload;
end;
$$;

revoke all on function public.get_platform_dashboard() from public;
revoke all on function public.get_platform_gym_detail(uuid) from public;

grant execute on function public.get_platform_dashboard() to authenticated, service_role;
grant execute on function public.get_platform_gym_detail(uuid) to authenticated, service_role;
