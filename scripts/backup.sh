#!/bin/bash
# ──────────────────────────────────────────────────────────────
# DeepMindQ — Database Backup Script
#
# Creates timestamped PostgreSQL backups with rotation.
# Designed for cron-based scheduled backups.
#
# Usage:
#   ./scripts/backup.sh                   # Manual backup
#   ./scripts/backup.sh --rotate 7        # Keep last 7 backups
#   crontab: 0 2 * * * /app/scripts/backup.sh --rotate 30
#
# Required env vars:
#   DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE
# ──────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuration ──────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/app/backups}"
ROTATE_COUNT="${1:-30}"  # Default: keep 30 backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/deepmindq_${TIMESTAMP}.sql.gz"

# ── Resolve database connection ─────────────────────────────
if [ -n "${DATABASE_URL:-}" ]; then
  # Parse DATABASE_URL: postgresql://user:pass@host:port/dbname
  # Extract components for pg_dump
  DB_URL_NO_PREFIX="${DATABASE_URL#postgresql://}"
  DB_URL_NO_QUERY="${DB_URL_NO_PREFIX%%\?*}"
  DB_USER="$(echo "$DB_URL_NO_QUERY" | cut -d: -f1)"
  DB_PASS="$(echo "$DB_URL_NO_QUERY" | cut -d: -f2 | cut -d@ -f1)"
  DB_HOST_PORT="$(echo "$DB_URL_NO_QUERY" | cut -d@ -f2)"
  DB_HOST="$(echo "$DB_HOST_PORT" | cut -d: -f1)"
  DB_PORT="$(echo "$DB_HOST_PORT" | cut -d: -f2)"
  DB_NAME="$(echo "$DB_URL_NO_QUERY" | cut -d/ -f2)"

  export PGHOST="${DB_HOST:-localhost}"
  export PGPORT="${DB_PORT:-5432}"
  export PGUSER="$DB_USER"
  export PGPASSWORD="$DB_PASS"
  export PGDATABASE="${DB_NAME:-deepmindq}"
fi

# ── Create backup directory ────────────────────────────────
mkdir -p "$BACKUP_DIR"

# ── Perform backup ─────────────────────────────────────────
echo "[backup] Starting backup: ${BACKUP_FILE}"

if pg_dump --compress=9 --format=plain > "${BACKUP_FILE%.gz}" 2>/dev/null; then
  gzip -f "${BACKUP_FILE%.gz}"
  BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[backup] Success: ${BACKUP_FILE} (${BACKUP_SIZE})"
else
  echo "[backup] ERROR: pg_dump failed" >&2
  rm -f "${BACKUP_FILE}" "${BACKUP_FILE%.gz}"
  exit 1
fi

# ── Rotate old backups ──────────────────────────────────────
KEEP=$((ROTATE_COUNT))
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/deepmindq_*.sql.gz 2>/dev/null | wc -l)

if [ "$BACKUP_COUNT" -gt "$KEEP" ]; then
  REMOVE_COUNT=$((BACKUP_COUNT - KEEP))
  echo "[backup] Rotating: removing ${REMOVE_COUNT} old backup(s)"
  ls -1t "${BACKUP_DIR}"/deepmindq_*.sql.gz | tail -n "$REMOVE_COUNT" | xargs rm -f
fi

echo "[backup] Done. ${BACKUP_COUNT} backup(s) in ${BACKUP_DIR}"
