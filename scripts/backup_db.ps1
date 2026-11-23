$ErrorActionPreference = "Stop"

# Load defaults from .env if present and not overridden in environment
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*(POSTGRES_USER|POSTGRES_DB)\s*=\s*(.+?)\s*$') {
            $k = $Matches[1]
            $v = $Matches[2].Trim('"', "'")
            if (-not (Get-Item "Env:$k" -ErrorAction SilentlyContinue)) {
                Set-Item "Env:$k" $v
            }
        }
    }
}

New-Item -ItemType Directory -Force -Path "backups" | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "taskuser" }
$dbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "taskplanner" }
$outFile = Join-Path (Resolve-Path "backups").Path "${dbName}_${timestamp}.sql"

$prevEncoding = [Console]::OutputEncoding
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
try {
    $dumpLines = & docker compose exec -T db pg_dump -U $dbUser $dbName
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed with exit code $LASTEXITCODE"
    }
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($outFile, ($dumpLines -join "`n") + "`n", $utf8NoBom)
} finally {
    [Console]::OutputEncoding = $prevEncoding
}

Write-Output "Backup saved to backups/${dbName}_${timestamp}.sql"
