#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Branch Protection Setup — DeepMindQ Enterprise CI
#
# This script requires GitHub repo ADMIN access.
# It configures branch protection rules on the main branch
# to enforce all 10 blocking CI jobs must pass before merge.
#
# Prerequisites:
#   1. GitHub Personal Access Token with 'repo' scope (admin access)
#   2. jq installed
#
# Usage:
#   export GH_TOKEN=your_github_token
#   bash scripts/setup-branch-protection.sh
#
# Or with the GitHub CLI:
#   gh api repos/DeepMindQ/deepmindq-crm/branches/main/protection \
#     --method PUT \
#     -f required_status_checks_strict=true \
#     --input-json <(cat scripts/branch-protection-payload.json)
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

REPO="DeepMindQ/deepmindq-crm"
BRANCH="main"
API_URL="https://api.github.com/repos/${REPO}/branches/${BRANCH}/protection"

if [ -z "${GH_TOKEN:-}" ]; then
  echo "ERROR: GH_TOKEN environment variable not set."
  echo ""
  echo "Create a token at: https://github.com/settings/tokens"
  echo "Required scopes: repo (full control)"
  echo ""
  echo "Then run:"
  echo "  export GH_TOKEN=ghp_your_token_here"
  echo "  bash scripts/setup-branch-protection.sh"
  exit 1
fi

# Verify token has admin access
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GH_TOKEN" \
  "https://api.github.com/repos/${REPO}" 2>/dev/null)

if [ "$HTTP_CODE" != "200" ]; then
  echo "ERROR: Token validation failed (HTTP $HTTP_CODE). Check GH_TOKEN."
  exit 1
fi

echo "Setting branch protection on ${REPO}/${BRANCH}..."
echo ""

# Apply branch protection with all 10 blocking CI jobs as required checks
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_URL" \
  -d '{
    "required_status_checks": {
      "strict": true,
      "contexts": [
        "Blocking -- Security Gate (Static)",
        "Blocking -- Dependency Audit",
        "Blocking -- API Security Contract",
        "Blocking -- Lint + Typecheck",
        "Blocking -- Unit Tests",
        "Blocking -- Security Tests",
        "Blocking -- API Tests",
        "Blocking -- Database Tests",
        "Blocking -- Integration Tests",
        "Blocking -- M5 Intelligence Tests",
        "Blocking -- Build Verification"
      ]
    },
    "enforce_admins": true,
    "required_pull_request_reviews": false,
    "allow_force_pushes": false,
    "allow_deletions": false,
    "block_creations": false
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Branch protection applied successfully!"
  echo ""
  echo "Required status checks (must all pass to merge):"
  echo "  ──────────────────────────────────────────────"
  echo "  ✅ Blocking -- Security Gate (Static)"
  echo "  ✅ Blocking -- Dependency Audit"
  echo "  ✅ Blocking -- API Security Contract"
  echo "  ✅ Blocking -- Lint + Typecheck"
  echo "  ✅ Blocking -- Unit Tests"
  echo "  ✅ Blocking -- Security Tests"
  echo "  ✅ Blocking -- API Tests"
  echo "  ✅ Blocking -- Database Tests"
  echo "  ✅ Blocking -- Integration Tests"
  echo "  ✅ Blocking -- M5 Intelligence Tests"
  echo "  ✅ Blocking -- Build Verification"
  echo ""
  echo "  enforce_admins: true (admins must also pass checks)"
  echo "  force pushes:  disabled"
  echo "  branch deletion: disabled"
elif [ "$HTTP_CODE" = "403" ]; then
  echo "❌ Permission denied (HTTP 403). The token needs repo admin access."
  echo "   Go to: https://github.com/settings/tokens"
  echo "   Ensure 'repo' scope is checked."
else
  echo "⚠️  Unexpected response (HTTP $HTTP_CODE):"
  echo "$BODY" | head -5
fi
