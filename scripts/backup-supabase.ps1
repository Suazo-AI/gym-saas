[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $DatabaseUrl,

  [Parameter(Mandatory = $true)]
  [string] $OutputDirectory
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
. "$PSScriptRoot\lib\postgres-docker.ps1"

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)

if (Test-Path -LiteralPath $resolvedOutput) {
  $existingFiles = @(Get-ChildItem -LiteralPath $resolvedOutput -Force)

  if ($existingFiles.Count -gt 0) {
    throw "OutputDirectory must be empty: $resolvedOutput"
  }
} else {
  New-Item -ItemType Directory -Path $resolvedOutput | Out-Null
}

function Invoke-SupabaseDump {
  param([string[]] $Arguments)

  & npx supabase db dump --db-url $DatabaseUrl @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw 'Supabase database dump failed.'
  }
}

Invoke-SupabaseDump -Arguments @(
  '--file',
  (Join-Path $resolvedOutput 'roles.sql'),
  '--role-only'
)

Invoke-SupabaseDump -Arguments @(
  '--file',
  (Join-Path $resolvedOutput 'schema.sql')
)

Invoke-SupabaseDump -Arguments @(
  '--file',
  (Join-Path $resolvedOutput 'data.sql'),
  '--use-copy',
  '--data-only',
  '--exclude',
  'storage.buckets_vectors',
  '--exclude',
  'storage.vector_indexes'
)

Invoke-SupabaseDump -Arguments @(
  '--file',
  (Join-Path $resolvedOutput 'history-schema.sql'),
  '--schema',
  'supabase_migrations'
)

Invoke-SupabaseDump -Arguments @(
  '--file',
  (Join-Path $resolvedOutput 'history-data.sql'),
  '--use-copy',
  '--data-only',
  '--schema',
  'supabase_migrations'
)

$customSchemaSql = @'
select format(
  'drop policy if exists %I on %I.%I;%screate policy %I on %I.%I as %s for %s to %s%s%s;',
  p.polname,
  n.nspname,
  c.relname,
  chr(10),
  p.polname,
  n.nspname,
  c.relname,
  case when p.polpermissive then 'permissive' else 'restrictive' end,
  case p.polcmd when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update' when 'd' then 'delete' else 'all' end,
  coalesce((select string_agg(quote_ident(r.rolname), ', ' order by r.rolname) from pg_roles r where r.oid = any(p.polroles)), 'public'),
  case when p.polqual is not null then ' using (' || pg_get_expr(p.polqual, p.polrelid) || ')' else '' end,
  case when p.polwithcheck is not null then ' with check (' || pg_get_expr(p.polwithcheck, p.polrelid) || ')' else '' end
)
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('auth', 'storage')
union all
select format(
  'drop trigger if exists %I on %I.%I;%s%s;',
  t.tgname,
  n.nspname,
  c.relname,
  chr(10),
  pg_get_triggerdef(t.oid, true)
)
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc f on f.oid = t.tgfoid
join pg_namespace fn on fn.oid = f.pronamespace
where n.nspname in ('auth', 'storage')
  and not t.tgisinternal
  and fn.nspname not in ('auth', 'storage')
order by 1;
'@

Invoke-PostgresDockerQuery `
  -DatabaseUrl $DatabaseUrl `
  -Sql $customSchemaSql `
  -OutputFile (Join-Path $resolvedOutput 'auth-storage-custom.sql') | Out-Null

$privilegesSql = @'
with objects as (
  select 1 as ord, 'SCHEMA ' || quote_ident(n.nspname) as target, n.nspacl as acl
  from pg_namespace n
  where n.nspname in ('public', 'private')
    and n.nspacl is not null
  union all
  select 2,
    case when c.relkind = 'S' then 'SEQUENCE ' else 'TABLE ' end ||
      quote_ident(n.nspname) || '.' || quote_ident(c.relname),
    c.relacl
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private')
    and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
    and c.relacl is not null
  union all
  select 3,
    'ROUTINE ' || quote_ident(n.nspname) || '.' || quote_ident(p.proname) ||
      '(' || pg_get_function_identity_arguments(p.oid) || ')',
    p.proacl
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    and p.proacl is not null
  union all
  select 4, 'TYPE ' || quote_ident(n.nspname) || '.' || quote_ident(t.typname), t.typacl
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname in ('public', 'private')
    and t.typrelid = 0
    and t.typelem = 0
    and t.typtype <> 'p'
    and t.typacl is not null
),
statements as (
  select o.ord, o.target, 0 as step,
    'do $fitmanager_privileges$ declare role_name text; begin execute ' ||
      quote_literal('revoke all on ' || o.target || ' from public') ||
      '; for role_name in select rolname from pg_roles where not starts_with(rolname, ''pg_'') loop execute ' ||
      quote_literal('revoke all on ' || o.target || ' from ') ||
      ' || quote_ident(role_name); end loop; end $fitmanager_privileges$;' as statement
  from objects o
  union all
  select o.ord, o.target, 1,
    'GRANT ' || acl.privilege_type || ' ON ' || o.target || ' TO ' ||
      case when acl.grantee = 0 then 'PUBLIC' else quote_ident(pg_get_userbyid(acl.grantee)) end ||
      case when acl.is_grantable then ' WITH GRANT OPTION' else '' end || ';'
  from objects o
  cross join lateral aclexplode(o.acl) acl
)
select statement
from statements
order by ord, target, step, statement;
'@

Invoke-PostgresDockerQuery `
  -DatabaseUrl $DatabaseUrl `
  -Sql $privilegesSql `
  -OutputFile (Join-Path $resolvedOutput 'privileges.sql') | Out-Null

$requiredFiles = @(
  'roles.sql',
  'schema.sql',
  'data.sql',
  'history-schema.sql',
  'history-data.sql',
  'auth-storage-custom.sql',
  'privileges.sql'
)

foreach ($fileName in $requiredFiles) {
  $file = Get-Item -LiteralPath (Join-Path $resolvedOutput $fileName)

  if ($file.Length -eq 0) {
    throw "Backup file is empty: $fileName"
  }
}

Write-Output "POSTGRES_BACKUP=PASS FILES=$($requiredFiles.Count) DIRECTORY=$resolvedOutput"
