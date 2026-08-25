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
  'auth-storage-custom.sql',
  'privileges.sql'
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

$sequenceRecoverySql = @'
do $restore_recovery$
declare
  item record;
  has_rows boolean;
begin
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
      raise exception 'Sequence recovery refused because the restore target holds data.';
    end if;
  end loop;

  -- offset 0 keeps the planner from testing has_sequence_privilege on rows
  -- that are not sequences, which raises an is-not-a-sequence error.
  for item in
    select *
    from (
      select n.nspname, c.relname, c.oid as sequence_oid, s.seqstart
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_sequence s on s.seqrelid = c.oid
      where c.relkind = 'S'
        and n.nspname in ('auth', 'storage', 'supabase_migrations')
      offset 0
    ) candidate
    where pg_catalog.has_sequence_privilege(candidate.sequence_oid, 'UPDATE')
  loop
    perform setval(format('%I.%I', item.nspname, item.relname)::regclass, item.seqstart, false);
  end loop;
end
$restore_recovery$;
'@

# Every SQL string below reaches psql as a docker argument. Never write a
# double quote inside one: PowerShell mangles a native argument that carries
# both a quote and whitespace, and psql then reads the rest as stray arguments.
$image = 'public.ecr.aws/supabase/postgres:17.6.1.143'
docker image inspect $image *> $null

if ($LASTEXITCODE -ne 0) {
  throw "Required Docker image is missing: $image"
}

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
  '--set',
  'ON_ERROR_STOP=1'
)

# The gate runs on its own first. Only a target that passes it may be repaired
# afterwards, so recovery can never touch a database that holds real data.
& docker @baseArguments '--command' $targetStateSql

if ($LASTEXITCODE -ne 0) {
  throw 'The restore target failed the empty-target check. Nothing was changed.'
}

# The gate runs again inside the transaction to close the gap between both calls.
# Dropping the empty migration schema lets history-schema.sql recreate it; the
# drop belongs to the same transaction and is undone if any later file fails.
& docker @baseArguments `
  '--single-transaction' `
  '--command' $targetStateSql `
  '--file' '/backup/roles.sql' `
  '--file' '/backup/schema.sql' `
  '--command' 'SET session_replication_role = replica' `
  '--file' '/backup/data.sql' `
  '--command' 'RESET session_replication_role' `
  '--command' 'DROP SCHEMA IF EXISTS supabase_migrations CASCADE' `
  '--file' '/backup/history-schema.sql' `
  '--file' '/backup/history-data.sql' `
  '--file' '/backup/auth-storage-custom.sql' `
  '--file' '/backup/privileges.sql'

if ($LASTEXITCODE -ne 0) {
  # PostgreSQL never rolls back a sequence, so a failed restore would otherwise
  # leave the target permanently rejected by its own empty-target gate.
  & docker @baseArguments `
    '--single-transaction' `
    '--command' $sequenceRecoverySql `
    '--command' $targetStateSql

  if ($LASTEXITCODE -ne 0) {
    throw 'Database restore failed and was rolled back, but the sequence recovery failed. The target rejects a retry until its auth, storage and supabase_migrations sequences are set back to their start value.'
  }

  throw 'Database restore failed and was rolled back. The target was returned to its empty state and accepts a retry.'
}

Write-Output 'RESTORE_APPLY=PASS'
