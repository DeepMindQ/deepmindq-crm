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

# CI DATABASE_URL (mirrors GitHub Actions service container)
export DATABASE_URL="postgresql://ci_test:ci_test_pass@localhost:5432/ci_test"
export DIRECT_DATABASE_URL="${DATABASE_URL}"

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
JOBS_SKIPPED=0

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

# ── Helper: Check if current job should run ──
should_run_job() {
  local job_num="$1"
  if [ -n "$SINGLE_JOB" ] && [ "$SINGLE_JOB" != "$job_num" ]; then
    return 1  # Skip this job
  fi
  return 0  # Run this job
}

# ── Helper: Print job header (only if job should run) ──
print_job() {
  local job_num="$1"
  local name="$2"

  if ! should_run_job "$job_num"; then
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

  # If job was not run (SINGLE_JOB mismatch), skip result
  if [ -n "$SINGLE_JOB" ] && [ $JOBS_RUN -eq 0 ]; then
    return $exit_code
  fi

  if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}  ✅ PASSED${NC} (${elapsed}s)"
    JOBS_PASSED=$((JOBS_PASSED + 1))
  else
    echo -e "${RED}  ❌ FAILED${NC} (exit code $exit_code, ${elapsed}s)"
    JOBS_FAILED=$((JOBS_FAILED + 1))
  fi

  return $exit_code
}

# ── Prerequisites ──
if ! command -v npx &>/dev/null; then
  echo "ERROR: npx not found. Install Node.js first."
  exit 1
fi

# Ensure Prisma client is generated (mirrors every CI job's `npx prisma generate`)
npx prisma generate --quiet 2>/dev/null

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  DeepMindQ — Local CI Mirror                     ║${NC}"
echo -e "${CYAN}║  Mirrors: .github/workflows/ci.yml (blocking jobs) ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════
# JOB 1: SECURITY GATE
# Mirrors: .github/workflows/ci.yml → job: security-gate
# ═══════════════════════════════════════════════════════════════
_JOB1_FAIL=0
print_job "1" "Security Gate"
if should_run_job "1"; then
  npx vitest run --config vitest.security.config.ts
  VEXIT=$?
  if [ $VEXIT -ne 0 ]; then _JOB1_FAIL=1; fi

  # Static security checks (mirrors CI steps — exact match with ci.yml)
  FAIL=0

  # Verify edge proxy exists (CI step: Verify edge proxy exists)
  if [ ! -f "src/proxy.ts" ]; then echo "FAIL: src/proxy.ts missing"; FAIL=1; fi

  # Verify CSRF flow integrity (CI step: Verify CSRF flow integrity)
  for f in src/lib/csrf.ts src/proxy.ts src/lib/fetchApi.ts src/lib/auth-helpers.ts; do
    if [ ! -f "$f" ]; then echo "FAIL: $f missing"; FAIL=1; fi
  done
  grep -q "generateCsrfToken" src/lib/csrf.ts || { echo "FAIL: CSRF gen missing"; FAIL=1; }
  grep -q "timingSafeEqual" src/lib/csrf.ts || { echo "FAIL: CSRF timing missing"; FAIL=1; }
  grep -q "validateCsrf" src/proxy.ts || { echo "FAIL: Proxy CSRF missing"; FAIL=1; }
  grep -q "x-csrf-token" src/lib/fetchApi.ts || { echo "FAIL: fetchApi CSRF missing"; FAIL=1; }
  grep -q "validateCsrf" src/lib/auth-helpers.ts || { echo "FAIL: auth-helpers CSRF missing"; FAIL=1; }

  # Verify AI route authentication (CI step: Verify AI route authentication)
  for route in src/app/api/ai/*/route.ts src/app/api/ai/*/*/route.ts; do
    if [ -f "$route" ] && ! grep -q "checkApiAuth" "$route"; then
      echo "FAIL: $route has no auth guard"; FAIL=1
    fi
  done

  # Verify security headers (CI step: Verify security headers)
  for header in X-Content-Type-Options X-Frame-Options Strict-Transport-Security Content-Security-Policy Referrer-Policy; do
    grep -q "$header" src/lib/auth-helpers.ts || { echo "FAIL: $header missing"; FAIL=1; }
  done

  # Verify DOMPurify (CI step: Verify DOMPurify)
  grep -q "isomorphic-dompurify" src/lib/sanitize.ts || { echo "FAIL: DOMPurify missing"; FAIL=1; }

  # Verify CSP policy (CI step: Verify CSP policy — unsafe-inline ban)
  if grep -q "unsafe-inline" src/lib/auth-helpers.ts; then
    SCRIPT_LINE=$(grep "script-src" src/lib/auth-helpers.ts | grep -v "unsafe-eval")
    if echo "$SCRIPT_LINE" | grep -q "unsafe-inline"; then
      echo "FAIL: unsafe-inline in script-src"; FAIL=1
    fi
  fi

  # Verify AuthProvider session (CI step: Verify AuthProvider session)
  grep -q "/api/auth/me" src/providers/auth-provider.tsx || { echo "FAIL: AuthProvider session check missing"; FAIL=1; }
  grep -q "window.location.href" src/providers/auth-provider.tsx || { echo "FAIL: AuthProvider redirect missing"; FAIL=1; }

  # Verify environment validation (CI step: Verify environment validation)
  grep -q "API_KEY_ENCRYPTION_KEY" src/lib/validate-env.ts || { echo "FAIL: validate-env encryption key missing"; FAIL=1; }
  grep -q "PLAINTEXT" src/lib/validate-env.ts || { echo "FAIL: validate-env plaintext warning missing"; FAIL=1; }
  grep -q "throw new Error" src/lib/validate-env.ts || { echo "FAIL: validate-env throw missing"; FAIL=1; }

  if [ "$_JOB1_FAIL" -ne 0 ] || [ "$FAIL" -ne 0 ]; then
    print_result 1
    exit 1
  fi
  print_result 0
