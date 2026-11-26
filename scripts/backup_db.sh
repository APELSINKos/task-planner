#!/usr/bin/env bash
set -euo pipefail

mkdir -p backups
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DB_USER="${POSTGRES_USER:-taskuser}"
DB_NAME="${POSTGRES_DB:-taskplanner}"
OUT_FILE="backups/${DB_NAME}_${TIMESTAMP}.sql"

docker compose exec -T db pg_dump -U "$DB_USER" "$DB_NAME" > "$OUT_FILE"
echo "Backup saved to $OUT_FILE"
