-- Local development seed only. Do not run in production.
-- Test users use the fake local password: LocalDev123!

begin;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  email_change_token_current,
  reauthentication_token,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'owner1@fitmanager.local',
    extensions.crypt('LocalDev123!', extensions.gen_salt('bf')),
    timezone('utc', now()),
    '',
    '',
    '',
    '',
    '',
    '',
    timezone('utc', now()),
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Dueno Demo Uno"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'owner2@fitmanager.local',
    extensions.crypt('LocalDev123!', extensions.gen_salt('bf')),
    timezone('utc', now()),
    '',
    '',
    '',
    '',
    '',
    '',
    timezone('utc', now()),
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Dueno Demo Dos"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'platform-admin@fitmanager.local',
    extensions.crypt('LocalDev123!', extensions.gen_salt('bf')),
    timezone('utc', now()),
    '',
    '',
    '',
    '',
    '',
    '',
    timezone('utc', now()),
    timezone('utc', now()),
    '{"provider":"email","providers":["email"],"platform_role":"admin"}'::jsonb,
    '{"name":"Admin Plataforma Local"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'gym-admin@fitmanager.local',
    extensions.crypt('LocalDev123!', extensions.gen_salt('bf')),
    timezone('utc', now()),
    '',
    '',
    '',
    '',
    '',
    '',
    timezone('utc', now()),
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Admin Gym Local"}'::jsonb
  )
on conflict do nothing;

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    '01000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '{"sub":"00000000-0000-4000-8000-000000000001","email":"owner1@fitmanager.local","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    '01000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    '{"sub":"00000000-0000-4000-8000-000000000002","email":"owner2@fitmanager.local","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    '01000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000003',
    '{"sub":"00000000-0000-4000-8000-000000000003","email":"platform-admin@fitmanager.local","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    '01000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000004',
    '{"sub":"00000000-0000-4000-8000-000000000004","email":"gym-admin@fitmanager.local","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  )
on conflict (provider_id, provider) do nothing;

insert into public.saas_plans (
  id,
  code,
  name,
  description,
  billing_interval_months,
  price,
  currency,
  trial_days
)
values (
  '10000000-0000-4000-8000-000000000001',
  'starter-local',
  'Starter Local',
  'Plan local para desarrollo',
  1,
  29.00,
  'USD',
  14
)
on conflict do nothing;

insert into public.gyms (
  id,
  legal_name,
  trade_name,
  slug,
  default_currency,
  timezone,
  created_by
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    'Impulso Fitness S.A.',
    'Impulso Fitness',
    'impulso-fitness',
    'NIO',
    'America/Managua',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'Norte Gym S.A.',
    'Norte Gym',
    'norte-gym',
    'USD',
    'America/Managua',
    '00000000-0000-4000-8000-000000000002'
  )
on conflict do nothing;

insert into public.gym_saas_subscriptions (
  gym_id,
  saas_plan_id,
  status,
  current_period_start,
  current_period_end
)
select
  g.id,
  '10000000-0000-4000-8000-000000000001',
  'trialing',
  timezone('utc', now()),
  timezone('utc', now()) + interval '14 days'
from public.gyms g
where g.slug in ('impulso-fitness', 'norte-gym')
on conflict do nothing;

insert into public.gym_users (
  gym_id,
  auth_user_id,
  employee_code,
  status,
  invited_by,
  accepted_at
)
values (
  '20000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000004',
  'ADM-LOCAL',
  'active',
  '00000000-0000-4000-8000-000000000001',
  timezone('utc', now())
)
on conflict do nothing;

insert into public.gym_user_roles (
  gym_user_id,
  role_id,
  assigned_by
)
select
  gu.id,
  r.id,
  '00000000-0000-4000-8000-000000000001'
from public.gym_users gu
join public.roles r on r.gym_id = gu.gym_id and r.code = 'admin'
where gu.auth_user_id = '00000000-0000-4000-8000-000000000004'
on conflict do nothing;

insert into public.gym_branches (
  id,
  gym_id,
  code,
  name,
  city,
  address_line_1
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'central',
    'Sucursal Central',
    'Managua',
    'Reparto San Juan'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'central',
    'Sucursal Central',
    'Esteli',
    'Centro'
  )
on conflict do nothing;

insert into public.membership_plans (
  id,
  gym_id,
  code,
  name,
  billing_cycle_months,
  duration_months,
  price,
  currency,
  grace_days
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'monthly-nio',
    'Mensual',
    1,
    1,
    900.00,
    'NIO',
    3
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'monthly-usd',
    'Mensual',
    1,
    1,
    30.00,
    'USD',
    3
  )
on conflict do nothing;

insert into public.persons (id, first_name, last_name, created_by)
values
  ('50000000-0000-4000-8000-000000000001', 'Ana', 'Martinez', '00000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000002', 'Jorge', 'Ramirez', '00000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000003', 'Lucia', 'Castillo', '00000000-0000-4000-8000-000000000002')
on conflict do nothing;

insert into public.person_contacts (person_id, contact_type, value, is_primary)
values
  ('50000000-0000-4000-8000-000000000001', 'phone', '8888-0001', true),
  ('50000000-0000-4000-8000-000000000002', 'phone', '8888-0002', true),
  ('50000000-0000-4000-8000-000000000003', 'phone', '8888-0003', true)
on conflict do nothing;

insert into public.gym_members (
  id,
  gym_id,
  person_id,
  home_branch_id,
  member_code,
  status,
  joined_on,
  created_by
)
values
  (
    '60000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'M-0001',
    'active',
    current_date - 20,
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001',
    'M-0002',
    'active',
    current_date - 45,
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '60000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000002',
    'M-0001',
    'active',
    current_date - 10,
    '00000000-0000-4000-8000-000000000002'
  )
on conflict do nothing;

insert into public.member_subscriptions (
  id,
  gym_member_id,
  membership_plan_id,
  status,
  start_date,
  billing_cycle_months,
  recurring_amount,
  currency,
  created_by
)
values
  (
    '70000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'active',
    current_date - 20,
    1,
    900.00,
    'NIO',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    'past_due',
    current_date - 45,
    1,
    900.00,
    'NIO',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '70000000-0000-4000-8000-000000000003',
    '60000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000002',
    'active',
    current_date - 10,
    1,
    30.00,
    'USD',
    '00000000-0000-4000-8000-000000000002'
  )
on conflict do nothing;

insert into public.membership_charges (
  id,
  gym_member_id,
  member_subscription_id,
  period_start,
  period_end,
  due_date,
  amount_due,
  currency,
  status
)
values
  (
    '80000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    current_date - 20,
    current_date + 10,
    current_date - 20,
    900.00,
    'NIO',
    'paid'
  ),
  (
    '80000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000002',
    '70000000-0000-4000-8000-000000000002',
    current_date - 45,
    current_date - 15,
    current_date - 45,
    900.00,
    'NIO',
    'overdue'
  )
on conflict do nothing;

insert into public.member_payments (
  id,
  gym_id,
  gym_member_id,
  branch_id,
  payment_method_id,
  status,
  amount,
  currency,
  receipt_number,
  paid_at,
  received_by
)
select
  '90000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  pm.id,
  'settled',
  900.00,
  'NIO',
  'R-LOCAL-0001',
  timezone('utc', now()) - interval '5 days',
  '00000000-0000-4000-8000-000000000001'
from public.payment_methods pm
where pm.code = 'cash'
on conflict do nothing;

insert into public.member_payment_allocations (
  member_payment_id,
  membership_charge_id,
  amount
)
values (
  '90000000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000001',
  900.00
)
on conflict do nothing;

commit;
