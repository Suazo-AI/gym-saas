begin;

create or replace function public.revoke_biometric_consent(
  p_gym_id uuid,
  p_person_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
  v_media_asset_ids uuid[];
  v_revoked_count integer := 0;
  v_photo_count integer := 0;
  v_asset_count integer := 0;
begin
  if not private.has_permission(p_gym_id, 'faces.manage') then
    raise exception 'Insufficient permission: faces.manage';
  end if;

  if not exists (
    select 1
    from public.gym_members gm
    where gm.gym_id = p_gym_id
      and gm.person_id = p_person_id
  ) then
    raise exception 'Person % does not belong to gym %', p_person_id, p_gym_id;
  end if;

  update public.biometric_consents
  set status = 'revoked',
      revoked_at = v_now
  where gym_id = p_gym_id
    and person_id = p_person_id
    and status = 'granted';

  get diagnostics v_revoked_count = row_count;

  select pg_catalog.array_agg(distinct pp.media_asset_id)
  into v_media_asset_ids
  from public.person_photos pp
  where pp.gym_id = p_gym_id
    and pp.person_id = p_person_id
    and pp.deleted_at is null;

  perform set_config('app.soft_delete_operation', 'on', true);

  update public.person_photos
  set deleted_at = v_now,
      deleted_by = v_actor,
      deletion_reason = nullif(pg_catalog.btrim(p_reason), '')
  where gym_id = p_gym_id
    and person_id = p_person_id
    and deleted_at is null;

  get diagnostics v_photo_count = row_count;

  update public.media_assets
  set deleted_at = v_now,
      deleted_by = v_actor,
      deletion_reason = nullif(pg_catalog.btrim(p_reason), '')
  where gym_id = p_gym_id
    and id = any(coalesce(v_media_asset_ids, array[]::uuid[]))
    and deleted_at is null;

  get diagnostics v_asset_count = row_count;

  insert into public.storage_deletion_queue(
    media_asset_id,
    gym_id,
    bucket_name,
    object_path
  )
  select
    ma.id,
    ma.gym_id,
    ma.bucket_name,
    ma.object_path
  from public.media_assets ma
  where ma.gym_id = p_gym_id
    and ma.id = any(coalesce(v_media_asset_ids, array[]::uuid[]))
    and ma.storage_deleted_at is null
    and not exists (
      select 1
      from public.storage_deletion_queue q
      where q.media_asset_id = ma.id
    )
  on conflict do nothing;

  insert into public.audit_logs(
    gym_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    after_data
  )
  values (
    p_gym_id,
    v_actor,
    'BIOMETRIC_CONSENT_REVOKED',
    'biometric_consents',
    p_person_id::text,
    jsonb_build_object(
      'reason', nullif(pg_catalog.btrim(p_reason), ''),
      'revoked_consents', v_revoked_count,
      'deleted_photos', v_photo_count,
      'deleted_media_assets', v_asset_count
    )
  );
end;
$$;

revoke all on function public.revoke_biometric_consent(uuid, uuid, text)
  from public;
grant execute on function public.revoke_biometric_consent(uuid, uuid, text)
  to authenticated;

create or replace function public.soft_delete_entity(
  p_entity text,
  p_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target record;
  v_deleted_at timestamptz;
  v_before jsonb;
  v_now timestamptz := timezone('utc', now());
  v_actor uuid := auth.uid();
  v_owner_count integer;
begin
  select *
  into v_target
  from private.resolve_soft_delete_target(p_entity, p_id);

  if not found then
    raise exception '% with id % was not found', p_entity, p_id;
  end if;

  if not private.has_permission(v_target.gym_id, v_target.permission_code) then
    raise exception 'Insufficient permission: %', v_target.permission_code;
  end if;

  execute format(
    'select deleted_at, to_jsonb(t)
     from public.%I t
     where id = $1
     for update',
    v_target.table_name
  )
  into v_deleted_at, v_before
  using p_id;

  if v_deleted_at is not null then
    return jsonb_build_object(
      'entity', p_entity,
      'id', p_id,
      'deletedAt', v_deleted_at,
      'alreadyDeleted', true
    );
  end if;

  -- Dependency and business-rule checks.
  case p_entity
    when 'gym_branch' then
      if exists (
        select 1
        from public.access_devices ad
        where ad.branch_id = p_id
          and ad.deleted_at is null
      ) then
        raise exception 'Reassign or delete active access devices before deleting the branch';
      end if;

      if exists (
        select 1
        from public.gym_members gm
        where gm.home_branch_id = p_id
          and gm.deleted_at is null
          and gm.status in ('prospect', 'active', 'suspended', 'blocked')
      ) then
        raise exception 'Reassign active members before deleting the branch';
      end if;

    when 'gym_user' then
      if exists (
        select 1
        from public.gym_user_roles gur
        join public.roles r on r.id = gur.role_id
        where gur.gym_user_id = p_id
          and r.code = 'owner'
          and r.deleted_at is null
      ) then
        select count(*)
        into v_owner_count
        from public.gym_users gu
        join public.gym_user_roles gur on gur.gym_user_id = gu.id
        join public.roles r on r.id = gur.role_id
        where gu.gym_id = v_target.gym_id
          and gu.deleted_at is null
          and gu.status = 'active'
          and r.deleted_at is null
          and r.code = 'owner';

        if v_owner_count <= 1 then
          raise exception 'The last active owner cannot be deleted';
        end if;
      end if;

    when 'role' then
      if exists (
        select 1
        from public.roles r
        where r.id = p_id
          and r.is_system
      ) then
        raise exception 'System roles cannot be deleted';
      end if;

      if exists (
        select 1
        from public.gym_user_roles gur
        join public.gym_users gu on gu.id = gur.gym_user_id
        where gur.role_id = p_id
          and gu.deleted_at is null
          and gu.status = 'active'
      ) then
        raise exception 'Remove this role from active users before deleting it';
      end if;

    when 'gym_member' then
      if exists (
        select 1
        from public.member_subscriptions ms
        where ms.gym_member_id = p_id
          and ms.status in ('trialing', 'active', 'past_due', 'paused')
      ) then
        raise exception 'Cancel or expire the active membership before deleting the member';
      end if;

    when 'membership_plan' then
      if exists (
        select 1
        from public.member_subscriptions ms
        where ms.membership_plan_id = p_id
          and ms.status in ('trialing', 'active', 'past_due', 'paused')
      ) then
        raise exception 'The plan has current subscriptions and cannot be deleted';
      end if;

    when 'media_asset' then
      if exists (
        select 1
        from public.person_photos pp
        where pp.media_asset_id = p_id
          and pp.deleted_at is null
      ) then
        raise exception 'Delete the active person_photo reference before deleting the media asset';
      end if;

    when 'income_category' then
      if exists (
        select 1
        from public.income_categories ic
        where ic.id = p_id
          and ic.is_membership_related
      ) then
        raise exception 'System membership income categories cannot be deleted';
      end if;

    else
      null;
  end case;

  perform set_config('app.soft_delete_operation', 'on', true);

  execute format(
    'update public.%I
     set deleted_at = $2,
         deleted_by = $3,
         deletion_reason = nullif(trim($4), '''')
     where id = $1',
    v_target.table_name
  )
  using p_id, v_now, v_actor, p_reason;

  if p_entity = 'gym_member' then
    perform public.revoke_biometric_consent(
      v_target.gym_id,
      (
        select gm.person_id
        from public.gym_members gm
        where gm.id = p_id
      ),
      p_reason
    );
  end if;

  if p_entity = 'person_photo' then
    update public.face_embeddings
    set is_active = false,
        updated_at = v_now
    where person_photo_id = p_id
      and is_active;
  end if;

  if p_entity = 'media_asset' then
    insert into public.storage_deletion_queue(
      media_asset_id,
      gym_id,
      bucket_name,
      object_path
    )
    select
      ma.id,
      ma.gym_id,
      ma.bucket_name,
      ma.object_path
    from public.media_assets ma
    where ma.id = p_id
      and ma.storage_deleted_at is null
    on conflict do nothing;
  end if;

  insert into public.audit_logs(
    gym_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    before_data,
    after_data
  )
  values (
    v_target.gym_id,
    v_actor,
    'SOFT_DELETE',
    v_target.table_name,
    p_id::text,
    v_before,
    jsonb_build_object(
      'deleted_at', v_now,
      'deleted_by', v_actor,
      'deletion_reason', p_reason
    )
  );

  return jsonb_build_object(
    'entity', p_entity,
    'id', p_id,
    'gymId', v_target.gym_id,
    'deletedAt', v_now,
    'alreadyDeleted', false
  );
end;
$$;

create or replace function private.revoke_biometrics_after_last_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym_id uuid;
  v_person_id uuid;
begin
  if new.status = 'canceled'
     and old.status is distinct from new.status
     and not exists (
       select 1
       from public.member_subscriptions ms
       where ms.gym_member_id = new.gym_member_id
         and ms.id <> new.id
         and ms.status in ('trialing', 'active', 'past_due', 'paused')
     )
  then
    select gm.gym_id, gm.person_id
    into v_gym_id, v_person_id
    from public.gym_members gm
    where gm.id = new.gym_member_id;

    perform public.revoke_biometric_consent(
      v_gym_id,
      v_person_id,
      'Last current membership canceled'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_member_subscriptions_revoke_biometrics
  on public.member_subscriptions;

create trigger trg_member_subscriptions_revoke_biometrics
after update of status on public.member_subscriptions
for each row execute function private.revoke_biometrics_after_last_subscription();

commit;
