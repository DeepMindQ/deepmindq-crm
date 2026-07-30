#!/usr/bin/env bash
# Ticket 3: Governance enforcement validation
# Exit 1 if any violation found

set -e
echo "=== Ticket 3: Governance Enforcement Check ==="

# Check 1: No callLLM imports outside governance layer
echo "Check 1: callLLM imports..."
VIOLATIONS=$(rg "import.*callLLM.*from.*(zai-helpers|llm-client)" src/ --type ts -l | grep -v -E "(ai-governance\.ts|model-router\.ts|llm-client\.ts)" || true)
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

# Check 5: No getZAI imports outside governance layer
echo "Check 5: getZAI imports..."
GETZAI_FILES=$(rg "import.*getZAI.*from" src/ --type ts -l | grep -v -E "(ai-governance\.ts|model-router\.ts|llm-client\.ts)" || true)
if [ -n "$GETZAI_FILES" ]; then
  echo "FAIL: getZAI imported outside governance layer:"
  echo "$GETZAI_FILES"
  exit 1
fi
echo "PASS"

# Check 6: No ModelRouter imports outside governance layer
echo "Check 6: ModelRouter imports..."
# Ticket 3 deep audit: Also catch barrel export pattern '@/lib/engines'
MODELR_FILES=$(rg "import.*ModelRouter.*from" src/ --type ts -l | grep -v -E "(ai-governance\.ts|model-router\.ts|llm-client\.ts)" || true)
# Filter: allowed if from engines/ dir AND file itself is in engines/ or is a governance/test file
if [ -n "$MODELR_FILES" ]; then
  for f in $MODELR_FILES; do
    case "$f" in
      */engines/*) ;; # Engine files importing ModelRouter internally is ok
      */__tests__/*) ;; # Test files are ok
      */governance/check/*) ;; # Governance check endpoint explicitly allowed (health-only)
      *)
        echo "FAIL: ModelRouter imported outside governance/engines layer: $f"
        exit 1
        ;;
    esac
  done
fi
echo "PASS"

# Check 7: Ticket 3 deep audit — No raw fetch() to AI provider APIs
echo "Check 7: Raw fetch() to AI provider APIs..."
AI_FETCH_FILES=""
for HOST in "api.openai.com" "api.groq.com" "generativelanguage.googleapis.com" "api.anthropic.com" "api.deepseek.com" "api.mistral.ai" "api.fireworks.ai" "api.together.xyz" "api.nvidia.com" "openrouter.ai"; do
  FOUND=$(rg "fetch.*$HOST" src/app/ --type ts -l 2>/dev/null | grep -v "ai-governance\.ts" | grep -v "model-router\.ts" | grep -v "llm-client\.ts" || true)
  if [ -n "$FOUND" ]; then
    AI_FETCH_FILES="$AI_FETCH_FILES $FOUND"
  fi
done
if [ -n "$AI_FETCH_FILES" ]; then
  echo "FAIL: Raw fetch() to AI provider API found:"
  echo "$AI_FETCH_FILES" | tr ' ' '\n' | sort -u
  exit 1
fi
echo "PASS"

# Check 8: Ticket 3 deep audit — No callAI imports from llm-client outside governance layer
echo "Check 8: callAI imports from llm-client..."
CALLAI_VIOLATIONS=$(rg "import.*callAI.*from.*llm-client" src/ --type ts -l | grep -v -E "(ai-governance\.ts|model-router\.ts|llm-client\.ts)" || true)
if [ -n "$CALLAI_VIOLATIONS" ]; then
  echo "FAIL: callAI imported from llm-client outside governance layer:"
  echo "$CALLAI_VIOLATIONS"
  exit 1
fi
echo "PASS"

# Check 9: No revenueLLMCall / generateExecutiveSummary / generateEngagementApproach outside governance
echo "Check 9: revenueLLMCall / generateExecutiveSummary / generateEngagementApproach imports..."
REVENUE_VIOLATIONS=""
for FN in "revenueLLMCall" "generateExecutiveSummary" "generateEngagementApproach"; do
  FOUND=$(rg "import.*${FN}.*from.*llm-client" src/ --type ts -l | grep -v -E "(ai-governance\.ts|model-router\.ts|llm-client\.ts)" || true)
  if [ -n "$FOUND" ]; then
    REVENUE_VIOLATIONS="$REVENUE_VIOLATIONS $FOUND"
  fi
done
if [ -n "$REVENUE_VIOLATIONS" ]; then
  echo "FAIL: revenueLLMCall/generateExecutiveSummary/generateEngagementApproach imported outside governance layer:"
  echo "$REVENUE_VIOLATIONS" | tr ' ' '\n' | sort -u
  exit 1
fi
echo "PASS"

echo ""
echo "=== All governance checks PASSED ==="
