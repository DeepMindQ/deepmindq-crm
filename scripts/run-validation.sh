#!/bin/bash
# Enterprise Test Validation — Run all 13 test categories and collect results
# Output: Category, Files, Passed, Failed, Skipped, Status

CATEGORIES=(
  "unit:vitest.unit.config.ts"
  "security:vitest.security.config.ts"
  "api:vitest.api.config.ts"
  "database:vitest.database.config.ts"
  "ai:vitest.ai.config.ts"
  "ai-governance:vitest.ai-governance.config.ts"
  "ai-retrieval:vitest.ai-retrieval.config.ts"
  "ai-framework:vitest.ai-framework.config.ts"
  "ai-inference:vitest.ai-inference.config.ts"
  "integration:vitest.integration.config.ts"
  "e2e:vitest.e2e.config.ts"
  "performance:vitest.performance.config.ts"
  "ui:vitest.ui.config.ts"
)

echo "CATEGORY,FILES,PASSED,FAILED,SKIPPED,STATUS,DURATION_MS"

for entry in "${CATEGORIES[@]}"; do
  IFS=':' read -r name config <<< "$entry"
  
  OUTPUT=$(npx vitest run --config "$config" 2>&1)
  
  # Extract metrics
  FILES=$(echo "$OUTPUT" | rg "Test Files" | rg -o "[0-9]+ passed" | head -1 | rg -o "[0-9]+")
  TOTAL_FILES=$(echo "$OUTPUT" | rg "Test Files" | rg -o "\([0-9]+\)" | head -1 | rg -o "[0-9]+")
  PASSED=$(echo "$OUTPUT" | rg "Tests" | head -1 | rg -o "[0-9]+ passed" | head -1 | rg -o "[0-9]+")
  FAILED=$(echo "$OUTPUT" | rg "Tests" | head -1 | rg -o "[0-9]+ failed" | head -1 | rg -o "[0-9]+")
  SKIPPED=$(echo "$OUTPUT" | rg "Tests" | head -1 | rg -o "[0-9]+ skipped" | head -1 | rg -o "[0-9]+")
  ERRORS=$(echo "$OUTPUT" | rg "Errors" | rg -o "[0-9]+ error" | head -1 | rg -o "[0-9]+")
  DURATION=$(echo "$OUTPUT" | rg "Duration" | rg -o "[0-9.]+[a-z]+" | head -1)
  
  # Defaults
  FILES=${FILES:-0}
  TOTAL_FILES=${TOTAL_FILES:-0}
  PASSED=${PASSED:-0}
  FAILED=${FAILED:-0}
  SKIPPED=${SKIPPED:-0}
  ERRORS=${ERRORS:-0}
  
  if [ "$FAILED" -gt 0 ] || [ "$ERRORS" -gt 0 ]; then
    STATUS="FAIL"
  else
    STATUS="PASS"
  fi
  
  echo "$name,$FILES/$TOTAL_FILES,$PASSED,$FAILED,$SKIPPED,$STATUS,$DURATION"
done

echo ""
echo "Validation complete."
