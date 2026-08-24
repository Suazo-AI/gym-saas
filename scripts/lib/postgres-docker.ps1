function Get-PostgresDockerConnection {
  param(
    [Parameter(Mandatory = $true)]
    [string] $DatabaseUrl
  )

  $uri = [System.Uri] $DatabaseUrl

  if ($uri.Scheme -notin @('postgres', 'postgresql')) {
    throw 'DatabaseUrl must use postgres:// or postgresql://.'
  }

  $userInfo = $uri.UserInfo.Split(':', 2)

  if ($userInfo.Count -ne 2) {
    throw 'DatabaseUrl must contain a user and password.'
  }

  $hostName = $uri.Host

  if ($hostName -in @('127.0.0.1', 'localhost')) {
    $hostName = 'host.docker.internal'
  }

  $sslMode = 'prefer'

  if ($uri.Query -match '(?:^|[?&])sslmode=([^&]+)') {
    $sslMode = [System.Uri]::UnescapeDataString($Matches[1])
  }

  return @{
    Host = $hostName
    Port = if ($uri.IsDefaultPort) { 5432 } else { $uri.Port }
    Database = [System.Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
    User = [System.Uri]::UnescapeDataString($userInfo[0])
    Password = [System.Uri]::UnescapeDataString($userInfo[1])
    SslMode = $sslMode
  }
}

function Invoke-PostgresDockerQuery {
  param(
    [Parameter(Mandatory = $true)]
    [string] $DatabaseUrl,

    [Parameter(Mandatory = $true)]
    [string] $Sql,

    [string] $OutputFile
  )

  $image = 'public.ecr.aws/supabase/postgres:17.6.1.143'
  docker image inspect $image *> $null

  if ($LASTEXITCODE -ne 0) {
    throw "Required Docker image is missing: $image"
  }

  $connection = Get-PostgresDockerConnection -DatabaseUrl $DatabaseUrl
  $arguments = @(
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
    "PGSSLMODE=$($connection.SslMode)"
  )

  if ($OutputFile) {
    $resolvedOutput = [System.IO.Path]::GetFullPath($OutputFile)
    $outputDirectory = Split-Path -Parent $resolvedOutput
    $outputName = Split-Path -Leaf $resolvedOutput
    $arguments += @(
      '--mount',
      "type=bind,source=$outputDirectory,target=/output",
      $image,
      'psql',
      '-X',
      '--set',
      'ON_ERROR_STOP=1',
      '--no-align',
      '--tuples-only',
      '--output',
      "/output/$outputName",
      '--command',
      $Sql
    )
  } else {
    $arguments += @(
      $image,
      'psql',
      '-X',
      '--set',
      'ON_ERROR_STOP=1',
      '--no-align',
      '--tuples-only',
      '--command',
      $Sql
    )
  }

  $result = @(& docker @arguments)

  if ($LASTEXITCODE -ne 0) {
    throw 'PostgreSQL query failed.'
  }

  return $result
}
