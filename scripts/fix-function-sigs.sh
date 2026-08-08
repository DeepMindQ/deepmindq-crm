#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
# Fix function signatures that now need `request` parameter
# but don't have it declared.
# ═══════════════════════════════════════════════════════
set -euo pipefail
cd /home/z/my-project

FILES=(
  "src/app/api/ai/cost/route.ts"
  "src/app/api/ai/experiments/[id]/route.ts"
  "src/app/api/ai/experiments/route.ts"
  "src/app/api/ai/freshness/route.ts"
  "src/app/api/ai/governance/dashboard/route.ts"
  "src/app/api/ai/prompt-registry/[id]/route.ts"
  "src/app/api/ai/prompt-registry/route.ts"
  "src/app/api/ai/recommendations/route.ts"
  "src/app/api/ai/relationship-memory/route.ts"
  "src/app/api/ai/advisor/conversation/[id]/route.ts"
  "src/app/api/ai/cache/route.ts"
  "src/app/api/ai/governance/check/route.ts"
  "src/app/api/contacts/[id]/generate-email/route.ts"
  "src/app/api/pipeline/forecast/route.ts"
  "src/app/api/pipeline/health/route.ts"
  "src/app/api/pipeline/route.ts"
  "src/app/api/reports/data-quality/route.ts"
  "src/app/api/reports/team-performance/route.ts"
  "src/app/api/users/route.ts"
  "src/app/api/companies/[id]/brief/route.ts"
  "src/app/api/companies/[id]/alignment/route.ts"
  "src/app/api/companies/[id]/signals/[signalId]/route.ts"
  "src/app/api/companies/[id]/notes/[noteId]/route.ts"
)

for file in "${FILES[@]}"; do
  filepath="/home/z/my-project/$file"
  if [ ! -f "$filepath" ]; then
    echo "⚠️  SKIP (not found): $file"
    continue
  fi

  # Check if this file has functions without request parameter
  # that use checkApiAuth(request)
  
  # Pattern: export async function GET() { or export async function POST() {
  # Need to add request: Request parameter
  
  # Use sed to add request parameter to functions missing it
  # Pattern: export async function METHOD( { → export async function METHOD(request: Request, {
  
  # Also fix: export async function METHOD(  { → export async function METHOD(request: Request) {
  
  # Generic approach: find exported async functions that have empty or no params
  # and add request: Request
  
  # First, check if the file has functions that need fixing
  if rg -q "export async function (GET|POST|PUT|PATCH|DELETE)\(\s*\{" "$filepath" 2>/dev/null; then
    # Add request: Request parameter
    sed -i 's/export async function \(GET\|POST\|PUT\|PATCH\|DELETE\)(\s*{/export async function \1(request: Request) {/g' "$filepath"
    echo "✅ Fixed function signature: $file"
  elif rg -q "export async function (GET|POST|PUT|PATCH|DELETE)() {" "$filepath" 2>/dev/null; then
    sed -i 's/export async function \(GET\|POST\|PUT\|PATCH\|DELETE\)() {/export async function \1(request: Request) {/g' "$filepath"
    echo "✅ Fixed function signature: $file"
  else
    echo "⏭️  Already has request param: $file"
  fi
done

echo ""
echo "═══ Done ═══"
