#!/usr/bin/env bash
# Phase 4 A2: Governance enforcement validation
# Exit 1 if any violation found

set -e
echo "=== Phase 4 A2: Governance Enforcement Check ==="

# Check 1: No callLLM imports outside ai-governance.ts
echo "Check 1: callLLM imports..."
VIOLATIONS=$(rg "import.*callLLM.*from.*zai-helpers" src/ --type ts -l | grep -v "ai-governance.ts" || true)
if [ -n "$VIOLATIONS" ]; then
  echo "FAIL: callLLM imported outside governance layer:"
  echo "$VIOLATIONS"
  exit 1
fi
echo "PASS"

# Check 2: No callChatLLM references (removed function)
# Allow comment-only references in zai-helpers.ts (removal documentation)
echo "Check 2: callChatLLM references..."
CHAT_FILES=$(rg "callChatLLM" src/ --type ts -l 2>/dev/null || true)
if [ -n "$CHAT_FILES" ]; then
  # Filter out files where callChatLLM only appears in comments
  REAL_VIOLATION=""
  for f in $CHAT_FILES; do
    # Check if there are any non-comment lines containing callChatLLM
    NON_COMMENT=$(rg "callChatLLM" "$f" --type ts -n | grep -E -v "^[[:space:]]*[0-9]+:[[:space:]]*//" || true)
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

# Check 4: callLLM should only be in code in ai-governance.ts / zai-helpers.ts
# Comment-only references are allowed anywhere (governance docs, reminders, etc.)
echo "Check 4: callLLM usage locations..."
CALLLLM_FILES=$(rg "\bcallLLM\b" src/ --type ts -l 2>/dev/null || true)
for f in $CALLLLM_FILES; do
  case "$f" in
    *ai-governance.ts|*zai-helpers.ts)
      # These files may have actual code usage — always allowed
      ;;
    *)
      # All other files: callLLM must only appear in comments
      if rg "\bcallLLM\b" "$f" --type ts -n 2>/dev/null | grep -E -q -v "^[[:space:]]*[0-9]+:[[:space:]]*//"; then
        echo "FAIL: callLLM found in code (not comment) in $f"
        exit 1
      fi
      ;;
  esac
done
echo "PASS"

echo ""
echo "=== All governance checks PASSED ==="