param (
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
python scripts/restore.py "$BackupFile"
