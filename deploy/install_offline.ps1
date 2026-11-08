<#
.SYNOPSIS
    AISYS RFID ILMS - Offline Deployment and Installation Script
.DESCRIPTION
    Installs and launches the AISYS library solution in an air-gapped / isolated Windows environment
    without requiring internet connectivity (conforming to NFR 03 and FR 12).
#>

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  AISYS RFID ILMS - Offline Environment Installer" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check Python installation
$pythonVersion = python --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Python 3.12+ is required but was not detected in PATH."
    exit 1
}
Write-Host "[OK] Detected: $pythonVersion" -ForegroundColor Green

# 2. Setup isolated data and log directories
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$dataDir = Join-Path $projectRoot "data"
$backupDir = Join-Path $projectRoot "backups"
$cctvDir = Join-Path $dataDir "cctv_captures"

New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
New-Item -ItemType Directory -Force -Path $cctvDir | Out-Null

Write-Host "[OK] Initialized offline storage paths at $dataDir" -ForegroundColor Green

# 3. Initialize Database Schema and Baseline Records
Write-Host "[*] Initializing SQLite database in WAL mode..." -ForegroundColor Yellow
python -c "from app.database import init_database, seed_initial_data; init_database(); seed_initial_data(); print('Schema & Baseline Seeding OK')"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to initialize database."
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Installation Completed Successfully!" -ForegroundColor Green
Write-Host "  To start the application, run:" -ForegroundColor White
Write-Host "  python -m uvicorn app.main:app --host 127.0.0.1 --port 8000" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green
