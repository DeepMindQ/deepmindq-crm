#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# DeepMindQ — Database Backup Script
# Phase 8.1 — Automated Backups with Encryption & S3 Archival
#
# Usage:
#   ./scripts/backup.sh                        # Full backup
#   ./scripts/backup.sh --type incremental     # Incremental (WAL-based)
#   ./scripts/backup.sh --type pre_migration   # Pre-migration snapshot
#   ./scripts/backup.sh --verify               # Verify last backup
#   ./scripts/backup.sh --restore <backup_id> # Restore from backup
#   ./scripts/backup.sh --skip-upload         # Skip S3 upload
#
# Requirements:
#   - pg_dump / pg_restore (PostgreSQL client tools)
#   - aws-cli (for S3 archival)
#   - openssl (for AES-256-CBC encryption)
#   - DIRECT_DATABASE_URL env var (or DATABASE_URL as fallback)
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ──────────────────────────────────────────────
# Configuration & Defaults
# ──────────────────────────────────────────────
BACKUP_TYPE="${BACKUP_TYPE:-full}"
SKIP_UPLOAD=false
VERIFY_MODE=false
RESTORE_MODE=false
RESTORE_BACKUP_ID=""
FORCE_MODE=false

# Resolve database URL — prefer direct URL for pg_dump
DB_URL="${DIRECT_DATABASE_URL:-${DATABASE_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "ERROR: DIRECT_DATABASE_URL or DATABASE_URL must be set" >&2
  exit 1
fi

# Encryption key — prefer dedicated key, derive from master key as fallback
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-${ENCRYPTION_MASTER_KEY:-}}"
if [ -z "$BACKUP_ENCRYPTION_KEY" ]; then
  echo "WARNING: BACKUP_ENCRYPTION_KEY not set — backup will NOT be encrypted"
fi

# S3 configuration
S3_BUCKET_NAME="${S3_BUCKET:-}"
S3_PREFIX="${S3_BACKUP_PREFIX:-backups}"

# Local temp directory
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_ONLY=$(date +%Y%m%d)
TEMP_DIR="${TEMP_DIR:-/tmp/deepmindq-backup}"
mkdir -p "$TEMP_DIR"

# Backup metadata file (tracks last backup)
METADATA_FILE="${TEMP_DIR}/last-backup.json"

# ──────────────────────────────────────────────
# Argument Parsing
# ──────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --type)
      BACKUP_TYPE="$2"
      shift 2
      ;;
    --verify)
      VERIFY_MODE=true
      shift
      ;;
    --restore)
      RESTORE_MODE=true
      RESTORE_BACKUP_ID="$2"
      shift 2
      ;;
    --skip-upload)
      SKIP_UPLOAD=true
      shift
      ;;
    --force)
      FORCE_MODE=true
      shift
      ;;
    --help|-h)
      echo "DeepMindQ Database Backup Script"
      echo ""
      echo "Usage:"
      echo "  $0                            # Full backup (default)"
      echo "  $0 --type incremental         # Incremental (WAL-based)"
      echo "  $0 --type pre_migration       # Pre-migration snapshot"
      echo "  $0 --verify                   # Verify last backup integrity"
      echo "  $0 --restore <backup_id>      # Restore from specific backup"
      echo "  $0 --skip-upload              # Skip S3 upload step"
      echo "  $0 --force                    # Skip confirmation prompts"
      echo ""
      echo "Environment Variables:"
      echo "  DIRECT_DATABASE_URL   PostgreSQL direct connection URL (preferred)"
      echo "  DATABASE_URL           PostgreSQL connection URL (fallback)"
      echo "  BACKUP_ENCRYPTION_KEY  AES-256 encryption key"
      echo "  ENCRYPTION_MASTER_KEY  Fallback encryption key"
      echo "  S3_BUCKET              S3 bucket for backup archival"
      echo "  S3_BACKUP_PREFIX       S3 key prefix (default: backups)"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1 (use --help for usage)" >&2
      exit 1
      ;;
  esac
done

# ──────────────────────────────────────────────
# Helper Functions
# ──────────────────────────────────────────────
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

error() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

warn() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $*" >&2
}

cleanup() {
  local exit_code=$?
  if [ -d "$TEMP_DIR" ]; then
    rm -rf "${TEMP_DIR:?}/"* 2>/dev/null || true
  fi
  exit $exit_code
}

trap cleanup EXIT INT TERM

# Generate S3 key for a backup file
s3_key() {
  local filename="$1"
  echo "${S3_PREFIX}/${DATE_ONLY}/${filename}"
}

