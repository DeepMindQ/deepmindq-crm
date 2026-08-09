#!/bin/bash
# DeepMindQ — Safe Database Migration Runner
# Usage: ./scripts/migrate.sh [up|down|status|create] [target]

set -euo pipefail

echo "=== DeepMindQ Migration Runner ==="
echo ""

case "${1:-up}" in
  up)
    echo "Running forward migrations..."
    npx prisma migrate deploy 2>&1
    echo "Running custom data migrations..."
    node -e "
      const { preMigrationCheck, runMigration } = require('./src/lib/db-migration');
      // Add custom migration steps here
    " 2>/dev/null || echo "No custom migrations to run."
    ;;
  down)
    echo "Rolling back migrations..."
    TARGET="${2:-}"
    if [ -z "$TARGET" ]; then
      echo "Usage: $0 down <migration_name>"
      exit 1
    fi
    npx prisma migrate revert 2>&1 || true
    ;;
  status)
    echo "Migration status:"
    npx prisma migrate status 2>&1
    ;;
  create)
    NAME="${2:-migration}"
    echo "Creating migration: $NAME"
    npx prisma migrate dev --name "$NAME" --create-only 2>&1
    ;;
  *)
    echo "Usage: $0 [up|down|status|create]"
    exit 1
    ;;
esac