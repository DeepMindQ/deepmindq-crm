#!/usr/bin/env bash
# create-baseline.sh — Capture the current quality state as a golden record
# Usage: ./scripts/create-baseline.sh [--version v2]
#
# This script runs all quality checks and captures the results as a snapshot.
# Future runs of ci-check.sh --diff will compare against this snapshot.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

VERSION="${1:-v1}"
SNAPSHOT_DIR="error-snapshots"
SNAPSHOT_FILE="${SNAPSHOT_DIR}/baseline-${VERSION}.json"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "══════════════════════════════════════════════════════"
echo " Creating Baseline Snapshot: ${VERSION}"
echo " Timestamp: ${TIMESTAMP}"
echo "══════════════════════════════════════════════════════"

# ── 1. TypeScript ──
echo "⏳ [1/7] TypeScript check..."
TSC_OUTPUT=$(npx tsc --noEmit 2>&1)
TSC_EXIT=$?
TSC_ERRORS=$(echo "$TSC_OUTPUT" | grep -c "error TS" || true)

# ── 2. ESLint ──
echo "⏳ [2/7] ESLint check..."
LINT_OUTPUT=$(npm run lint 2>&1)
LINT_EXIT=$?
LINT_ERRORS=$(echo "$LINT_OUTPUT" | grep -oP '\d+ problems \(\K\d+' || echo "0")
LINT_WARNINGS=$(echo "$LINT_OUTPUT" | grep -oP '(\d+ errors).*?(\K\d+) warnings' || echo "0")
GOVERNANCE_STATUS=$(echo "$LINT_OUTPUT" | grep -q "All governance checks PASSED" && echo "PASS" || echo "FAIL")

# ── 3. Tests ──
echo "⏳ [3/7] Test suite..."
TEST_OUTPUT=$(npx vitest run 2>&1)
TEST_EXIT=$?
TEST_TOTAL=$(echo "$TEST_OUTPUT" | grep -oP 'Tests \K\d+' || echo "0")
TEST_PASSED=$(echo "$TEST_OUTPUT" | grep -oP '\K\d+(?= passed)' | tail -1 || echo "0")
TEST_FAILED=$(echo "$TEST_OUTPUT" | grep -oP '\K\d+(?= failed)' | tail -1 || echo "0")

# ── 4. WCAG Audit ──
echo "⏳ [4/7] WCAG audit..."
WCAG_FOCUS=$(rg -c ':focus-visible' src/app/globals.css 2>/dev/null | head -1 | cut -d: -f2 || echo "0")
WCAG_SKIP=$(rg -c 'skip-to-content' src/components/app-shell.tsx 2>/dev/null || echo "0")
WCAG_FORCED=$(rg -c 'forced-colors' src/app/globals.css 2>/dev/null || echo "0")
WCAG_REDUCED=$(rg -c 'prefers-reduced-motion' src/app/globals.css 2>/dev/null || echo "0")
WCAG_ARIA_EXPANDED=$(rg -c 'aria-expanded' src/components/shared/ai-chat-button.tsx 2>/dev/null || echo "0")

SVG_WITHOUT_HIDDEN=$(rg '<svg' src/components/ --type ts -l 2>/dev/null | while read f; do
  svg=$(rg -c '<svg' "$f" 2>/dev/null || echo "0")
  ah=$(rg -c 'aria-hidden' "$f" 2>/dev/null || echo "0")
  if [ "$svg" -gt "$ah" ] 2>/dev/null; then echo "$f"; fi
done | wc -l | tr -d ' ')

TEXT_10PX=$(rg -c 'text-\[10px\]' src/ --type ts -l 2>/dev/null | while read f; do
  count=$(rg -c 'text-\[10px\]' "$f" 2>/dev/null || echo "0")
  echo "$count"
done | paste -sd+ | bc 2>/dev/null || echo "0")

DIV_NO_ROLE=$(rg 'div[^>]*onClick' src/components/ --type ts -n 2>/dev/null | grep -v 'role=' | grep -v 'aria-hidden' | wc -l | tr -d ' ')

# ── 5. Middleware/Proxy ──
echo "⏳ [5/7] Auth proxy check..."
PROXY_EXISTS=$(test -f src/proxy.ts && echo "true" || echo "false")

# ── 6. Build ──
echo "⏳ [6/7] Build check..."
BUILD_OUTPUT=$(npx next build 2>&1)
BUILD_EXIT=$?
BUILD_STATUS=$([ $BUILD_EXIT -eq 0 ] && echo "SUCCESS" || echo "FAIL")

# ── 7. File counts ──
echo "⏳ [7/7] Codebase stats..."
TS_FILES=$(find src -name '*.ts' -not -path '*/node_modules/*' | wc -l | tr -d ' ')
TSX_FILES=$(find src -name '*.tsx' -not -path '*/node_modules/*' | wc -l | tr -d ' ')
TOTAL_FILES=$((TS_FILES + TSX_FILES))

