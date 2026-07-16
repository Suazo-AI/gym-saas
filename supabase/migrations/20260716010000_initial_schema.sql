-- ============================================================================
-- GYM SaaS / Supabase / PostgreSQL
-- Multi-tenant schema normalized to 4NF for gyms, SaaS billing, memberships,
-- RBAC, images, facial recognition, alerts, payments, income and dashboards.
--
-- Target: Supabase PostgreSQL 15+
-- Important:
--   1. Run this as a migration in a NEW Supabase project.
--   2. Facial embeddings use vector(512). Change this dimension everywhere if
--      the selected face model produces a different vector size.
--   3. Images stored in PostgreSQL use BYTEA, not BIT. Upload already-compressed
--      WebP/AVIF/JPEG bytes. Do not store Base64.
--   4. For maximum scale, use storage_backend='supabase_storage'; BYTEA remains
--      available when database storage is explicitly required.
-- ============================================================================

begin;

create schema if not exists extensions;
create schema if not exists private;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

set search_path = public, extensions;

-- ============================================================================
-- ENUMS
-- ============================================================================

create type public.record_status as enum ('active', 'inactive', 'suspended', 'deleted');
create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'paused', 'canceled', 'expired'
);
create type public.invoice_status as enum (
  'draft', 'open', 'partially_paid', 'paid', 'void', 'uncollectible'
);
create type public.payment_status as enum (
  'pending', 'processing', 'settled', 'failed', 'refunded', 'partially_refunded', 'void'
);
create type public.charge_status as enum (
  'pending', 'partial', 'paid', 'overdue', 'void'
);
create type public.member_status as enum (
  'prospect', 'active', 'inactive', 'suspended', 'blocked', 'archived'
);
create type public.user_membership_status as enum (
  'invited', 'active', 'suspended', 'revoked'
);
create type public.storage_backend as enum ('database', 'supabase_storage');
create type public.photo_purpose as enum (
  'profile', 'face_enrollment', 'identity_document', 'payment_receipt', 'other'
);
create type public.biometric_consent_status as enum ('granted', 'revoked', 'expired');
create type public.access_decision as enum ('allowed', 'denied', 'manual_review', 'no_match');
create type public.alert_severity as enum ('info', 'warning', 'critical');
create type public.alert_status as enum ('open', 'acknowledged', 'resolved', 'dismissed');
create type public.income_entry_status as enum ('draft', 'posted', 'void');
create type public.contact_type as enum ('email', 'phone', 'whatsapp', 'other');
create type public.address_type as enum ('home', 'work', 'billing', 'other');

-- ============================================================================
-- COMMON TRIGGER
-- ============================================================================

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

-- ============================================================================
-- SaaS CATALOG AND PLATFORM BILLING
-- ============================================================================

create table public.saas_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  billing_interval_months integer not null default 1 check (billing_interval_months > 0),
  price numeric(14,2) not null check (price >= 0),
  currency char(3) not null default 'USD',
  trial_days integer not null default 0 check (trial_days >= 0),
  max_branches integer check (max_branches is null or max_branches > 0),
  max_staff_users integer check (max_staff_users is null or max_staff_users > 0),
  max_members integer check (max_members is null or max_members > 0),
  included_storage_bytes bigint check (included_storage_bytes is null or included_storage_bytes >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.saas_features (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.saas_plan_features (
  saas_plan_id uuid not null references public.saas_plans(id) on delete cascade,
  feature_id uuid not null references public.saas_features(id) on delete cascade,
  enabled boolean not null default true,
  limit_value numeric,
  configuration jsonb not null default '{}'::jsonb,
  primary key (saas_plan_id, feature_id)
);

-- ============================================================================
-- PEOPLE AND AUTH PROFILES
-- ============================================================================

create table public.persons (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  middle_name text,
  last_name text not null default '',
  second_last_name text,
  birth_date date,
  sex text check (sex is null or sex in ('female', 'male', 'other', 'unspecified')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.person_contacts (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete cascade,
  contact_type public.contact_type not null,
  value text not null,
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (person_id, contact_type, value)
);

create unique index uq_person_primary_contact
  on public.person_contacts(person_id, contact_type)
  where is_primary;

create table public.person_addresses (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete cascade,
  address_type public.address_type not null default 'home',
  country_code char(2),
  department_state text,
  city text,
  district text,
  address_line_1 text not null,
  address_line_2 text,
  postal_code text,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index uq_person_primary_address
  on public.person_addresses(person_id, address_type)
  where is_primary;

create table public.user_profiles (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  person_id uuid not null unique references public.persons(id) on delete cascade,
  status public.record_status not null default 'active',
  last_login_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_person_id uuid;
  v_name text;
  v_first_name text;
  v_last_name text;
begin
  v_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'name', '')), '');
  v_first_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(split_part(v_name, ' ', 1), ''),
    split_part(coalesce(new.email, 'user'), '@', 1)
  );
  v_last_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''),
    case
      when v_name is not null and position(' ' in v_name) > 0
      then trim(substr(v_name, position(' ' in v_name) + 1))
      else ''
    end,
    ''
  );

  insert into public.persons(first_name, last_name, created_by)
  values (v_first_name, v_last_name, new.id)
  returning id into v_person_id;

  insert into public.user_profiles(auth_user_id, person_id)
  values (new.id, v_person_id);

  if new.email is not null then
    insert into public.person_contacts(person_id, contact_type, value, is_primary, verified_at)
    values (
      v_person_id,
      'email',
      lower(new.email),
      true,
      case when new.email_confirmed_at is not null then new.email_confirmed_at else null end
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

-- ============================================================================
-- TENANTS: GYMS AND BRANCHES
-- ============================================================================

create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text not null,
  slug text not null,
  tax_identifier text,
  default_currency char(3) not null default 'NIO',
  timezone text not null default 'America/Managua',
  status public.record_status not null default 'active',
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (slug)
);

create table public.gym_branches (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  code text not null,
  name text not null,
  phone text,
  email text,
  country_code char(2) default 'NI',
  department_state text,
  city text,
  address_line_1 text,
  address_line_2 text,
  timezone text,
  status public.record_status not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (gym_id, code)
);

create index idx_gym_branches_gym_status
  on public.gym_branches(gym_id, status);

create table public.gym_saas_subscriptions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  saas_plan_id uuid not null references public.saas_plans(id) on delete restrict,
  status public.subscription_status not null default 'trialing',
  started_at timestamptz not null default timezone('utc', now()),
  trial_ends_at timestamptz,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  ended_at timestamptz,
  external_customer_id text,
  external_subscription_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (current_period_end > current_period_start)
);

create unique index uq_one_current_saas_subscription_per_gym
  on public.gym_saas_subscriptions(gym_id)
  where status in ('trialing', 'active', 'past_due', 'paused');

create table public.gym_saas_subscription_events (
  id bigint generated always as identity primary key,
  gym_saas_subscription_id uuid not null
    references public.gym_saas_subscriptions(id) on delete cascade,
  previous_status public.subscription_status,
  new_status public.subscription_status not null,
  reason text,
  actor_user_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default timezone('utc', now())
);

create index idx_saas_subscription_events_subscription_time
  on public.gym_saas_subscription_events(gym_saas_subscription_id, occurred_at desc);

