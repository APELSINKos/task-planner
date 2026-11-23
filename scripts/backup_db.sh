#!/usr/bin/env bash
set -euo pipefail

if [ -f .env ]; then
  while IFS='=' read -r key val; do
    case "$key" in
      POSTGRES_USER|POSTGRES_DB)
        val="${val%$'\r'}"
        val="${val#\"}"; val="${val%\"}"
        val="${val#\'}"; val="${val%\'}"
        if [ -z "${!key:-}" ]; then
          export "$key=$val"
        fi
        ;;
    esac
  done < .env
fi

mkdir -p backups
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DB_USER="${POSTGRES_USER:-taskuser}"
DB_NAME="${POSTGRES_DB:-taskplanner}"
OUT_FILE="backups/${DB_NAME}_${TIMESTAMP}.sql"

docker compose exec -T db pg_dump -U "$DB_USER" "$DB_NAME" > "$OUT_FILE"
echo "Backup saved to $OUT_FILE"
