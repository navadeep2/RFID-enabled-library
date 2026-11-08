# Run snapshot backup
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
python scripts/backup.py
