begin;

select plan(7);

select isnt_empty(
  $$select 1 from public.permissions where code = 'entries.read'$$,
  'entries.read permission code exists'
);

select isnt_empty(
  $$select 1 from public.permissions where code = 'entries.manage'$$,
  'entries.manage permission code exists'
);

select results_eq(
  $$select count(*)::integer from public.permissions where code in ('entries.read', 'entries.manage')$$,
  $$values (2)$$,
  'entry permission codes are not duplicated'
);

select results_eq(
  $$select count(*)::integer
    from public.roles r
    where r.code = 'receptionist' and r.is_system
      and not exists (
        select 1 from public.role_permissions rp
        join public.permissions p on p.id = rp.permission_id
        where rp.role_id = r.id and p.code = 'memberships.manage'
      )$$,
  $$values (0)$$,
  'every system receptionist role can manage memberships'
);

select results_eq(
  $$select count(*)::integer
    from public.roles r
    where r.code = 'receptionist' and r.is_system
      and not exists (
        select 1 from public.role_permissions rp
        join public.permissions p on p.id = rp.permission_id
        where rp.role_id = r.id and p.code = 'entries.manage'
      )$$,
  $$values (0)$$,
  'every system receptionist role can register entries'
);

select results_eq(
  $$select count(*)::integer
    from public.roles r
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where r.code = 'trainer' and r.is_system and p.code = 'entries.manage'$$,
  $$values (0)$$,
  'trainer role cannot register entries'
);

select isnt_empty(
  $$select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'bootstrap_new_gym'
      and p.prosecdef
      and pg_get_functiondef(p.oid) ilike '%memberships.manage%'$$,
  'bootstrap_new_gym grants memberships.manage to new receptionist roles'
);

select * from finish();

rollback;