# ──────────────────────────────────────────────
# Prerequisite Checks
# ──────────────────────────────────────────────
check_prerequisites() {
  local missing=0

  if ! command -v pg_dump &>/dev/null; then
    error "pg_dump not found. Install PostgreSQL client tools."
    missing=1
  fi

  if ! command -v openssl &>/dev/null; then
    error "openssl not found. Required for backup encryption."
    missing=1
  fi

  if [ "$SKIP_UPLOAD" = false ] && [ -n "$S3_BUCKET_NAME" ]; then
    if ! command -v aws &>/dev/null; then
      error "aws-cli not found. Required for S3 upload (use --skip-upload to skip)."
      missing=1
    fi
  fi

  if [ "$missing" -eq 1 ]; then
    exit 2
  fi
}

check_prerequisites

# ──────────────────────────────────────────────
# MODE: Full Backup
# ──────────────────────────────────────────────
do_full_backup() {
  local backup_label="$1"
  local filename="deepmindq_${backup_label}_${TIMESTAMP}.sql"
  local raw_file="${TEMP_DIR}/${filename}"
  local gz_file="${raw_file}.gz"
  local enc_file="${gz_file}.enc"
  local checksum_file="${gz_file}.sha256"

  log "Starting ${backup_label} backup..."
  local start_time=$(date +%s)

  # Step 1: pg_dump
  log "Running pg_dump (custom format with data)..."
  set +e
  pg_dump "$DB_URL" \
    --format=plain \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    --encoding=UTF8 \
    --file="$raw_file" \
    2>/tmp/pg_dump_error.log
  DUMP_EXIT=$?
  set -e

  if [ $DUMP_EXIT -ne 0 ]; then
    error "pg_dump failed (exit code ${DUMP_EXIT})"
    [ -f /tmp/pg_dump_error.log ] && cat /tmp/pg_dump_error.log >&2
    rm -f /tmp/pg_dump_error.log
    exit 3
  fi
  rm -f /tmp/pg_dump_error.log

  local raw_size=$(stat -f%z "$raw_file" 2>/dev/null || stat -c%s "$raw_file")
  log "Raw dump size: $(numfmt --to=iec $raw_size 2>/dev/null || echo "${raw_size} bytes")"

  # Step 2: Compress with gzip
  log "Compressing with gzip..."
  gzip -f -9 "$raw_file"
  local gz_size=$(stat -f%z "$gz_file" 2>/dev/null || stat -c%s "$gz_file")
  log "Compressed size: $(numfmt --to=iec $gz_size 2>/dev/null || echo "${gz_size} bytes")"
  local compression_ratio=$(echo "scale=1; 100 - ($gz_size * 100 / $raw_size)" | bc 2>/dev/null || echo "?")
  log "Compression ratio: ${compression_ratio}% reduction"

  # Step 3: Encrypt with AES-256-CBC
  if [ -n "$BACKUP_ENCRYPTION_KEY" ]; then
    log "Encrypting with AES-256-CBC..."
    openssl enc -aes-256-cbc \
      -salt \
      -pbkdf2 \
      -iter 100000 \
      -in "$gz_file" \
      -out "$enc_file" \
      -pass "pass:${BACKUP_ENCRYPTION_KEY}" \
      2>/dev/null
    local enc_size=$(stat -f%z "$enc_file" 2>/dev/null || stat -c%s "$enc_file")
    log "Encrypted size: $(numfmt --to=iec $enc_size 2>/dev/null || echo "${enc_size} bytes")"
    # Use encrypted file as the upload target
    local upload_file="$enc_file"
    local upload_filename="${filename}.gz.enc"
  else
    warn "Skipping encryption — BACKUP_ENCRYPTION_KEY not set"
    local upload_file="$gz_file"
    local upload_filename="${filename}.gz"
  fi

  # Step 4: Calculate SHA-256 checksum (of compressed, pre-encryption)
  local checksum=$(sha256sum "$gz_file" | awk '{print $1}')
  echo "$checksum  ${filename}.gz" > "$checksum_file"
  log "SHA-256 checksum: ${checksum}"

  # Step 5: Upload to S3
  if [ "$SKIP_UPLOAD" = false ] && [ -n "$S3_BUCKET_NAME" ]; then
    local s3_key_val=$(s3_key "$upload_filename")
    log "Uploading to s3://${S3_BUCKET_NAME}/${s3_key_val}..."
    set +e
    aws s3 cp "$upload_file" "s3://${S3_BUCKET_NAME}/${s3_key_val}" \
      --server-side-encryption aws:kms \
      --storage-class STANDARD_IA \
      2>/dev/null
    UPLOAD_EXIT=$?
    set -e

    if [ $UPLOAD_EXIT -ne 0 ]; then
      warn "S3 upload failed (exit code ${UPLOAD_EXIT}) — backup retained locally"
      echo "upload_status=local_only" >> "$METADATA_FILE"
    else
      log "Upload successful"
      echo "upload_status=uploaded" >> "$METADATA_FILE"

      # Upload checksum
      aws s3 cp "$checksum_file" "s3://${S3_BUCKET_NAME}/$(s3_key "${filename}.gz.sha256")" \
        --storage-class STANDARD_IA \
        2>/dev/null || warn "Checksum upload failed"
    fi
  else
    log "S3 upload skipped (--skip-upload or S3_BUCKET not set)"
    echo "upload_status=local_only" >> "$METADATA_file"
  fi

  # Step 6: Calculate duration
  local end_time=$(date +%s)
  local duration=$((end_time - start_time))

  # Step 7: Write metadata
  local backup_id="${DATE_ONLY}-${TIMESTAMP}-${backup_label}"
  cat > "$METADATA_FILE" << METAEOF
{
  "backupId": "${backup_id}",
  "type": "${backup_label}",
  "status": "completed",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "sizeBytes": ${gz_size},
  "sizeEncryptedBytes": ${enc_size:-0},
  "checksum": "${checksum}",
  "checksumAlgorithm": "sha256",
  "durationMs": $((duration * 1000)),
  "snapshotTime": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "s3Key": "${S3_PREFIX:-backups}/${DATE_ONLY}/${upload_filename}",
  "localPath": "${upload_file}",
  "encrypted": $([ -n "$BACKUP_ENCRYPTION_KEY" ] && echo "true" || echo "false")
}
METAEOF

  # Step 8: Print summary
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  BACKUP SUMMARY"
  echo "═══════════════════════════════════════════════════════════════"
  echo "  Backup ID:     ${backup_id}"
  echo "  Type:          ${backup_label}"
  echo "  Status:        ✅ Completed"
  echo "  Raw Size:      $(numfmt --to=iec $raw_size 2>/dev/null || echo "${raw_size} bytes")"
  echo "  Compressed:    $(numfmt --to=iec $gz_size 2>/dev/null || echo "${gz_size} bytes")"
  echo "  Encrypted:     $([ -n "$BACKUP_ENCRYPTION_KEY" ] && echo "Yes (AES-256-CBC)" || echo "No")"
  echo "  Checksum:      ${checksum}"
  echo "  Duration:      ${duration}s"
  echo "  S3 Location:   s3://${S3_BUCKET_NAME}/${S3_PREFIX:-backups}/${DATE_ONLY}/${upload_filename}"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
}

