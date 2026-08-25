begin;

select plan(5);

select is(
  (select count(*)
   from information_schema.role_table_grants
   where table_schema = 'public'
     and grantee = 'anon'
     and privilege_type = 'TRUNCATE'),
  0::bigint,
  'anon no tiene TRUNCATE sobre ninguna tabla actual de public'
);

select is(
  (select count(*)
   from information_schema.role_table_grants
   where table_schema = 'public'
     and grantee = 'authenticated'
     and privilege_type = 'TRUNCATE'),
  0::bigint,
  'authenticated no tiene TRUNCATE sobre ninguna tabla actual de public'
);

create table public.security_review_truncate_probe (id bigint primary key);

select is(
  (select count(*)
   from pg_default_acl d
   cross join lateral aclexplode(d.defaclacl) acl
   join pg_roles grantee on grantee.oid = acl.grantee
   where d.defaclrole = 'postgres'::regrole
     and d.defaclnamespace = 'public'::regnamespace
     and d.defaclobjtype = 'r'
     and grantee.rolname in ('anon', 'authenticated')
     and acl.privilege_type = 'TRUNCATE'),
  0::bigint,
  'las migraciones futuras no heredan TRUNCATE para los roles de la API'
);

select ok(
  not has_table_privilege('anon', 'public.security_review_truncate_probe', 'TRUNCATE'),
  'el privilegio por defecto tampoco entrega TRUNCATE a anon'
);

select ok(
  not has_table_privilege('authenticated', 'public.security_review_truncate_probe', 'TRUNCATE'),
  'el privilegio por defecto tampoco entrega TRUNCATE a authenticated'
);

select * from finish();

rollback;