fi

# ═══════════════════════════════════════════════════════════════
# JOB 2: DEPENDENCY AUDIT
# Mirrors: .github/workflows/ci.yml → job: dependency-audit
# ═══════════════════════════════════════════════════════════════
print_job "2" "Dependency Audit"
if should_run_job "2"; then
  node scripts/dependency-audit-ci.js
  print_result $?
fi

# ═══════════════════════════════════════════════════════════════════
# JOB 3: API SECURITY CONTRACT
# Mirrors: .github/workflows/ci.yml → job: api-security-contract
# ═══════════════════════════════════════════════════════════════
print_job "3" "API Security Contract"
if should_run_job "3"; then
  node scripts/api-security-scan.js
  print_result $?
fi

# ═══════════════════════════════════════════════════════════════════
# JOB 4: CI PATH SAFETY CHECK
# Mirrors: .github/workflows/ci.yml → job: ci-path-check
# ═══════════════════════════════════════════════════════════════
print_job "4" "CI Path Safety Check"
if should_run_job "4"; then
  node scripts/no-hardcoded-paths.js
  print_result $?
fi

# ═══════════════════════════════════════════════════════════════════
# JOB 5: LINT + TYPECHECK
# Mirrors: .github/workflows/ci.yml → job: lint-and-typecheck
# ═══════════════════════════════════════════════════════════════
print_job "5" "Lint + Typecheck"
if should_run_job "5"; then
  npm run lint && npx tsc --noEmit
  print_result $?
fi

# ═══════════════════════════════════════════════════════════════════
# JOB 6: UNIT TESTS
# Mirrors: .github/workflows/ci.yml → job: test-unit
# ═══════════════════════════════════════════════════════════════
print_job "6" "Unit Tests"
if should_run_job "6"; then
  npx vitest run --config vitest.unit.config.ts 2>&1 | tee /tmp/vitest-local-unit.txt
  VEXIT=${PIPESTATUS[0]}
  if grep -q "Test Files.*failed" /tmp/vitest-local-unit.txt 2>/dev/null; then
    echo "FAIL: Unit test files failed"; print_result 1; exit 1
  fi
  if grep -q "Tests .*failed" /tmp/vitest-local-unit.txt 2>/dev/null; then
    echo "FAIL: Unit tests failed"; print_result 1; exit 1
  fi
  print_result 0
