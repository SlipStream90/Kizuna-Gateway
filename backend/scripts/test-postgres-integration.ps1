param([string]$MaintenanceDatabaseUrl = $env:POSTGRES_MAINTENANCE_URL)

$ErrorActionPreference = 'Stop'
$target = 'kizuna_it_' + [guid]::NewGuid().ToString('N')
if ($target -notmatch '^kizuna_it_[0-9a-f]{32}$') { throw 'Generated database name was invalid.' }

function Invoke-Psql([string]$url, [string]$query) {
  & psql --no-psqlrc -v ON_ERROR_STOP=1 $url -Atqc $query 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL command failed.' }
}

if (-not $MaintenanceDatabaseUrl -or -not (Get-Command psql -ErrorAction SilentlyContinue)) {
  Write-Output 'SKIPPED: PostgreSQL client tooling or service unavailable'
  exit 0
}

try {
  $probe = & psql --no-psqlrc -v ON_ERROR_STOP=1 $MaintenanceDatabaseUrl -Atqc 'SELECT 1' 2>&1
  if ($LASTEXITCODE -ne 0) {
    $probeText = ($probe | Out-String)
    if ($probeText -match '(?i)connection refused|could not connect|timeout|server closed|no such host') {
      Write-Output 'SKIPPED: PostgreSQL client tooling or service unavailable'
      exit 0
    }
    throw 'PostgreSQL maintenance connection configuration failed.'
  }
  $builder = [System.UriBuilder]::new($MaintenanceDatabaseUrl)
  $builder.Path = '/' + $target
  $targetUrl = $builder.Uri.AbsoluteUri
  Invoke-Psql $MaintenanceDatabaseUrl ('CREATE DATABASE "{0}"' -f $target)
  try {
    & psql --no-psqlrc -v ON_ERROR_STOP=1 $targetUrl -f (Join-Path $PSScriptRoot '..\migrations\001_initial.sql') 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Migration failed.' }
    $env:DATABASE_URL = $targetUrl
    Push-Location (Join-Path $PSScriptRoot '..')
    try { & python -m pytest tests/test_postgres_integration.py -q; if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL integration test failed.' } } finally { Pop-Location }
  } finally {
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    Invoke-Psql $MaintenanceDatabaseUrl ('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ''{0}'' AND pid <> pg_backend_pid()' -f $target)
    Invoke-Psql $MaintenanceDatabaseUrl ('DROP DATABASE IF EXISTS "{0}"' -f $target)
  }
} catch { Write-Error $_; exit 1 }
