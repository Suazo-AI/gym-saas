begin;

select plan(10);

-- F018. member_subscriptions es la tabla padre de membership_charges y de
-- member_payment_allocations, las dos con on delete cascade. La migracion
-- 20260807150000_member_payment_direct_write.sql revoco DML sobre las hijas
-- pero dejo la padre con el grant general a authenticated y sin el trigger
-- prevent_physical_delete, asi que borrar una suscripcion todavia arrasa el
-- historial financiero del miembro sin dejar rastro.
--
-- Criterio escrito por el autor del contrato antes de delegar la
-- implementacion. El ejecutor no puede modificar este archivo.

select ok(
  has_table_privilege('authenticated', 'public.member_subscriptions', 'select'),
  'authenticated conserva lectura sobre member_subscriptions'
);

select ok(
  not has_table_privilege('authenticated', 'public.member_subscriptions', 'insert'),
  'authenticated no puede insertar en member_subscriptions'
);

select ok(
  not has_table_privilege('authenticated', 'public.member_subscriptions', 'update'),
  'authenticated no puede actualizar member_subscriptions'
);

select ok(
  not has_table_privilege('authenticated', 'public.member_subscriptions', 'delete'),
  'authenticated no puede borrar member_subscriptions'
);

select has_trigger(
  'public', 'member_subscriptions', 'trg_member_subscriptions_prevent_delete',
  'member_subscriptions tiene el trigger que bloquea el borrado fisico'
);

-- Corre como superusuario, que es el peor caso: ni siquiera el dueno de la
-- base puede borrar la fila sin activar la valvula explicita.
select throws_ok(
  $$delete from public.member_subscriptions
    where id = '70000000-0000-4000-8000-000000000001'$$,
  'Physical DELETE is blocked for member_subscriptions. Use the corresponding lifecycle or soft-delete RPC.',
  'el borrado fisico de una suscripcion se rechaza'
);

select ok(
  exists (
    select 1 from public.membership_charges
    where member_subscription_id = '70000000-0000-4000-8000-000000000001'
  ),
  'los cargos de la suscripcion sobreviven al intento de borrado'
);

select ok(
  exists (
    select 1
    from public.member_payment_allocations a
    join public.membership_charges c on c.id = a.membership_charge_id
    where c.member_subscription_id = '70000000-0000-4000-8000-000000000001'
  ),
  'las asignaciones de pago sobreviven al intento de borrado'
);

-- La cancelacion sigue siendo el camino legitimo: cerrar la puerta del borrado
-- fisico no debe cerrar tambien la baja auditada.
select ok(
  has_function_privilege(
    'authenticated',
    'public.cancel_member_subscription(uuid, text, boolean)',
    'execute'
  ),
  'authenticated conserva la ejecucion de cancel_member_subscription'
);

-- Guarda de regresion del paquete anterior: la proteccion de las hijas sigue
-- en pie despues de tocar la padre.
select ok(
  not has_table_privilege('authenticated', 'public.membership_charges', 'delete')
    and not has_table_privilege('authenticated', 'public.member_payment_allocations', 'delete'),
  'las tablas hijas conservan su proteccion contra borrado'
);

select * from finish();

rollback;
