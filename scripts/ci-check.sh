#!/usr/bin/env bash
# ci-check.sh — One-command quality verification (60 seconds)
#
# Usage:
#   ./scripts/ci-check.sh              # Full check, fail on any error
#   ./scripts/ci-check.sh --quick      # Fast (tsc + lint only, ~10s)
#   ./scripts/ci-check.sh --diff       # Compare against baseline, fail on regressions
#   ./scripts/ci-check.sh --json       # Output JSON for CI parsing
#
# Exit codes:
#   0 = ALL PASS
#   1 = One or more checks FAILED
#   2 = REGRESSION detected (errors increased vs baseline)

set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

MODE="full"
OUTPUT_FORMAT="text"
BASELINE_FILE="error-snapshots/baseline-v1.json"

# Parse args
for arg in "$@"; do
  case $arg in
    --quick) MODE="quick" ;;
    --diff)  MODE="diff" ;;
    --json)  OUTPUT_FORMAT="json" ;;
    --snapshot) MODE="snapshot" ;;
  esac
done

# ── Colors ──
RED=$'\033[31m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
BLUE=$'\033[34m'
RESET=$'\033[0m'

if [ "$OUTPUT_FORMAT" = "text" ]; then
  echo "══════════════════════════════════════════════════════"
  echo " DeepMindQ Quality Check — $(date -u +"%Y-%m-%d %H:%M:%SZ")"
  echo " Mode: ${MODE}"
  echo "══════════════════════════════════════════════════════"
fi

FAILURES=0
RESULTS=""

run_check() {
  local name="$1"
  local cmd="$2"
  local expected_exit="$3"
  
  if [ "$OUTPUT_FORMAT" = "text" ]; then
    echo "⏳ [${name}] Running..."
  fi
  
  local output exit_code
  output=$(eval "$cmd" 2>&1)
  exit_code=$?
  
  if [ "$exit_code" -eq "$expected_exit" ]; then
    if [ "$OUTPUT_FORMAT" = "text" ]; then
      echo "✅ [${name}] PASS (exit ${exit_code})"
    fi
    RESULTS="${RESULTS}\"${name}\":{\"status\":\"PASS\",\"exitCode\":${exit_code}},"
  else
    if [ "$OUTPUT_FORMAT" = "text" ]; then
      echo "❌ [${name}] FAIL (exit ${exit_code})"
      echo "$output" | tail -20 | sed 's/^/    /'
    fi
    RESULTS="${RESULTS}\"${name}\":{\"status\":\"FAIL\",\"exitCode\":${exit_code}},"
    FAILURES=$((FAILURES + 1))
  fi
}

# ── 1. TypeScript ──
TSC_CMD="npx tsc --noEmit"
run_check "typescript" "$TSC_CMD" 0

# ── 2. ESLint + Governance ──
LINT_CMD="npm run lint"
run_check "eslint" "$LINT_CMD" 0

if [ "$MODE" = "quick" ]; then
  if [ "$OUTPUT_FORMAT" = "json" ]; then
    echo "{\"checks\":{${RESULTS%,}},\"failures\":${FAILURES}}"
  else
    echo ""
    if [ "$FAILURES" -eq 0 ]; then
      echo "${GREEN}══════════════════════════════════════════════════════"
      echo " ✅ QUICK CHECK PASSED — tsc + lint clean"
      echo "══════════════════════════════════════════════════════${RESET}"
    else
      echo "${RED}══════════════════════════════════════════════════════"
      echo " ❌ QUICK CHECK FAILED — ${FAILURES} failures"
      echo "══════════════════════════════════════════════════════${RESET}"
    fi
  fi
  exit $([ $FAILURES -eq 0 ] && echo 0 || echo 1)
fi

# ── 3. Tests ──
TEST_CMD="npx vitest run"
run_check "tests" "$TEST_CMD" 0

# ── 4. Build ──
BUILD_CMD="npx next build"
run_check "build" "$BUILD_CMD" 0

