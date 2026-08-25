[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $SourceDatabaseUrl,

  [Parameter(Mandatory = $true)]
  [string] $RestoredDatabaseUrl,

  [string] $EvidenceFile
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
. "$PSScriptRoot\lib\postgres-docker.ps1"
$evidence = [System.Collections.Generic.List[string]]::new()

function Read-DatabaseRows {
  param(
    [string] $DatabaseUrl,
    [string] $Sql
  )

  # Assign without @() first: the helper already emits the row list as one
  # object, so a collector here would nest it inside another array.
  $rows = Invoke-PostgresDockerQuery -DatabaseUrl $DatabaseUrl -Sql $Sql

  # The leading comma keeps a one-row result an array instead of a bare string.
  return ,@($rows)
}

$identitySql = @'
select jsonb_build_array(system_identifier::text, d.oid)::text
from pg_control_system()
cross join pg_database d
where d.datname = current_database();
'@

$sourceIdentity = Read-DatabaseRows -DatabaseUrl $SourceDatabaseUrl -Sql $identitySql
$restoredIdentity = Read-DatabaseRows -DatabaseUrl $RestoredDatabaseUrl -Sql $identitySql

if (
  $sourceIdentity.Count -ne 1 -or
  $restoredIdentity.Count -ne 1 -or
  $sourceIdentity[0] -ceq $restoredIdentity[0]
) {
  throw 'SourceDatabaseUrl and RestoredDatabaseUrl must identify different databases.'
}

$tableSql = @'
select json_build_object('schema', n.nspname, 'name', c.relname)::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p')
  and (
    (
      n.nspname not in (
        'information_schema', 'graphql', 'graphql_public', 'pgsodium',
        'pgsodium_masks', 'pgtle', 'repack', 'tiger', 'tiger_data',
        'topology', 'vault', 'etl', 'extensions', 'pgbouncer', 'realtime',
        'supabase_migrations', '_analytics', '_realtime', '_supavisor'
      )
      and n.nspname not like 'pg\_%' escape '\'
      and n.nspname not like 'timescaledb\_%' escape '\'
      and n.nspname not like '\_timescaledb\_%' escape '\'
    )
    or n.nspname = 'supabase_migrations'
  )
  and (n.nspname, c.relname) not in (
    ('auth', 'schema_migrations'),
    ('storage', 'migrations'),
    ('supabase_functions', 'migrations'),
    ('storage', 'buckets_vectors'),
    ('storage', 'vector_indexes')
  )
order by n.nspname, c.relname;
'@

function ConvertTo-SqlIdentifier {
  param([string] $Value)

  # SQL reaches psql as a docker argument, and PowerShell mangles a native
  # argument that carries both a double quote and whitespace. A quoted
  # identifier with a space would corrupt the command silently, so refuse it.
  if ($Value -match '[\s"]') {
    throw "Unsupported identifier for docker argument passing: $Value"
  }

  return '"' + $Value + '"'
}

function Compare-DatabaseRows {
  param(
    [string] $Name,
    [string] $Sql,
    [switch] $ReturnRows
  )

  $source = Read-DatabaseRows -DatabaseUrl $SourceDatabaseUrl -Sql $Sql
  $restored = Read-DatabaseRows -DatabaseUrl $RestoredDatabaseUrl -Sql $Sql
  $difference = @(
    Compare-Object `
      -ReferenceObject $source `
      -DifferenceObject $restored `
      -CaseSensitive
  )

  if ($difference.Count -gt 0) {
    $difference | Select-Object -First 20 | Format-Table -AutoSize
    throw "Restore comparison failed: $Name"
  }

  $checkLine = "RESTORE_CHECK=$Name ROWS=$($source.Count) DIFF=0"
  $evidence.Add($checkLine)

  if ($ReturnRows) {
    return $source
  }

  Write-Output $checkLine
}

$tables = @(
  Compare-DatabaseRows -Name 'table_inventory' -Sql $tableSql -ReturnRows
)
Write-Output "RESTORE_CHECK=table_inventory ROWS=$($tables.Count) DIFF=0"
$tableDigests = [System.Collections.Generic.List[string]]::new()

foreach ($tableJson in $tables) {
  $table = $tableJson | ConvertFrom-Json
  $schemaName = ConvertTo-SqlIdentifier -Value $table.schema
  $tableName = ConvertTo-SqlIdentifier -Value $table.name
  $digestSql = @"
select jsonb_build_array(
  count(*),
  coalesce(
    md5(string_agg(row_hash, '' order by row_hash)),
    md5('')
  )
)::text
from (
  select md5(to_jsonb(row_value)::text) as row_hash
  from $schemaName.$tableName row_value
) rows_to_hash;
"@
  $sourceDigest = Read-DatabaseRows -DatabaseUrl $SourceDatabaseUrl -Sql $digestSql
  $restoredDigest = Read-DatabaseRows -DatabaseUrl $RestoredDatabaseUrl -Sql $digestSql

  if (
    $sourceDigest.Count -ne 1 -or
    $restoredDigest.Count -ne 1 -or
    $sourceDigest[0] -cne $restoredDigest[0]
  ) {
    throw "Restore comparison failed: table_data $($table.schema).$($table.name)"
  }

  $tableDigests.Add($sourceDigest[0])
}

$tableDataLine = "RESTORE_CHECK=table_data ROWS=$($tableDigests.Count) DIFF=0"
Write-Output $tableDataLine
$evidence.Add($tableDataLine)

$sequenceSql = $tableSql.Replace("c.relkind in ('r', 'p')", "c.relkind = 'S'")
$sequences = @(
  Compare-DatabaseRows -Name 'sequence_inventory' -Sql $sequenceSql -ReturnRows
)
Write-Output "RESTORE_CHECK=sequence_inventory ROWS=$($sequences.Count) DIFF=0"

foreach ($sequenceJson in $sequences) {
  $sequence = $sequenceJson | ConvertFrom-Json
  $schemaName = ConvertTo-SqlIdentifier -Value $sequence.schema
  $sequenceName = ConvertTo-SqlIdentifier -Value $sequence.name
  $stateSql = "select jsonb_build_array(last_value, is_called)::text from $schemaName.$sequenceName;"
  $sourceState = Read-DatabaseRows -DatabaseUrl $SourceDatabaseUrl -Sql $stateSql
  $restoredState = Read-DatabaseRows -DatabaseUrl $RestoredDatabaseUrl -Sql $stateSql

  if (
    $sourceState.Count -ne 1 -or
    $restoredState.Count -ne 1 -or
    $sourceState[0] -cne $restoredState[0]
  ) {
    throw "Restore comparison failed: sequence_state $($sequence.schema).$($sequence.name)"
  }
}

$sequenceStateLine = "RESTORE_CHECK=sequence_state ROWS=$($sequences.Count) DIFF=0"
Write-Output $sequenceStateLine
$evidence.Add($sequenceStateLine)

$queries = [ordered] @{
  columns = @'
select jsonb_build_array(
  n.nspname,
  c.relname,
  a.attname,
  format_type(a.atttypid, a.atttypmod),
  a.attnotnull,
  coalesce(pg_get_expr(d.adbin, d.adrelid), ''),
  a.attidentity::text,
  a.attgenerated::text,
  case
    when coll.oid is null then null
    else jsonb_build_array(coll_ns.nspname, coll.collname)
  end
)::text
from pg_attribute a
join pg_class c on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
left join pg_collation coll on coll.oid = a.attcollation and a.attcollation <> 0
left join pg_namespace coll_ns on coll_ns.oid = coll.collnamespace
where n.nspname in ('public', 'private')
  and c.relkind in ('r', 'p', 'v', 'm', 'f')
  and a.attnum > 0
  and not a.attisdropped
order by 1;
'@
  constraints = @'
select jsonb_build_array(n.nspname, c.relname, con.conname, pg_get_constraintdef(con.oid, true))::text
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'private')
union all
select jsonb_build_array(n.nspname, t.typname, con.conname, pg_get_constraintdef(con.oid, true))::text
from pg_constraint con
join pg_type t on t.oid = con.contypid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname in ('public', 'private')
order by 1;
'@
  indexes = @'
select jsonb_build_array(schemaname, tablename, indexname, indexdef)::text
from pg_indexes
where schemaname in ('public', 'private')
order by 1;
'@
  functions = @'
select jsonb_build_array(
  n.nspname,
  p.proname,
  pg_get_function_identity_arguments(p.oid),
  md5(pg_get_functiondef(p.oid))
)::text
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
order by 1;
'@
  views = @'
select jsonb_build_array(
  n.nspname,
  c.relname,
  c.relkind::text,
  md5(pg_get_viewdef(c.oid, true)),
  coalesce(to_jsonb(c.reloptions), '[]'::jsonb)
)::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'private')
  and c.relkind in ('v', 'm')
order by 1;
'@
  types = @'
select jsonb_build_array(
  n.nspname,
  t.typname,
  t.typtype::text,
  case when t.typbasetype = 0 then '' else format_type(t.typbasetype, t.typtypmod) end,
  t.typnotnull,
  coalesce(t.typdefault, ''),
  coalesce(format_type(r.rngsubtype, null), ''),
  case
    when coll.oid is null then null
    else jsonb_build_array(coll_ns.nspname, coll.collname)
  end,
  coalesce(r.rngcanonical::regprocedure::text, ''),
  coalesce(format_type(r.rngmultitypid, null), '')
)::text
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
left join pg_range r on r.rngtypid = t.oid
left join pg_collation coll on coll.oid = r.rngcollation and r.rngcollation <> 0
left join pg_namespace coll_ns on coll_ns.oid = coll.collnamespace
where n.nspname in ('public', 'private')
  and t.typrelid = 0
  and t.typelem = 0
  and t.typtype <> 'p'
order by 1;
'@
  enums = @'
select jsonb_build_array(n.nspname, t.typname, e.enumsortorder, e.enumlabel)::text
from pg_enum e
join pg_type t on t.oid = e.enumtypid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname in ('public', 'private')
order by n.nspname, t.typname, e.enumsortorder;
'@
  owners = @'
select jsonb_build_array('schema', n.nspname, pg_get_userbyid(n.nspowner))::text
from pg_namespace n
where n.nspname in ('public', 'private')
union all
select jsonb_build_array('relation', n.nspname, c.relname, pg_get_userbyid(c.relowner))::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'private')
  and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
union all
select jsonb_build_array(
  'routine',
  n.nspname,
  p.proname,
  pg_get_function_identity_arguments(p.oid),
  pg_get_userbyid(p.proowner)
)::text
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
union all
select jsonb_build_array('type', n.nspname, t.typname, pg_get_userbyid(t.typowner))::text
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
where n.nspname in ('public', 'private')
  and t.typrelid = 0
  and t.typelem = 0
  and t.typtype <> 'p'
order by 1;
'@
  privileges = @'
select jsonb_build_array(
  'schema',
  n.nspname,
  case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,
  pg_get_userbyid(acl.grantor),
  acl.privilege_type,
  acl.is_grantable
)::text
from pg_namespace n
cross join lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) acl
where n.nspname in ('public', 'private')
union all
select jsonb_build_array(
  'relation',
  n.nspname,
  c.relname,
  case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,
  pg_get_userbyid(acl.grantor),
  acl.privilege_type,
  acl.is_grantable
)::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
where n.nspname in ('public', 'private')
  and c.relkind in ('r', 'p', 'v', 'm', 'f')
union all
select jsonb_build_array(
  'relation',
  n.nspname,
  c.relname,
  case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,
  pg_get_userbyid(acl.grantor),
  acl.privilege_type,
  acl.is_grantable
)::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(coalesce(c.relacl, acldefault('s', c.relowner))) acl
where n.nspname in ('public', 'private')
  and c.relkind = 'S'
union all
select jsonb_build_array(
  'routine',
  n.nspname,
  p.proname,
  pg_get_function_identity_arguments(p.oid),
  case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,
  pg_get_userbyid(acl.grantor),
  acl.privilege_type,
  acl.is_grantable
)::text
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
where n.nspname in ('public', 'private')
union all
select jsonb_build_array(
  'type',
  n.nspname,
  t.typname,
  case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,
  pg_get_userbyid(acl.grantor),
  acl.privilege_type,
  acl.is_grantable
)::text
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
cross join lateral aclexplode(coalesce(t.typacl, acldefault('T', t.typowner))) acl
where n.nspname in ('public', 'private')
  and t.typrelid = 0
  and t.typelem = 0
  and t.typtype <> 'p'
union all
select jsonb_build_array(
  'column',
  n.nspname,
  c.relname,
  a.attname,
  case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,
  pg_get_userbyid(acl.grantor),
  acl.privilege_type,
  acl.is_grantable
)::text
from pg_attribute a
join pg_class c on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(a.attacl) acl
where n.nspname in ('public', 'private')
  and a.attnum > 0
  and not a.attisdropped
union all
select jsonb_build_array(
  'default',
  pg_get_userbyid(d.defaclrole),
  coalesce(n.nspname, ''),
  d.defaclobjtype::text,
  case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,
  pg_get_userbyid(acl.grantor),
  acl.privilege_type,
  acl.is_grantable
)::text
from pg_default_acl d
left join pg_namespace n on n.oid = d.defaclnamespace
cross join lateral aclexplode(d.defaclacl) acl
where n.nspname in ('public', 'private')
order by 1;
'@
  policies = @'
select jsonb_build_array(
  n.nspname,
  c.relname,
  p.polname,
  p.polcmd::text,
  p.polpermissive,
  coalesce((
    select jsonb_agg(role_name order by convert_to(role_name, 'UTF8'))
    from (
      select case when role_oid = 0 then 'PUBLIC' else pg_get_userbyid(role_oid) end as role_name
      from unnest(p.polroles) policy_role(role_oid)
    ) resolved_roles
  ), jsonb_build_array('PUBLIC')),
  coalesce(pg_get_expr(p.polqual, p.polrelid), ''),
  coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
)::text
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'private', 'auth', 'storage')
order by 1;
'@
  rls = @'
select jsonb_build_array(n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity)::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'private', 'auth', 'storage')
  and c.relkind in ('r', 'p')
order by 1;
'@
  triggers = @'
select jsonb_build_array(
  n.nspname,
  c.relname,
  t.tgname,
  t.tgenabled::text,
  pg_get_triggerdef(t.oid, true)
)::text
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'private', 'auth', 'storage')
  and not t.tgisinternal
order by 1;
'@
  extensions = @'
select jsonb_build_array(e.extname, e.extversion, n.nspname)::text
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
order by 1;
'@
  roles = @'
select jsonb_build_array(
  r.rolname,
  r.rolsuper,
  r.rolinherit,
  r.rolcreaterole,
  r.rolcreatedb,
  r.rolcanlogin,
  r.rolreplication,
  r.rolbypassrls,
  r.rolconnlimit,
  coalesce(r.rolvaliduntil::text, ''),
  coalesce((
    select jsonb_agg(setting order by convert_to(setting, 'UTF8'))
    from unnest(r.rolconfig) config(setting)
  ), '[]'::jsonb)
)::text
from pg_roles r
order by convert_to(r.rolname, 'UTF8');
'@
  role_members = @'
select jsonb_build_array(
  granted.rolname,
  member.rolname,
  grantor.rolname,
  m.admin_option,
  coalesce(to_jsonb(m)->>'inherit_option', member.rolinherit::text)::boolean,
  coalesce(to_jsonb(m)->>'set_option', 'true')::boolean
)::text
from pg_auth_members m
join pg_roles granted on granted.oid = m.roleid
join pg_roles member on member.oid = m.member
join pg_roles grantor on grantor.oid = m.grantor
order by convert_to(granted.rolname, 'UTF8'), convert_to(member.rolname, 'UTF8'), convert_to(grantor.rolname, 'UTF8');
'@
}

foreach ($name in $queries.Keys) {
  Compare-DatabaseRows -Name $name -Sql $queries[$name]
}

$testUrl = $RestoredDatabaseUrl
$restoredUri = [System.Uri] $RestoredDatabaseUrl

if ($restoredUri.Host -in @('127.0.0.1', 'localhost') -and -not $restoredUri.Query) {
  $testUrl += '?sslmode=disable'
}

Push-Location $projectRoot
$testOutputFile = [System.IO.Path]::GetTempFileName()
$testErrorFile = [System.IO.Path]::GetTempFileName()

try {
  $npxPath = (Get-Command npx.cmd -ErrorAction Stop).Source
  $testProcess = Start-Process `
    -FilePath $npxPath `
    -ArgumentList @('supabase', 'test', 'db', 'supabase/tests', '--db-url', $testUrl) `
    -WindowStyle Hidden `
    -Wait `
    -PassThru `
    -RedirectStandardOutput $testOutputFile `
    -RedirectStandardError $testErrorFile
  $testExitCode = $testProcess.ExitCode
  $testOutput = @(Get-Content -LiteralPath $testOutputFile)
  $testErrors = @(Get-Content -LiteralPath $testErrorFile)
  $testErrors | Write-Output
  $testOutput | Write-Output

  if ($testExitCode -ne 0) {
    throw 'Restored database pgTAP suite failed.'
  }
} finally {
  Pop-Location
  Remove-Item -LiteralPath $testOutputFile, $testErrorFile -Force -ErrorAction SilentlyContinue
}

foreach ($line in $testOutput) {
  $text = [string] $line

  if ($text -match '^(All tests successful\.|Files=|Result: PASS)') {
    $evidence.Add($text)
  }
}

$finalLine = 'RESTORE_VERIFICATION=PASS'
$evidence.Add($finalLine)
Write-Output $finalLine

if ($EvidenceFile) {
  $resolvedEvidence = [System.IO.Path]::GetFullPath($EvidenceFile)
  $evidenceDirectory = Split-Path -Parent $resolvedEvidence

  if (-not (Test-Path -LiteralPath $evidenceDirectory)) {
    New-Item -ItemType Directory -Path $evidenceDirectory | Out-Null
  }

  $evidence | Set-Content -LiteralPath $resolvedEvidence -Encoding utf8
  Write-Output "RESTORE_EVIDENCE=$resolvedEvidence"
}
