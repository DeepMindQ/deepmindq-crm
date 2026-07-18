#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# GOVERNANCE BUILD-TIME GUARD (Phase 3 Freeze)
# ═══════════════════════════════════════════════════════════════════════════════
#
# This script enforces the architecture rule:
#   "No AI route, module, or future engine may directly access LLM primitives.
#    All AI execution must flow through the governance layer (ai-governance.ts)."
#
# USAGE:
#   ./scripts/check-governance.sh          # run locally
#   Add to package.json "lint" or CI pipeline
#
# RULES ENFORCED:
#   1. callLLM( must NOT appear in src/app/api/ routes
#   2. callChatLLM( must NOT appear anywhere in src/ (removed entirely)
#   3. Direct OpenAI/Anthropic/@ai-sdk/@google SDK imports are forbidden
#   4. Direct fetch to AI provider APIs (api.openai.com, api.anthropic.com) is forbidden
#   5. callLLM( in src/lib/ is allowed ONLY in ai-governance.ts
#
# EXIT CODES:
#   0 = all checks passed
#   1 = governance violation detected
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

ERRORS=0
SRC_DIR="src"
GOVERNANCE_FILE="src/lib/ai-governance.ts"
PRIMITIVE_FILE="src/lib/zai-helpers.ts"  # definition of callLLM — allowed

echo "============================================"
echo " Phase 3 Governance Build-Time Guard"
echo "============================================"
echo ""

# ── CHECK 1: No callLLM() in API routes ──
echo "[1/5] Checking: callLLM() must not appear in API routes..."

ROUTES_VIOLATIONS=$(rg "callLLM\(" "$SRC_DIR/app/api/" --files-with-matches 2>/dev/null || true)
if [ -n "$ROUTES_VIOLATIONS" ]; then
  echo "  FAIL: callLLM() found in API routes:"
  echo "$ROUTES_VIOLATIONS" | while read -r line; do echo "    - $line"; done
  ERRORS=$((ERRORS + 1))
else
  echo "  PASS"
fi

# ── CHECK 2: No callChatLLM() anywhere in src/ ──
echo "[2/5] Checking: callChatLLM() must not exist anywhere in src/..."

CHAT_VIOLATIONS=$(rg "callChatLLM\(" "$SRC_DIR/" --files-with-matches 2>/dev/null || true)
if [ -n "$CHAT_VIOLATIONS" ]; then
  echo "  FAIL: callChatLLM() found in:"
  echo "$CHAT_VIOLATIONS" | while read -r line; do echo "    - $line"; done
  ERRORS=$((ERRORS + 1))
else
  echo "  PASS"
fi

# ── CHECK 3: No third-party AI SDK imports ──
echo "[3/5] Checking: No direct OpenAI/Anthropic/@ai-sdk/@google imports..."

SDK_VIOLATIONS=$(rg "from ['\"]openai['\"]|from ['\"]@anthropic|from ['\"]@ai-sdk|from ['\"]@google/generative" "$SRC_DIR/" --files-with-matches 2>/dev/null || true)
if [ -n "$SDK_VIOLATIONS" ]; then
  echo "  FAIL: Third-party AI SDK imports found in:"
  echo "$SDK_VIOLATIONS" | while read -r line; do echo "    - $line"; done
  ERRORS=$((ERRORS + 1))
else
  echo "  PASS"
fi

# ── CHECK 4: No direct fetch to AI provider APIs ──
echo "[4/5] Checking: No direct fetch to AI provider endpoints..."

FETCH_VIOLATIONS=$(rg "fetch\(" "$SRC_DIR/" --files-with-matches | xargs rg "api\.(openai|anthropic|google)\.com" --files-with-matches 2>/dev/null || true)
if [ -n "$FETCH_VIOLATIONS" ]; then
  echo "  FAIL: Direct AI API fetch calls found in:"
  echo "$FETCH_VIOLATIONS" | while read -r line; do echo "    - $line"; done
  ERRORS=$((ERRORS + 1))
else
  echo "  PASS"
fi

# ── CHECK 5: callLLM() in src/lib/ allowed ONLY in ai-governance.ts ──
echo "[5/5] Checking: callLLM() in src/lib/ allowed ONLY in ai-governance.ts..."

LIB_VIOLATIONS=$(rg "callLLM\(" "$SRC_DIR/lib/" --files-with-matches 2>/dev/null | grep -v "$GOVERNANCE_FILE" | grep -v "$PRIMITIVE_FILE" || true)
if [ -n "$LIB_VIOLATIONS" ]; then
  echo "  FAIL: callLLM() found in lib files outside governance layer:"
  echo "$LIB_VIOLATIONS" | while read -r line; do echo "    - $line"; done
  ERRORS=$((ERRORS + 1))
else
  echo "  PASS"
fi

echo ""
echo "============================================"
if [ "$ERRORS" -gt 0 ]; then
  echo " RESULT: FAILED ($ERRORS violation(s) found)"
  echo " Fix the violations above before merging."
  echo "============================================"
  exit 1
else
  echo " RESULT: ALL CHECKS PASSED"
  echo "============================================"
  exit 0
fi