-- Platform-only onboarding for one gym and its initial owner.
-- Auth invitation happens in the trusted Next.js server; this RPC owns the
-- atomic database portion and the existing gym bootstrap trigger creates the
-- tenant roles, permissions, owner membership, income categories and rate.

create or replace function public.create_platform_gym_with_owner(
  p_owner_auth_user_id uuid,
  p_legal_name text,
  p_trade_name text,
  p_slug text,
  p_tax_identifier text,
  p_default_currency text,
  p_timezone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_gym public.gyms%rowtype;
  v_gym_user_id uuid;
  v_owner_role_id uuid;
  v_currency text := upper(trim(coalesce(p_default_currency, '')));
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_payload jsonb;
begin
  if not private.is_platform_admin() then
    raise exception 'platform admin permission required'
      using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_owner_auth_user_id) then
    raise exception 'Invited owner authentication user was not found'
      using errcode = '23503';
  end if;

  if char_length(trim(coalesce(p_legal_name, ''))) not between 2 and 160 then
    raise exception 'La razon social debe tener entre 2 y 160 caracteres.'
      using errcode = '23514';
  end if;

  if char_length(trim(coalesce(p_trade_name, ''))) not between 2 and 160 then
    raise exception 'El nombre comercial debe tener entre 2 y 160 caracteres.'
      using errcode = '23514';
  end if;

  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_slug) > 80 then
    raise exception 'El slug solo admite letras minusculas, numeros y guiones.'
      using errcode = '23514';
  end if;

  if v_currency not in ('NIO', 'USD') then
    raise exception 'La moneda debe ser NIO o USD.'
      using errcode = '23514';
  end if;

  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'La zona horaria no es valida.'
      using errcode = '23514';
  end if;

  insert into public.gyms(
    legal_name,
    trade_name,
    slug,
    tax_identifier,
    default_currency,
    timezone,
    created_by
  ) values (
    trim(p_legal_name),
    trim(p_trade_name),
    v_slug,
    nullif(trim(coalesce(p_tax_identifier, '')), ''),
    v_currency,
    p_timezone,
    p_owner_auth_user_id
  )
  returning * into v_gym;

  select gu.id, r.id
  into v_gym_user_id, v_owner_role_id
  from public.gym_users gu
  join public.gym_user_roles gur on gur.gym_user_id = gu.id
  join public.roles r on r.id = gur.role_id
  where gu.gym_id = v_gym.id
    and gu.auth_user_id = p_owner_auth_user_id
    and r.code = 'owner'
    and gu.deleted_at is null
    and r.deleted_at is null;

  if v_gym_user_id is null or v_owner_role_id is null then
    raise exception 'Tenant bootstrap did not create the owner assignment';
  end if;

  update public.gym_users
  set invited_by = v_actor_user_id
  where id = v_gym_user_id;

  update public.gym_user_roles
  set assigned_by = v_actor_user_id
  where gym_user_id = v_gym_user_id
    and role_id = v_owner_role_id;

  v_payload := jsonb_build_object(
    'gymId', v_gym.id,
    'ownerAuthUserId', p_owner_auth_user_id,
    'tradeName', v_gym.trade_name,
    'legalName', v_gym.legal_name,
    'slug', v_gym.slug,
    'defaultCurrency', v_gym.default_currency,
    'timezone', v_gym.timezone
  );

  insert into public.audit_logs(
    gym_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    after_data
  ) values (
    v_gym.id,
    v_actor_user_id,
    'PLATFORM_GYM_CREATED_WITH_OWNER',
    'gyms',
    v_gym.id::text,
    v_payload
  );

  return v_payload;
end;
$$;

revoke all on function public.create_platform_gym_with_owner(
  uuid, text, text, text, text, text, text
) from public;

grant execute on function public.create_platform_gym_with_owner(
  uuid, text, text, text, text, text, text
) to authenticated, service_role;

comment on function public.create_platform_gym_with_owner(
  uuid, text, text, text, text, text, text
) is 'Platform-admin-only atomic tenant bootstrap for an invited owner; writes a compact audit event without email or secrets.';

-- Rollback: drop function public.create_platform_gym_with_owner(uuid, text, text, text, text, text, text);