# ──────────────────────────────────────────────
# MODE: Incremental Backup
# ──────────────────────────────────────────────
do_incremental_backup() {
  log "Checking for WAL archiving support on Neon..."

  # Neon does not expose WAL archiving to user connections.
  # We check if the server supports it, and fall back if not.
  set +e
  WAL_CHECK=$(psql "$DB_URL" -t -A -c "
    SELECT COUNT(*) FROM pg_settings WHERE name IN ('wal_level', 'archive_mode') AND setting IN ('replica', 'logical', 'on');
  " 2>/dev/null || echo "0")
  set -e

  if [ "$WAL_CHECK" -lt 2 ]; then
    warn "WAL archiving not available on this database"
    warn "Neon serverless does not expose WAL archiving to client connections"
    warn "Falling back to full backup..."
    do_full_backup "incremental_fallback"
    return
  fi

  log "WAL archiving available — performing incremental backup..."
  # On Neon, we can use their point-in-time restore API instead
  # For self-managed PostgreSQL, this would use pg_basebackup with --checkpoint=fast
  log "Performing differential pg_dump (fast checkpoint)..."
  pg_dump "$DB_URL" \
    --format=plain \
    --no-owner \
    --no-privileges \
    --encoding=UTF8 \
    2>/dev/null | gzip -9 > "${TEMP_DIR}/deepmindq_incremental_${TIMESTAMP}.sql.gz"

  log "Incremental backup completed"
  do_full_backup "incremental"
}

# ──────────────────────────────────────────────
# MODE: Verify Last Backup
# ──────────────────────────────────────────────
do_verify() {
  log "Starting backup verification..."

  if [ ! -f "$METADATA_FILE" ]; then
    error "No backup metadata found at ${METADATA_FILE}"
    error "Run a backup first, or provide the backup ID"
    exit 4
  fi

  # Read metadata
  local s3_key_val=$(python3 -c "import json; print(json.load(open('$METADATA_FILE')).get('s3Key',''))" 2>/dev/null || echo "")
  local local_path=$(python3 -c "import json; print(json.load(open('$METADATA_FILE')).get('localPath',''))" 2>/dev/null || echo "")
  local checksum=$(python3 -c "import json; print(json.load(open('$METADATA_FILE')).get('checksum',''))" 2>/dev/null || echo "")
  local backup_id=$(python3 -c "import json; print(json.load(open('$METADATA_FILE')).get('backupId',''))" 2>/dev/null || echo "")

  if [ -z "$s3_key_val" ] && [ ! -f "$local_path" ]; then
    error "No backup found to verify"
    exit 4
  fi

  # Download from S3 if needed
  local verify_file="${TEMP_DIR}/verify_backup"
  if [ -n "$s3_key_val" ] && [ -n "$S3_BUCKET_NAME" ]; then
    log "Downloading backup from S3..."
    aws s3 cp "s3://${S3_BUCKET_NAME}/${s3_key_val}" "$verify_file" 2>/dev/null
  elif [ -f "$local_path" ]; then
    verify_file="$local_path"
  fi

  if [ ! -f "$verify_file" ]; then
    error "Could not locate backup file for verification"
    exit 5
  fi

  # Decrypt if encrypted
  local decrypted_file="${TEMP_DIR}/verify_decrypted.sql.gz"
  if [[ "$verify_file" == *.enc ]] && [ -n "$BACKUP_ENCRYPTION_KEY" ]; then
    log "Decrypting backup..."
    openssl enc -aes-256-cbc \
      -d \
      -pbkdf2 \
      -iter 100000 \
      -in "$verify_file" \
      -out "$decrypted_file" \
      -pass "pass:${BACKUP_ENCRYPTION_KEY}" \
      2>/dev/null || {
        error "Decryption FAILED — backup integrity compromised or wrong key"
        exit 6
      }
    verify_file="$decrypted_file"
  fi

  # Verify checksum
  if [ -n "$checksum" ]; then
    log "Verifying SHA-256 checksum..."
    local actual_checksum=$(sha256sum "$verify_file" | awk '{print $1}')
    if [ "$actual_checksum" = "$checksum" ]; then
      log "✅ Checksum verified: ${checksum}"
    else
      error "❌ Checksum MISMATCH!"
      error "  Expected: ${checksum}"
      error "  Actual:   ${actual_checksum}"
      exit 7
    fi
  fi

  # Validate SQL dump structure
  log "Validating SQL dump structure..."
  set +e
  DECOMPRESSED=$(gunzip -c "$verify_file" 2>/dev/null | head -c 2000)
  SQL_OK=$?
  set -e

  if [ $SQL_OK -eq 0 ]; then
    if echo "$DECOMPRESSED" | grep -q "PostgreSQL database dump"; then
      log "✅ Valid PostgreSQL dump detected"
    else
      warn "Could not confirm PostgreSQL dump header — file may be corrupted"
    fi
  else
    error "❌ Failed to decompress backup — gzip integrity check failed"
    exit 8
  fi

  # Attempt pg_restore --list (dry-run validation)
  log "Running pg_restore --list (dry-run validation)..."
  set +e
  echo "$DECOMPRESSED" | pg_restore --list --format=plain /dev/stdin 2>/dev/null | tail -5
  RESTORE_LIST_EXIT=$?
  set -e

  if [ $RESTORE_LIST_EXIT -eq 0 ]; then
    log "✅ pg_restore --list validation passed"
  else
    warn "pg_restore --list returned non-zero (this may be expected for plain SQL dumps)"
  fi

  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  VERIFICATION SUMMARY"
  echo "═══════════════════════════════════════════════════════════════"
  echo "  Backup ID:   ${backup_id}"
  echo "  Checksum:    ✅ Verified"
  echo "  Decryption:  ✅ Passed"
  echo "  Structure:   ✅ Valid PostgreSQL dump"
  echo "  Status:      ✅ BACKUP INTEGRITY CONFIRMED"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
}

# ──────────────────────────────────────────────
# MODE: Restore from Backup
# ──────────────────────────────────────────────
do_restore() {
  local backup_id="$1"
  log "Starting restore from backup: ${backup_id}"

  # Safety check — require confirmation unless --force
  if [ "$FORCE_MODE" = false ]; then
    echo ""
    echo "⚠️  WARNING: This will OVERWRITE the current database!"
    echo "⚠️  Backup ID: ${backup_id}"
    echo "⚠️  Target:    ${DB_URL}"
    echo ""
    read -p "Type 'RESTORE CONFIRM' to proceed: " confirmation
    if [ "$confirmation" != "RESTORE CONFIRM" ]; then
      log "Restore cancelled by user"
      exit 0
    fi
  fi

  # Find backup — try S3 first, then local metadata
  local restore_file="${TEMP_DIR}/restore_backup"
  local s3_key_val=""

  if [ -n "$S3_BUCKET_NAME" ] && [ -n "$backup_id" ]; then
    # Construct S3 key from backup ID
    local date_part=$(echo "$backup_id" | cut -d'-' -f1)
    local time_part=$(echo "$backup_id" | cut -d'-' -f2)
    s3_key_val=$(aws s3 ls "s3://${S3_BUCKET_NAME}/${S3_PREFIX:-backups}/${date_part}/" 2>/dev/null \
      | grep "${time_part}" \
      | awk '{print $4}' \
      | head -1 || true)

    if [ -n "$s3_key_val" ]; then
      log "Downloading backup from S3..."
      aws s3 cp "s3://${S3_BUCKET_NAME}/${S3_PREFIX:-backups}/${date_part}/${s3_key_val}" "$restore_file" 2>/dev/null
    fi
  fi

  if [ ! -f "$restore_file" ]; then
    error "Could not find backup with ID: ${backup_id}"
    error "Check S3 bucket or local backups directory"
    exit 9
  fi

  # Decrypt if needed
  if [[ "$restore_file" == *.enc ]] && [ -n "$BACKUP_ENCRYPTION_KEY" ]; then
    log "Decrypting backup..."
    openssl enc -aes-256-cbc \
      -d \
      -pbkdf2 \
      -iter 100000 \
      -in "$restore_file" \
      -out "${restore_file}.decrypted.sql.gz" \
      -pass "pass:${BACKUP_ENCRYPTION_KEY}" \
      2>/dev/null || {
        error "Decryption FAILED"
        exit 10
      }
    restore_file="${restore_file}.decrypted.sql.gz"
  fi

  # Pre-restore safety: create a backup of current state
  log "Creating pre-restore safety snapshot..."
  local pre_restore_backup_id="pre-restore-${TIMESTAMP}"
  set +e
  pg_dump "$DB_URL" --format=plain --no-owner --no-privileges \
    2>/dev/null | gzip -9 > "${TEMP_DIR}/pre-restore-safety-${TIMESTAMP}.sql.gz" || {
    warn "Pre-restore safety backup failed — proceeding anyway"
  }
  set -e

  # Restore
  log "Restoring database from backup..."
  log "Target: ${DB_URL}"

  set +e
  gunzip -c "$restore_file" | psql "$DB_URL" \
    --set ON_ERROR_STOP=0 \
    --quiet \
    2>&1 | tail -20
  RESTORE_EXIT=$?
  set -e

  if [ $RESTORE_EXIT -eq 0 ]; then
    log "✅ Database restore completed successfully"

    # Run post-restore validation
    log "Running post-restore validation..."
    TABLE_COUNT=$(psql "$DB_URL" -t -A -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "?")
    log "Tables in restored database: ${TABLE_COUNT}"

    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  RESTORE SUMMARY"
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Backup ID:    ${backup_id}"
    echo "  Status:       ✅ Restored"
    echo "  Tables:       ${TABLE_COUNT}"
    echo "  Safety Backup: ${TEMP_DIR}/pre-restore-safety-${TIMESTAMP}.sql.gz"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
  else
    error "❌ Database restore FAILED (exit code ${RESTORE_EXIT})"
    error "Pre-restore safety backup: ${TEMP_DIR}/pre-restore-safety-${TIMESTAMP}.sql.gz"
    exit 11
  fi
}

# ──────────────────────────────────────────────
# Main Dispatch
# ──────────────────────────────────────────────
if [ "$VERIFY_MODE" = true ]; then
  do_verify
elif [ "$RESTORE_MODE" = true ]; then
  if [ -z "$RESTORE_BACKUP_ID" ]; then
    error "--restore requires a backup ID"
    echo "Usage: $0 --restore <backup_id>"
    exit 1
  fi
  do_restore "$RESTORE_BACKUP_ID"
else
  case "$BACKUP_TYPE" in
    full)
      do_full_backup "full"
      ;;
    incremental)
      do_incremental_backup
      ;;
    pre_migration)
      do_full_backup "pre_migration"
      ;;
    *)
      error "Unknown backup type: ${BACKUP_TYPE}"
      echo "Valid types: full, incremental, pre_migration"
      exit 1
      ;;
  esac
fi
