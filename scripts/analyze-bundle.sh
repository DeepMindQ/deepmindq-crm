#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# Analyze webpack bundle sizes and flag chunks > 200KB
#
# Usage:
#   bash scripts/analyze-bundle.sh
#   ANALYZE=true bash scripts/analyze-bundle.sh   # with @next/bundle-analyzer
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

THRESHOLD_KB=200
BUILD_OUTPUT="build-output.txt"

echo "=== BUNDLE SIZE ANALYSIS ==="
echo "Threshold: ${THRESHOLD_KB}KB per chunk"
echo "Timestamp: $(date -Iseconds)"
echo ""

# Build with ANALYZE flag for detailed output
ANALYZE=true npm run build 2>&1 | tee "$BUILD_OUTPUT"

EXIT_CODE=${PIPESTATUS[0]}

if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌ BUILD FAILED (exit code $EXIT_CODE)"
  echo "Check $BUILD_OUTPUT for details."
  exit $EXIT_CODE
fi

echo ""
echo "=== LARGE CHUNK REPORT (> ${THRESHOLD_KB}KB) ==="
echo ""

# Parse the Next.js build output for route/webpack chunk sizes
# Next.js build outputs lines like:
#   ├ ○ /dashboard                    234.56 kB
#   ├ λ /api/companies                12.34 kB
#   └ f /some-page                    56.78 kB

FOUND_LARGE=0

# Extract lines with size information ( kB pattern)
rg "\d+\.\d+ kB" "$BUILD_OUTPUT" 2>/dev/null | while IFS= read -r line; do
  # Extract the size number
  size=$(echo "$line" | rg -o '[0-9]+\.[0-9]+' | head -1)
  if [ -n "$size" ]; then
    size_int=$(echo "$size" | awk '{printf "%.0f", $1}')
    if [ "$size_int" -gt "$THRESHOLD_KB" ]; then
      echo "⚠️  OVER THRESHOLD: $line"
    fi
  fi
done

# Also check webpack chunk output if available
echo ""
echo "=== TOP 20 LARGEST CHUNKS ==="
echo ""

# Try to parse the route-by-route output
rg -o "[0-9]+\.[0-9]+ kB" "$BUILD_OUTPUT" 2>/dev/null | \
  sort -t' ' -k1 -rn | \
  head -20 | \
  while IFS= read -r size_line; do
  echo "  $size_line"
done

echo ""
echo "=== SUMMARY ==="
echo "Build output saved to: $BUILD_OUTPUT"
echo ""
echo "To open the interactive bundle analyzer:"
echo "  ANALYZE=true npm run build"
echo "  (Opens browser at http://localhost:8888)"
echo ""
