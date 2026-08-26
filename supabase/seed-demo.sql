-- ============================================================================
-- Ambiente de DEMOSTRACION. Datos inventados.
--
-- Crea un gimnasio ficticio, "Vertice Fitness", con 80 miembros y tres meses
-- de operacion: cargos, pagos, morosidad, entradas diarias y otros ingresos.
--
-- No es un gimnasio real. No contiene datos de ninguna persona real.
-- Nunca correr esto contra el ambiente de piloto ni contra produccion.
--
-- Cuentas (contrasena local: LocalDev123!):
--   demo-owner@fitmanager.local      dueno de Vertice Fitness
--   demo-reception@fitmanager.local  recepcion de Vertice Fitness
--
-- Es idempotente: correrlo dos veces no duplica nada.
-- ============================================================================

begin;

-- ============================================================================
-- 1. CUENTAS
-- ============================================================================

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values
  (
    'a0000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'demo-owner@fitmanager.local',
    extensions.crypt('LocalDev123!', extensions.gen_salt('bf')),
    timezone('utc', now()), '', '', '', '', '', '',
    timezone('utc', now()), timezone('utc', now()),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Marcela Herrera"}'::jsonb
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'demo-reception@fitmanager.local',
    extensions.crypt('LocalDev123!', extensions.gen_salt('bf')),
    timezone('utc', now()), '', '', '', '', '', '',
    timezone('utc', now()), timezone('utc', now()),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Kevin Zeledon"}'::jsonb
  )
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
values
  (
    'a1000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    '{"sub":"a0000000-0000-4000-8000-000000000001","email":"demo-owner@fitmanager.local","email_verified":true,"phone_verified":false}'::jsonb,
    'email', timezone('utc', now()), timezone('utc', now()), timezone('utc', now())
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000002',
    '{"sub":"a0000000-0000-4000-8000-000000000002","email":"demo-reception@fitmanager.local","email_verified":true,"phone_verified":false}'::jsonb,
    'email', timezone('utc', now()), timezone('utc', now()), timezone('utc', now())
  )
on conflict (provider_id, provider) do nothing;

-- ============================================================================
-- 2. GIMNASIO, SUCURSAL Y PERSONAL
-- ============================================================================

insert into public.gyms (
  id, legal_name, trade_name, slug, default_currency, timezone, created_by
)
values (
  'a2000000-0000-4000-8000-000000000001',
  'Vertice Fitness Nicaragua S.A.',
  'Vertice Fitness',
  'vertice-fitness',
  'NIO',
  'America/Managua',
  'a0000000-0000-4000-8000-000000000001'
)
on conflict (id) do nothing;

insert into public.gym_saas_subscriptions (
  gym_id, saas_plan_id, status, current_period_start, current_period_end
)
select
  'a2000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'active',
  date_trunc('month', timezone('utc', now())),
  date_trunc('month', timezone('utc', now())) + interval '1 month'
where not exists (
  select 1 from public.gym_saas_subscriptions
  where gym_id = 'a2000000-0000-4000-8000-000000000001'
);

insert into public.gym_branches (
  id, gym_id, code, name, city, address_line_1
)
values (
  'a3000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'central',
  'Sucursal Bello Horizonte',
  'Managua',
  'Rotonda Bello Horizonte, 2 cuadras al sur'
)
on conflict (id) do nothing;

insert into public.gym_users (
  gym_id, auth_user_id, employee_code, status, invited_by, accepted_at
)
values (
  'a2000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000002',
  'REC-001',
  'active',
  'a0000000-0000-4000-8000-000000000001',
  timezone('utc', now())
)
on conflict do nothing;

insert into public.gym_user_roles (gym_user_id, role_id, assigned_by)
select gu.id, r.id, 'a0000000-0000-4000-8000-000000000001'
from public.gym_users gu
join public.roles r on r.gym_id = gu.gym_id and r.code = 'receptionist'
where gu.auth_user_id = 'a0000000-0000-4000-8000-000000000002'
  and gu.gym_id = 'a2000000-0000-4000-8000-000000000001'
on conflict do nothing;

-- ============================================================================
-- 3. PLANES DE MEMBRESIA
-- ============================================================================

insert into public.membership_plans (
  id, gym_id, code, name, billing_cycle_months, duration_months,
  price, currency, grace_days
)
values
  ('a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001',
   'mensual', 'Mensual', 1, 1, 900.00, 'NIO', 3),
  ('a4000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001',
   'trimestral', 'Trimestral', 3, 3, 2400.00, 'NIO', 5),
  ('a4000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000001',
   'anual', 'Anual', 12, 12, 8500.00, 'NIO', 7)
