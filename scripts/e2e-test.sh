#!/bin/bash
# E2E test script - starts server and immediately tests it

cd /home/z/my-project

export DATABASE_URL="file:/home/z/my-project/db/custom.db"
export SESSION_TOKEN_HMAC_SECRET="this-is-a-dev-secret-key-that-is-at-least-32-chars-long-1234"
export NEXTAUTH_SECRET="this-is-a-dev-secret-key-that-is-at-least-32-chars-long-1234"
export TRACKING_SECRET="this-is-a-tracking-secret-min16"
export AUTHORIZED_EMAIL="admin@deepmindq.com"
export API_KEY_ENCRYPTION_KEY="this-is-an-encryption-key-that-is-at-least-32-chars-1234"

# Start standalone server in background
PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js > /tmp/e2e-server.log 2>&1 &
SERVER_PID=$!

# Wait for server to be ready
for i in $(seq 1 30); do
  sleep 1
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 --max-time 2 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" != "000" ]; then
    echo "Server ready! HTTP $HTTP_CODE"
    break
  fi
  # Check if process is still alive
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "Server died. Log:"
    cat /tmp/e2e-server.log
    exit 1
  fi
done

if [ "$HTTP_CODE" = "000" ]; then
  echo "Server never became ready"
  cat /tmp/e2e-server.log
  exit 1
fi

# Now run the browser tests
echo "=== BROWSER E2E TEST ==="

# Test 1: Navigate to page
echo "Test 1: Navigating to http://localhost:3000..."
agent-browser open http://localhost:3000 --timeout 15000
BROWSE_EXIT=$?
echo "Browser navigate exit: $BROWSE_EXIT"

# Test 2: Take screenshot
echo "Test 2: Taking screenshot..."
agent-browser screenshot /tmp/e2e-screenshot.png --timeout 10000
SCREENSHOT_EXIT=$?
echo "Screenshot exit: $SCREENSHOT_EXIT"

# Test 3: Get page title
echo "Test 3: Getting page title..."
agent-browser get title --timeout 10000
TITLE_EXIT=$?
echo "Title exit: $TITLE_EXIT"

# Test 4: Snapshot the page
echo "Test 4: Getting page snapshot..."
agent-browser snapshot -c --timeout 10000
SNAPSHOT_EXIT=$?
echo "Snapshot exit: $SNAPSHOT_EXIT"

# Test 5: Check for errors
echo "Test 5: Checking browser errors..."
agent-browser errors --timeout 10000
ERRORS_EXIT=$?
echo "Errors exit: $ERRORS_EXIT"

# Test 6: Check URL
echo "Test 6: Getting current URL..."
agent-browser get url --timeout 10000
URL_EXIT=$?
echo "URL exit: $URL_EXIT"

# Cleanup
kill $SERVER_PID 2>/dev/null

echo "=== E2E TEST COMPLETE ==="
