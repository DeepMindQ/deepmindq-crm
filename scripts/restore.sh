#!/bin/bash
# DeepMindQ — Database Restore Script
# Usage: ./scripts/restore.sh <backup_file>
# WARNING: This will OVERWRITE the current database

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <backup_file>"
  echo "Available backups:"
  ls -la "${BACKUP_DIR:-./backups}/" 2>/dev/null || echo "  (none found)"
  exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "WARNING: This will restore the database from backup."
echo "Backup: $BACKUP_FILE"
echo "Database: $DATABASE_URL"
read -p "Type 'CONFIRM' to proceed: " confirmation

if [ "$confirmation" != "CONFIRM" ]; then
  echo "Cancelled."
  exit 0
fi

echo "[$(date)] Starting restore..."

# Drop existing connections and restore
pg_dump "$DATABASE_URL" --format=custom -f "$BACKUP_FILE" 2>/dev/null && {
  pg_restore --clean --if-exists --dbname="$DATABASE_URL" "$BACKUP_FILE"
} || {
  # Fallback for SQL backups
  psql "$DATABASE_URL" < "$BACKUP_FILE"
}

echo "[$(date)] Restore completed successfully."
