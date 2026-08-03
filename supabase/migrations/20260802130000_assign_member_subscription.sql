-- ============================================================================
-- Asignar membresia a un miembro existente
--
-- Motivo:
--   El alta de miembros permite crear una suscripcion inicial, pero no existe
--   una operacion para asignarla despues. Este contrato agrega una RPC atomica
--   que valida gimnasio, permiso y estado, registra la suscripcion y su evento,
--   genera opcionalmente el primer cargo y conserva la auditoria.
--
-- Alcance: funcion RPC, privilegios de ejecucion y contrato de auditoria.
-- No modifica tablas ni aplica conversiones entre monedas.
-- ============================================================================

begin;

-- ============================================================================
-- 1. RPC ATOMICA DE ASIGNACION
-- ============================================================================

create or replace function public.assign_member_subscription(
  p_gym_id uuid,
  p_gym_member_id uuid,
  p_membership_plan_id uuid,
  p_start_date date default current_date,
  p_billing_cycle_months integer default null,
  p_recurring_amount numeric default null,
  p_currency char(3) default null,
  p_auto_renew boolean default true,
  p_generate_first_charge boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.gym_members;
  v_plan public.membership_plans;
  v_subscription_id uuid;
  v_subscription_end_date date;
  v_charge_id uuid;
  v_start_date date := coalesce(p_start_date, current_date);
  v_cycle integer;
  v_amount numeric(14,2);
  v_currency char(3);
  v_actor uuid := auth.uid();
begin
  if not private.has_permission(p_gym_id, 'memberships.manage') then
    raise exception 'Insufficient permission: memberships.manage'
      using errcode = '42501';
  end if;

  select gm.*
  into v_member
  from public.gym_members gm
  where gm.id = p_gym_member_id
    and gm.gym_id = p_gym_id
    and gm.deleted_at is null
  for update;

  if not found then
    raise exception 'No encontramos el miembro en este gimnasio.'
      using errcode = 'P0002';
  end if;

  select mp.*
  into v_plan
  from public.membership_plans mp
  where mp.id = p_membership_plan_id
    and mp.gym_id = p_gym_id
    and mp.deleted_at is null
    and mp.is_active
  for share;

  if not found then
    raise exception 'El plan no pertenece a este gimnasio o no está activo.'
      using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.member_subscriptions ms
    where ms.gym_member_id = p_gym_member_id
      and ms.status in (
        'trialing'::public.subscription_status,
        'active'::public.subscription_status,
        'past_due'::public.subscription_status,
        'paused'::public.subscription_status
      )
  ) then
    raise exception 'El miembro ya tiene una membresía vigente. Cancélala antes de asignar otra.'
      using errcode = '22023';
  end if;

  if v_member.joined_on is not null and v_start_date < v_member.joined_on then
    raise exception 'La fecha de inicio no puede ser anterior al ingreso del miembro.'
      using errcode = '22023';
  end if;

  -- El precio, la moneda y el ciclo los define el plan, no quien llama.
  -- Los parametros existen para que el contrato sea explicito, pero si vienen
  -- deben coincidir con el plan: no hay regla de producto para descuentos ni
  -- para precios a medida, y PostgREST es alcanzable directamente por cualquier
  -- usuario con 'memberships.manage'.
  v_cycle := coalesce(p_billing_cycle_months, v_plan.billing_cycle_months);
  v_amount := coalesce(p_recurring_amount, v_plan.price);
  v_currency := coalesce(p_currency, v_plan.currency);

  if v_cycle is distinct from v_plan.billing_cycle_months then
    raise exception 'El ciclo de cobro debe ser el del plan.'
      using errcode = '22023';
  end if;

  if v_amount is distinct from v_plan.price then
    raise exception 'El monto debe ser el precio del plan.'
      using errcode = '22023';
  end if;

  if v_currency is distinct from v_plan.currency then
    raise exception 'La moneda debe ser la del plan.'
      using errcode = '22023';
  end if;

  if v_cycle <= 0 or v_amount < 0 then
    raise exception 'El ciclo de cobro y el monto deben ser válidos.'
      using errcode = '22023';
  end if;

  insert into public.member_subscriptions(
    gym_member_id,
    membership_plan_id,
    status,
    start_date,
    billing_cycle_months,
    recurring_amount,
    currency,
    auto_renew,
    created_by
  )
  values (
    p_gym_member_id,
    p_membership_plan_id,
    'active'::public.subscription_status,
    v_start_date,
    v_cycle,
    v_amount,
    v_currency,
    p_auto_renew,
    v_actor
  )
  returning id, end_date into v_subscription_id, v_subscription_end_date;

  insert into public.member_subscription_events(
    member_subscription_id,
    previous_status,
    new_status,
    reason,
    actor_user_id
  )
  values (
    v_subscription_id,
    null,
    'active'::public.subscription_status,
    'Membresía asignada.',
    v_actor
  );

  if p_generate_first_charge then
    insert into public.membership_charges(
      gym_member_id,
      member_subscription_id,
      period_start,
      period_end,
      due_date,
      amount_due,
      currency,
      status
    )
    values (
      p_gym_member_id,
      v_subscription_id,
      v_start_date,
      (
        v_start_date
        + pg_catalog.make_interval(months => v_cycle)
        - interval '1 day'
      )::date,
      v_start_date,
      v_amount,
      v_currency,
      case
        when v_start_date < current_date then 'overdue'::public.charge_status
        else 'pending'::public.charge_status
      end
    )
    returning id into v_charge_id;
  end if;

  if v_member.status = 'prospect'::public.member_status then
    update public.gym_members
    set
      status = 'active'::public.member_status,
      updated_at = timezone('utc', now())
    where id = p_gym_member_id;
  end if;

  insert into public.audit_logs(
    gym_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    before_data,
    after_data
  )
  values (
    p_gym_id,
    v_actor,
    'membership.assigned',
    'member_subscriptions',
    v_subscription_id::text,
    null,
    jsonb_build_object(
      'gymMemberId', p_gym_member_id,
      'membershipPlanId', p_membership_plan_id,
      'chargeId', v_charge_id
    )
  );

  return jsonb_build_object(
    'subscriptionId', v_subscription_id,
    'gymMemberId', p_gym_member_id,
    'membershipPlanId', p_membership_plan_id,
    'planName', v_plan.name,
    'status', 'active',
    'startDate', v_start_date,
    'endDate', v_subscription_end_date,
    'billingCycleMonths', v_cycle,
    'recurringAmount', v_amount::text,
    'currency', v_currency,
    'chargeId', v_charge_id,
    'chargeAmountDue', case when v_charge_id is null then null else v_amount::text end,
    'chargeDueDate', case when v_charge_id is null then null else v_start_date end
  );
