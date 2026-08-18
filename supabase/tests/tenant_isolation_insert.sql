-- Aislamiento multi-tenant del lado de la escritura.
-- Tarjeta "Pruebas de aislamiento multi-tenant", item "Intentar insertar
-- usando otro gym_id".
--
-- El dueno del gimnasio 2 intenta insertar filas que digan pertenecer al
-- gimnasio 1. Todo intento debe ser rechazado. El mismo insert contra su
-- propio gimnasio debe pasar: sin ese contraste, una prueba donde todo falla
-- no distingue "RLS funciona" de "la tabla no existe".
--
-- Se afirma el SQLSTATE y no el texto del mensaje, que cambia entre versiones
-- de PostgreSQL.
--
-- Fixtures propios de este archivo: prefijo a2000000-.

begin;

select plan(15);

-- ---------------------------------------------------------------------------
-- Fixtures. Se cargan como dueno de la transaccion, nunca como el usuario
-- que esta bajo prueba.
-- ---------------------------------------------------------------------------

insert into public.persons (id, first_name, last_name, created_by)
values
  (
    'a2000000-0000-4000-8000-000000000001',
    'Cruzada',
    'Uno',
    '00000000-0000-4000-8000-000000000002'
  ),
  (
    'a2000000-0000-4000-8000-000000000002',
    'Legitima',
    'Dos',
    '00000000-0000-4000-8000-000000000002'
  ),
  (
    'a2000000-0000-4000-8000-000000000003',
    'Sucursal',
    'Ajena',
    '00000000-0000-4000-8000-000000000002'
  );

-- Categoria de ingresos del gimnasio 1. Existe para que el insert cruzado a
-- other_income_entries llegue con todas sus columnas obligatorias llenas y el
-- unico motivo de rechazo posible sea el permiso, no un not null ni una clave
-- foranea.
insert into public.income_categories (id, gym_id, code, name)
values (
  'a2000000-0000-4000-8000-000000000010',
  '20000000-0000-4000-8000-000000000001',
  'a2-cross-test',
  'Categoria de prueba de aislamiento'
);

-- ---------------------------------------------------------------------------
-- Que mecanismo rechaza cada tabla.
-- Sin esto, un 42501 no distingue "lo bloqueo RLS" de "no hay grant". En las
-- tres primeras el grant de insert sigue vivo, asi que quien rechaza solo
-- puede ser la politica. En other_income_entries la escritura directa esta
-- revocada y el rechazo llega antes, en el chequeo de privilegios.
-- ---------------------------------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'public.gym_members', 'insert'),
  'authenticated conserva insert sobre gym_members: quien rechaza es RLS'
);

select ok(
  has_table_privilege('authenticated', 'public.membership_plans', 'insert'),
  'authenticated conserva insert sobre membership_plans: quien rechaza es RLS'
);

select ok(
  has_table_privilege('authenticated', 'public.gym_branches', 'insert'),
  'authenticated conserva insert sobre gym_branches: quien rechaza es RLS'
);

select ok(
  not has_table_privilege('authenticated', 'public.other_income_entries', 'insert'),
  'la escritura directa de ingresos esta revocada para authenticated'
);

-- ---------------------------------------------------------------------------
-- Dueno del gimnasio 2 escribiendo contra el gimnasio 1.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

-- home_branch_id va en null a proposito: con una sucursal del gimnasio 1 el
-- trigger de integridad cruzada saltaria antes que la politica y el rechazo
-- no probaria nada sobre RLS.
select throws_ok(
  $$
    insert into public.gym_members (
      gym_id,
      person_id,
      home_branch_id,
      member_code,
      status,
      joined_on,
      created_by
    ) values (
      '20000000-0000-4000-8000-000000000001',
      'a2000000-0000-4000-8000-000000000001',
      null,
      'A2-CROSS',
      'active',
      current_date,
      '00000000-0000-4000-8000-000000000002'
    )
  $$,
  '42501',
  null,
  'el dueno del gimnasio 2 no puede crear un miembro del gimnasio 1'
);

select throws_ok(
  $$
    insert into public.membership_plans (
      gym_id,
      code,
      name,
      billing_cycle_months,
      price,
      currency,
      grace_days
    ) values (
      '20000000-0000-4000-8000-000000000001',
      'a2-cross',
      'Plan cruzado',
      1,
      100.00,
      'NIO',
      0
    )
  $$,
  '42501',
  null,
  'el dueno del gimnasio 2 no puede crear un plan del gimnasio 1'
);

select throws_ok(
  $$
    insert into public.gym_branches (
      gym_id,
      code,
      name,
      city,
      address_line_1
    ) values (
      '20000000-0000-4000-8000-000000000001',
      'a2-cross',
      'Sucursal cruzada',
      'Managua',
      'Direccion de prueba'
    )
  $$,
  '42501',
  null,
  'el dueno del gimnasio 2 no puede crear una sucursal del gimnasio 1'
);

