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

  return @(Invoke-PostgresDockerQuery -DatabaseUrl $DatabaseUrl -Sql $Sql)
}

$identitySql = @'
select system_identifier::text || '|' || d.oid::text
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

  return '"' + $Value.Replace('"', '""') + '"'
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
select count(*)::text || '|' || coalesce(
  md5(string_agg(row_hash, '' order by row_hash)),
  md5('')
)
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
  $stateSql = "select last_value::text || '|' || is_called::text from $schemaName.$sequenceName;"
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
select n.nspname || '|' || c.relname || '|' || a.attname || '|' ||
  format_type(a.atttypid, a.atttypmod) || '|' || a.attnotnull::text || '|' ||
  coalesce(pg_get_expr(d.adbin, d.adrelid), '') || '|' || a.attidentity || '|' ||
  a.attgenerated || '|' || coalesce(coll_ns.nspname || '.' || coll.collname, '')
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
select n.nspname || '|' || c.relname || '|' || con.conname || '|' || pg_get_constraintdef(con.oid, true)
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'private')
union all
select n.nspname || '|' || t.typname || '|' || con.conname || '|' || pg_get_constraintdef(con.oid, true)
from pg_constraint con
join pg_type t on t.oid = con.contypid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname in ('public', 'private')
order by 1;
'@
  indexes = @'
select schemaname || '|' || tablename || '|' || indexname || '|' || indexdef
from pg_indexes
where schemaname in ('public', 'private')
order by 1;
'@
  functions = @'
select n.nspname || '|' || p.proname || '|' || pg_get_function_identity_arguments(p.oid) || '|' || md5(pg_get_functiondef(p.oid))
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
order by 1;
'@
  views = @'
select n.nspname || '|' || c.relname || '|' || c.relkind || '|' ||
  md5(pg_get_viewdef(c.oid, true)) || '|' || coalesce(array_to_string(c.reloptions, ','), '')
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'private')
  and c.relkind in ('v', 'm')
order by 1;
'@
  types = @'
select n.nspname || '|' || t.typname || '|' || t.typtype || '|' ||
  case when t.typbasetype = 0 then '' else format_type(t.typbasetype, t.typtypmod) end || '|' ||
  t.typnotnull::text || '|' || coalesce(t.typdefault, '') || '|' ||
  coalesce(format_type(r.rngsubtype, null), '') || '|' ||
  coalesce(coll_ns.nspname || '.' || coll.collname, '') || '|' ||
  coalesce(r.rngcanonical::regprocedure::text, '') || '|' ||
  coalesce(format_type(r.rngmultitypid, null), '')
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
select n.nspname || '|' || t.typname || '|' || e.enumsortorder::text || '|' || e.enumlabel
from pg_enum e
join pg_type t on t.oid = e.enumtypid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname in ('public', 'private')
order by n.nspname, t.typname, e.enumsortorder;
'@
  owners = @'
select 'schema|' || n.nspname || '|' || pg_get_userbyid(n.nspowner)
from pg_namespace n
where n.nspname in ('public', 'private')
union all
select 'relation|' || n.nspname || '|' || c.relname || '|' || pg_get_userbyid(c.relowner)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'private')
  and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
union all
select 'routine|' || n.nspname || '|' || p.proname || '|' || pg_get_function_identity_arguments(p.oid) || '|' || pg_get_userbyid(p.proowner)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
union all
select 'type|' || n.nspname || '|' || t.typname || '|' || pg_get_userbyid(t.typowner)
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
where n.nspname in ('public', 'private')
  and t.typrelid = 0
  and t.typelem = 0
  and t.typtype <> 'p'
order by 1;
'@
  privileges = @'
select 'schema|' || n.nspname || '|' ||
  case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end || '|' ||
  pg_get_userbyid(acl.grantor) || '|' || acl.privilege_type || '|' || acl.is_grantable::text
from pg_namespace n
cross join lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) acl
where n.nspname in ('public', 'private')
union all
select 'relation|' || n.nspname || '|' || c.relname || '|' ||
  case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end || '|' ||
  pg_get_userbyid(acl.grantor) || '|' || acl.privilege_type || '|' || acl.is_grantable::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(coalesce(c.relacl, acldefault(case when c.relkind = 'S' then 's' else 'r' end, c.relowner))) acl
where n.nspname in ('public', 'private')
  and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
union all
select 'routine|' || n.nspname || '|' || p.proname || '|' || pg_get_function_identity_arguments(p.oid) || '|' ||
  case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end || '|' ||
  pg_get_userbyid(acl.grantor) || '|' || acl.privilege_type || '|' || acl.is_grantable::text
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
where n.nspname in ('public', 'private')
union all
select 'type|' || n.nspname || '|' || t.typname || '|' ||
  case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end || '|' ||
  pg_get_userbyid(acl.grantor) || '|' || acl.privilege_type || '|' || acl.is_grantable::text
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
cross join lateral aclexplode(coalesce(t.typacl, acldefault('T', t.typowner))) acl
where n.nspname in ('public', 'private')
  and t.typrelid = 0
  and t.typelem = 0
  and t.typtype <> 'p'
union all
select 'column|' || n.nspname || '|' || c.relname || '|' || a.attname || '|' ||
  case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end || '|' ||
  pg_get_userbyid(acl.grantor) || '|' || acl.privilege_type || '|' || acl.is_grantable::text
from pg_attribute a
join pg_class c on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(a.attacl) acl
where n.nspname in ('public', 'private')
  and a.attnum > 0
  and not a.attisdropped
union all
select 'default|' || pg_get_userbyid(d.defaclrole) || '|' || coalesce(n.nspname, '') || '|' || d.defaclobjtype || '|' ||
  case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end || '|' ||
  pg_get_userbyid(acl.grantor) || '|' || acl.privilege_type || '|' || acl.is_grantable::text
from pg_default_acl d
left join pg_namespace n on n.oid = d.defaclnamespace
cross join lateral aclexplode(d.defaclacl) acl
where n.nspname in ('public', 'private')
order by 1;
'@
  policies = @'
select n.nspname || '|' || c.relname || '|' || p.polname || '|' || p.polcmd::text || '|' ||
  p.polpermissive::text || '|' ||
  coalesce((
    select string_agg(case when role_oid = 0 then 'PUBLIC' else pg_get_userbyid(role_oid) end, ',' order by role_oid)
    from unnest(p.polroles) role_oid
  ), 'PUBLIC') || '|' ||
  coalesce(pg_get_expr(p.polqual, p.polrelid), '') || '|' ||
  coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'auth', 'storage')
order by 1;
'@
  rls = @'
select n.nspname || '|' || c.relname || '|' || c.relrowsecurity || '|' || c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'private', 'auth', 'storage')
  and c.relkind in ('r', 'p')
order by 1;
'@
  triggers = @'
select n.nspname || '|' || c.relname || '|' || t.tgname || '|' || pg_get_triggerdef(t.oid, true)
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'auth', 'storage')
  and not t.tgisinternal
order by 1;
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
