#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
# Fix checkApiAuth(request) calls where the parameter
# is actually named `req` instead of `request`.
# ═══════════════════════════════════════════════════════
set -euo pipefail
cd /home/z/my-project

# Files that use `req` as the request parameter name
FILES=(
  "src/app/api/ai/cost/route.ts"
  "src/app/api/ai/experiments/route.ts"
  "src/app/api/ai/governance/dashboard/route.ts"
  "src/app/api/ai/prompt-registry/route.ts"
  "src/app/api/ai/cache/route.ts"
  "src/app/api/ai/advisor/conversation/[id]/route.ts"
)

for file in "${FILES[@]}"; do
  filepath="/home/z/my-project/$file"
  if [ ! -f "$filepath" ]; then
    echo "⚠️  SKIP: $file"
    continue
  fi

  # Check if file uses req: NextRequest but checkApiAuth(request)
  if rg -q "req: NextRequest" "$filepath" && rg -q "checkApiAuth\(request\)" "$filepath"; then
    sed -i 's/checkApiAuth(request)/checkApiAuth(req)/g' "$filepath"
    echo "✅ Fixed req→request: $file"
  else
    echo "⏭️  No fix needed: $file"
  fi
done

# Files that need `request: Request` added to empty function signatures
EMPTY_PARAM_FILES=(
  "src/app/api/users/route.ts:29"
  "src/app/api/ai/freshness/route.ts:12"
  "src/app/api/ai/freshness/route.ts:25"
  "src/app/api/ai/relationship-memory/route.ts:866"
  "src/app/api/ai/recommendations/route.ts:364"
  "src/app/api/reports/team-performance/route.ts:6"
  "src/app/api/reports/data-quality/route.ts:6"
  "src/app/api/pipeline/forecast/route.ts:20"
  "src/app/api/pipeline/route.ts:18"
  "src/app/api/pipeline/health/route.ts:9"
)

echo ""
echo "═══ Empty param functions — adding request: Request ═══"
for entry in "${EMPTY_PARAM_FILES[@]}"; do
  file="${entry%%:*}"
  line="${entry##*:}"
  filepath="/home/z/my-project/$file"
  if [ ! -f "$filepath" ]; then
    echo "⚠️  SKIP: $file"
    continue
  fi
  
  # Replace "async function METHOD() {" with "async function METHOD(request: Request) {"
  if sed -i "s/export async function \(GET\|POST\|PUT\|PATCH\|DELETE\)() {/export async function \1(request: Request) {/g" "$filepath"; then
    echo "✅ Added request param: $file"
  fi
done

echo ""
echo "═══ Done ═══"
