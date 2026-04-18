<#
.SYNOPSIS
  Start the TenderFish development environment.
.DESCRIPTION
  1. Starts Docker services (Postgres + Redis)
  2. Waits for Postgres to be healthy
  3. Pushes any pending DB schema changes via drizzle-kit
  4. Starts the API server (port 3001) and Web server (port 3002)
#>

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "=== TenderFish Dev Startup ===" -ForegroundColor Cyan

# --- 1. Docker services ---
Write-Host ""
Write-Host "[1/4] Starting Docker services..." -ForegroundColor Yellow
docker compose -f "$root\docker-compose.yml" up -d
if ($LASTEXITCODE -ne 0) { Write-Host "Docker compose failed." -ForegroundColor Red; exit 1 }

# --- 2. Wait for Postgres ---
Write-Host "[2/4] Waiting for Postgres to be healthy..." -ForegroundColor Yellow
$maxWait = 30
$elapsed = 0
while ($elapsed -lt $maxWait) {
    $health = docker inspect --format '{{.State.Health.Status}}' tenderfishapp-postgres-1 2>$null
    if ($health -eq "healthy") { break }
    Start-Sleep -Seconds 1
    $elapsed++
}
if ($elapsed -ge $maxWait) {
    Write-Host "Postgres did not become healthy within $maxWait seconds." -ForegroundColor Red
    exit 1
}
Write-Host "  Postgres is healthy." -ForegroundColor Green

# --- 3. Push DB schema ---
Write-Host "[3/4] Pushing DB schema changes..." -ForegroundColor Yellow

# Load DATABASE_URL from .env
$envFile = Get-Content "$root\.env" -ErrorAction SilentlyContinue
foreach ($line in $envFile) {
    if ($line -match '^\s*DATABASE_URL\s*=\s*(.+)$') {
        $env:DATABASE_URL = $Matches[1].Trim('"').Trim("'")
    }
}

if (-not $env:DATABASE_URL) {
    Write-Host "  DATABASE_URL not found in .env" -ForegroundColor Red
    exit 1
}

Push-Location "$root\packages\db"
npx drizzle-kit push
if ($LASTEXITCODE -ne 0) {
    Write-Host "  drizzle-kit push failed." -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "  Schema push complete." -ForegroundColor Green

# --- 4. Kill stale dev servers ---
Write-Host "[4/4] Starting dev servers..." -ForegroundColor Yellow

foreach ($port in @(3001, 3002)) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Host "  Killed stale process on port $port (PID $($conn.OwningProcess))" -ForegroundColor DarkYellow
    }
}

# --- Start API + Web ---
Write-Host ''
Write-Host '  API : http://localhost:3001' -ForegroundColor Green
Write-Host '  Web : http://localhost:3002' -ForegroundColor Green
Write-Host ''

Set-Location $root
npx turbo dev
