-- CRITERIO DE ACEPTACION CONGELADO - paquete S4, Reportes esenciales.
--
-- Escrito ANTES de la implementacion, por alguien que no la va a implementar.
-- Su sha256 esta registrado en verification/packages.json y el verificador
-- rechaza el paquete si este archivo cambia. Si una asercion resulta imposible
-- de satisfacer, se para y se discute: no se afloja la prueba.
--
-- Cubre los dos huecos de S4 que viven en la base de datos:
--
--   1. get_owner_dashboard cuenta las entradas de hoy leyendo
--      face_recognition_events, asi que las entradas manuales no existen para
--      el dashboard. El plan lo llama defecto con todas las letras.
--      La cifra tiene que salir de v_gym_entries, que es la vista unificada
--      que ya une entradas manuales y faciales.
--
--   2. La ventana de "membresias por vencer" son 7 dias fijos escritos dentro
--      de la funcion. El plan pide que sea configurable.
--
-- Lo que este contrato exige que exista:
--
--   public.get_owner_dashboard(uuid, integer)  -- ventana en dias
--   public.get_owner_dashboard(uuid)           -- sigue existiendo, ventana 7
--
-- No exige como se implementa. Exige que las dos cifras sean correctas.

begin;

select plan(7);

-- ============================================================================
-- 1. La ventana configurable existe y esta protegida igual que el resto
-- ============================================================================

select has_function(
  'public',
  'get_owner_dashboard',
  array['uuid', 'integer'],
  'get_owner_dashboard acepta una ventana en dias'
);

-- Corregido despues de la primera corrida de CI. La version anterior comparaba
-- pg_get_function_identity_arguments(oid) contra 'uuid, integer', y esa funcion
-- devuelve los NOMBRES de los parametros junto a los tipos
-- ("p_gym_id uuid, p_expiring_days integer"), asi que no podia coincidir con
-- ninguna implementacion. Era un defecto del instrumento, no del codigo.
-- regprocedure identifica la sobrecarga por tipos y no depende de como se
-- hayan llamado los parametros.
select isnt_empty(
  $$select 1
    from pg_proc p
    where p.oid = 'public.get_owner_dashboard(uuid,integer)'::regprocedure
      and p.prosecdef$$,
  'la version con ventana es security definer'
);

select ok(
  has_function_privilege('authenticated', 'public.get_owner_dashboard(uuid, integer)', 'execute'),
  'authenticated puede ejecutar la version con ventana'
);

select has_function(
  'public',
  'get_owner_dashboard',
  array['uuid'],
  'la firma de un solo argumento sigue existiendo y no rompe a quien ya la llama'
);

-- ============================================================================
-- 2. Datos de la prueba
--
-- Se preparan antes de cambiar de rol, a proposito: aca todavia se salta la
-- RLS para poder dejar el escenario exacto que las aserciones necesitan.
-- ============================================================================

-- Una entrada manual permitida, de hoy, en el gimnasio 1. Esta es la fila que
-- el dashboard de main no cuenta.
insert into public.member_entries(gym_id, gym_member_id, source, decision)
select
  gm.gym_id,
  gm.id,
  'manual'::public.entry_source,
  'allowed'::public.access_decision
from public.gym_members gm
where gm.gym_id = '20000000-0000-4000-8000-000000000001'
  and gm.deleted_at is null
order by gm.id
limit 1;

-- Escenario determinista para la ventana: ninguna membresia del gimnasio 1
-- vence, salvo una que lo hace dentro de 45 dias.
update public.member_subscriptions ms
set end_date = null
from public.gym_members gm
where gm.id = ms.gym_member_id
  and gm.gym_id = '20000000-0000-4000-8000-000000000001';

update public.member_subscriptions
set end_date = current_date + 45,
    status = 'active'
where id = '70000000-0000-4000-8000-000000000001';

-- ============================================================================
-- 3. Las cifras, con una sesion autenticada de verdad
-- ============================================================================

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';

-- El dashboard tiene que coincidir con la vista unificada. Si contara solo
-- eventos faciales, le faltaria la entrada manual insertada arriba.
select is(
  (select (public.get_owner_dashboard('20000000-0000-4000-8000-000000000001')->>'entriesToday')::int),
  (select count(*)::int
     from public.v_gym_entries e
    where e.gym_id = '20000000-0000-4000-8000-000000000001'
      and e.decision = 'allowed'
      and e.occurred_at >= date_trunc('day', timezone('utc', now()))),
  'entriesToday cuenta todas las entradas permitidas de hoy, no solo las faciales'
);

select is(
  (select (public.get_owner_dashboard('20000000-0000-4000-8000-000000000001', 7)->>'expiringMemberships')::int),
  0,
  'con ventana de 7 dias, una membresia que vence en 45 no cuenta'
);

select is(
  (select (public.get_owner_dashboard('20000000-0000-4000-8000-000000000001', 90)->>'expiringMemberships')::int),
  1,
  'con ventana de 90 dias, esa misma membresia si cuenta'
);

reset role;

select * from finish();

rollback;
