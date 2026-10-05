<#
.SYNOPSIS
  ProctorNet Dev Stack — one-command startup for Windows 11 developers.
.DESCRIPTION
  From a clean clone: validates prerequisites, copies .env.example if
  needed, brings up the full dev stack, runs migrations, seeds admin,
  and prints all access URLs.
.EXAMPLE
  .\scripts\dev\up.ps1
  .\scripts\dev\up.ps1 -NoSeed -Profiles "observability"
#>
param(
  [switch]$NoSeed,
  [string]$Profiles = ""
)

$ErrorActionPreference = "Stop"
$ROOT = (Resolve-Path "$PSScriptRoot\..\..").Path

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  ProctorNet Dev Stack" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# -- Prerequisites ------------------------------------------------------------
function Require($cmd, $hint) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Write-Host "  [ERROR] '$cmd' not found. $hint" -ForegroundColor Red
    exit 1
  }
}
Require "docker"       "Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
Require "node"         "Install Node.js 22 LTS: https://nodejs.org/"

$dockerRunning = docker info 2>&1 | Select-String "Server Version"
if (-not $dockerRunning) {
  Write-Host "  [ERROR] Docker daemon is not running. Start Docker Desktop first." -ForegroundColor Red
  exit 1
}

# -- .env guard ---------------------------------------------------------------
$envFile = "$ROOT\.env"
if (-not (Test-Path $envFile)) {
  Write-Host "  [INFO] .env not found — copying from .env.example" -ForegroundColor Yellow
  Copy-Item "$ROOT\.env.example" $envFile
  Write-Host "  [WARN] Review $envFile and set real secrets before production use." -ForegroundColor Yellow
}

Set-Location $ROOT

# -- Compose profile args ------------------------------------------------------
$profileArgs = @()
if ($Profiles) {
  foreach ($p in $Profiles.Split(",")) {
    $profileArgs += "--profile"
    $profileArgs += $p.Trim()
  }
}
# Always enable 'dev' profile for MinIO
$profileArgs += "--profile"; $profileArgs += "dev"

# -- Pull / build --------------------------------------------------------------
Write-Host "  Building images..." -ForegroundColor Cyan
docker compose -f docker-compose.prod.yml -f docker-compose.override.yml @profileArgs build --quiet

# -- Bring up stack ------------------------------------------------------------
Write-Host "  Starting services (detached)..." -ForegroundColor Cyan
docker compose -f docker-compose.prod.yml -f docker-compose.override.yml @profileArgs up -d --remove-orphans

# -- Wait for postgres healthcheck ---------------------------------------------
Write-Host "  Waiting for postgres to be healthy..." -ForegroundColor Cyan
$deadline = (Get-Date).AddSeconds(60)
do {
  Start-Sleep -Seconds 3
  $status = docker inspect --format "{{.State.Health.Status}}" proctornet-postgres 2>&1
} while ($status -ne "healthy" -and (Get-Date) -lt $deadline)

if ($status -ne "healthy") {
  Write-Host "  [ERROR] postgres did not become healthy in 60 s. Check logs:" -ForegroundColor Red
  Write-Host "    docker compose logs postgres" -ForegroundColor Red
  exit 1
}

# -- Seed admin ----------------------------------------------------------------
if (-not $NoSeed) {
  Write-Host "  Seeding admin account..." -ForegroundColor Cyan
  Push-Location "$ROOT\proctornet\backend"
  node prisma/seed/admin.js
  Pop-Location
}

# -- Print URLs ----------------------------------------------------------------
Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "  Stack is UP. Access URLs:" -ForegroundColor Green
Write-Host "    Frontend (Vite dev)  : http://localhost:5173" -ForegroundColor White
Write-Host "    API (direct)         : http://localhost:5000/api/v1/healthz" -ForegroundColor White
Write-Host "    Nginx edge           : http://localhost:80" -ForegroundColor White
Write-Host "    RabbitMQ management  : http://localhost:15672" -ForegroundColor White
Write-Host "    MinIO console        : http://localhost:9001" -ForegroundColor White
if ($Profiles -match "observability") {
  Write-Host "    Prometheus           : http://localhost:9090" -ForegroundColor White
  Write-Host "    Grafana              : http://localhost:3001" -ForegroundColor White
}
Write-Host ""
Write-Host "  To stop: docker compose -f docker-compose.prod.yml -f docker-compose.override.yml down" -ForegroundColor DarkGray
Write-Host "  Logs   : docker compose logs -f" -ForegroundColor DarkGray
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
