#!/bin/bash
# DeepMindQ — Database Backup Script
# Usage: ./scripts/backup.sh [backup_type]
# Types: full (default), schema-only, data-only

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="${DB_NAME:-deepmindq}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

case "${1:-full}" in
  full)
    echo "[$(date)] Starting full backup..."
    pg_dump "$DATABASE_URL" --compress=6 --format=custom \
      --file="$BACKUP_DIR/${DB_NAME}_full_${TIMESTAMP}.dump"
    ;;
  schema-only)
    echo "[$(date)] Starting schema-only backup..."
    pg_dump "$DATABASE_URL" --schema-only \
      --file="$BACKUP_DIR/${DB_NAME}_schema_${TIMESTAMP}.sql"
    ;;
  data-only)
    echo "[$(date)] Starting data-only backup..."
    pg_dump "$DATABASE_URL" --data-only --compress=6 \
      --file="$BACKUP_DIR/${DB_NAME}_data_${TIMESTAMP}.sql.gz"
    ;;
  *)
    echo "Usage: $0 [full|schema-only|data-only]"
    exit 1
    ;;
esac

echo "[$(date)] Backup completed: $BACKUP_DIR/${DB_NAME}_${1:-full}_${TIMESTAMP}.*"

# Cleanup old backups
find "$BACKUP_DIR" -name "${DB_NAME}_*" -mtime +$RETENTION_DAYS -delete
echo "[$(date)] Cleaned up backups older than $RETENTION_DAYS days"
