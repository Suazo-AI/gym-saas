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

$requiredFiles = @(
  'roles.sql',
  'schema.sql',
  'data.sql',
  'history-schema.sql',
  'history-data.sql',
  'auth-storage-custom.sql'
)

foreach ($fileName in $requiredFiles) {
  $file = Get-Item -LiteralPath (Join-Path $resolvedOutput $fileName)

  if ($file.Length -eq 0) {
    throw "Backup file is empty: $fileName"
  }
}

Write-Output "POSTGRES_BACKUP=PASS FILES=$($requiredFiles.Count) DIRECTORY=$resolvedOutput"
