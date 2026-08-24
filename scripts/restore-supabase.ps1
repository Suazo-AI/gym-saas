[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $DatabaseUrl,

  [Parameter(Mandatory = $true)]
  [string] $BackupDirectory,

  [switch] $ConfirmEmptyTarget
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\lib\postgres-docker.ps1"

if (-not $ConfirmEmptyTarget) {
  throw 'ConfirmEmptyTarget is required because this script changes the target database.'
}

$resolvedBackup = [System.IO.Path]::GetFullPath($BackupDirectory)
$requiredFiles = @(
  'roles.sql',
  'schema.sql',
  'data.sql',
  'history-schema.sql',
  'history-data.sql',
  'auth-storage-custom.sql'
)

foreach ($fileName in $requiredFiles) {
  $filePath = Join-Path $resolvedBackup $fileName

  if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
    throw "Backup file is missing: $fileName"
  }
}

$targetStateSql = @'
select
  (select count(*) from pg_tables where schemaname = 'public')
  + (select count(*) from auth.users)
  + (select count(*) from storage.objects);
'@

$targetRows = @(Invoke-PostgresDockerQuery -DatabaseUrl $DatabaseUrl -Sql $targetStateSql)

if ($targetRows.Count -ne 1 -or $targetRows[0] -ne '0') {
  throw 'The restore target is not empty.'
}

$image = 'public.ecr.aws/supabase/postgres:17.6.1.143'
$connection = Get-PostgresDockerConnection -DatabaseUrl $DatabaseUrl
$baseArguments = @(
  'run',
  '--rm',
  '--add-host',
  'host.docker.internal:host-gateway',
  '--env',
  "PGHOST=$($connection.Host)",
  '--env',
  "PGPORT=$($connection.Port)",
  '--env',
  "PGDATABASE=$($connection.Database)",
  '--env',
  "PGUSER=$($connection.User)",
  '--env',
  "PGPASSWORD=$($connection.Password)",
  '--env',
  "PGSSLMODE=$($connection.SslMode)",
  '--mount',
  "type=bind,source=$resolvedBackup,target=/backup,readonly",
  $image,
  'psql',
  '-X',
  '--single-transaction',
  '--set',
  'ON_ERROR_STOP=1'
)

& docker @baseArguments `
  '--file' '/backup/roles.sql' `
  '--file' '/backup/schema.sql' `
  '--command' 'SET session_replication_role = replica' `
  '--file' '/backup/data.sql'

if ($LASTEXITCODE -ne 0) {
  throw 'Main database restore failed.'
}

& docker @baseArguments `
  '--file' '/backup/history-schema.sql' `
  '--file' '/backup/history-data.sql'

if ($LASTEXITCODE -ne 0) {
  throw 'Migration history restore failed.'
}

& docker @baseArguments '--file' '/backup/auth-storage-custom.sql'

if ($LASTEXITCODE -ne 0) {
  throw 'Auth and Storage custom schema restore failed.'
}

Write-Output 'RESTORE_APPLY=PASS'
