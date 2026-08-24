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

$tableSql = @'
select schemaname || '.' || tablename
from pg_tables
where schemaname = 'public'
union all select 'auth.users'
union all select 'storage.buckets'
union all select 'storage.objects'
union all select 'supabase_migrations.schema_migrations'
order by 1;
'@

$tables = Read-DatabaseRows -DatabaseUrl $SourceDatabaseUrl -Sql $tableSql
$countParts = foreach ($table in $tables) {
  $parts = $table.Split('.', 2)
  "select '$table|' || count(*)::text from `"$($parts[0])`".`"$($parts[1])`""
}

$queries = [ordered] @{
  row_counts = ($countParts -join ' union all ') + ' order by 1;'
  columns = @'
select table_schema || '|' || table_name || '|' || column_name || '|' || data_type || '|' || is_nullable || '|' || coalesce(column_default, '')
from information_schema.columns
where table_schema in ('public', 'private')
order by 1;
'@
  constraints = @'
select n.nspname || '|' || c.relname || '|' || con.conname || '|' || pg_get_constraintdef(con.oid, true)
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
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
  policies = @'
select n.nspname || '|' || c.relname || '|' || p.polname || '|' || p.polcmd::text || '|' || p.polpermissive::text || '|' || pg_get_expr(p.polqual, p.polrelid) || '|' || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
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
where n.nspname in ('public', 'auth', 'storage')
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
  $source = Read-DatabaseRows -DatabaseUrl $SourceDatabaseUrl -Sql $queries[$name]
  $restored = Read-DatabaseRows -DatabaseUrl $RestoredDatabaseUrl -Sql $queries[$name]
  $difference = @(Compare-Object -ReferenceObject $source -DifferenceObject $restored)

  if ($difference.Count -gt 0) {
    $difference | Select-Object -First 20 | Format-Table -AutoSize
    throw "Restore comparison failed: $name"
  }

  $checkLine = "RESTORE_CHECK=$name ROWS=$($source.Count) DIFF=0"
  Write-Output $checkLine
  $evidence.Add($checkLine)
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
