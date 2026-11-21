$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path "backups" | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "taskuser" }
$dbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "taskplanner" }
$outFile = "backups/${dbName}_${timestamp}.sql"

docker compose exec -T db pg_dump -U $dbUser $dbName | Out-File -FilePath $outFile -Encoding utf8
Write-Output "Backup saved to $outFile"
