begin;

select plan(19);

select has_table('public', 'gym_alerts', 'gym_alerts table exists');

select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'gym_alerts'),
  'gym_alerts has RLS enabled'
);

select isnt_empty(
  $$select 1 from pg_policies where schemaname = 'public' and tablename = 'gym_alerts'
    and policyname = 'gym_alerts_read' and cmd = 'SELECT'$$,
  'gym_alerts has a read policy'
);

select isnt_empty(
  $$select 1 from pg_policies where schemaname = 'public' and tablename = 'gym_alerts'
    and policyname = 'gym_alerts_manage' and cmd = 'UPDATE'$$,
  'gym_alerts has a manage policy'
);

select has_function('private', 'create_alert_from_member_entry', array[]::text[], 'member entry alert function exists');

select trigger_is(
  'public', 'member_entries', 'trg_member_entry_create_alert',
  'private', 'create_alert_from_member_entry',
  'member entry alert trigger exists'
);

insert into public.gym_users(gym_id, auth_user_id, employee_code, status, accepted_at)
values (
  '20000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000003',
  'RECEPTION-ALERT-TEST',
  'active',
  timezone('utc', now())
);

insert into public.gym_user_roles(gym_user_id, role_id, assigned_by)
select gu.id, r.id, '00000000-0000-4000-8000-000000000001'
from public.gym_users gu
join public.roles r on r.gym_id = gu.gym_id and r.code = 'receptionist'
where gu.gym_id = '20000000-0000-4000-8000-000000000001'
  and gu.auth_user_id = '00000000-0000-4000-8000-000000000003';

insert into public.face_recognition_events(
  id, gym_id, branch_id, decision, decision_reason, model_code
) values (
  '91000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'no_match',
  'No se encontro coincidencia.',
  'face-model:1.0.0'
);

select is(
  (select count(*)::int from public.gym_alerts ga join public.alert_types at on at.id = ga.alert_type_id
   where at.code = 'FACE_NO_MATCH' and ga.face_recognition_event_id = '91000000-0000-4000-8000-000000000001'),
  1,
  'facial no-match trigger creates an alert'
);

select is(
  (select gym_id from public.gym_alerts where face_recognition_event_id = '91000000-0000-4000-8000-000000000001'),
  '20000000-0000-4000-8000-000000000001'::uuid,
  'facial alert retains the event tenant'
);

insert into public.gym_alerts(gym_id, branch_id, alert_type_id, severity, title, message)
select
  '20000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000002',
  at.id,
  at.default_severity,
  'Alerta ajena',
  'Esta alerta pertenece al gimnasio dos.'
from public.alert_types at
where at.code = 'DEVICE_OFFLINE';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$select public.register_member_entry(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001'
  )$$,
  'denied overdue entry is registered'
);

select is(
  (select count(*)::int from public.gym_alerts ga join public.alert_types at on at.id = ga.alert_type_id
   where at.code = 'MEMBERSHIP_UNPAID' and ga.gym_member_id = '60000000-0000-4000-8000-000000000002'),
  1,
  'denied overdue entry creates an unpaid alert'
);

reset role;
update public.member_subscriptions
set end_date = current_date - 1
where id = '70000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$select public.register_member_entry(
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001'
  )$$,
  'denied expired entry is registered'
);

select is(
  (select count(*)::int from public.gym_alerts ga join public.alert_types at on at.id = ga.alert_type_id
   where at.code = 'MEMBERSHIP_EXPIRED' and ga.gym_member_id = '60000000-0000-4000-8000-000000000001'),
  1,
  'denied expired entry creates an expired alert'
);

select ok(
  (select count(*) from public.gym_alerts where gym_id = '20000000-0000-4000-8000-000000000001') >= 3,
  'owner can read own gym alerts'
);

select is(
  (select count(*) from public.gym_alerts where gym_id = '20000000-0000-4000-8000-000000000002')::int,
  0,
  'owner cannot read another gym alerts'
);

update public.gym_alerts
set status = 'acknowledged'
where gym_id = '20000000-0000-4000-8000-000000000001' and status = 'open';

select is(
  (select count(*)::int from public.gym_alerts
   where gym_id = '20000000-0000-4000-8000-000000000001'
     and status = 'acknowledged'),
  3,
  'owner with alerts.manage can acknowledge own alerts'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';

select ok(
  (select count(*) from public.gym_alerts where gym_id = '20000000-0000-4000-8000-000000000001') >= 3,
  'receptionist with alerts.read can read own gym alerts'
);

update public.gym_alerts
set status = 'resolved'
where gym_id = '20000000-0000-4000-8000-000000000001';

select is(
  (select count(*)::int from public.gym_alerts
   where gym_id = '20000000-0000-4000-8000-000000000001'
     and status = 'resolved'),
  0,
  'receptionist without alerts.manage cannot update alerts'
);

select is(
  (select count(*) from public.gym_alerts where gym_id = '20000000-0000-4000-8000-000000000002')::int,
  0,
  'receptionist cannot read another gym alerts'
);

reset role;

select throws_ok(
  $$insert into public.gym_alerts(gym_id, gym_member_id, alert_type_id, severity, title, message)
    select
      '20000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000003',
      at.id,
      at.default_severity,
      'Alerta invalida',
      'El miembro pertenece a otro gimnasio.'
    from public.alert_types at where at.code = 'MEMBERSHIP_UNPAID'$$,
  null,
  'Alert member does not belong to the gym',
  'tenant trigger rejects a member from another gym'
);

select * from finish();
rollback;