# ── Write snapshot ──
echo "📝 Writing snapshot to ${SNAPSHOT_FILE}..."

mkdir -p "$SNAPSHOT_DIR"

cat > "$SNAPSHOT_FILE" << SNAPSHOT_EOF
{
  "version": "${VERSION}",
  "timestamp": "${TIMESTAMP}",
  "project": "deepmindq",
  "checks": {
    "typescript": {
      "errors": ${TSC_ERRORS},
      "exitCode": ${TSC_EXIT},
      "status": $([ $TSC_EXIT -eq 0 ] && echo '"PASS"' || echo '"FAIL"')
    },
    "eslint": {
      "errors": ${LINT_ERRORS},
      "warnings": ${LINT_WARNINGS},
      "governance": "${GOVERNANCE_STATUS}",
      "exitCode": ${LINT_EXIT},
      "status": $([ $LINT_EXIT -eq 0 ] && echo '"PASS"' || echo '"FAIL"')
    },
    "tests": {
      "total": ${TEST_TOTAL},
      "passed": ${TEST_PASSED},
      "failed": ${TEST_FAILED},
      "exitCode": ${TEST_EXIT},
      "status": $([ $TEST_EXIT -eq 0 ] && echo '"PASS"' || echo '"FAIL"')
    },
    "build": {
      "status": "${BUILD_STATUS}",
      "exitCode": ${BUILD_EXIT}
    },
    "wcag": {
      "focus-visible": {
        "status": $([ "$WCAG_FOCUS" -gt 0 ] && echo '"PASS"' || echo '"FAIL"'),
        "matches": ${WCAG_FOCUS}
      },
      "skip-to-content": {
        "status": $([ "$WCAG_SKIP" -gt 0 ] && echo '"PASS"' || echo '"FAIL"'),
        "matches": ${WCAG_SKIP}
      },
      "forced-colors": {
        "status": $([ "$WCAG_FORCED" -gt 0 ] && echo '"PASS"' || echo '"FAIL"'),
        "matches": ${WCAG_FORCED}
      },
      "prefers-reduced-motion": {
        "status": $([ "$WCAG_REDUCED" -gt 0 ] && echo '"PASS"' || echo '"FAIL"'),
        "matches": ${WCAG_REDUCED}
      },
      "svg-aria-hidden": {
        "status": $([ "$SVG_WITHOUT_HIDDEN" -eq 0 ] && echo '"PASS"' || echo '"FAIL"'),
        "missing": ${SVG_WITHOUT_HIDDEN}
      },
      "text-min-11px": {
        "status": $([ "$TEXT_10PX" -eq 0 ] && echo '"PASS"' || echo '"FAIL"'),
        "violations": ${TEXT_10PX}
      },
      "div-onclick-role": {
        "status": $([ "$DIV_NO_ROLE" -eq 0 ] && echo '"PASS"' || echo '"FAIL"'),
        "violations": ${DIV_NO_ROLE}
      }
    },
    "auth-proxy": {
      "exists": ${PROXY_EXISTS},
      "status": $([ "$PROXY_EXISTS" = "true" ] && echo '"PASS"' || echo '"FAIL"')
    }
  },
  "codebase": {
    "tsFiles": ${TS_FILES},
    "tsxFiles": ${TSX_FILES},
    "totalSourceFiles": ${TOTAL_FILES}
  }
}
SNAPSHOT_EOF

echo ""
echo "✅ Baseline snapshot created: ${SNAPSHOT_FILE}"
echo ""
echo "Summary:"
echo "  TypeScript: ${TSC_ERRORS} errors — $([ $TSC_EXIT -eq 0 ] && echo '✅' || echo '❌')"
echo "  ESLint: ${LINT_ERRORS} errors, ${LINT_WARNINGS} warnings — $([ $LINT_EXIT -eq 0 ] && echo '✅' || echo '❌')"
echo "  Tests: ${TEST_PASSED}/${TEST_TOTAL} passed — $([ $TEST_EXIT -eq 0 ] && echo '✅' || echo '❌')"
echo "  Build: ${BUILD_STATUS} — $([ $BUILD_EXIT -eq 0 ] && echo '✅' || echo '❌')"
echo "  WCAG SVG aria-hidden: ${SVG_WITHOUT_HIDDEN} missing — $([ "$SVG_WITHOUT_HIDDEN" -eq 0 ] && echo '✅' || echo '❌')"
echo "  WCAG text-[10px]: ${TEXT_10PX} violations — $([ "$TEXT_10PX" -eq 0 ] && echo '✅' || echo '❌')"
echo "  Auth proxy: ${PROXY_EXISTS} — $([ "$PROXY_EXISTS" = "true" ] && echo '✅' || echo '❌')"
