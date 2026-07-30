#!/usr/bin/env bash
# Ticket 3: Governance enforcement validation
# Exit 1 if any violation found

set -e
echo "=== Ticket 3: Governance Enforcement Check ==="

# Check 1: No callLLM imports outside governance layer
echo "Check 1: callLLM imports..."
VIOLATIONS=$(rg "import.*callLLM.*from.*zai-helpers" src/ --type ts -l | grep -v -E "(ai-governance\.ts|model-router\.ts|zai-helpers\.ts)" || true)
if [ -n "$VIOLATIONS" ]; then
  echo "FAIL: callLLM imported outside governance layer:"
  echo "$VIOLATIONS"
  exit 1
fi
echo "PASS"

# Check 2: No callChatLLM references (removed function)
echo "Check 2: callChatLLM references..."
CHAT_FILES=$(rg "callChatLLM" src/ --type ts -l 2>/dev/null || true)
if [ -n "$CHAT_FILES" ]; then
  REAL_VIOLATION=""
  for f in $CHAT_FILES; do
    NON_COMMENT=$(rg "callChatLLM" "$f" --type ts -n | grep -E -v "^[[:space:]]*[0-9]+:[[:space:]]*(//|\*)" || true)
    if [ -n "$NON_COMMENT" ]; then
      REAL_VIOLATION="$f"
      break
    fi
  done
  if [ -n "$REAL_VIOLATION" ]; then
    echo "FAIL: callChatLLM found in code (removed in Phase 3): $REAL_VIOLATION"
    exit 1
  fi
fi
echo "PASS"

# Check 3: No direct AI SDK imports
echo "Check 3: Direct AI SDK imports..."
if rg "from ['\"]ai['\"]" src/ --type ts -l -q 2>/dev/null; then
  echo "FAIL: Direct AI SDK import found"
  exit 1
fi
if rg "from ['\"]openai['\"]" src/ --type ts -l -q 2>/dev/null; then
  echo "FAIL: Direct OpenAI SDK import found"
  exit 1
fi
echo "PASS"

# Check 4: callLLM should only be in code in governance layer files
echo "Check 4: callLLM usage locations..."
CALLLLM_FILES=$(rg "\bcallLLM\b" src/ --type ts -l 2>/dev/null || true)
for f in $CALLLLM_FILES; do
  case "$f" in
    *ai-governance.ts|*zai-helpers.ts|*model-router.ts|*llm-client.ts)
      # Governance layer files — always allowed
      ;;
    *)
      # All other files: callLLM must only appear in comments
      if rg "\bcallLLM\b" "$f" --type ts -n 2>/dev/null | grep -E -v ":[[:space:]]*(\*|//)" > /dev/null 2>&1; then
        echo "FAIL: callLLM found in code (not comment) in $f"
        exit 1
      fi
      ;;
  esac
done
echo "PASS"

# Check 5: Ticket 3 — No getZAI imports outside governance layer
echo "Check 5: getZAI imports..."
GETZAI_FILES=$(rg "import.*getZAI.*from" src/ --type ts -l | grep -v -E "(ai-governance\.ts|model-router\.ts|llm-client\.ts)" || true)
if [ -n "$GETZAI_FILES" ]; then
  echo "FAIL: getZAI imported outside governance layer:"
  echo "$GETZAI_FILES"
  exit 1
fi
echo "PASS"

# Check 6: Ticket 3 — No ModelRouter imports outside governance layer
# Allow: engines/* routes (they ARE the engine layer), and health check usage
echo "Check 6: ModelRouter imports..."
MODELR_FILES=$(rg "import.*ModelRouter.*from" src/ --type ts -l | grep -v -E "(ai-governance\.ts|model-router\.ts|/engines/)" || true)
if [ -n "$MODELR_FILES" ]; then
  echo "FAIL: ModelRouter imported outside governance/engines layer:"
  echo "$MODELR_FILES"
  exit 1
fi
echo "PASS"

echo ""
echo "=== All governance checks PASSED ==="
