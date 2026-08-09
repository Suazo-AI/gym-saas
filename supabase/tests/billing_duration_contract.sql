begin;

select plan(12);

-- W4. Tres defectos que son el mismo: la facturacion solo sabe contar meses.
--
-- F030: membership_plans guarda duration_count y duration_unit desde
--       20260804030000, y su propio comentario dice que billing_cycle_months
--       queda "hasta que las RPC de suscripcion consuman duration_count y
--       duration_unit". Nunca las consumieron, asi que un plan de 7 dias
--       genera un periodo de un mes entero.
-- F029: assign_member_subscription nunca escribe end_date, y
--       private.member_access_allowed lee end_date nulo como vigencia sin fin.
-- F028: generate_membership_charges avanza de a meses, asi que ni siquiera
--       llamandola genera el segundo periodo de un plan semanal.
--
-- Semantica que fija este contrato:
--   auto_renew falso  -> end_date = inicio + duracion - 1 dia
--   auto_renew cierto -> end_date nulo, el acceso lo gobiernan los cargos
--
-- Criterio escrito por el autor del contrato antes de delegar. El ejecutor no
-- puede modificar este archivo.

insert into public.persons (id, first_name, last_name, created_by)
values
  ('50000000-0000-4000-8000-000000000401', 'Semanal', 'Vence', '00000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000402', 'Semanal', 'Renueva', '00000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000403', 'Mensual', 'Control', '00000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000404', 'Quincenal', 'Semanas', '00000000-0000-4000-8000-000000000001');

insert into public.gym_members (
  id, gym_id, person_id, home_branch_id, member_code, status, joined_on, created_by
)
values
  ('60000000-0000-4000-8000-000000000401', '20000000-0000-4000-8000-000000000001',
   '50000000-0000-4000-8000-000000000401', '30000000-0000-4000-8000-000000000001',
   'M-W4-VENCE', 'active', current_date, '00000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000402', '20000000-0000-4000-8000-000000000001',
   '50000000-0000-4000-8000-000000000402', '30000000-0000-4000-8000-000000000001',
   'M-W4-RENUEVA', 'active', current_date, '00000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000403', '20000000-0000-4000-8000-000000000001',
   '50000000-0000-4000-8000-000000000403', '30000000-0000-4000-8000-000000000001',
   'M-W4-MENSUAL', 'active', current_date, '00000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000404', '20000000-0000-4000-8000-000000000001',
   '50000000-0000-4000-8000-000000000404', '30000000-0000-4000-8000-000000000001',
   'M-W4-SEMANAS', 'active', current_date, '00000000-0000-4000-8000-000000000001');

