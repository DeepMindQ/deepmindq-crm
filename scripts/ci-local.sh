#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# ci-local.sh — Local CI Mirror
#
# Reproduces the EXACT same validation path as GitHub Actions CI.
# If this script exits 0, GitHub CI should pass.
# If this script exits non-zero, fix locally before pushing.
#
# Usage:
#   ./scripts/ci-local.sh           # Full blocking job suite
#   ./scripts/ci-local.sh --quick   # Skip build job
#   ./scripts/ci-local.sh --job N   # Run only job N (1-11)
#
# This is the single source of truth for local pre-push verification.
# ═══════════════════════════════════════════════════════════════

set -uo pipefail

# ── Configuration (mirrors .github/workflows/ci.yml) ──
export CI="true"
export NODE_OPTIONS="--max-old-space-size=2048"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Timing
TOTAL_START=$(date +%s)
JOBS_RUN=0
JOBS_PASSED=0
JOBS_FAILED=0

# Parse arguments
QUICK_MODE=false
SINGLE_JOB=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --quick)   QUICK_MODE=true; shift ;;
    --job)     SINGLE_JOB="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: ci-local.sh [--quick] [--job N]"
      echo ""
      echo "  --quick   Skip build job"
      echo "  --job N   Run only job N (1-11)"
      echo ""
      echo "Jobs:"
      echo "  1  Security Gate"
      echo "  2  Dependency Audit"
      echo "  3  API Security Contract"
      echo "  4  CI Path Safety Check"
      echo "  5  Lint + Typecheck"
      echo "  6  Unit Tests"
      echo "  7  Security Tests"
      echo "  8  API Tests (requires PostgreSQL)"
      echo "   9  Database Tests (requires PostgreSQL)"
      echo " 10 Integration Tests"
      echo " 11 Build Verification"
      exit 0
      ;;
    *) shift ;;
  esac
done

# ── Helper: Print job header ──
print_job() {
  local job_num="$1"
  local name="$2"

  # Skip if single job mode and this isn't it
  if [ -n "$SINGLE_JOB" ] && [ "$SINGLE_JOB" != "$job_num" ]; then
    return 0
  fi

  JOBS_RUN=$((JOBS_RUN + 1))
  echo ""
  _JOB_START=$(date +%s)
  echo -e "${CYAN}━━━ [$job_num/11] $name ━━━${NC}"
}

# ── Helper: Print job result ──
# Must be called immediately after the job command exits
print_result() {
  local exit_code=${1:-0}
  local elapsed=$(( $(date +%s) - ${_JOB_START:-$(date +%s)} ))

  if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}  ✅ PASSED${NC} (${elapsed}s)"
    JOBS_PASSED=$((JOBS_PASSED + 1))
  else
    echo -e "${RED}  ❌ FAILED${NC} (exit code $exit_code, ${elapsed}s)"
    JOBS_FAILED=$((JOBS_FAILED + 1))
  fi

  return $exit_code
}

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  DeepMindQ — Local CI Mirror                     ║${NC}"
echo -e "${CYAN}║  Mirrors: .github/workflows/ci.yml (blocking jobs) ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════
# JOB 1: SECURITY GATE
# ═════════════════════════════════════════════════════════════
print_job "1" "Security Gate"

npx vitest run --config vitest.security.config.ts 2>&1 | tail -8
print_result $?

# Static security checks (mirrors CI steps 7-14)
FAIL=0
if [ ! -f "src/proxy.ts" ]; then echo "FAIL: src/proxy.ts missing"; FAIL=1; fi
for f in src/lib/csrf.ts src/proxy.ts src/lib/fetchApi.ts src/lib/auth-helpers.ts; do
  if [ ! -f "$f" ]; then echo "FAIL: $f missing"; FAIL=1; fi
done
grep -q "generateCsrfToken" src/lib/csrf.ts || { echo "FAIL: CSRF gen missing"; FAIL=1; }
grep -q "timingSafeEqual" src/lib/csrf.ts || { echo "FAIL: CSRF timing missing"; FAIL=1; }
grep -q "validateCsrf" src/proxy.ts || { echo "FAIL: Proxy CSRF missing"; FAIL=1; }
grep -q "x-csrf-token" src/lib/fetchApi.ts || { echo "FAIL: fetchApi CSRF missing"; FAIL=1; }
grep -q "validateCsrf" src/lib/auth-helpers.ts || { echo "FAIL: auth-helpers CSRF missing"; FAIL=1; }

for route in src/app/api/ai/*/route.ts src/app/api/ai/*/*/route.ts; do
  if [ -f "$route" ] && ! grep -q "checkApiAuth" "$route"; then
    echo "FAIL: $route has no auth guard"; FAIL=1
  fi
done

for header in X-Content-Type-Options X-Frame-Options Strict-Transport-Security Content-Security-Policy Referrer-Policy; do
  grep -q "$header" src/lib/auth-helpers.ts || { echo "FAIL: $header missing"; FAIL=1; }
done

grep -q "isomorphic-dompurify" src/lib/sanitize.ts || { echo "FAIL: DOMPurify missing"; FAIL=1; }
grep -q "/api/auth/me" src/providers/auth-provider.tsx || { echo "FAIL: AuthProvider session check missing"; FAIL=1; }
grep -q "window.location.href" src/providers/auth-provider.tsx || { echo "FAIL: AuthProvider redirect missing"; FAIL=1; }
grep -q "API_KEY_ENCRYPTION_KEY" src/lib/validate-env.ts || { echo "FAIL: validate-env encryption key missing"; FAIL=1; }
grep -q "PLAINTEXT" src/lib/validate-env.ts || { echo "FAIL: validate-env plaintext warning missing"; FAIL=1; }

