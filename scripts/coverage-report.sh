#!/bin/bash
# ============================================================================
# Coverage Report Generator
# 
# Runs all test suites with coverage and generates a comprehensive report.
# Fails if coverage drops below 70% threshold (matching vitest.config.ts).
# 
# Usage:
#   ./scripts/coverage-report.sh              # Run all blocking suites
#   ./scripts/coverage-report.sh --all        # Run ALL suites including DB-dependent
#   ./scripts/coverage-report.sh --suite=api  # Run specific suite
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

COLOR_RED='\033[0;31m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_RESET='\033[0m'

OUTPUT_FILE="${PROJECT_ROOT}/test-output.txt"
COVERAGE_DIR="${PROJECT_ROOT}/coverage"
SUMMARY_FILE="${PROJECT_ROOT}/coverage-summary.txt"

# Thresholds (must match vitest.config.ts)
MIN_STATEMENTS=70
MIN_BRANCHES=60
MIN_FUNCTIONS=70
MIN_LINES=70

echo -e "${COLOR_YELLOW}=== Running Test Suites with Coverage ===${COLOR_RESET}"
echo "Project: $PROJECT_ROOT"
echo "Date: $(date -Iseconds)"
echo "Node: $(node --version)"
echo ""

# Clean previous coverage
rm -rf "$COVERAGE_DIR"
mkdir -p "$COVERAGE_DIR"

# Determine which suites to run
TEST_CMD="npx vitest run --coverage --reporter=verbose"

if [[ "${1:-}" == "--all" ]]; then
  echo "Running ALL test suites (including DB-dependent)..."
  TEST_CMD="${TEST_CMD} --config vitest.config.ts"
  # Also run API, database, and other suites
  for cfg in vitest.api.config.ts vitest.database.config.ts; do
    if [ -f "$PROJECT_ROOT/$cfg" ]; then
      echo ""
      echo -e "${COLOR_YELLOW}--- Running with $cfg ---${COLOR_RESET}"
      npx vitest run --config "$cfg" --coverage --reporter=verbose 2>&1 | tee -a "$OUTPUT_FILE" || true
    fi
  done
elif [[ "${1:-}" == --suite=* ]]; then
  SUITE="${1#--suite=}"
  echo "Running suite: $SUITE"
  CFG_FILE="vitest.${SUITE}.config.ts"
  if [ -f "$PROJECT_ROOT/$CFG_FILE" ]; then
    TEST_CMD="npx vitest run --config $CFG_FILE --coverage --reporter=verbose"
  else
    echo -e "${COLOR_RED}Config not found: $CFG_FILE${COLOR_RESET}"
    exit 1
  fi
else
  echo "Running blocking suites (unit, security, m5, integration)..."
fi

# Run tests
set +e
eval "$TEST_CMD" 2>&1 | tee "$OUTPUT_FILE"
TEST_EXIT_CODE=${PIPESTATUS[0]}
set -e

echo ""
echo -e "${COLOR_YELLOW}=== COVERAGE SUMMARY ===${COLOR_RESET}"

# Extract coverage from output
if [ -f "$OUTPUT_FILE" ]; then
  # Look for vitest coverage summary lines
  echo ""
  echo "Test Results:"
  echo "------------"
  
  # Check for test failures
  if rg -q "FAIL|Tests\s+\d+\s+failed" "$OUTPUT_FILE" 2>/dev/null; then
    echo -e "${COLOR_RED}❌ TEST FAILURES DETECTED${COLOR_RESET}"
    
    # Count failures
    FAIL_COUNT=$(rg -c "FAIL" "$OUTPUT_FILE" 2>/dev/null || echo "0")
    echo "   Failed test files: $FAIL_COUNT"
    
    # In CI, send notification
    if [ -n "${CI:-}" ]; then
      echo "Sending failure notification..."
      if [ -f "$PROJECT_ROOT/scripts/notify-ci-failure.sh" ]; then
        bash "$PROJECT_ROOT/scripts/notify-ci-failure.sh" "Test failures detected in coverage run. Failed files: $FAIL_COUNT"
      fi
    fi
    
    TEST_EXIT_CODE=1
  else
    echo -e "${COLOR_GREEN}✅ All tests passed${COLOR_RESET}"
  fi
  
  echo ""
  echo "Coverage Report:"
  echo "---------------"
  
  # Check if HTML report was generated
  if [ -d "$COVERAGE_DIR" ]; then
    echo -e "${COLOR_GREEN}HTML coverage report: $COVERAGE_DIR/index.html${COLOR_RESET}"
  fi
  
  # Extract key metrics if available
  if rg -q "Statements|Branches|Functions|Lines" "$OUTPUT_FILE" 2>/dev/null; then
    rg "(Statements|Branches|Functions|Lines)" "$OUTPUT_FILE" 2>/dev/null | tail -4 || true
  fi
fi

echo ""
echo "Thresholds: Statements≥${MIN_STATEMENTS}% Branches≥${MIN_BRANCHES}% Functions≥${MIN_FUNCTIONS}% Lines≥${MIN_LINES}%"

# Save summary
cat > "$SUMMARY_FILE" << EOF
Coverage Report - $(date -Iseconds)
Node: $(node --version)
Test Exit Code: $TEST_EXIT_CODE
Thresholds: S≥${MIN_STATEMENTS}% B≥${MIN_BRANCHES}% F≥${MIN_FUNCTIONS}% L≥${MIN_LINES}%
EOF

exit $TEST_EXIT_CODE
