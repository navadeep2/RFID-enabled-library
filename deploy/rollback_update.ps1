<#
.SYNOPSIS
    AISYS RFID ILMS - Offline Rollback Script
.DESCRIPTION
    Reverts an applied update to the latest verified database snapshot (FR 12, AC 09).
#>

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  AISYS RFID ILMS - Automated Rollback Utility" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
$backupDir = Join-Path $projectRoot "backups"

# Find newest backup
$latestBackup = Get-ChildItem -Path $backupDir -Filter "*.db" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $latestBackup) {
    Write-Error "No snapshot backups found in $backupDir to rollback to!"
    exit 1
}

Write-Host "[*] Selected latest verified backup: $($latestBackup.FullName)" -ForegroundColor Yellow
python scripts/restore.py "$($latestBackup.FullName)"

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Rollback completed successfully. Previous state restored intact." -ForegroundColor Green
} else {
    Write-Error "Rollback operation failed."
    exit 1
}
