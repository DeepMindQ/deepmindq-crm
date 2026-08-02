#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────
# DeepMindQ — Database Restore Script
#
# Usage:
#   ./scripts/restore.sh <backup-file>
#   ./scripts/restore.sh --list          # List available backups
#   ./scripts/restore.sh --latest       # Restore most recent backup
# ──────────────────────────────────────────────────────────────

BACKUP_DIR="${BACKUP_DIR:-/app/backups}"
DB_NAME="${DB_NAME:-deepmindq}"
DB_USER="${DB_USER:-deepmindq}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

list_backups() {
  echo "Available backups in ${BACKUP_DIR}:"
  ls -lht "${BACKUP_DIR}/${DB_NAME}"*.sql.gz 2>/dev/null || echo "  No backups found."
}

restore_latest() {
  local latest
  latest=$(ls -t "${BACKUP_DIR}/${DB_NAME}"*.sql.gz 2>/dev/null | head -1)
  if [ -z "$latest" ]; then
    echo "ERROR: No backups found in ${BACKUP_DIR}"
    exit 1
  fi
  echo "Restoring latest backup: $(basename "$latest")"
  restore_backup "$latest"
}

restore_backup() {
  local backup_file="$1"

  if [ ! -f "$backup_file" ]; then
    echo "ERROR: Backup file not found: $backup_file"
    exit 1
  fi

  echo "WARNING: This will replace ALL data in the '${DB_NAME}' database."
  read -rp "Type 'yes' to confirm: " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
  fi

  echo "Stopping application connections..."
  # Note: In Docker, use docker compose pause app instead
  # docker compose pause app 2>/dev/null || true

  echo "Restoring from: $(basename "$backup_file")"
  gunzip -c "$backup_file" | psql \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --quiet \
    --single-transaction

  if [ $? -eq 0 ]; then
    echo "Restore completed successfully."
    echo "Restart the application to apply changes."
  else
    echo "ERROR: Restore failed!"
    exit 1
  fi
}

# ── Main ──
case "${1:-}" in
  --list)
    list_backups
    ;;
  --latest)
    restore_latest
    ;;
  *)
    if [ -z "${1:-}" ]; then
      echo "Usage: $0 <backup-file> | --list | --latest"
      exit 1
    fi
    restore_backup "$1"
    ;;
esac