if [ "$FAIL" -ne 0 ]; then print_result 1; exit 1; fi
print_result 0

# ═══════════════════════════════════════════════════════════════
# JOB 2: DEPENDENCY AUDIT
# ═════════════════════════════════════════════════════════════
print_job "2" "Dependency Audit"
node scripts/dependency-audit-ci.js
print_result $?

# ═══════════════════════════════════════════════════════════════════
# JOB 3: API SECURITY CONTRACT
# ═══════════════════════════════════════════════════════════════
print_job "3" "API Security Contract"
node scripts/api-security-scan.js
print_result $?

# ═══════════════════════════════════════════════════════════════════
# JOB 4: CI PATH SAFETY CHECK
# ═══════════════════════════════════════════════════════════════
print_job "4" "CI Path Safety Check"
node scripts/no-hardcoded-paths.js
print_result $?

# ═════════════════════════════════════════════════════════════════════
# JOB 5: LINT + TYPECHECK
# ═══════════════════════════════════════════════════════════════
print_job "5" "Lint + Typecheck"
npm run lint && npx tsc --noEmit
print_result $?

# ═══════════════════════════════════════════════════════════════════
# JOB 6: UNIT TESTS
# ═════════════════════════════════════════════════════════════════
print_job "6" "Unit Tests"
npx vitest run --config vitest.unit.config.ts 2>&1 | tee /tmp/vitest-local-unit.txt
VEXIT=${PIPESTATUS[0]}
if grep -q "Test Files.*failed" /tmp/vitest-local-unit.txt 2>/dev/null; then
  echo "FAIL: Unit test files failed"; print_result 1; exit 1
fi
if grep -q "Tests .*failed" /tmp/vitest-local-unit.txt 2>/dev/null; then
  echo "FAIL: Unit tests failed"; print_result 1; exit 1
fi
print_result 0

# ═════════════════════════════════════════════════════════════════════
# JOB 7: SECURITY TESTS
# ═══════════════════════════════════════════════════════════════
print_job "7" "Security Tests"
npx vitest run --config vitest.security.config.ts
print_result $?

# ══════════════════════════════════════════════════════════════════════
# JOB 8: API TESTS (requires PostgreSQL)
# ═════════════════════════════════════════════════════════════
print_job "8" "API Tests (PostgreSQL)"
if ! command -v pg_isready &>/dev/null || ! pg_isready -h localhost -p 5432 -t 2 &>/dev/null; then
  echo -e "${YELLOW}  ⚠ SKIPPED: PostgreSQL not available locally${NC}"
  echo "  CI runs this with a PostgreSQL service container."
  echo "  To run locally: start PostgreSQL and set DATABASE_URL"
else
  npx vitest run --config vitest.api.config.ts
fi
print_result $?

# ══════════════════════════════════════════════════════════════════════
# JOB 9: DATABASE TESTS (requires PostgreSQL)
# ═════════════════════════════════════════════════════════════
print_job "9" "Database Tests (PostgreSQL)"
if ! command -v pg_isready &>/dev/null || ! pg_isready -h localhost -p 5432 -t 2 &>/dev/null; then
  echo -e "${YELLOW}  ⚠ SKIPPED: PostgreSQL not available locally${NC}"
  echo "  CI runs this with a PostgreSQL service container."
  echo "  To run locally: start PostgreSQL and set DATABASE_URL"
else
  npx vitest run --config vitest.database.config.ts
fi
print_result $?

# ════════════════════════════════════════════════════════════════════
# JOB 10: INTEGRATION TESTS
# ═════════════════════════════════════════════════════════════
print_job "10" "Integration Tests"
npx vitest run --config vitest.integration.config.ts
print_result $?

# ════════════════════════════════════════════════════════════════════
# JOB 11: BUILD VERIFICATION
# Skipped in --quick mode
# ═════════════════════════════════════════════════════════════════
if [ "$QUICK_MODE" = true ]; then
  echo ""
  echo -e "${YELLOW}━━━ [11/11] Build Verification — SKIPPED (--quick mode) ━━━${NC}"
else
  print_job "11" "Build Verification"
  export NODE_OPTIONS="--max-old-space-size=4096"
  npm run build:vercel
  print_result $?
fi

# ═════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════
TOTAL_END=$(date +%s)
TOTAL_ELAPSED=$(( TOTAL_END - TOTAL_START ))

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  CI LOCAL MIRROR — RESULTS                       ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Jobs run:    $JOBS_RUN"
echo -e "  Passed:      ${GREEN}$JOBS_PASSED${NC}"
echo -e "  Failed:      ${RED}$JOBS_FAILED${NC}"
echo "  Duration:    ${TOTAL_ELAPSED}s"
echo ""

if [ $JOBS_FAILED -gt 0 ]; then
  echo -e "${RED}  ❌ CI MIRROR FAILED — Do not push. Fix failures above.${NC}"
  exit 1
else
  echo -e "${GREEN}  ✅ CI MIRROR PASSED — Safe to push to GitHub.${NC}"
  exit 0
fi