-- Plan de 7 dias. La gracia es larga a proposito: aisla el vencimiento de la
-- suscripcion de la morosidad, que es el otro motivo por el que se niega el
-- acceso. Sin eso, la asercion 12 pasaria por la razon equivocada.
insert into public.membership_plans (
  id, gym_id, code, name, billing_cycle_months, duration_count, duration_unit,
  price, currency, grace_days
)
values (
  '40000000-0000-4000-8000-000000000401',
  '20000000-0000-4000-8000-000000000001',
  'w4-siete-dias', 'Semanal siete dias', 1, 7, 'day', 300.00, 'NIO', 60
),
(
  '40000000-0000-4000-8000-000000000402',
  '20000000-0000-4000-8000-000000000001',
  'w4-dos-semanas', 'Quincenal dos semanas', 1, 2, 'week', 500.00, 'NIO', 60
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
begin
  -- A: semanal que no se renueva. Tiene que vencer a los 7 dias.
  perform public.assign_member_subscription(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000401',
    '40000000-0000-4000-8000-000000000401',
    current_date, null, null, null, false, true
  );

  -- B: el mismo plan, renovable. No vence, pero cada 7 dias debe cobrar.
  perform public.assign_member_subscription(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000402',
    '40000000-0000-4000-8000-000000000401',
    current_date, null, null, null, true, true
  );

  -- C: control mensual con el plan del seed. No debe cambiar de comportamiento.
  perform public.assign_member_subscription(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000403',
    '40000000-0000-4000-8000-000000000001',
    current_date, null, null, null, true, true
  );

  -- D: plan medido en semanas. La aritmetica de semanas es la que ninguna RPC
  -- sabe hacer hoy, y es una unidad valida del catalogo de planes.
  perform public.assign_member_subscription(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000404',
    '40000000-0000-4000-8000-000000000402',
    current_date, null, null, null, false, true
  );

  -- Dos semanas mas adelante. Llamada dos veces: la segunda no debe duplicar.
  perform public.generate_membership_charges(
    '20000000-0000-4000-8000-000000000001', current_date + 13
  );
  perform public.generate_membership_charges(
    '20000000-0000-4000-8000-000000000001', current_date + 13
  );
end;
$$;

reset role;

-- Las columnas duration_count y duration_unit ya existen en
-- member_subscriptions desde 20260804031000, con valores por defecto 1 y
-- 'month'. Afirmar que existen no probaria nada: lo que falta es que alguien
-- las escriba con la duracion real del plan. Por eso este contrato mide
-- comportamiento y no estructura.

select is(
  (select (mc.period_end - mc.period_start)
   from public.membership_charges mc
   join public.member_subscriptions ms on ms.id = mc.member_subscription_id
   where ms.gym_member_id = '60000000-0000-4000-8000-000000000404'
   order by mc.period_start
   limit 1),
  13,
  'el primer cargo de un plan de dos semanas cubre catorce dias'
);

select is(
  (select end_date from public.member_subscriptions
   where gym_member_id = '60000000-0000-4000-8000-000000000404'),
  current_date + 13,
  'una suscripcion de dos semanas que no se renueva vence a los catorce dias'
);

select is(
  (select duration_count from public.member_subscriptions
   where gym_member_id = '60000000-0000-4000-8000-000000000401'),
  7,
  'la suscripcion copia la cantidad de duracion del plan'
);

select is(
  (select duration_unit from public.member_subscriptions
   where gym_member_id = '60000000-0000-4000-8000-000000000401'),
  'day',
  'la suscripcion copia la unidad de duracion del plan'
);

select is(
  (select end_date from public.member_subscriptions
   where gym_member_id = '60000000-0000-4000-8000-000000000401'),
  current_date + 6,
  'una suscripcion que no se renueva vence a los siete dias'
);

select is(
  (select (mc.period_end - mc.period_start)
   from public.membership_charges mc
   join public.member_subscriptions ms on ms.id = mc.member_subscription_id
   where ms.gym_member_id = '60000000-0000-4000-8000-000000000401'
   order by mc.period_start
   limit 1),
  6,
  'el primer cargo de un plan de siete dias cubre siete dias'
);

select is(
  (select end_date from public.member_subscriptions
   where gym_member_id = '60000000-0000-4000-8000-000000000402'),
  null::date,
  'una suscripcion renovable no nace con fecha de vencimiento'
);

select is(
  (select count(*)::integer
   from public.membership_charges mc
   join public.member_subscriptions ms on ms.id = mc.member_subscription_id
   where ms.gym_member_id = '60000000-0000-4000-8000-000000000402'),
  2,
  'a las dos semanas, un plan semanal renovable lleva dos cargos'
);

select is(
  (select mc.period_start
   from public.membership_charges mc
   join public.member_subscriptions ms on ms.id = mc.member_subscription_id
   where ms.gym_member_id = '60000000-0000-4000-8000-000000000402'
   order by mc.period_start
   offset 1 limit 1),
  current_date + 7,
  'el segundo periodo arranca siete dias despues del primero'
);

select is(
  (select count(*)::integer
   from public.membership_charges mc
   join public.member_subscriptions ms on ms.id = mc.member_subscription_id
   where ms.gym_member_id = '60000000-0000-4000-8000-000000000401'),
  1,
  'no se generan cargos despues de que la suscripcion vencio'
);

select is(
  (select (mc.period_end - mc.period_start)
   from public.membership_charges mc
   join public.member_subscriptions ms on ms.id = mc.member_subscription_id
   where ms.gym_member_id = '60000000-0000-4000-8000-000000000403'
   order by mc.period_start
   limit 1),
  ((current_date + interval '1 month' - interval '1 day')::date - current_date),
  'el plan mensual conserva su periodo de un mes'
);

select ok(
  not private.member_access_allowed(
    '60000000-0000-4000-8000-000000000401',
    (current_date + 7)::timestamptz
  ),
  'vencida la suscripcion, el acceso se niega aunque no haya mora'
);

select * from finish();

rollback;