end;
$$;

-- ============================================================================
-- 2. PRIVILEGIOS
-- ============================================================================

revoke all on function public.assign_member_subscription(
  uuid, uuid, uuid, date, integer, numeric, character, boolean, boolean
) from public;

grant execute on function public.assign_member_subscription(
  uuid, uuid, uuid, date, integer, numeric, character, boolean, boolean
) to authenticated, service_role;

commit;

-- ============================================================================
-- VERIFICACION (ejecutar despues de aplicar)
-- ============================================================================
-- -- La funcion existe, es security definer y no usa un search_path implicito:
-- select n.nspname, p.proname, p.prosecdef, p.proconfig
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname = 'assign_member_subscription';
--
-- -- authenticated puede ejecutar, pero public no:
-- select
--   has_function_privilege(
--     'authenticated',
--     'public.assign_member_subscription(uuid, uuid, uuid, date, integer, numeric, character, boolean, boolean)',
--     'execute'
--   ) as authenticated_can_execute,
--   has_function_privilege(
--     'public',
--     'public.assign_member_subscription(uuid, uuid, uuid, date, integer, numeric, character, boolean, boolean)',
--     'execute'
--   ) as public_can_execute;
--
-- -- Cada suscripcion creada por la RPC tiene su evento inicial:
-- select ms.id, ms.gym_member_id, mse.new_status, mse.occurred_at
-- from public.member_subscriptions ms
-- left join public.member_subscription_events mse
--   on mse.member_subscription_id = ms.id
--  and mse.previous_status is null
-- where ms.created_at >= timezone('utc', now()) - interval '1 day';

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- La funcion es aditiva. Los datos creados por su uso son historicos y no se
-- eliminan durante el rollback.
--
-- begin;
--
-- drop function if exists public.assign_member_subscription(
--   uuid, uuid, uuid, date, integer, numeric, character, boolean, boolean
-- );
--
-- commit;
