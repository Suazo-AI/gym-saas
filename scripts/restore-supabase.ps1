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
do $restore_gate$
declare
  item record;
  has_rows boolean;
  sequence_value bigint;
  sequence_called boolean;
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private')
      and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
    union all
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
    union all
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname in ('public', 'private')
      and t.typrelid = 0
      and t.typelem = 0
      and t.typtype <> 'p'
  ) then
    raise exception 'The restore target is not empty.';
  end if;

  for item in
    select n.nspname, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p')
      and n.nspname in ('auth', 'storage', 'supabase_migrations')
      and (n.nspname, c.relname) not in (
        ('auth', 'schema_migrations'),
        ('storage', 'migrations'),
        ('storage', 'buckets_vectors'),
        ('storage', 'vector_indexes')
      )
  loop
    execute format('lock table %I.%I in access exclusive mode', item.nspname, item.relname);
    execute format('select exists(select 1 from %I.%I limit 1)', item.nspname, item.relname)
      into has_rows;

    if has_rows then
      raise exception 'The restore target is not empty.';
    end if;
  end loop;

  for item in
    select n.nspname, c.relname, s.seqstart
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_sequence s on s.seqrelid = c.oid
    where c.relkind = 'S'
      and n.nspname in ('auth', 'storage', 'supabase_migrations')
  loop
    execute format('select last_value, is_called from %I.%I', item.nspname, item.relname)
      into sequence_value, sequence_called;

    if sequence_called or sequence_value <> item.seqstart then
      raise exception 'The restore target is not empty.';
    end if;
  end loop;
end
$restore_gate$;
'@

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
  '--command' $targetStateSql `
  '--file' '/backup/roles.sql' `
  '--file' '/backup/schema.sql' `
  '--command' 'SET session_replication_role = replica' `
  '--file' '/backup/data.sql' `
  '--command' 'RESET session_replication_role' `
  '--file' '/backup/history-schema.sql' `
  '--file' '/backup/history-data.sql' `
  '--file' '/backup/auth-storage-custom.sql'

if ($LASTEXITCODE -ne 0) {
  throw 'Database restore failed and was rolled back.'
}

Write-Output 'RESTORE_APPLY=PASS'