on conflict (id) do nothing;

-- ============================================================================
-- 4. CATEGORIAS DE INGRESO
-- ============================================================================

insert into public.income_categories (id, gym_id, code, name, is_membership_related)
values
  ('a5000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001',
   'bebidas', 'Bebidas y agua', false),
  ('a5000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001',
   'suplementos', 'Suplementos', false),
  ('a5000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000001',
   'dia', 'Pase por dia', false)
on conflict (id) do nothing;

commit;

-- ============================================================================
-- 5. OCHENTA MIEMBROS CON TRES MESES DE HISTORIA
--
-- Reparto:
--   1..62   activos y al dia
--   63..72  activos pero morosos (el cargo del mes corriente sigue pendiente)
--   73..77  inactivos, suscripcion cancelada
--   78..80  prospectos, sin suscripcion
-- ============================================================================

do $demo$
declare
  v_gym        uuid := 'a2000000-0000-4000-8000-000000000001';
  v_branch     uuid := 'a3000000-0000-4000-8000-000000000001';
  v_owner      uuid := 'a0000000-0000-4000-8000-000000000001';
  v_reception  uuid := 'a0000000-0000-4000-8000-000000000002';
  v_cash       uuid;
  v_transfer   uuid;

  nombres    text[] := array[
    'Ana','Jose','Maria','Carlos','Lucia','Jorge','Sofia','Luis','Karla','Marlon',
    'Yahoska','Bayardo','Massiel','Denis','Xiomara','Wilfredo','Scarleth','Elvin',
    'Heydi','Norlan','Tatiana','Gerald','Ivania','Rodrigo','Meyling','Cristhian',
    'Auxiliadora','Freddy','Jaritza','Douglas'];
  apellidos  text[] := array[
    'Martinez','Ramirez','Castillo','Lopez','Gutierrez','Mendoza','Zeledon','Rocha',
    'Sequeira','Membreno','Trana','Chavarria','Aleman','Bermudez','Talavera','Urbina',
    'Pavon','Sandoval','Obando','Calero','Baltodano','Icaza','Solorzano','Narvaez',
    'Cerda','Gaitan','Espinoza','Duarte','Vanegas','Ortega'];

  i            int;
  v_person     uuid;
  v_member     uuid;
  v_sub        uuid;
  v_plan       uuid;
  v_price      numeric(14,2);
  v_cycle      int;
  v_joined     date;
  v_mstatus    public.member_status;
  v_sstatus    public.subscription_status;
  p            int;
  v_pstart     date;
  v_pend       date;
  v_charge     uuid;
  v_paid       boolean;
  v_payment    uuid;
  d            int;
  v_visits     int;
  v_when       timestamptz;
  v_decision   public.access_decision;
  v_entry_src  public.entry_source;
  v_overdue    boolean;
  v_seq        int := 0;