# ── 5. WCAG Quick Grep Audit ──
run_wcag_check() {
  local check_name="$1"
  local pattern="$2"
  local min_matches="$3"
  local scope="$4"
  
  if [ "$OUTPUT_FORMAT" = "text" ]; then
    echo "⏳ [wcag:${check_name}] Running..."
  fi
  
  local matches
  matches=$(rg -c "$pattern" "$scope" 2>/dev/null | awk -F: '{sum+=$2} END {print sum+0}')
  
  if [ "$matches" -ge "$min_matches" ]; then
    if [ "$OUTPUT_FORMAT" = "text" ]; then
      echo "✅ [wcag:${check_name}] PASS (${matches} matches)"
    fi
    RESULTS="${RESULTS}\"wcag:${check_name}\":{\"status\":\"PASS\",\"matches\":${matches}},"
  else
    if [ "$OUTPUT_FORMAT" = "text" ]; then
      echo "❌ [wcag:${check_name}] FAIL (${matches} matches, need ${min_matches})"
    fi
    RESULTS="${RESULTS}\"wcag:${check_name}\":{\"status\":\"FAIL\",\"matches\":${matches}},"
    FAILURES=$((FAILURES + 1))
  fi
}

run_wcag_check "focus-visible" ":focus-visible" 1 "src/app/globals.css"
run_wcag_check "skip-to-content" "skip-to-content" 1 "src/components/app-shell.tsx"
run_wcag_check "forced-colors" "forced-colors" 1 "src/app/globals.css"
run_wcag_check "prefers-reduced-motion" "prefers-reduced-motion" 1 "src/app/globals.css"

# ── 6. Auth Proxy ──
if [ "$OUTPUT_FORMAT" = "text" ]; then
  echo "⏳ [auth-proxy] Running..."
fi
if [ -f "src/proxy.ts" ]; then
  if [ "$OUTPUT_FORMAT" = "text" ]; then
    echo "✅ [auth-proxy] PASS (proxy.ts exists)"
  fi
  RESULTS="${RESULTS}\"auth-proxy\":{\"status\":\"PASS\"},"
else
  if [ "$OUTPUT_FORMAT" = "text" ]; then
    echo "❌ [auth-proxy] FAIL (proxy.ts missing)"
  fi
  RESULTS="${RESULTS}\"auth-proxy\":{\"status\":\"FAIL\"},"
  FAILURES=$((FAILURES + 1))
fi

# ── Diff Mode: Compare Against Baseline ──
if [ "$MODE" = "diff" ] && [ -f "$BASELINE_FILE" ]; then
  if [ "$OUTPUT_FORMAT" = "text" ]; then
    echo ""
    echo "${BLUE}══════════════════════════════════════════════════════"
    echo " Comparing against baseline: $BASELINE_FILE"
    echo "══════════════════════════════════════════════════════${RESET}"
  fi
  
  BASELINE_TSC=$(jq -r '.checks.typescript.errors' "$BASELINE_FILE" 2>/dev/null || echo "0")
  BASELINE_LINT=$(jq -r '.checks.eslint.errors' "$BASELINE_FILE" 2>/dev/null || echo "0")
  BASELINE_TEST_FAIL=$(jq -r '.checks.tests.failed' "$BASELINE_FILE" 2>/dev/null || echo "0")
  
  # If baseline says 0 errors and we have failures, that's a regression
  if [ "$FAILURES" -gt 0 ] && [ "$BASELINE_TSC" = "0" ] && [ "$BASELINE_LINT" = "0" ] && [ "$BASELINE_TEST_FAIL" = "0" ]; then
    if [ "$OUTPUT_FORMAT" = "text" ]; then
      echo "${RED}❌ REGRESSION DETECTED — baseline was 100% clean, now ${FAILURES} failures${RESET}"
    fi
    exit 2
  fi
fi

# ── Final Report ──
if [ "$OUTPUT_FORMAT" = "json" ]; then
  echo "{\"checks\":{${RESULTS%,}},\"failures\":${FAILURES}}"
else
  echo ""
  if [ "$FAILURES" -eq 0 ]; then
    echo "${GREEN}══════════════════════════════════════════════════════"
    echo " ✅ ALL CHECKS PASSED — zero failures"
    echo "══════════════════════════════════════════════════════${RESET}"
  else
    echo "${RED}══════════════════════════════════════════════════════"
    echo " ❌ ${FAILURES} CHECK(S) FAILED"
    echo "══════════════════════════════════════════════════════${RESET}"
  fi
fi

exit $([ $FAILURES -eq 0 ] && echo 0 || echo 1)