select throws_ok(
  $$
    insert into public.other_income_entries (
      gym_id,
      income_category_id,
      amount,
      currency,
      reference
    ) values (
      '20000000-0000-4000-8000-000000000001',
      'a2000000-0000-4000-8000-000000000010',
      100.00,
      'NIO',
      'A2-CROSS'
    )
  $$,
  '42501',
  null,
  'el dueno del gimnasio 2 no puede insertar un ingreso del gimnasio 1'
);

-- La via sancionada tambien niega el gimnasio ajeno: sin esta asercion el
-- insert directo de arriba solo probaria el grant revocado.
select throws_ok(
  $$
    select public.record_other_income(
      '20000000-0000-4000-8000-000000000001',
      'a2000000-0000-4000-8000-000000000010',
      100.00,
      'NIO'
    )
  $$,
  '42501',
  null,
  'la rpc de ingresos rechaza el gym_id de otro gimnasio'
);

-- Reparentar por la sucursal: gimnasio propio, sucursal ajena. Lo corta el
-- trigger de integridad cruzada, que levanta P0001, no RLS.
select throws_ok(
  $$
    insert into public.gym_members (
      gym_id,
      person_id,
      home_branch_id,
      member_code,
      status,
      joined_on,
      created_by
    ) values (
      '20000000-0000-4000-8000-000000000002',
      'a2000000-0000-4000-8000-000000000003',
      '30000000-0000-4000-8000-000000000001',
      'A2-CROSS-BRANCH',
      'active',
      current_date,
      '00000000-0000-4000-8000-000000000002'
    )
  $$,
  'P0001',
  null,
  'un miembro propio no puede colgarse de la sucursal de otro gimnasio'
);

-- ---------------------------------------------------------------------------
-- El mismo insert contra el gimnasio propio si pasa.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$
    insert into public.gym_members (
      gym_id,
      person_id,
      home_branch_id,
      member_code,
      status,
      joined_on,
      created_by
    ) values (
      '20000000-0000-4000-8000-000000000002',
      'a2000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000002',
      'A2-LEGIT',
      'active',
      current_date,
      '00000000-0000-4000-8000-000000000002'
    )
  $$,
  'el dueno del gimnasio 2 si crea un miembro de su propio gimnasio'
);

select lives_ok(
  $$
    insert into public.membership_plans (
      gym_id,
      code,
      name,
      billing_cycle_months,
      price,
      currency,
      grace_days
    ) values (
      '20000000-0000-4000-8000-000000000002',
      'a2-legit',
      'Plan propio',
      1,
      30.00,
      'USD',
      0
    )
  $$,
  'el dueno del gimnasio 2 si crea un plan de su propio gimnasio'
);

select lives_ok(
  $$
    insert into public.gym_branches (
      gym_id,
      code,
      name,
      city,
      address_line_1
    ) values (
      '20000000-0000-4000-8000-000000000002',
      'a2-legit',
      'Sucursal propia',
      'Esteli',
      'Direccion de prueba'
    )
  $$,
  'el dueno del gimnasio 2 si crea una sucursal de su propio gimnasio'
);

reset role;
select set_config('request.jwt.claims', '{}', true);

-- ---------------------------------------------------------------------------
-- Que quedo escrito de verdad. Se cuenta sin RLS, como dueno de la
-- transaccion: un rechazo que igual deja la fila seria peor que ninguno.
-- ---------------------------------------------------------------------------

-- Sin filtro por gimnasio a proposito: ninguna de las filas rechazadas debe
-- existir en ningun tenant, ni siquiera en el del propio atacante.
select is(
  (
    (select count(*) from public.gym_members
      where member_code in ('A2-CROSS', 'A2-CROSS-BRANCH'))
    + (select count(*) from public.membership_plans
        where code = 'a2-cross')
    + (select count(*) from public.gym_branches
        where code = 'a2-cross')
    + (select count(*) from public.other_income_entries
        where reference = 'A2-CROSS')
  ),
  0::bigint,
  'ninguna fila de los intentos rechazados quedo escrita en ningun gimnasio'
);

select is(
  (
    (select count(*) from public.gym_members
      where gym_id = '20000000-0000-4000-8000-000000000002'
        and member_code = 'A2-LEGIT')
    + (select count(*) from public.membership_plans
        where gym_id = '20000000-0000-4000-8000-000000000002'
          and code = 'a2-legit')
    + (select count(*) from public.gym_branches
        where gym_id = '20000000-0000-4000-8000-000000000002'
          and code = 'a2-legit')
  ),
  3::bigint,
  'las tres filas legitimas quedaron escritas en el gimnasio 2'
);

select * from finish();

rollback;