create table public.saas_subscription_cancellations (
  id uuid primary key default gen_random_uuid(),
  gym_saas_subscription_id uuid not null
    references public.gym_saas_subscriptions(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  reason text,
  cancel_at_period_end boolean not null default true,
  requested_at timestamptz not null default timezone('utc', now()),
  effective_at timestamptz,
  reversed_at timestamptz
);

create table public.saas_invoices (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  gym_saas_subscription_id uuid
    references public.gym_saas_subscriptions(id) on delete set null,
  invoice_number text not null unique,
  status public.invoice_status not null default 'draft',
  currency char(3) not null,
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(14,2) generated always as (subtotal + tax_amount) stored,
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.saas_invoice_items (
  id uuid primary key default gen_random_uuid(),
  saas_invoice_id uuid not null references public.saas_invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  tax_rate numeric(7,4) not null default 0 check (tax_rate >= 0),
  line_subtotal numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.saas_payments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  status public.payment_status not null default 'pending',
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null,
  provider text,
  provider_transaction_id text,
  paid_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index uq_saas_payment_provider_transaction
  on public.saas_payments(provider, provider_transaction_id)
  where provider is not null and provider_transaction_id is not null;

create table public.saas_payment_allocations (
  saas_payment_id uuid not null references public.saas_payments(id) on delete cascade,
  saas_invoice_id uuid not null references public.saas_invoices(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (saas_payment_id, saas_invoice_id)
);

-- ============================================================================
-- SCREENS, PERMISSIONS, ROLES AND GYM USERS
-- ============================================================================

create table public.screens (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  route text not null unique,
  parent_screen_id uuid references public.screens(id) on delete set null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.screen_permissions (
  screen_id uuid not null references public.screens(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (screen_id, permission_id)
);

create table public.gym_users (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  employee_code text,
  status public.user_membership_status not null default 'invited',
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (gym_id, auth_user_id),
  unique (gym_id, employee_code)
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (gym_id, code)
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.gym_user_roles (
  gym_user_id uuid not null references public.gym_users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default timezone('utc', now()),
  primary key (gym_user_id, role_id)
);

create index idx_gym_users_user_status
  on public.gym_users(auth_user_id, status);

create index idx_roles_gym
  on public.roles(gym_id);

-- ============================================================================
-- MEMBERS, MEMBERSHIP PLANS, SUBSCRIPTIONS AND MONTHLY CHARGES
-- ============================================================================

create table public.gym_members (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete restrict,
  home_branch_id uuid references public.gym_branches(id) on delete set null,
  member_code text not null,
  status public.member_status not null default 'prospect',
  joined_on date,
  blocked_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (gym_id, person_id),
  unique (gym_id, member_code)
);

create index idx_gym_members_gym_status
  on public.gym_members(gym_id, status);

create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  billing_cycle_months integer not null default 1 check (billing_cycle_months > 0),
  duration_months integer check (duration_months is null or duration_months > 0),
  price numeric(14,2) not null check (price >= 0),
  currency char(3) not null,
  grace_days integer not null default 0 check (grace_days >= 0),
  access_limit_per_day integer check (access_limit_per_day is null or access_limit_per_day > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (gym_id, code)
);

create table public.membership_plan_benefits (
  id uuid primary key default gen_random_uuid(),
  membership_plan_id uuid not null references public.membership_plans(id) on delete cascade,
  benefit_code text not null,
  description text not null,
  quantity_limit numeric,
  created_at timestamptz not null default timezone('utc', now()),
  unique (membership_plan_id, benefit_code)
);

create table public.member_subscriptions (
  id uuid primary key default gen_random_uuid(),
  gym_member_id uuid not null references public.gym_members(id) on delete cascade,
  membership_plan_id uuid not null references public.membership_plans(id) on delete restrict,
  status public.subscription_status not null default 'active',
  start_date date not null,
  end_date date,
  billing_cycle_months integer not null check (billing_cycle_months > 0),
  recurring_amount numeric(14,2) not null check (recurring_amount >= 0),
  currency char(3) not null,
  auto_renew boolean not null default true,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (end_date is null or end_date >= start_date)
);

create unique index uq_member_current_subscription
  on public.member_subscriptions(gym_member_id)
  where status in ('trialing', 'active', 'past_due', 'paused');

create index idx_member_subscriptions_member_status
  on public.member_subscriptions(gym_member_id, status);

create table public.member_subscription_events (
  id bigint generated always as identity primary key,
  member_subscription_id uuid not null
    references public.member_subscriptions(id) on delete cascade,
  previous_status public.subscription_status,
  new_status public.subscription_status not null,
  reason text,
  actor_user_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default timezone('utc', now())
);

create table public.member_subscription_cancellations (
  id uuid primary key default gen_random_uuid(),
  member_subscription_id uuid not null
    references public.member_subscriptions(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  reason text,
  cancel_at_period_end boolean not null default false,
  requested_at timestamptz not null default timezone('utc', now()),
  effective_at timestamptz,
  reversed_at timestamptz
);

create table public.membership_charges (
  id uuid primary key default gen_random_uuid(),
  gym_member_id uuid not null references public.gym_members(id) on delete cascade,
  member_subscription_id uuid not null
    references public.member_subscriptions(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  amount_due numeric(14,2) not null check (amount_due >= 0),
  currency char(3) not null,
  status public.charge_status not null default 'pending',
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (period_end >= period_start),
  unique (member_subscription_id, period_start)
);

create index idx_membership_charges_member_due_status
  on public.membership_charges(gym_member_id, due_date, status);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_cash boolean not null default false,
  is_active boolean not null default true
);

create table public.member_payments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  gym_member_id uuid not null references public.gym_members(id) on delete restrict,
  branch_id uuid references public.gym_branches(id) on delete set null,
  payment_method_id uuid not null references public.payment_methods(id) on delete restrict,
  status public.payment_status not null default 'settled',
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null,
  receipt_number text,
  external_reference text,
  paid_at timestamptz not null default timezone('utc', now()),
  received_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (gym_id, receipt_number)
);

create index idx_member_payments_gym_paid_at
  on public.member_payments(gym_id, paid_at desc)
  where status = 'settled';

create index idx_member_payments_member_paid_at
  on public.member_payments(gym_member_id, paid_at desc);

create table public.member_payment_allocations (
  member_payment_id uuid not null references public.member_payments(id) on delete cascade,
  membership_charge_id uuid not null references public.membership_charges(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (member_payment_id, membership_charge_id)
);

-- ============================================================================
-- IMAGES AND MEDIA
-- ============================================================================

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  owner_person_id uuid references public.persons(id) on delete set null,
  storage_backend public.storage_backend not null default 'database',

  -- Database mode: compressed binary bytes.
  binary_data bytea,

  -- Supabase Storage mode: object metadata.
  bucket_name text,
  object_path text,

  original_filename text,
  mime_type text not null,
  compression_codec text,
  width_pixels integer check (width_pixels is null or width_pixels > 0),
  height_pixels integer check (height_pixels is null or height_pixels > 0),
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  sha256_hex char(64),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  check (
    (storage_backend = 'database'
      and binary_data is not null
      and bucket_name is null
      and object_path is null)
    or
    (storage_backend = 'supabase_storage'
      and binary_data is null
      and bucket_name is not null
      and object_path is not null)
  ),
  check (
    mime_type in (
      'image/webp', 'image/avif', 'image/jpeg', 'image/png',
      'application/pdf'
    )
  )
);

create unique index uq_media_asset_hash_per_gym
  on public.media_assets(gym_id, sha256_hex)
  where sha256_hex is not null;

create unique index uq_media_storage_object
  on public.media_assets(bucket_name, object_path)
  where storage_backend = 'supabase_storage';

create or replace function private.sync_media_size()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.storage_backend = 'database' then
    new.size_bytes := octet_length(new.binary_data);
    new.bucket_name := null;
    new.object_path := null;
  else
    new.binary_data := null;
  end if;

  return new;
end;
$$;

create trigger trg_media_assets_sync_size
before insert or update of storage_backend, binary_data, bucket_name, object_path
on public.media_assets
for each row execute function private.sync_media_size();

create table public.person_photos (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  purpose public.photo_purpose not null,
  is_primary boolean not null default false,
  captured_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (gym_id, person_id, media_asset_id, purpose)
);

create unique index uq_primary_person_photo_per_purpose
  on public.person_photos(gym_id, person_id, purpose)
  where is_primary;

-- ============================================================================
-- FACIAL RECOGNITION AND BIOMETRIC CONSENT
-- ============================================================================

create table public.biometric_consents (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  status public.biometric_consent_status not null default 'granted',
  purpose text not null default 'gym_access_verification',
  consent_version text not null,
  obtained_by uuid references auth.users(id) on delete set null,
  obtained_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  expires_at timestamptz,
  retention_until timestamptz,
  evidence_media_asset_id uuid references public.media_assets(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  check (
    (status = 'granted' and revoked_at is null)
    or status in ('revoked', 'expired')
  )
);

create index idx_biometric_consents_person_status
  on public.biometric_consents(gym_id, person_id, status);

create table public.face_models (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version text not null,
  vector_dimensions integer not null default 512 check (vector_dimensions = 512),
  default_similarity_threshold real not null default 0.75
    check (default_similarity_threshold > 0 and default_similarity_threshold <= 1),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (code, version)
);

create table public.face_embeddings (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  person_photo_id uuid not null references public.person_photos(id) on delete cascade,
  face_model_id uuid not null references public.face_models(id) on delete restrict,
  embedding extensions.vector(512) not null,
  quality_score real check (quality_score is null or (quality_score >= 0 and quality_score <= 1)),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (gym_id, person_photo_id, face_model_id)
);

create index idx_face_embeddings_gym_person_active
  on public.face_embeddings(gym_id, person_id)
  where is_active;

create index idx_face_embeddings_hnsw_cosine
  on public.face_embeddings
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create table public.access_devices (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  branch_id uuid not null references public.gym_branches(id) on delete cascade,
  code text not null,
  name text not null,
  device_type text not null default 'face_terminal',
  api_key_hash text,
  status public.record_status not null default 'active',
  last_seen_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (gym_id, code)
);

create table public.face_recognition_events (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  branch_id uuid references public.gym_branches(id) on delete set null,
  device_id uuid references public.access_devices(id) on delete set null,
  captured_media_asset_id uuid references public.media_assets(id) on delete set null,
  matched_face_embedding_id uuid references public.face_embeddings(id) on delete set null,
  matched_person_id uuid references public.persons(id) on delete set null,
  gym_member_id uuid references public.gym_members(id) on delete set null,
  similarity_score real check (
    similarity_score is null or (similarity_score >= -1 and similarity_score <= 1)
  ),
  decision public.access_decision not null,
  decision_reason text,
  model_code text,
  processing_ms integer check (processing_ms is null or processing_ms >= 0),
  occurred_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb
);

create index idx_face_events_gym_time
  on public.face_recognition_events(gym_id, occurred_at desc);

create index idx_face_events_member_time
  on public.face_recognition_events(gym_member_id, occurred_at desc)
  where gym_member_id is not null;

-- ============================================================================
-- ALERTS
-- ============================================================================

create table public.alert_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  default_severity public.alert_severity not null default 'warning',
  created_at timestamptz not null default timezone('utc', now())
);

create table public.gym_alerts (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  branch_id uuid references public.gym_branches(id) on delete set null,
  alert_type_id uuid not null references public.alert_types(id) on delete restrict,
  gym_member_id uuid references public.gym_members(id) on delete set null,
  face_recognition_event_id uuid
    references public.face_recognition_events(id) on delete set null,
  severity public.alert_severity not null,
  status public.alert_status not null default 'open',
  title text not null,
  message text not null,
  created_at timestamptz not null default timezone('utc', now()),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index idx_gym_alerts_open
  on public.gym_alerts(gym_id, created_at desc)
  where status in ('open', 'acknowledged');

create table public.gym_alert_recipients (
  gym_alert_id uuid not null references public.gym_alerts(id) on delete cascade,
  gym_user_id uuid not null references public.gym_users(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (gym_alert_id, gym_user_id)
);

-- ============================================================================
-- SIMPLE INCOME MODULE
-- ============================================================================

create table public.income_categories (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  code text not null,
  name text not null,
  is_membership_related boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (gym_id, code)
);

create table public.other_income_entries (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  branch_id uuid references public.gym_branches(id) on delete set null,
  income_category_id uuid not null references public.income_categories(id) on delete restrict,
  status public.income_entry_status not null default 'posted',
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null,
  occurred_at timestamptz not null default timezone('utc', now()),
  reference text,
  description text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index idx_other_income_gym_time
  on public.other_income_entries(gym_id, occurred_at desc)
  where status = 'posted';

-- ============================================================================
-- AUDIT
-- ============================================================================

create table public.audit_logs (
  id bigint generated always as identity primary key,
  gym_id uuid references public.gyms(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_schema text not null default 'public',
  entity_table text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  ip_address inet,
  user_agent text,
  occurred_at timestamptz not null default timezone('utc', now())
);

create index idx_audit_logs_gym_time
  on public.audit_logs(gym_id, occurred_at desc);

-- ============================================================================
-- SEED DATA
-- ============================================================================

insert into public.payment_methods(code, name, is_cash) values
  ('cash', 'Cash', true),
  ('card', 'Card', false),
  ('bank_transfer', 'Bank transfer', false),
  ('mobile_wallet', 'Mobile wallet', false),
  ('other', 'Other', false)
on conflict (code) do nothing;

insert into public.permissions(code, name, description) values
  ('gym.read', 'View gym', 'View gym configuration'),
  ('gym.manage', 'Manage gym', 'Modify gym and branch configuration'),
  ('billing.read', 'View SaaS billing', 'View the gym SaaS subscription and invoices'),
  ('billing.manage', 'Manage SaaS billing', 'Request changes or cancellation of SaaS billing'),
  ('staff.read', 'View staff', 'View gym staff users'),
  ('staff.manage', 'Manage staff', 'Invite, suspend and manage gym staff'),
  ('roles.manage', 'Manage roles', 'Manage roles and permission assignments'),
  ('members.read', 'View members', 'View gym members and their personal data'),
  ('members.manage', 'Manage members', 'Create and update gym members'),
  ('memberships.read', 'View memberships', 'View membership plans, subscriptions and charges'),
  ('memberships.manage', 'Manage memberships', 'Manage plans, subscriptions and charges'),
  ('payments.read', 'View payments', 'View member payments and allocations'),
  ('payments.manage', 'Manage payments', 'Record and allocate payments'),
  ('income.read', 'View income', 'View membership and other income'),
  ('income.manage', 'Manage income', 'Create or void other income entries'),
  ('media.read', 'View media', 'View tenant media assets'),
  ('media.manage', 'Manage media', 'Upload and remove tenant media assets'),
  ('faces.read', 'View facial data', 'View face enrollment and recognition events'),
  ('faces.verify', 'Verify facial access', 'Run facial matching and access verification'),
  ('faces.manage', 'Manage facial data', 'Enroll, revoke and delete biometric data'),
  ('alerts.read', 'View alerts', 'View alerts for the gym'),
  ('alerts.manage', 'Manage alerts', 'Acknowledge and resolve alerts'),
  ('dashboard.read', 'View dashboard', 'View dashboard metrics'),
  ('audit.read', 'View audit log', 'View tenant audit records')
on conflict (code) do nothing;

insert into public.screens(code, name, route, sort_order) values
  ('dashboard', 'Dashboard', '/dashboard', 10),
  ('members', 'Members', '/members', 20),
  ('memberships', 'Memberships', '/memberships', 30),
  ('payments', 'Payments', '/payments', 40),
  ('income', 'Income', '/income', 50),
  ('facial_access', 'Facial access', '/facial-access', 60),
  ('alerts', 'Alerts', '/alerts', 70),
  ('staff', 'Staff', '/staff', 80),
  ('roles', 'Roles and permissions', '/roles', 90),
  ('settings', 'Gym settings', '/settings', 100),
  ('saas_billing', 'SaaS billing', '/billing', 110),
  ('audit', 'Audit', '/audit', 120)
on conflict (code) do nothing;

insert into public.screen_permissions(screen_id, permission_id)
select s.id, p.id
from public.screens s
join public.permissions p on (
  (s.code = 'dashboard' and p.code = 'dashboard.read')
  or (s.code = 'members' and p.code = 'members.read')
  or (s.code = 'memberships' and p.code = 'memberships.read')
  or (s.code = 'payments' and p.code = 'payments.read')
  or (s.code = 'income' and p.code = 'income.read')
  or (s.code = 'facial_access' and p.code = 'faces.read')
  or (s.code = 'alerts' and p.code = 'alerts.read')
  or (s.code = 'staff' and p.code = 'staff.read')
  or (s.code = 'roles' and p.code = 'roles.manage')
  or (s.code = 'settings' and p.code = 'gym.read')
  or (s.code = 'saas_billing' and p.code = 'billing.read')
  or (s.code = 'audit' and p.code = 'audit.read')
)
on conflict do nothing;

insert into public.alert_types(code, name, default_severity) values
  ('FACE_NO_MATCH', 'Face not recognized', 'warning'),
  ('FACE_ACCESS_DENIED', 'Facial access denied', 'warning'),
  ('MEMBERSHIP_UNPAID', 'Member payment overdue', 'critical'),
  ('MEMBERSHIP_EXPIRED', 'Membership expired', 'warning'),
  ('DEVICE_OFFLINE', 'Access device offline', 'warning'),
  ('SAAS_PAYMENT_FAILED', 'SaaS payment failed', 'critical')
on conflict (code) do nothing;

insert into public.face_models(code, version, vector_dimensions, default_similarity_threshold)
values ('face-model', '1.0.0', 512, 0.75)
on conflict (code, version) do nothing;

-- ============================================================================
-- AUTHORIZATION HELPERS
-- ============================================================================

create or replace function private.is_service_role()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(auth.role() = 'service_role', false);
$$;

create or replace function private.is_gym_user(p_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_service_role()
    or exists (
      select 1
      from public.gym_users gu
      where gu.gym_id = p_gym_id
        and gu.auth_user_id = auth.uid()
        and gu.status = 'active'
    );
$$;

create or replace function private.has_permission(p_gym_id uuid, p_permission_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_service_role()
    or exists (
      select 1
      from public.gym_users gu
      join public.gym_user_roles gur on gur.gym_user_id = gu.id
      join public.role_permissions rp on rp.role_id = gur.role_id
      join public.permissions p on p.id = rp.permission_id
      where gu.gym_id = p_gym_id
        and gu.auth_user_id = auth.uid()
        and gu.status = 'active'
        and p.code = p_permission_code
    );
$$;

create or replace function private.can_access_person(p_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_service_role()
    or exists (
      select 1
      from public.user_profiles up
      where up.auth_user_id = auth.uid()
        and up.person_id = p_person_id
    )
    or exists (
      select 1
      from public.gym_members gm
      where gm.person_id = p_person_id
        and private.has_permission(gm.gym_id, 'members.read')
    )
    or exists (
      select 1
      from public.gym_users gu
      join public.user_profiles up on up.auth_user_id = gu.auth_user_id
      where up.person_id = p_person_id
        and private.has_permission(gu.gym_id, 'staff.read')
    )
    or exists (
      select 1
      from public.persons p
      where p.id = p_person_id
        and p.created_by = auth.uid()
    );
$$;

-- ============================================================================
-- DEFAULT TENANT BOOTSTRAP
-- ============================================================================

create or replace function private.bootstrap_new_gym()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_role uuid;
  v_admin_role uuid;
  v_reception_role uuid;
  v_accountant_role uuid;
  v_trainer_role uuid;
  v_gym_user uuid;
begin
  insert into public.roles(gym_id, code, name, description, is_system)
  values (new.id, 'owner', 'Owner', 'Full tenant control', true)
  returning id into v_owner_role;

  insert into public.roles(gym_id, code, name, description, is_system)
  values (new.id, 'admin', 'Administrator', 'Operational administration', true)
  returning id into v_admin_role;

  insert into public.roles(gym_id, code, name, description, is_system)
  values (new.id, 'receptionist', 'Receptionist', 'Members, payments and access', true)
  returning id into v_reception_role;

  insert into public.roles(gym_id, code, name, description, is_system)
  values (new.id, 'accountant', 'Accountant', 'Payments, income and reports', true)
  returning id into v_accountant_role;

  insert into public.roles(gym_id, code, name, description, is_system)
  values (new.id, 'trainer', 'Trainer', 'Read member information', true)
  returning id into v_trainer_role;

  insert into public.role_permissions(role_id, permission_id)
  select v_owner_role, id from public.permissions;

  insert into public.role_permissions(role_id, permission_id)
  select v_admin_role, id
  from public.permissions
  where code not in ('billing.manage');

  insert into public.role_permissions(role_id, permission_id)
  select v_reception_role, id
  from public.permissions
  where code in (
    'gym.read', 'members.read', 'members.manage',
    'memberships.read', 'payments.read', 'payments.manage',
    'faces.read', 'faces.verify', 'alerts.read', 'dashboard.read',
    'media.read', 'media.manage'
  );

  insert into public.role_permissions(role_id, permission_id)
  select v_accountant_role, id
  from public.permissions
  where code in (
    'gym.read', 'members.read', 'memberships.read',
    'payments.read', 'payments.manage', 'income.read', 'income.manage',
    'dashboard.read'
  );

  insert into public.role_permissions(role_id, permission_id)
  select v_trainer_role, id
  from public.permissions
  where code in ('gym.read', 'members.read', 'dashboard.read');

  insert into public.gym_users(
    gym_id, auth_user_id, status, invited_by, accepted_at
  )
  values (
    new.id, new.created_by, 'active', new.created_by, timezone('utc', now())
  )
  returning id into v_gym_user;

  insert into public.gym_user_roles(gym_user_id, role_id, assigned_by)
  values (v_gym_user, v_owner_role, new.created_by);

  insert into public.income_categories(gym_id, code, name, is_membership_related)
  values
    (new.id, 'membership', 'Membership income', true),
    (new.id, 'registration', 'Registration fees', true),
    (new.id, 'products', 'Product sales', false),
    (new.id, 'other', 'Other income', false);

  return new;
end;
$$;

create trigger trg_gyms_bootstrap
after insert on public.gyms
for each row execute function private.bootstrap_new_gym();

-- ============================================================================
-- CROSS-TENANT INTEGRITY VALIDATION
-- ============================================================================

create or replace function private.validate_gym_member_tenant()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.home_branch_id is not null and not exists (
    select 1 from public.gym_branches b
    where b.id = new.home_branch_id and b.gym_id = new.gym_id
  ) then
    raise exception 'Member home branch does not belong to the gym';
  end if;
  return new;
end;
$$;

create trigger trg_gym_members_validate_tenant
before insert or update of gym_id, home_branch_id
on public.gym_members
for each row execute function private.validate_gym_member_tenant();

create or replace function private.validate_member_subscription_tenant()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_member_gym uuid;
  v_plan_gym uuid;
begin
  select gym_id into v_member_gym
  from public.gym_members where id = new.gym_member_id;

  select gym_id into v_plan_gym
  from public.membership_plans where id = new.membership_plan_id;

  if v_member_gym is null or v_plan_gym is null or v_member_gym <> v_plan_gym then
    raise exception 'Member and membership plan must belong to the same gym';
  end if;
  return new;
end;
$$;

create trigger trg_member_subscriptions_validate_tenant
before insert or update of gym_member_id, membership_plan_id
on public.member_subscriptions
for each row execute function private.validate_member_subscription_tenant();

create or replace function private.validate_membership_charge_tenant()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_subscription_member uuid;
begin
  select gym_member_id into v_subscription_member
  from public.member_subscriptions
  where id = new.member_subscription_id;

  if v_subscription_member is null or v_subscription_member <> new.gym_member_id then
    raise exception 'Charge member does not match subscription member';
  end if;
  return new;
end;
$$;

create trigger trg_membership_charges_validate_tenant
before insert or update of gym_member_id, member_subscription_id
on public.membership_charges
for each row execute function private.validate_membership_charge_tenant();

create or replace function private.validate_gym_user_role_tenant()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_gym uuid;
  v_role_gym uuid;
begin
  select gym_id into v_user_gym from public.gym_users where id = new.gym_user_id;
  select gym_id into v_role_gym from public.roles where id = new.role_id;

  if v_user_gym is null or v_role_gym is null or v_user_gym <> v_role_gym then
    raise exception 'Gym user and role must belong to the same gym';
  end if;
  return new;
end;
$$;

create trigger trg_gym_user_roles_validate_tenant
before insert or update of gym_user_id, role_id
on public.gym_user_roles
for each row execute function private.validate_gym_user_role_tenant();

create or replace function private.validate_person_photo_tenant()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_asset_gym uuid;
begin
  select gym_id into v_asset_gym
  from public.media_assets where id = new.media_asset_id;

  if v_asset_gym is null or v_asset_gym <> new.gym_id then
    raise exception 'Photo and media asset must belong to the same gym';
  end if;
  return new;
end;
$$;

create trigger trg_person_photos_validate_tenant
before insert or update of gym_id, media_asset_id
on public.person_photos
for each row execute function private.validate_person_photo_tenant();

create or replace function private.validate_face_embedding_tenant()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_photo_gym uuid;
  v_photo_person uuid;
begin
  select gym_id, person_id
    into v_photo_gym, v_photo_person
  from public.person_photos
  where id = new.person_photo_id;

  if v_photo_gym is null
     or v_photo_gym <> new.gym_id
     or v_photo_person <> new.person_id then
    raise exception 'Face embedding, person and photo must belong to the same gym/person';
  end if;
  return new;
end;
$$;

create trigger trg_face_embeddings_validate_tenant
before insert or update of gym_id, person_id, person_photo_id
on public.face_embeddings
for each row execute function private.validate_face_embedding_tenant();

create or replace function private.validate_access_device_tenant()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.gym_branches b
    where b.id = new.branch_id and b.gym_id = new.gym_id
  ) then
    raise exception 'Access device branch does not belong to the gym';
  end if;
  return new;
end;
$$;

create trigger trg_access_devices_validate_tenant
before insert or update of gym_id, branch_id
on public.access_devices
for each row execute function private.validate_access_device_tenant();

create or replace function private.validate_face_event_tenant()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.branch_id is not null and not exists (
    select 1 from public.gym_branches b
    where b.id = new.branch_id and b.gym_id = new.gym_id
  ) then
    raise exception 'Recognition branch does not belong to the gym';
  end if;

  if new.device_id is not null and not exists (
    select 1 from public.access_devices d
    where d.id = new.device_id and d.gym_id = new.gym_id
  ) then
    raise exception 'Recognition device does not belong to the gym';
  end if;

  if new.captured_media_asset_id is not null and not exists (
    select 1 from public.media_assets m
    where m.id = new.captured_media_asset_id and m.gym_id = new.gym_id
  ) then
    raise exception 'Recognition media does not belong to the gym';
  end if;

  if new.matched_face_embedding_id is not null and not exists (
    select 1 from public.face_embeddings e
    where e.id = new.matched_face_embedding_id and e.gym_id = new.gym_id
  ) then
    raise exception 'Matched embedding does not belong to the gym';
  end if;

  if new.gym_member_id is not null and not exists (
    select 1 from public.gym_members gm
    where gm.id = new.gym_member_id and gm.gym_id = new.gym_id
  ) then
    raise exception 'Matched member does not belong to the gym';
  end if;

  return new;
end;
$$;

create trigger trg_face_events_validate_tenant
before insert or update of gym_id, branch_id, device_id, captured_media_asset_id,
  matched_face_embedding_id, gym_member_id
on public.face_recognition_events
for each row execute function private.validate_face_event_tenant();

create or replace function private.validate_gym_alert_tenant()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.branch_id is not null and not exists (
    select 1 from public.gym_branches b
    where b.id = new.branch_id and b.gym_id = new.gym_id
  ) then
    raise exception 'Alert branch does not belong to the gym';
  end if;

  if new.gym_member_id is not null and not exists (
    select 1 from public.gym_members gm
    where gm.id = new.gym_member_id and gm.gym_id = new.gym_id
  ) then
    raise exception 'Alert member does not belong to the gym';
  end if;

  if new.face_recognition_event_id is not null and not exists (
    select 1 from public.face_recognition_events e
    where e.id = new.face_recognition_event_id and e.gym_id = new.gym_id
  ) then
    raise exception 'Alert recognition event does not belong to the gym';
  end if;

  return new;
end;
$$;

create trigger trg_gym_alerts_validate_tenant
before insert or update of gym_id, branch_id, gym_member_id, face_recognition_event_id
on public.gym_alerts
for each row execute function private.validate_gym_alert_tenant();

create or replace function private.validate_other_income_tenant()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.branch_id is not null and not exists (
    select 1 from public.gym_branches b
    where b.id = new.branch_id and b.gym_id = new.gym_id
  ) then
    raise exception 'Income branch does not belong to the gym';
  end if;

  if not exists (
    select 1 from public.income_categories c
    where c.id = new.income_category_id and c.gym_id = new.gym_id
  ) then
    raise exception 'Income category does not belong to the gym';
  end if;
  return new;
end;
$$;

create trigger trg_other_income_validate_tenant
before insert or update of gym_id, branch_id, income_category_id
on public.other_income_entries
for each row execute function private.validate_other_income_tenant();

create or replace function private.deactivate_embeddings_on_consent_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'granted'
     or (new.expires_at is not null and new.expires_at <= timezone('utc', now()))
     or (new.retention_until is not null and new.retention_until <= timezone('utc', now())) then
    update public.face_embeddings
    set is_active = false
    where gym_id = new.gym_id and person_id = new.person_id;
  end if;
  return new;
end;
$$;

create trigger trg_biometric_consent_deactivate_embeddings
after insert or update of status, expires_at, retention_until
on public.biometric_consents
for each row execute function private.deactivate_embeddings_on_consent_change();

-- ============================================================================
-- DOMAIN VALIDATION AND ACCOUNTING FUNCTIONS
-- ============================================================================

create or replace function private.validate_member_payment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_member_gym uuid;
begin
  select gm.gym_id into v_member_gym
  from public.gym_members gm
  where gm.id = new.gym_member_id;

  if v_member_gym is null or v_member_gym <> new.gym_id then
    raise exception 'Payment gym_id does not match member gym_id';
  end if;

  if new.branch_id is not null and not exists (
    select 1
    from public.gym_branches gb
    where gb.id = new.branch_id and gb.gym_id = new.gym_id
  ) then
    raise exception 'Payment branch does not belong to the gym';
  end if;

  return new;
end;
$$;

create trigger trg_member_payments_validate
before insert or update of gym_id, gym_member_id, branch_id
on public.member_payments
for each row execute function private.validate_member_payment();

create or replace function private.validate_payment_allocation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_payment_member uuid;
  v_charge_member uuid;
  v_payment_amount numeric(14,2);
  v_other_allocated numeric(14,2);
begin
  select gym_member_id, amount
    into v_payment_member, v_payment_amount
  from public.member_payments
  where id = new.member_payment_id;

  select gym_member_id
    into v_charge_member
  from public.membership_charges
  where id = new.membership_charge_id;

  if v_payment_member is null or v_charge_member is null
     or v_payment_member <> v_charge_member then
    raise exception 'Payment and charge must belong to the same member';
  end if;

  if tg_op = 'INSERT' then
    select coalesce(sum(a.amount), 0)
      into v_other_allocated
    from public.member_payment_allocations a
    where a.member_payment_id = new.member_payment_id;
  else
    select coalesce(sum(a.amount), 0)
      into v_other_allocated
    from public.member_payment_allocations a
    where a.member_payment_id = new.member_payment_id
      and not (
        a.member_payment_id = old.member_payment_id
        and a.membership_charge_id = old.membership_charge_id
      );
  end if;

  if v_other_allocated + new.amount > v_payment_amount then
    raise exception 'Allocated amount exceeds payment amount';
  end if;

  return new;
end;
$$;

create trigger trg_payment_allocations_validate
before insert or update
on public.member_payment_allocations
for each row execute function private.validate_payment_allocation();

create or replace function private.refresh_membership_charge_status(p_charge_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due numeric(14,2);
  v_paid numeric(14,2);
  v_due_date date;
  v_current_status public.charge_status;
begin
  select amount_due, due_date, status
    into v_due, v_due_date, v_current_status
  from public.membership_charges
  where id = p_charge_id
  for update;

  if not found or v_current_status = 'void' then
    return;
  end if;

  select coalesce(sum(a.amount), 0)
    into v_paid
  from public.member_payment_allocations a
  join public.member_payments p on p.id = a.member_payment_id
  where a.membership_charge_id = p_charge_id
    and p.status = 'settled';

  update public.membership_charges
  set status = case
    when v_paid >= v_due then 'paid'::public.charge_status
    when v_paid > 0 then 'partial'::public.charge_status
    when v_due_date < current_date then 'overdue'::public.charge_status
    else 'pending'::public.charge_status
  end
  where id = p_charge_id;
end;
$$;

create or replace function private.refresh_charge_after_allocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.refresh_membership_charge_status(old.membership_charge_id);
    return old;
  end if;

  perform private.refresh_membership_charge_status(new.membership_charge_id);

  if tg_op = 'UPDATE'
     and new.membership_charge_id <> old.membership_charge_id then
    perform private.refresh_membership_charge_status(old.membership_charge_id);
  end if;

  return new;
end;
$$;

create trigger trg_payment_allocations_refresh_charge
after insert or update or delete
on public.member_payment_allocations
for each row execute function private.refresh_charge_after_allocation();

create or replace function private.refresh_charges_after_payment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if old.status is distinct from new.status then
    for r in
      select membership_charge_id
      from public.member_payment_allocations
      where member_payment_id = new.id
    loop
      perform private.refresh_membership_charge_status(r.membership_charge_id);
    end loop;
  end if;

  return new;
end;
$$;

create trigger trg_member_payment_status_refresh
after update of status
on public.member_payments
for each row execute function private.refresh_charges_after_payment_status();

create or replace function private.member_access_allowed(
  p_gym_member_id uuid,
  p_at timestamptz default timezone('utc', now())
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.gym_members gm
    join public.member_subscriptions ms on ms.gym_member_id = gm.id
    join public.membership_plans mp on mp.id = ms.membership_plan_id
    where gm.id = p_gym_member_id
      and gm.status = 'active'
      and ms.status in ('trialing', 'active')
      and ms.start_date <= p_at::date
      and (ms.end_date is null or ms.end_date >= p_at::date)
      and not exists (
        select 1
        from public.membership_charges mc
        where mc.gym_member_id = gm.id
          and mc.status <> 'void'
          and mc.due_date + mp.grace_days < p_at::date
          and mc.status in ('pending', 'partial', 'overdue')
      )
  );
$$;

create or replace function public.generate_membership_charges(
  p_gym_id uuid,
  p_through_date date default current_date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not private.is_service_role()
     and not private.has_permission(p_gym_id, 'memberships.manage') then
    raise exception 'Insufficient permission';
  end if;

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
  select
    ms.gym_member_id,
    ms.id,
    gs::date,
    (gs + make_interval(months => ms.billing_cycle_months) - interval '1 day')::date,
    gs::date,
    ms.recurring_amount,
    ms.currency,
    case
      when gs::date < current_date then 'overdue'::public.charge_status
      else 'pending'::public.charge_status
    end
  from public.member_subscriptions ms
  join public.gym_members gm on gm.id = ms.gym_member_id
  cross join lateral generate_series(
    ms.start_date::timestamp,
    least(coalesce(ms.end_date, p_through_date), p_through_date)::timestamp,
    make_interval(months => ms.billing_cycle_months)
  ) gs
  where gm.gym_id = p_gym_id
    and ms.status in ('trialing', 'active', 'past_due')
  on conflict (member_subscription_id, period_start) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.cancel_member_subscription(
  p_member_subscription_id uuid,
  p_reason text default null,
  p_cancel_at_period_end boolean default false
)
returns public.member_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscription public.member_subscriptions;
  v_gym_id uuid;
  v_previous_status public.subscription_status;
begin
  select ms.*
  into v_subscription
  from public.member_subscriptions ms
  where ms.id = p_member_subscription_id
  for update;

  if not found then
    raise exception 'Member subscription not found';
  end if;

  select gm.gym_id
  into v_gym_id
  from public.gym_members gm
  where gm.id = v_subscription.gym_member_id;

  if not private.has_permission(v_gym_id, 'memberships.manage') then
    raise exception 'Insufficient permission';
  end if;

  v_previous_status := v_subscription.status;

  insert into public.member_subscription_cancellations(
    member_subscription_id,
    requested_by,
    reason,
    cancel_at_period_end,
    effective_at
  )
  values (
    p_member_subscription_id,
    auth.uid(),
    p_reason,
    p_cancel_at_period_end,
    case when p_cancel_at_period_end then null else timezone('utc', now()) end
  );

  update public.member_subscriptions
  set
    cancel_at_period_end = p_cancel_at_period_end,
    auto_renew = false,
    canceled_at = case
      when p_cancel_at_period_end then canceled_at
      else timezone('utc', now())
    end,
    status = case
      when p_cancel_at_period_end then status
      else 'canceled'::public.subscription_status
    end
  where id = p_member_subscription_id
  returning * into v_subscription;

  insert into public.member_subscription_events(
    member_subscription_id,
    previous_status,
    new_status,
    reason,
    actor_user_id
  )
  values (
    p_member_subscription_id,
    v_previous_status,
    v_subscription.status,
    p_reason,
    auth.uid()
  );

  return v_subscription;
end;
$$;

create or replace function public.request_saas_subscription_cancellation(
  p_gym_saas_subscription_id uuid,
  p_reason text default null,
  p_cancel_at_period_end boolean default true
)
returns public.gym_saas_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscription public.gym_saas_subscriptions;
begin
  select *
  into v_subscription
  from public.gym_saas_subscriptions
  where id = p_gym_saas_subscription_id
  for update;

  if not found then
    raise exception 'SaaS subscription not found';
  end if;

  if not private.has_permission(v_subscription.gym_id, 'billing.manage') then
    raise exception 'Insufficient permission';
  end if;

  insert into public.saas_subscription_cancellations(
    gym_saas_subscription_id,
    requested_by,
    reason,
    cancel_at_period_end,
    effective_at
  )
  values (
    p_gym_saas_subscription_id,
    auth.uid(),
    p_reason,
    p_cancel_at_period_end,
    case when p_cancel_at_period_end then null else timezone('utc', now()) end
  );

  update public.gym_saas_subscriptions
  set
    cancel_at_period_end = p_cancel_at_period_end,
    canceled_at = case
      when p_cancel_at_period_end then canceled_at
      else timezone('utc', now())
    end,
    status = case
      when p_cancel_at_period_end then status
      else 'canceled'::public.subscription_status
    end
  where id = p_gym_saas_subscription_id
  returning * into v_subscription;

  return v_subscription;
end;
$$;

create or replace function public.match_face_candidates(
  p_gym_id uuid,
  p_embedding extensions.vector(512),
  p_similarity_threshold real default 0.75,
  p_limit integer default 3
)
returns table (
  face_embedding_id uuid,
  person_id uuid,
  gym_member_id uuid,
  similarity real,
  access_allowed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    fe.id,
    fe.person_id,
    gm.id,
    (1 - (fe.embedding OPERATOR(extensions.<=>) p_embedding))::real as similarity,
    private.member_access_allowed(gm.id, timezone('utc', now())) as access_allowed
  from public.face_embeddings fe
  join public.gym_members gm
    on gm.gym_id = fe.gym_id
   and gm.person_id = fe.person_id
  where fe.gym_id = p_gym_id
    and fe.is_active
    and (
      private.is_service_role()
      or private.has_permission(p_gym_id, 'faces.verify')
    )
    and exists (
      select 1
      from public.biometric_consents bc
      where bc.gym_id = fe.gym_id
        and bc.person_id = fe.person_id
        and bc.status = 'granted'
        and (bc.expires_at is null or bc.expires_at > timezone('utc', now()))
        and (bc.retention_until is null or bc.retention_until > timezone('utc', now()))
    )
    and (1 - (fe.embedding OPERATOR(extensions.<=>) p_embedding)) >= p_similarity_threshold
  order by fe.embedding OPERATOR(extensions.<=>) p_embedding
  limit greatest(1, least(p_limit, 10));
$$;

create or replace function private.create_alert_from_face_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alert_type_id uuid;
  v_title text;
  v_message text;
  v_severity public.alert_severity;
begin
  if new.decision = 'allowed' then
    return new;
  end if;

  if new.decision = 'no_match' then
    select id, default_severity
      into v_alert_type_id, v_severity
    from public.alert_types
    where code = 'FACE_NO_MATCH';

    v_title := 'Face not recognized';
    v_message := 'A facial access attempt did not match an enrolled member.';
  elsif new.gym_member_id is not null
        and not private.member_access_allowed(new.gym_member_id, new.occurred_at) then
    select id, default_severity
      into v_alert_type_id, v_severity
    from public.alert_types
    where code = 'MEMBERSHIP_UNPAID';

    v_title := 'Member access denied';
    v_message := 'The recognized member does not have a valid paid membership.';
  else
    select id, default_severity
      into v_alert_type_id, v_severity
    from public.alert_types
    where code = 'FACE_ACCESS_DENIED';

    v_title := 'Facial access denied';
    v_message := coalesce(new.decision_reason, 'Access was denied.');
  end if;

  if v_alert_type_id is not null then
    insert into public.gym_alerts(
      gym_id,
      branch_id,
      alert_type_id,
      gym_member_id,
      face_recognition_event_id,
      severity,
      title,
      message
    )
    values (
      new.gym_id,
      new.branch_id,
      v_alert_type_id,
      new.gym_member_id,
      new.id,
      v_severity,
      v_title,
      v_message
    );
  end if;

  return new;
end;
$$;

create trigger trg_face_event_create_alert
after insert on public.face_recognition_events
for each row execute function private.create_alert_from_face_event();

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'saas_plans',
    'persons',
    'person_addresses',
    'user_profiles',
    'gyms',
    'gym_branches',
    'gym_saas_subscriptions',
    'saas_invoices',
    'saas_payments',
    'gym_users',
    'roles',
    'gym_members',
    'membership_plans',
    'member_subscriptions',
    'membership_charges',
    'member_payments',
    'media_assets',
    'face_embeddings',
    'access_devices',
    'other_income_entries'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I
       for each row execute function private.set_updated_at()',
      'trg_' || v_table || '_updated_at',
      v_table
    );
  end loop;
end;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.saas_plans enable row level security;
alter table public.saas_features enable row level security;
alter table public.saas_plan_features enable row level security;
alter table public.persons enable row level security;
alter table public.person_contacts enable row level security;
alter table public.person_addresses enable row level security;
alter table public.user_profiles enable row level security;
alter table public.gyms enable row level security;
alter table public.gym_branches enable row level security;
alter table public.gym_saas_subscriptions enable row level security;
alter table public.gym_saas_subscription_events enable row level security;
alter table public.saas_subscription_cancellations enable row level security;
alter table public.saas_invoices enable row level security;
alter table public.saas_invoice_items enable row level security;
alter table public.saas_payments enable row level security;
alter table public.saas_payment_allocations enable row level security;
alter table public.screens enable row level security;
alter table public.permissions enable row level security;
alter table public.screen_permissions enable row level security;
alter table public.gym_users enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.gym_user_roles enable row level security;
alter table public.gym_members enable row level security;
alter table public.membership_plans enable row level security;
alter table public.membership_plan_benefits enable row level security;
alter table public.member_subscriptions enable row level security;
alter table public.member_subscription_events enable row level security;
alter table public.member_subscription_cancellations enable row level security;
alter table public.membership_charges enable row level security;
alter table public.payment_methods enable row level security;
alter table public.member_payments enable row level security;
alter table public.member_payment_allocations enable row level security;
alter table public.media_assets enable row level security;
alter table public.person_photos enable row level security;
alter table public.biometric_consents enable row level security;
alter table public.face_models enable row level security;
alter table public.face_embeddings enable row level security;
alter table public.access_devices enable row level security;
alter table public.face_recognition_events enable row level security;
alter table public.alert_types enable row level security;
alter table public.gym_alerts enable row level security;
alter table public.gym_alert_recipients enable row level security;
alter table public.income_categories enable row level security;
alter table public.other_income_entries enable row level security;
alter table public.audit_logs enable row level security;

-- Public/authenticated reference catalogs.
create policy saas_plans_read on public.saas_plans
for select to authenticated using (is_active);

create policy saas_features_read on public.saas_features
for select to authenticated using (true);

create policy saas_plan_features_read on public.saas_plan_features
for select to authenticated using (true);

create policy screens_read on public.screens
for select to authenticated using (is_active);

create policy permissions_read on public.permissions
for select to authenticated using (true);

create policy screen_permissions_read on public.screen_permissions
for select to authenticated using (true);

create policy payment_methods_read on public.payment_methods
for select to authenticated using (is_active);

create policy face_models_read on public.face_models
for select to authenticated using (is_active);

create policy alert_types_read on public.alert_types
for select to authenticated using (true);

-- Own profile and authorized people.
create policy user_profiles_read_own on public.user_profiles
for select to authenticated
using (
  auth_user_id = auth.uid()
  or private.can_access_person(person_id)
);

create policy user_profiles_update_own on public.user_profiles
for update to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

create policy persons_read on public.persons
for select to authenticated using (private.can_access_person(id));

create policy persons_insert on public.persons
for insert to authenticated with check (created_by = auth.uid());

create policy persons_update on public.persons
for update to authenticated
using (private.can_access_person(id))
with check (private.can_access_person(id));

create policy person_contacts_all on public.person_contacts
for all to authenticated
using (private.can_access_person(person_id))
with check (private.can_access_person(person_id));

create policy person_addresses_all on public.person_addresses
for all to authenticated
using (private.can_access_person(person_id))
with check (private.can_access_person(person_id));

-- Gyms and branches.
create policy gyms_read on public.gyms
for select to authenticated
using (
  private.is_gym_user(id)
  or created_by = auth.uid()
);

create policy gyms_insert on public.gyms
for insert to authenticated
with check (created_by = auth.uid());

create policy gyms_update on public.gyms
for update to authenticated
using (private.has_permission(id, 'gym.manage'))
with check (private.has_permission(id, 'gym.manage'));

create policy gym_branches_read on public.gym_branches
for select to authenticated
using (private.is_gym_user(gym_id));

create policy gym_branches_manage on public.gym_branches
for all to authenticated
using (private.has_permission(gym_id, 'gym.manage'))
with check (private.has_permission(gym_id, 'gym.manage'));

-- SaaS billing: clients read, writes occur through trusted functions/provider webhooks.
create policy gym_saas_subscriptions_read on public.gym_saas_subscriptions
for select to authenticated
using (private.has_permission(gym_id, 'billing.read'));

create policy gym_saas_subscription_events_read
on public.gym_saas_subscription_events
for select to authenticated
using (
  exists (
    select 1
    from public.gym_saas_subscriptions s
    where s.id = gym_saas_subscription_id
      and private.has_permission(s.gym_id, 'billing.read')
  )
);

create policy saas_cancellations_read on public.saas_subscription_cancellations
for select to authenticated
using (
  exists (
    select 1
    from public.gym_saas_subscriptions s
    where s.id = gym_saas_subscription_id
      and private.has_permission(s.gym_id, 'billing.read')
  )
);

create policy saas_invoices_read on public.saas_invoices
for select to authenticated
using (private.has_permission(gym_id, 'billing.read'));

create policy saas_invoice_items_read on public.saas_invoice_items
for select to authenticated
using (
  exists (
    select 1 from public.saas_invoices i
    where i.id = saas_invoice_id
      and private.has_permission(i.gym_id, 'billing.read')
  )
);

create policy saas_payments_read on public.saas_payments
for select to authenticated
using (private.has_permission(gym_id, 'billing.read'));

create policy saas_payment_allocations_read on public.saas_payment_allocations
for select to authenticated
using (
  exists (
    select 1
    from public.saas_payments p
    where p.id = saas_payment_id
      and private.has_permission(p.gym_id, 'billing.read')
  )
);

-- Staff and RBAC.
create policy gym_users_read on public.gym_users
for select to authenticated
using (
  auth_user_id = auth.uid()
  or private.has_permission(gym_id, 'staff.read')
);

create policy gym_users_manage on public.gym_users
for all to authenticated
using (private.has_permission(gym_id, 'staff.manage'))
with check (private.has_permission(gym_id, 'staff.manage'));

create policy roles_read on public.roles
for select to authenticated
using (private.is_gym_user(gym_id));

create policy roles_manage on public.roles
for all to authenticated
using (private.has_permission(gym_id, 'roles.manage'))
with check (private.has_permission(gym_id, 'roles.manage'));

create policy role_permissions_read on public.role_permissions
for select to authenticated
using (
  exists (
    select 1 from public.roles r
    where r.id = role_id
      and private.is_gym_user(r.gym_id)
  )
);

create policy role_permissions_manage on public.role_permissions
for all to authenticated
using (
  exists (
    select 1 from public.roles r
    where r.id = role_id
      and private.has_permission(r.gym_id, 'roles.manage')
  )
)
with check (
  exists (
    select 1 from public.roles r
    where r.id = role_id
      and private.has_permission(r.gym_id, 'roles.manage')
  )
);

create policy gym_user_roles_read on public.gym_user_roles
for select to authenticated
using (
  exists (
    select 1 from public.gym_users gu
    where gu.id = gym_user_id
      and (
        gu.auth_user_id = auth.uid()
        or private.has_permission(gu.gym_id, 'staff.read')
      )
  )
);

create policy gym_user_roles_manage on public.gym_user_roles
for all to authenticated
using (
  exists (
    select 1 from public.gym_users gu
    where gu.id = gym_user_id
      and private.has_permission(gu.gym_id, 'roles.manage')
  )
)
with check (
  exists (
    select 1 from public.gym_users gu
    where gu.id = gym_user_id
      and private.has_permission(gu.gym_id, 'roles.manage')
  )
);

-- Members and memberships.
create policy gym_members_read on public.gym_members
for select to authenticated
using (private.has_permission(gym_id, 'members.read'));

create policy gym_members_manage on public.gym_members
for all to authenticated
using (private.has_permission(gym_id, 'members.manage'))
with check (private.has_permission(gym_id, 'members.manage'));

create policy membership_plans_read on public.membership_plans
for select to authenticated
using (private.has_permission(gym_id, 'memberships.read'));

create policy membership_plans_manage on public.membership_plans
for all to authenticated
using (private.has_permission(gym_id, 'memberships.manage'))
with check (private.has_permission(gym_id, 'memberships.manage'));

create policy membership_plan_benefits_read on public.membership_plan_benefits
for select to authenticated
using (
  exists (
    select 1 from public.membership_plans mp
    where mp.id = membership_plan_id
      and private.has_permission(mp.gym_id, 'memberships.read')
  )
);

create policy membership_plan_benefits_manage on public.membership_plan_benefits
for all to authenticated
using (
  exists (
    select 1 from public.membership_plans mp
    where mp.id = membership_plan_id
      and private.has_permission(mp.gym_id, 'memberships.manage')
  )
)
with check (
  exists (
    select 1 from public.membership_plans mp
    where mp.id = membership_plan_id
      and private.has_permission(mp.gym_id, 'memberships.manage')
  )
);

create policy member_subscriptions_read on public.member_subscriptions
for select to authenticated
using (
  exists (
    select 1 from public.gym_members gm
    where gm.id = gym_member_id
      and private.has_permission(gm.gym_id, 'memberships.read')
  )
);

create policy member_subscriptions_manage on public.member_subscriptions
for all to authenticated
using (
  exists (
    select 1 from public.gym_members gm
    where gm.id = gym_member_id
      and private.has_permission(gm.gym_id, 'memberships.manage')
  )
)
with check (
  exists (
    select 1 from public.gym_members gm
    where gm.id = gym_member_id
      and private.has_permission(gm.gym_id, 'memberships.manage')
  )
);

create policy member_subscription_events_read on public.member_subscription_events
for select to authenticated
using (
  exists (
    select 1
    from public.member_subscriptions ms
    join public.gym_members gm on gm.id = ms.gym_member_id
    where ms.id = member_subscription_id
      and private.has_permission(gm.gym_id, 'memberships.read')
  )
);

create policy member_cancellations_read on public.member_subscription_cancellations
for select to authenticated
using (
  exists (
    select 1
    from public.member_subscriptions ms
    join public.gym_members gm on gm.id = ms.gym_member_id
    where ms.id = member_subscription_id
      and private.has_permission(gm.gym_id, 'memberships.read')
  )
);

create policy membership_charges_read on public.membership_charges
for select to authenticated
using (
  exists (
    select 1 from public.gym_members gm
    where gm.id = gym_member_id
      and private.has_permission(gm.gym_id, 'memberships.read')
  )
);

create policy membership_charges_manage on public.membership_charges
for all to authenticated
using (
  exists (
    select 1 from public.gym_members gm
    where gm.id = gym_member_id
      and private.has_permission(gm.gym_id, 'memberships.manage')
  )
)
with check (
  exists (
    select 1 from public.gym_members gm
    where gm.id = gym_member_id
      and private.has_permission(gm.gym_id, 'memberships.manage')
  )
);

-- Payments.
create policy member_payments_read on public.member_payments
for select to authenticated
using (private.has_permission(gym_id, 'payments.read'));

create policy member_payments_manage on public.member_payments
for all to authenticated
using (private.has_permission(gym_id, 'payments.manage'))
with check (private.has_permission(gym_id, 'payments.manage'));

create policy payment_allocations_read on public.member_payment_allocations
for select to authenticated
using (
  exists (
    select 1 from public.member_payments p
    where p.id = member_payment_id
      and private.has_permission(p.gym_id, 'payments.read')
  )
);

create policy payment_allocations_manage on public.member_payment_allocations
for all to authenticated
using (
  exists (
    select 1 from public.member_payments p
    where p.id = member_payment_id
      and private.has_permission(p.gym_id, 'payments.manage')
  )
)
with check (
  exists (
    select 1 from public.member_payments p
    where p.id = member_payment_id
      and private.has_permission(p.gym_id, 'payments.manage')
  )
);

-- Media and biometric data.
create policy media_assets_read on public.media_assets
for select to authenticated
using (private.has_permission(gym_id, 'media.read'));

create policy media_assets_manage on public.media_assets
for all to authenticated
using (private.has_permission(gym_id, 'media.manage'))
with check (private.has_permission(gym_id, 'media.manage'));

create policy person_photos_read on public.person_photos
for select to authenticated
using (
  private.has_permission(gym_id, 'media.read')
  or private.has_permission(gym_id, 'faces.read')
);

create policy person_photos_manage on public.person_photos
for all to authenticated
using (
  private.has_permission(gym_id, 'media.manage')
  or private.has_permission(gym_id, 'faces.manage')
)
with check (
  private.has_permission(gym_id, 'media.manage')
  or private.has_permission(gym_id, 'faces.manage')
);

create policy biometric_consents_read on public.biometric_consents
for select to authenticated
using (private.has_permission(gym_id, 'faces.read'));

create policy biometric_consents_manage on public.biometric_consents
for all to authenticated
using (private.has_permission(gym_id, 'faces.manage'))
with check (private.has_permission(gym_id, 'faces.manage'));

create policy face_embeddings_read on public.face_embeddings
for select to authenticated
using (private.has_permission(gym_id, 'faces.read'));

create policy face_embeddings_manage on public.face_embeddings
for all to authenticated
using (private.has_permission(gym_id, 'faces.manage'))
with check (private.has_permission(gym_id, 'faces.manage'));

create policy access_devices_read on public.access_devices
for select to authenticated
using (private.has_permission(gym_id, 'faces.read'));

create policy access_devices_manage on public.access_devices
for all to authenticated
using (private.has_permission(gym_id, 'faces.manage'))
with check (private.has_permission(gym_id, 'faces.manage'));

create policy face_events_read on public.face_recognition_events
for select to authenticated
using (private.has_permission(gym_id, 'faces.read'));

create policy face_events_insert on public.face_recognition_events
for insert to authenticated
with check (private.has_permission(gym_id, 'faces.verify'));

-- Alerts.
create policy gym_alerts_read on public.gym_alerts
for select to authenticated
using (private.has_permission(gym_id, 'alerts.read'));

create policy gym_alerts_manage on public.gym_alerts
for update to authenticated
using (private.has_permission(gym_id, 'alerts.manage'))
with check (private.has_permission(gym_id, 'alerts.manage'));

create policy alert_recipients_read on public.gym_alert_recipients
for select to authenticated
using (
  exists (
    select 1
    from public.gym_alerts ga
    join public.gym_users gu on gu.id = gym_user_id
    where ga.id = gym_alert_id
      and (
        gu.auth_user_id = auth.uid()
        or private.has_permission(ga.gym_id, 'alerts.read')
      )
  )
);

create policy alert_recipients_update_own on public.gym_alert_recipients
for update to authenticated
using (
  exists (
    select 1 from public.gym_users gu
    where gu.id = gym_user_id
      and gu.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.gym_users gu
    where gu.id = gym_user_id
      and gu.auth_user_id = auth.uid()
  )
);

-- Income and audit.
create policy income_categories_read on public.income_categories
for select to authenticated
using (private.has_permission(gym_id, 'income.read'));

create policy income_categories_manage on public.income_categories
for all to authenticated
using (private.has_permission(gym_id, 'income.manage'))
with check (private.has_permission(gym_id, 'income.manage'));

create policy other_income_read on public.other_income_entries
for select to authenticated
using (private.has_permission(gym_id, 'income.read'));

create policy other_income_manage on public.other_income_entries
for all to authenticated
using (private.has_permission(gym_id, 'income.manage'))
with check (private.has_permission(gym_id, 'income.manage'));

create policy audit_logs_read on public.audit_logs
for select to authenticated
using (gym_id is not null and private.has_permission(gym_id, 'audit.read'));

-- ============================================================================
-- SECURITY-INVOKER VIEWS
-- ============================================================================

create view public.v_member_access_status
with (security_invoker = true)
as
select
  gm.gym_id,
  gm.id as gym_member_id,
  gm.member_code,
  gm.status as member_status,
  p.id as person_id,
  p.first_name,
  p.last_name,
  exists (
    select 1
    from public.member_subscriptions ms
    where ms.gym_member_id = gm.id
      and ms.status in ('trialing', 'active')
      and ms.start_date <= current_date
      and (ms.end_date is null or ms.end_date >= current_date)
  ) as has_active_subscription,
  exists (
    select 1
    from public.membership_charges mc
    where mc.gym_member_id = gm.id
      and mc.status in ('pending', 'partial', 'overdue')
      and mc.due_date < current_date
  ) as has_overdue_charges,
  private.member_access_allowed(gm.id, timezone('utc', now())) as access_allowed
from public.gym_members gm
join public.persons p on p.id = gm.person_id;

create view public.v_gym_income
with (security_invoker = true)
as
select
  mp.gym_id,
  mp.branch_id,
  mp.paid_at as occurred_at,
  mp.amount,
  mp.currency,
  'membership_payment'::text as source_type,
  mp.id as source_id,
  mp.receipt_number as reference
from public.member_payments mp
where mp.status = 'settled'

union all

select
  oi.gym_id,
  oi.branch_id,
  oi.occurred_at,
  oi.amount,
  oi.currency,
  'other_income'::text as source_type,
  oi.id as source_id,
  oi.reference
from public.other_income_entries oi
where oi.status = 'posted';

create view public.v_gym_income_daily
with (security_invoker = true)
as
select
  gym_id,
  occurred_at::date as income_date,
  currency,
  sum(amount)::numeric(14,2) as total_income
from public.v_gym_income
group by gym_id, occurred_at::date, currency;

create view public.v_gym_dashboard
with (security_invoker = true)
as
select
  g.id as gym_id,
  g.trade_name,
  (
    select count(*)
    from public.gym_members gm
    where gm.gym_id = g.id
      and gm.status = 'active'
  ) as active_members,
  (
    select count(*)
    from public.membership_charges mc
    join public.gym_members gm on gm.id = mc.gym_member_id
    where gm.gym_id = g.id
      and mc.status in ('pending', 'partial', 'overdue')
      and mc.due_date < current_date
  ) as overdue_charges,
  (
    select coalesce(sum(i.amount), 0)
    from public.v_gym_income i
    where i.gym_id = g.id
      and i.currency = g.default_currency
      and i.occurred_at >= date_trunc('month', timezone('utc', now()))
      and i.occurred_at < date_trunc('month', timezone('utc', now())) + interval '1 month'
  )::numeric(14,2) as current_month_income,
  (
    select count(*)
    from public.face_recognition_events fre
    where fre.gym_id = g.id
      and fre.occurred_at >= date_trunc('day', timezone('utc', now()))
      and fre.decision = 'allowed'
  ) as successful_accesses_today,
  (
    select count(*)
    from public.gym_alerts ga
    where ga.gym_id = g.id
      and ga.status in ('open', 'acknowledged')
  ) as open_alerts
from public.gyms g;

-- ============================================================================
-- GRANTS
-- RLS remains the real authorization boundary.
-- ============================================================================

grant usage on schema public to anon, authenticated;
grant select on public.saas_plans, public.saas_features, public.saas_plan_features
  to authenticated;
grant select on public.screens, public.permissions, public.screen_permissions
  to authenticated;
grant select on public.payment_methods, public.face_models, public.alert_types
  to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant select on public.v_member_access_status,
  public.v_gym_income,
  public.v_gym_income_daily,
  public.v_gym_dashboard
to authenticated;

revoke all on function public.match_face_candidates(
  uuid, extensions.vector, real, integer
) from public;
revoke all on function public.generate_membership_charges(uuid, date) from public;
revoke all on function public.cancel_member_subscription(uuid, text, boolean) from public;
revoke all on function public.request_saas_subscription_cancellation(uuid, text, boolean)
  from public;

grant execute on function public.match_face_candidates(
  uuid, extensions.vector, real, integer
) to authenticated, service_role;
grant execute on function public.generate_membership_charges(uuid, date)
  to authenticated, service_role;
grant execute on function public.cancel_member_subscription(uuid, text, boolean)
  to authenticated, service_role;
grant execute on function public.request_saas_subscription_cancellation(uuid, text, boolean)
  to authenticated, service_role;

commit;

-- ============================================================================
-- RECOMMENDED APPLICATION FLOW
-- ============================================================================
-- 1. Create Auth user. Trigger creates persons + user_profiles.
-- 2. Authenticated owner inserts gyms. Trigger creates tenant roles and owner.
-- 3. Create branches, membership plans, people and gym_members.
-- 4. Create member_subscriptions, then call generate_membership_charges().
-- 5. Record member_payments and member_payment_allocations.
-- 6. Compress images in the API/Edge Function to WebP or AVIF.
-- 7. Store image bytes in media_assets.binary_data OR use Supabase Storage.
-- 8. Obtain explicit biometric consent before creating face_embeddings.
-- 9. Generate a 512-dimensional face embedding in a trusted server function.
-- 10. Call match_face_candidates(), decide access, insert recognition event.
-- 11. The event trigger creates alerts when access is denied.
-- 12. Read dashboards from v_gym_dashboard and income from v_gym_income.
