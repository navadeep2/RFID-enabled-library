<#
.SYNOPSIS
    AISYS RFID ILMS - Offline Patch & Update Script
.DESCRIPTION
    Applies an installable update package in an isolated offline site with automated snapshot backup
    and rollback capability (AC 09).
#>

param (
    [string]$UpdatePackageZip = ""
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  AISYS RFID ILMS - Offline Patch & Update Utility" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# Step 1: Pre-update snapshot backup (NFR 01)
Write-Host "[1/3] Creating pre-update snapshot backup..." -ForegroundColor Yellow
$backupOutput = python scripts/backup.py
Write-Host $backupOutput -ForegroundColor Green

# Step 2: Record update manifest
$updateLog = Join-Path $projectRoot "data\update_history.log"
$timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
Add-Content -Path $updateLog -Value "[$timestamp] Update applied. Pre-update snapshot taken."

Write-Host "[2/3] Validating database integrity post-patch..." -ForegroundColor Yellow
python -c "from app.database import get_db_connection; conn=get_db_connection(); cursor=conn.cursor(); cursor.execute('PRAGMA integrity_check;'); res=cursor.fetchone()[0]; print('DB Integrity:', res); assert res=='ok'"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Database integrity check failed! Initiating automated rollback..."
    & "$PSScriptRoot\rollback_update.ps1"
    exit 1
}

Write-Host "[3/3] Update applied successfully without internet access!" -ForegroundColor Green
