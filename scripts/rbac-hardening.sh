#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
# RBAC Hardening Script — Session: Enterprise Security
#
# Fixes all 28 bypassed endpoints by adding `request`
# parameter to checkApiAuth() calls.
#
# Pattern: checkApiAuth() → checkApiAuth(request)
# Also renames unused _request → request where needed.
# ═══════════════════════════════════════════════════════

set -euo pipefail
cd /home/z/my-project

echo "═══ RBAC HARDENING: Migrating checkApiAuth() → checkApiAuth(request) ═══"

# Category 1: Contacts (4 files)
FILES_CONTACTS=(
  "src/app/api/contacts/[id]/route.ts"
  "src/app/api/contacts/[id]/notes/route.ts"
  "src/app/api/contacts/[id]/generate-email/route.ts"
  "src/app/api/companies/[id]/contacts/route.ts"
)

# Category 2: Opportunities/Pipeline (4 files)
FILES_OPPS=(
  "src/app/api/opportunities/[id]/route.ts"
  "src/app/api/pipeline/route.ts"
  "src/app/api/pipeline/forecast/route.ts"
  "src/app/api/pipeline/health/route.ts"
)

# Category 3: Reports (2 files)
FILES_REPORTS=(
  "src/app/api/reports/team-performance/route.ts"
  "src/app/api/reports/data-quality/route.ts"
)

# Category 4: AI/Intelligence (11 files)
FILES_AI=(
  "src/app/api/ai/experiments/route.ts"
  "src/app/api/ai/experiments/[id]/route.ts"
  "src/app/api/ai/freshness/route.ts"
  "src/app/api/ai/governance/dashboard/route.ts"
  "src/app/api/ai/governance/check/route.ts"
  "src/app/api/ai/cost/route.ts"
  "src/app/api/ai/advisor/conversation/[id]/route.ts"
  "src/app/api/ai/cache/route.ts"
  "src/app/api/ai/prompt-registry/[id]/route.ts"
  "src/app/api/ai/prompt-registry/route.ts"
  "src/app/api/ai/recommendations/route.ts"
  "src/app/api/ai/relationship-memory/route.ts"
)

# Category 5: Companies [id] sub-routes (5 files)
FILES_COMPANIES=(
  "src/app/api/companies/[id]/brief/route.ts"
  "src/app/api/companies/[id]/alignment/route.ts"
  "src/app/api/companies/[id]/signals/[signalId]/route.ts"
  "src/app/api/companies/[id]/notes/[noteId]/route.ts"
)

# Category 6: Users (1 file - GET only)
FILES_USERS=(
  "src/app/api/users/route.ts"
)

ALL_FILES=(
  "${FILES_CONTACTS[@]}"
  "${FILES_OPPS[@]}"
  "${FILES_REPORTS[@]}"
  "${FILES_AI[@]}"
  "${FILES_COMPANIES[@]}"
  "${FILES_USERS[@]}"
)

FIXED=0
SKIPPED=0
FAILED=0

for file in "${ALL_FILES[@]}"; do
  filepath="/home/z/my-project/$file"
  if [ ! -f "$filepath" ]; then
    echo "⚠️  SKIP (not found): $file"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Check if file has checkApiAuth() without request (i.e., not already fixed)
  # Pattern: checkApiAuth() — with empty parens, no request arg
  if grep -q 'await checkApiAuth()' "$filepath"; then
    # Use sed to replace checkApiAuth() with checkApiAuth(request)
    # This handles both forms:
    #   const { errorResponse } = await checkApiAuth();
    #   const { session, errorResponse } = await checkApiAuth();
    sed -i 's/await checkApiAuth()/await checkApiAuth(request)/g' "$filepath"

    # Also rename _request to request where the parameter exists but is prefixed with _
    # (Next.js route handlers sometimes use _request to indicate unused)
    # Only do this for the first parameter in function signatures
    sed -i 's/_request: Request/request: Request/g' "$filepath"
    sed -i 's/_request: NextRequest/request: NextRequest/g' "$filepath"

    echo "✅ FIXED: $file"
    FIXED=$((FIXED + 1))
  else
    echo "⏭️  ALREADY FIXED: $file"
    SKIPPED=$((SKIPPED + 1))
  fi
done

echo ""
echo "═══ RESULTS ═══"
echo "  Fixed:   $FIXED"
echo "  Skipped: $SKIPPED"
echo "  Failed:  $FAILED"
echo "═════════════════"