fi

# ═════════════════════════════════════════════════════════════════════
# JOB 7: SECURITY TESTS
# Mirrors: .github/workflows/ci.yml → job: test-security
# ═══════════════════════════════════════════════════════════════
print_job "7" "Security Tests"
if should_run_job "7"; then
  npx vitest run --config vitest.security.config.ts
  print_result $?
fi

# ════════════════════════════════════════════════════════════════════
# JOB 8: API TESTS (requires PostgreSQL)
# Mirrors: .github/workflows/ci.yml → job: test-api
# ═════════════════════════════════════════════════════════════
print_job "8" "API Tests (PostgreSQL)"
if should_run_job "8"; then
  if ! command -v pg_isready &>/dev/null || ! pg_isready -h localhost -p 5432 -t 2 &>/dev/null; then
    echo -e "${YELLOW}  ⚠ SKIPPED: PostgreSQL not available locally${NC}"
    echo "  CI runs this with a PostgreSQL service container."
    echo "  To run locally: docker run -d -p 5432:5432 -e POSTGRES_USER=ci_test -e POSTGRES_PASSWORD=ci_test_pass -e POSTGRES_DB=ci_test postgres:16-alpine"
    JOBS_SKIPPED=$((JOBS_SKIPPED + 1))
    print_result 0
  else
    npx prisma migrate deploy 2>&1 | tail -3
    npx tsx scripts/seed-ci.ts 2>&1 | tail -3
    npx vitest run --config vitest.api.config.ts
    print_result $?
  fi
fi

# ════════════════════════════════════════════════════════════════════
# JOB 9: DATABASE TESTS (requires PostgreSQL)
# Mirrors: .github/workflows/ci.yml → job: test-database
# ═════════════════════════════════════════════════════════════
print_job "9" "Database Tests (PostgreSQL)"
if should_run_job "9"; then
  if ! command -v pg_isready &>/dev/null || ! pg_isready -h localhost -p 5432 -t 2 &>/dev/null; then
    echo -e "${YELLOW}  ⚠ SKIPPED: PostgreSQL not available locally${NC}"
    echo "  CI runs this with a PostgreSQL service container."
    echo "  To run locally: docker run -d -p 5432:5432 -e POSTGRES_USER=ci_test -e POSTGRES_PASSWORD=ci_test_pass -e POSTGRES_DB=ci_test postgres:16-alpine"
    JOBS_SKIPPED=$((JOBS_SKIPPED + 1))
    print_result 0
  else
    npx prisma migrate deploy 2>&1 | tail -3
    npx vitest run --config vitest.database.config.ts
    print_result $?
  fi
fi

# ════════════════════════════════════════════════════════════════════
# JOB 10: INTEGRATION TESTS
# Mirrors: .github/workflows/ci.yml → job: test-integration
# ═════════════════════════════════════════════════════════════
print_job "10" "Integration Tests"
if should_run_job "10"; then
  npx vitest run --config vitest.integration.config.ts
  print_result $?
fi

# ════════════════════════════════════════════════════════════════════
# JOB 11: BUILD VERIFICATION
# Skipped in --quick mode
# Note: CI build job is a pure dependency gate (no steps).
# ci-local.sh also runs build:vercel for extra local confidence.
# ═══════════════════════════════════════════════════════════════
if [ "$QUICK_MODE" = true ]; then
  echo ""
  echo -e "${YELLOW}━━━ [11/11] Build Verification — SKIPPED (--quick mode) ━━━${NC}"
else
  print_job "11" "Build Verification"
  if should_run_job "11"; then
    export NODE_OPTIONS="--max-old-space-size=4096"
    npm run build:vercel
    print_result $?
  fi
fi

# ═════════════════════════════════════════════════════════════
# SUMMARY
# ═════════════════════════════════════════════════════════════
TOTAL_END=$(date +%s)
TOTAL_ELAPSED=$(( TOTAL_END - TOTAL_START ))

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  CI LOCAL MIRROR — RESULTS                       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Jobs run:    $JOBS_RUN"
echo "  Skipped:     ${JOBS_SKIPPED:-0} (PostgreSQL not available)"
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