begin
  select id into v_cash from public.payment_methods where code = 'cash';
  select id into v_transfer from public.payment_methods where code = 'transfer';
  if v_transfer is null then
    v_transfer := v_cash;
  end if;

  -- Si ya corrio antes, no lo repite.
  if exists (select 1 from public.gym_members where gym_id = v_gym) then
    raise notice 'seed-demo: los miembros ya existen, no se vuelve a generar';
    return;
  end if;

  for i in 1..80 loop
    v_person := ('a6000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;
    v_member := ('a7000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;
    v_sub    := ('a8000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;

    -- Plan: la mayoria mensual, algunos trimestrales, pocos anuales.
    if i % 10 = 0 then
      v_plan := 'a4000000-0000-4000-8000-000000000003';
      v_price := 8500.00;
      v_cycle := 12;
    elsif i % 10 in (3, 6, 9) then
      v_plan := 'a4000000-0000-4000-8000-000000000002';
      v_price := 2400.00;
      v_cycle := 3;
    else
      v_plan := 'a4000000-0000-4000-8000-000000000001';
      v_price := 900.00;
      v_cycle := 1;
    end if;

    -- Antiguedad repartida a lo largo de trece meses.
    v_joined := (current_date - ((i * 5) % 400))::date;

    if i <= 62 then
      v_mstatus := 'active';
      v_sstatus := 'active';
    elsif i <= 72 then
      v_mstatus := 'active';
      v_sstatus := 'past_due';
    elsif i <= 77 then
      v_mstatus := 'inactive';
      v_sstatus := 'canceled';
    else
      v_mstatus := 'prospect';
      v_sstatus := null;
    end if;

    insert into public.persons (
      id, first_name, last_name, second_last_name, birth_date, sex, created_by
    )
    values (
      v_person,
      nombres[1 + (i * 7) % array_length(nombres, 1)],
      apellidos[1 + (i * 11) % array_length(apellidos, 1)],
      apellidos[1 + (i * 17) % array_length(apellidos, 1)],
      (date '1975-01-01' + ((i * 137) % 9000))::date,
      case when i % 2 = 0 then 'female' else 'male' end,
      v_owner
    );

    insert into public.person_contacts (person_id, contact_type, value, is_primary)
    values (
      v_person,
      'phone',
      '8' || lpad(((i * 7919) % 10000000)::text, 7, '0'),
      true
    );

    insert into public.gym_members (
      id, gym_id, person_id, home_branch_id, member_code, status, joined_on, created_by
    )
    values (
      v_member, v_gym, v_person, v_branch,
      'M-' || lpad(i::text, 6, '0'),
      v_mstatus, v_joined, v_owner
    );

    continue when v_sstatus is null;

    insert into public.member_subscriptions (
      id, gym_member_id, membership_plan_id, status, start_date,
      billing_cycle_months, recurring_amount, currency, created_by
    )
    values (
      v_sub, v_member, v_plan, v_sstatus, v_joined,
      v_cycle, v_price, 'NIO', v_owner
    );

    -- ---- Cargos: los tres ultimos periodos del plan -----------------------
    for p in reverse 2..0 loop
      v_pstart := (date_trunc('month', current_date) - (p * v_cycle || ' months')::interval)::date;
      v_pend   := (v_pstart + (v_cycle || ' months')::interval - interval '1 day')::date;

      continue when v_pstart < v_joined;

      v_charge := extensions.gen_random_uuid();

      -- Moroso o cancelado: el periodo corriente queda sin pagar.
      v_paid := not (p = 0 and v_sstatus in ('past_due', 'canceled'));

      insert into public.membership_charges (
        id, gym_member_id, member_subscription_id, period_start, period_end,
        due_date, amount_due, currency, status
      )
      values (
        v_charge, v_member, v_sub, v_pstart, v_pend, v_pstart,
        v_price, 'NIO',
        case when v_paid then 'paid'::public.charge_status
             else 'pending'::public.charge_status end
      );

      continue when not v_paid;

      v_seq := v_seq + 1;
      v_payment := extensions.gen_random_uuid();

      insert into public.member_payments (
        id, gym_id, gym_member_id, branch_id, payment_method_id, status,
        amount, currency, receipt_number, paid_at, received_by
      )
      values (
        v_payment, v_gym, v_member, v_branch,
        case when i % 5 = 0 then v_transfer else v_cash end,
        'settled', v_price, 'NIO',
        'R-' || lpad(v_seq::text, 5, '0'),
        -- El socio paga cuando puede, no el dia uno. Se reparte a lo largo del
        -- periodo y nunca se adelanta a hoy: un recibo con fecha futura no
        -- existe, y el panel de ingresos lo mostraria como plata ya cobrada.
        least(
          (v_pstart + ((i * 13) % 26 || ' days')::interval
                    + ((7 + (i % 13)) || ' hours')::interval)::timestamptz,
          timezone('utc', now()) - ((i % 40) || ' minutes')::interval
        ),
        v_reception
      );

      insert into public.member_payment_allocations (
        member_payment_id, membership_charge_id, amount
      )
      values (v_payment, v_charge, v_price);
    end loop;

    -- ---- Entradas de los ultimos 30 dias ----------------------------------
    continue when v_sstatus = 'canceled';

    v_overdue := (v_sstatus = 'past_due');

    for d in 0..29 loop
      -- Domingo cerrado.
      continue when extract(dow from current_date - d) = 0;

      -- Cada miembro viene entre dos y cinco veces por semana.
      v_visits := 2 + (i % 4);
      continue when ((d * 7 + i) % 7) >= v_visits;

      v_when := (current_date - d)::timestamptz
                + ((6 + (i % 15)) || ' hours')::interval
                + (((i * 13) % 60) || ' minutes')::interval;

      if v_overdue then
        -- Los primeros dias caen dentro de la gracia y entran; despues se niega.
        v_decision := case when d >= 27 then 'allowed'::public.access_decision
                           else 'denied'::public.access_decision end;
      else
        v_decision := 'allowed'::public.access_decision;
      end if;

      -- Dos de cada tres entradas llegan por reconocimiento facial.
      v_entry_src := case when (i + d) % 3 = 0 then 'manual'::public.entry_source
                          else 'face'::public.entry_source end;

      insert into public.member_entries (
        gym_id, gym_member_id, branch_id, source, decision, decision_reason,
        membership_status, has_overdue_charges, registered_by, occurred_at
      )
      values (
        v_gym, v_member, v_branch, v_entry_src, v_decision,
        case when v_decision = 'denied' then 'Cargo de membresia vencido' else null end,
        v_sstatus::text, v_overdue, v_reception, v_when
      );
    end loop;
  end loop;

  raise notice 'seed-demo: 80 miembros generados';
end;
$demo$;

-- ============================================================================
-- 6. OTROS INGRESOS DE LOS ULTIMOS 30 DIAS
--
-- La venta de mostrador de un gimnasio chico: agua, bebidas, algun suplemento
-- y el pase por dia de quien no es socio.
-- ============================================================================

do $demo$
declare
  v_gym    uuid := 'a2000000-0000-4000-8000-000000000001';
  v_branch uuid := 'a3000000-0000-4000-8000-000000000001';
  v_rec    uuid := 'a0000000-0000-4000-8000-000000000002';
  d        int;
  k        int;
  v_cat    uuid;
  v_amount numeric(14,2);
  v_desc   text;
begin
  if exists (select 1 from public.other_income_entries where gym_id = v_gym) then
    raise notice 'seed-demo: los ingresos ya existen, no se vuelven a generar';
    return;
  end if;

  for d in 0..29 loop
    continue when extract(dow from current_date - d) = 0;

    for k in 1..(4 + (d % 6)) loop
      if (d + k) % 5 = 0 then
        v_cat := 'a5000000-0000-4000-8000-000000000002';
        v_amount := 450.00 + ((d * k) % 6) * 100;
        v_desc := 'Venta de suplemento en mostrador';
      elsif (d + k) % 3 = 0 then
        v_cat := 'a5000000-0000-4000-8000-000000000003';
        v_amount := 120.00;
        v_desc := 'Pase por dia';
      else
        v_cat := 'a5000000-0000-4000-8000-000000000001';
        v_amount := 25.00 + ((d + k) % 4) * 15;
        v_desc := 'Bebida o agua';
      end if;

      insert into public.other_income_entries (
        gym_id, branch_id, income_category_id, status, amount, currency,
        occurred_at, reference, description, recorded_by
      )
      values (
        v_gym, v_branch, v_cat, 'posted', v_amount, 'NIO',
        (current_date - d)::timestamptz + ((8 + k) || ' hours')::interval,
        'V-' || to_char(current_date - d, 'YYYYMMDD') || '-' || lpad(k::text, 2, '0'),
        v_desc,
        v_rec
      );
    end loop;
  end loop;

  raise notice 'seed-demo: ingresos de mostrador generados';
end;
$demo$;

-- ============================================================================
-- 7. ALERTAS
--
-- No se insertan a mano. El trigger trg_member_entry_create_alert ya crea una
-- alerta por cada entrada denegada, que es exactamente lo que pasaria en un
-- gimnasio de verdad. Escribirlas aqui ademas duplicaria lo que el sistema
-- hace solo, y una demo con alertas inventadas no prueba que el trigger sirva.
-- ============================================================================

-- ============================================================================
-- 8. CONTADOR DE CODIGOS
--
-- El seed escribe member_code a mano, asi que el contador no se entera solo.
-- Sin esto, la primera alta hecha desde la aplicacion arranca en M-000001,
-- lo encuentra ocupado y avanza de a uno hasta pasar los ochenta.
-- ============================================================================

insert into private.member_code_counters (gym_id, last_value)
select
  gm.gym_id,
  max((substring(gm.member_code from 3))::bigint)
from public.gym_members gm
where gm.deleted_at is null
  and gm.member_code ~ '^M-[0-9]+$'
group by gm.gym_id
on conflict (gym_id) do update
  set last_value = greatest(private.member_code_counters.last_value, excluded.last_value),
      updated_at = timezone('utc', now());
