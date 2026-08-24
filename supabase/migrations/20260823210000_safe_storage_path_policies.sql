begin;

create or replace function private.storage_path_gym_id(p_name text)
returns uuid
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  v_first_segment text;
begin
  if strpos(p_name, '/') = 0 then
    return null;
  end if;

  v_first_segment := split_part(p_name, '/', 1);

  if v_first_segment = '' then
    return null;
  end if;

  return v_first_segment::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

revoke all on function private.storage_path_gym_id(text) from public;
grant execute on function private.storage_path_gym_id(text)
  to authenticated, service_role;

comment on function private.storage_path_gym_id(text) is
  'Returns the gym UUID from a Storage object path, or null for a malformed path.';

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
    private.storage_path_gym_id(name),
    'media.read'
  )
);

create policy "gym media insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'gym-media'
  and private.storage_path_gym_id(name) is not null
  and private.has_permission(
    private.storage_path_gym_id(name),
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
    private.storage_path_gym_id(name),
    'media.manage'
  )
)
with check (
  bucket_id = 'gym-media'
  and private.storage_path_gym_id(name) is not null
  and private.has_permission(
    private.storage_path_gym_id(name),
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
    private.storage_path_gym_id(name),
    'media.manage'
  )
);

commit;
