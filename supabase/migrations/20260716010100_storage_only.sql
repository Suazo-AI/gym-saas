-- MIGRATION: replace BYTEA image storage with Supabase Storage references only
-- Apply after gym_saas_supabase_schema.sql.
-- Existing BYTEA files must be uploaded through the Storage API before this runs.

begin;

do $$
begin
  if exists (
    select 1
    from public.media_assets
    where binary_data is not null
       or storage_backend = 'database'
  ) then
    raise exception
      'Migration stopped: upload existing binary_data files to Supabase Storage and update bucket_name/object_path first.';
  end if;
end;
$$;

drop trigger if exists trg_media_assets_sync_size on public.media_assets;
drop function if exists private.sync_media_size();

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'media_assets'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%storage_backend%'
  loop
    execute format(
      'alter table public.media_assets drop constraint %I',
      r.conname
    );
  end loop;
end;
$$;

alter table public.media_assets
  drop column if exists binary_data,
  drop column if exists storage_backend;

drop type if exists public.storage_backend;

alter table public.media_assets
  alter column bucket_name set default 'gym-media',
  alter column bucket_name set not null,
  alter column object_path set not null;

alter table public.media_assets
  add constraint media_assets_bucket_name_check
    check (bucket_name = 'gym-media'),
  add constraint media_assets_object_path_check
    check (
      object_path <> ''
      and object_path !~ '(^/|//|\.\.)'
    );

drop index if exists public.uq_media_storage_object;

create unique index uq_media_storage_object
  on public.media_assets(bucket_name, object_path);

comment on table public.media_assets is
  'Stores file metadata only. Actual files are stored in Supabase Storage.';

create or replace function private.validate_media_storage_path()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_path_gym_id uuid;
begin
  begin
    v_path_gym_id := split_part(new.object_path, '/', 1)::uuid;
  exception
    when invalid_text_representation then
      raise exception 'The first object_path segment must be a valid gym UUID';
  end;

  if v_path_gym_id <> new.gym_id then
    raise exception 'object_path must begin with the same gym_id';
  end if;

  if new.mime_type not in (
    'image/webp',
    'image/avif',
    'image/jpeg',
    'image/png',
    'application/pdf'
  ) then
    raise exception 'Unsupported MIME type: %', new.mime_type;
  end if;

  return new;
end;
$$;

create trigger trg_media_assets_validate_storage_path
before insert or update of gym_id, bucket_name, object_path, mime_type
on public.media_assets
for each row execute function private.validate_media_storage_path();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'gym-media',
  'gym-media',
  false,
  10485760,
  array[
    'image/webp',
    'image/avif',
    'image/jpeg',
    'image/png',
    'application/pdf'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "gym media select" on storage.objects;
drop policy if exists "gym media insert" on storage.objects;
drop policy if exists "gym media update" on storage.objects;
drop policy if exists "gym media delete" on storage.objects;

create policy "gym media select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'gym-media'
  and private.has_permission(
    ((storage.foldername(name))[1])::uuid,
    'media.read'
  )
);

create policy "gym media insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'gym-media'
  and (storage.foldername(name))[1] is not null
  and private.has_permission(
    ((storage.foldername(name))[1])::uuid,
    'media.manage'
  )
);

create policy "gym media update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'gym-media'
  and private.has_permission(
    ((storage.foldername(name))[1])::uuid,
    'media.manage'
  )
)
with check (
  bucket_id = 'gym-media'
  and private.has_permission(
    ((storage.foldername(name))[1])::uuid,
    'media.manage'
  )
);

create policy "gym media delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'gym-media'
  and private.has_permission(
    ((storage.foldername(name))[1])::uuid,
    'media.manage'
  )
);

commit;

-- Recommended object path:
-- <gym_id>/<person_id-or-general>/<uuid>.<extension>
--
-- Upload using the Supabase Storage API first, then insert public.media_assets.
-- Delete using the Storage API first, then delete the metadata row.
-- Never modify or delete storage.objects directly.