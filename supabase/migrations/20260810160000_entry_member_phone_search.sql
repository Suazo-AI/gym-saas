begin;

create or replace function public.search_entry_members(
  p_gym_id uuid,
  p_search text,
  p_limit integer default 10
)
returns table (
  gym_id uuid,
  gym_member_id uuid,
  member_code text,
  full_name text,
  status text,
  membership_status text,
  has_overdue_charges boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_search text := nullif(trim(p_search), '');
  v_phone_search text := regexp_replace(coalesce(p_search, ''), '[^0-9]', '', 'g');
begin
  if not public.current_user_has_gym_permission(p_gym_id, 'entries.read') then
    raise exception 'Insufficient permission: entries.read'
      using errcode = '42501';
  end if;

  if v_search is null then
    return;
  end if;

  return query
  select
    s.gym_id,
    s.gym_member_id,
    s.member_code,
    s.full_name,
    s.status::text,
    s.membership_status::text,
    s.has_overdue_charges
  from public.api_v1_member_summaries s
  where s.gym_id = p_gym_id
    and (
      s.full_name ilike '%' || v_search || '%'
      or s.member_code ilike '%' || v_search || '%'
      or (
        length(v_phone_search) >= 4
        and exists (
          select 1
          from public.person_contacts pc
          where pc.person_id = s.person_id
            and pc.contact_type = 'phone'::public.contact_type
            and regexp_replace(pc.value, '[^0-9]', '', 'g') like '%' || v_phone_search || '%'
        )
      )
    )
  order by s.full_name asc, s.gym_member_id asc
  limit greatest(1, least(coalesce(p_limit, 10), 10));
end;
$$;

revoke all on function public.search_entry_members(uuid, text, integer) from public;
grant execute on function public.search_entry_members(uuid, text, integer) to authenticated;

comment on function public.search_entry_members(uuid, text, integer) is
  'Searches entry candidates in one authorized gym by name, member code, or phone without returning contact data.';

commit;
