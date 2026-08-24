-- Codigo de miembro secuencial y legible, generado por gimnasio.
--
-- Por que existe esta migracion.
--
-- El codigo de miembro no es un identificador interno: la identidad real es
-- gym_members.id, un uuid que nunca choca. El codigo existe para que una
-- persona lo use. Aparece en la busqueda de pagos ("Escribe el nombre o codigo
-- del miembro"), en el recibo impreso ("Codigo de socio"), en la lista de
-- entradas, en el resultado del reconocimiento facial y en la exportacion a
-- CSV. Un socio lo dice en voz alta en el mostrador.
--
-- Hasta hoy create_gym_member generaba 'M-' + 8 caracteres hexadecimales de un
-- uuid cuando el codigo llegaba vacio. Eso no choca, pero 'M-3F9A2C1E' no se
-- dicta por telefono ni se copia de una tarjeta sin equivocarse. Los codigos
-- reales de la base lo confirman: nadie dejo el campo vacio y aparecieron
-- 'UX-R1-20260821-1459' y '888', tecleados a mano.
--
-- Desde aca el codigo es 'M-' seguido de seis digitos, secuencial dentro de
-- cada gimnasio. 'M-000042' se dice en voz alta.
--
-- Que NO cambia: el codigo sigue sin ser una frontera de seguridad. El
-- aislamiento lo da RLS por gym_id y la identidad la da gym_members.id.

-- ---------------------------------------------------------------------------
-- 1. Contador por gimnasio
--
-- Una fila por gimnasio. El incremento se hace con un upsert que devuelve el
-- valor ya reservado, asi que dos altas simultaneas toman el bloqueo de fila
-- del mismo gimnasio y salen con numeros distintos. Un max(codigo)+1 leido
-- aparte no da esa garantia.
--
-- Vive en `private` porque ningun cliente tiene por que verlo ni tocarlo.
-- ---------------------------------------------------------------------------
create table if not exists private.member_code_counters (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  last_value bigint not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

revoke all on table private.member_code_counters from public;
revoke all on table private.member_code_counters from anon, authenticated;

comment on table private.member_code_counters is
  'Ultimo numero de codigo de miembro entregado por gimnasio. Solo lo toca private.next_member_code().';

-- ---------------------------------------------------------------------------
-- 2. Formato unico, en un solo lugar
-- ---------------------------------------------------------------------------
create or replace function private.format_member_code(p_value bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'M-' || lpad(p_value::text, 6, '0');
$$;

-- ---------------------------------------------------------------------------
-- 3. Generador
--
-- El bucle existe porque el codigo manual sigue permitido: alguien puede haber
-- escrito 'M-000042' a mano y ocupado un numero que el contador todavia no
-- entrego. En ese caso se saltea y sigue. El tope de intentos evita un bucle
-- infinito si algo quedo inconsistente; se prefiere un error claro a colgar la
-- transaccion.
-- ---------------------------------------------------------------------------
create or replace function private.next_member_code(p_gym_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_value bigint;
  v_code text;
  v_attempts int := 0;
begin
  loop
    v_attempts := v_attempts + 1;
    if v_attempts > 10000 then
      raise exception 'No se pudo generar un codigo de miembro libre para el gimnasio %', p_gym_id
        using errcode = 'P0001';
    end if;

    insert into private.member_code_counters as c (gym_id, last_value)
    values (p_gym_id, 1)
    on conflict (gym_id) do update
      set last_value = c.last_value + 1,
          updated_at = timezone('utc', now())
    returning c.last_value into v_value;

    v_code := private.format_member_code(v_value);

    exit when not exists (
      select 1
      from public.gym_members gm
      where gm.gym_id = p_gym_id
        and lower(gm.member_code) = lower(v_code)
        and gm.deleted_at is null
    );
  end loop;

  return v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Normalizar lo que ya existe
--
-- Dos casos distintos, a proposito:
--
--   a) El codigo ya tiene la forma 'M-<digitos>'. Se conserva el numero y solo
--      se rellena a seis digitos. 'M-0001' pasa a 'M-000001' y sigue siendo el
--      mismo socio con el mismo numero.
--
--   b) El codigo no tiene esa forma. Son los tecleados a mano durante las
--      pruebas: 'UX-R1-20260821-1459', '888'. Reciben un numero nuevo, tomado
--      despues del mayor que ya exista en su gimnasio, en orden de antiguedad
--      para que el resultado sea el mismo corra cuando corra.
--
-- Se toca solo lo vivo. Un miembro borrado logicamente conserva su codigo
-- historico: el indice unico ya lo excluye y reescribir historia para que se
-- vea prolija es justo lo que este repositorio no hace.
-- ---------------------------------------------------------------------------
do $$
declare
  v_gym record;
  v_row record;
  v_next bigint;
begin
  for v_gym in select distinct gym_id from public.gym_members where deleted_at is null loop

    -- (a) rellenar los que ya son 'M-<digitos>'
    update public.gym_members gm
    set member_code = private.format_member_code((substring(gm.member_code from 3))::bigint)
    where gm.gym_id = v_gym.gym_id
      and gm.deleted_at is null
      and gm.member_code ~ '^[Mm]-[0-9]+$'
      and gm.member_code <> private.format_member_code((substring(gm.member_code from 3))::bigint);

    -- el proximo numero libre sale del mayor ya usado en este gimnasio
    select coalesce(max((substring(member_code from 3))::bigint), 0)
    into v_next
    from public.gym_members
    where gym_id = v_gym.gym_id
      and deleted_at is null
      and member_code ~ '^M-[0-9]+$';

    -- (b) renumerar lo que no sigue el formato, del mas viejo al mas nuevo
    for v_row in
      select id
      from public.gym_members
      where gym_id = v_gym.gym_id
        and deleted_at is null
        and member_code !~ '^M-[0-9]{6}$'
      order by created_at, id
    loop
      v_next := v_next + 1;
      update public.gym_members
      set member_code = private.format_member_code(v_next)
      where id = v_row.id;
    end loop;

    -- el contador arranca donde termino la numeracion real
    insert into private.member_code_counters (gym_id, last_value)
    values (v_gym.gym_id, v_next)
    on conflict (gym_id) do update
      set last_value = greatest(private.member_code_counters.last_value, excluded.last_value),
          updated_at = timezone('utc', now());
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. create_gym_member usa el generador
--
-- Cuerpo identico al de 20260721174500_members_api_contract.sql salvo dos
-- cosas: el bloque que generaba el codigo desde un uuid, y un mensaje claro
-- cuando el codigo manual ya esta ocupado. Antes eso salia como un 23505 crudo
-- y la recepcionista perdia el formulario entero sin entender por que.
-- ---------------------------------------------------------------------------
create or replace function public.create_gym_member(
  p_gym_id uuid,
  p_first_name text,
  p_last_name text,
  p_member_code text default null,
  p_branch_id uuid default null,
  p_phone text default null,
  p_email text default null,
  p_joined_on date default current_date,
  p_membership_plan_id uuid default null,
  p_subscription_start_date date default null,
  p_create_initial_charge boolean default false,
  p_payment_method_id uuid default null,
  p_payment_amount numeric default null,
  p_payment_currency char(3) default null,
  p_payment_paid_at timestamptz default null,
  p_payment_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_person_id uuid;
  v_member_id uuid;
  v_member_code text;
  v_plan public.membership_plans;
  v_subscription_id uuid;
  v_charge_id uuid;
  v_payment_id uuid;
  v_actor uuid := auth.uid();
begin
  if not private.has_permission(p_gym_id, 'members.manage') then
    raise exception 'Insufficient permission: members.manage';
  end if;

  if nullif(trim(p_first_name), '') is null or nullif(trim(p_last_name), '') is null then
    raise exception 'First name and last name are required';
  end if;

  if p_branch_id is not null and not exists (
    select 1 from public.gym_branches gb
    where gb.id = p_branch_id
      and gb.gym_id = p_gym_id
      and gb.deleted_at is null
  ) then
    raise exception 'Branch does not belong to this gym';
  end if;

  if p_membership_plan_id is not null then
    select *
    into v_plan
    from public.membership_plans mp
    where mp.id = p_membership_plan_id
      and mp.gym_id = p_gym_id
      and mp.deleted_at is null
      and mp.is_active
    for share;

    if not found then
      raise exception 'Membership plan does not belong to this gym';
    end if;
  end if;

  if p_payment_amount is not null and (p_payment_amount <= 0 or p_payment_method_id is null or p_membership_plan_id is null) then
    raise exception 'A positive payment amount, payment method and plan are required to create an initial payment';
  end if;

  if p_payment_method_id is not null and not exists (
    select 1 from public.payment_methods pm
    where pm.id = p_payment_method_id and pm.is_active
  ) then
    raise exception 'Payment method is not active';
  end if;

  insert into public.persons(first_name, last_name, created_by)
  values (trim(p_first_name), trim(p_last_name), v_actor)
  returning id into v_person_id;

  if nullif(trim(coalesce(p_phone, '')), '') is not null then
    insert into public.person_contacts(person_id, contact_type, value, is_primary)
    values (v_person_id, 'phone', trim(p_phone), true);
  end if;

  if nullif(trim(coalesce(p_email, '')), '') is not null then
    insert into public.person_contacts(person_id, contact_type, value, is_primary)
    values (v_person_id, 'email', lower(trim(p_email)), true);
  end if;

  v_member_code := nullif(trim(coalesce(p_member_code, '')), '');
  if v_member_code is null then
    v_member_code := private.next_member_code(p_gym_id);
  elsif exists (
    select 1
    from public.gym_members gm
    where gm.gym_id = p_gym_id
      and lower(gm.member_code) = lower(v_member_code)
      and gm.deleted_at is null
  ) then
    raise exception 'Ya existe un miembro con el codigo % en este gimnasio.', v_member_code
      using errcode = '23505';
  end if;

  insert into public.gym_members(
    gym_id,
    person_id,
    home_branch_id,
    member_code,
    status,
    joined_on,
    created_by
  )
  values (
    p_gym_id,
    v_person_id,
    p_branch_id,
    v_member_code,
    case when p_membership_plan_id is null then 'prospect'::public.member_status else 'active'::public.member_status end,
    coalesce(p_joined_on, current_date),
    v_actor
  )
  returning id into v_member_id;

  if p_membership_plan_id is not null then
    insert into public.member_subscriptions(
      gym_member_id,
      membership_plan_id,
      status,
      start_date,
      billing_cycle_months,
      recurring_amount,
      currency,
      created_by
    )
    values (
      v_member_id,
      p_membership_plan_id,
      'active',
      coalesce(p_subscription_start_date, p_joined_on, current_date),
      v_plan.billing_cycle_months,
      v_plan.price,
      v_plan.currency,
      v_actor
    )
    returning id into v_subscription_id;

    if p_create_initial_charge or p_payment_amount is not null then
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
        v_member_id,
        v_subscription_id,
        coalesce(p_subscription_start_date, p_joined_on, current_date),
        (coalesce(p_subscription_start_date, p_joined_on, current_date)
          + make_interval(months => v_plan.billing_cycle_months)
          - interval '1 day')::date,
        coalesce(p_subscription_start_date, p_joined_on, current_date),
        v_plan.price,
        v_plan.currency,
        'pending'
      )
      returning id into v_charge_id;
    end if;
  end if;

  if p_payment_amount is not null then
    insert into public.member_payments(
      gym_id,
      gym_member_id,
      branch_id,
      payment_method_id,
      status,
      amount,
      currency,
      receipt_number,
      paid_at,
      received_by,
      notes
    )
    values (
      p_gym_id,
      v_member_id,
      p_branch_id,
      p_payment_method_id,
      'settled',
      p_payment_amount,
      coalesce(p_payment_currency, v_plan.currency),
      'R-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 10)),
      coalesce(p_payment_paid_at, timezone('utc', now())),
      v_actor,
      p_payment_notes
    )
    returning id into v_payment_id;

    insert into public.member_payment_allocations(member_payment_id, membership_charge_id, amount)
    values (v_payment_id, v_charge_id, least(p_payment_amount, v_plan.price));
  end if;

  insert into public.audit_logs(gym_id, actor_user_id, action, entity_table, entity_id, after_data)
  values (
    p_gym_id,
    v_actor,
    'member.created',
    'gym_members',
    v_member_id::text,
    jsonb_build_object('personId', v_person_id, 'memberCode', v_member_code)
  );

  return v_member_id;
end;
$$;
