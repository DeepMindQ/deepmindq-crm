#!/bin/bash
# ============================================================================
# CI Failure Notification Script
# 
# Reads test results and sends notifications when CI fails.
# Currently outputs to stdout; can be extended to integrate with:
# - Slack (webhook)
# - Email (sendmail/SES)
# - GitHub (commit status, issue creation)
# - PagerDuty (incident creation)
# ============================================================================
set -euo pipefail

MESSAGE="${1:-CI build failed}"
PIPELINE_URL="${CI_PIPELINE_URL:-local}"
BRANCH="${GITHUB_REF_NAME:-$(git branch --show-current 2>/dev/null || echo 'unknown')}"
COMMIT="${GITHUB_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')}"
TIMESTAMP="$(date -Iseconds)"

COLOR_RED='\033[0;31m'
COLOR_YELLOW='\033[1;33m'
COLOR_RESET='\033[0m'

# --- Output notification ---
echo ""
echo -e "${COLOR_RED}═══════════════════════════════════════════════════════${COLOR_RESET}"
echo -e "${COLOR_RED}  CI FAILURE NOTIFICATION${COLOR_RESET}"
echo -e "${COLOR_RED}═══════════════════════════════════════════════════════${COLOR_RESET}"
echo ""
echo "  Message:     $MESSAGE"
echo "  Branch:      $BRANCH"
echo "  Commit:      $COMMIT"
echo "  Timestamp:   $TIMESTAMP"
echo "  Pipeline:    $PIPELINE_URL"
echo ""

# --- Slack integration (if SLACK_WEBHOOK_URL is set) ---
if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
  PAYLOAD=$(cat <<EOF
{
  "text": "🚨 *CI Failure*\n*Branch:* $BRANCH\n*Commit:* $COMMIT\n*Message:* $MESSAGE\n*Pipeline:* $PIPELINE_URL\n*Time:* $TIMESTAMP"
}
EOF
)
  
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
    -X POST "$SLACK_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "$PAYLOAD" 2>/dev/null || echo "000")
  
  if [ "$HTTP_CODE" = "200" ]; then
    echo "  Slack:      ✅ Notification sent"
  else
    echo "  Slack:      ❌ Failed (HTTP $HTTP_CODE)"
  fi
else
  echo "  Slack:      (not configured - set SLACK_WEBHOOK_URL)"
fi

echo ""

# --- GitHub Issue creation (if GITHUB_TOKEN is set) ---
if [ -n "${GITHUB_TOKEN:-}" ] && [ -n "${GITHUB_REPOSITORY:-}" ]; then
  ISSUE_TITLE="CI Failure: $BRANCH ($COMMIT)"
  ISSUE_BODY=$(cat <<EOF
## CI Failure

- **Branch:** $BRANCH
- **Commit:** $COMMIT
- **Time:** $TIMESTAMP
- **Pipeline:** $PIPELINE_URL

### Details

$MESSAGE
EOF
)

  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
    -X POST "https://api.github.com/repos/$GITHUB_REPOSITORY/issues" \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"title\": \"$ISSUE_TITLE\", \"body\": $(echo "$ISSUE_BODY" | jq -Rs .)}" \
    2>/dev/null || echo "000")
  
  if [ "$HTTP_CODE" = "201" ]; then
    echo "  GitHub:     ✅ Issue created"
  else
    echo "  GitHub:     ⚠️  Issue creation returned HTTP $HTTP_CODE (may already exist)"
  fi
else
  echo "  GitHub:     (not configured - set GITHUB_TOKEN and GITHUB_REPOSITORY)"
fi

echo ""
echo -e "${COLOR_RED}═══════════════════════════════════════════════════════${COLOR_RESET}"

exit 0
