#!/bin/bash
cd /home/z/my-project

export DATABASE_URL="file:/home/z/my-project/db/custom.db"
export SESSION_TOKEN_HMAC_SECRET="this-is-a-dev-secret-key-that-is-at-least-32-chars-long-1234"
export NEXTAUTH_SECRET="this-is-a-dev-secret-key-that-is-at-least-32-chars-long-1234"
export TRACKING_SECRET="this-is-a-tracking-secret-min16"
export AUTHORIZED_EMAIL="admin@deepmindq.com"
export API_KEY_ENCRYPTION_KEY="this-is-an-encryption-key-that-is-at-least-32-chars-1234"

# Start standalone server
PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js > /tmp/e2e-server3.log 2>&1 &
SERVER_PID=$!

for i in $(seq 1 30); do
  sleep 1
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 --max-time 2 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" != "000" ]; then
    echo "Server ready! HTTP $HTTP_CODE"
    break
  fi
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "Server died."
    exit 1
  fi
done

if [ "$HTTP_CODE" = "000" ]; then
  echo "Server never became ready"
  exit 1
fi

echo "========================================="
echo "=== TEST 1: HOMEPAGE ==="
echo "========================================="
agent-browser open http://localhost:3000 2>&1
sleep 5

echo "--- Title ---"
agent-browser get title 2>&1

echo "--- Snapshot ---"
agent-browser snapshot 2>&1

echo "--- Screenshot ---"
agent-browser screenshot /tmp/e2e-1-homepage.png 2>&1

echo "--- Console ---"
agent-browser console 2>&1

echo "--- Errors ---"
agent-browser errors 2>&1

echo "========================================="
echo "=== TEST 2: LOGIN PAGE ==="
echo "========================================="
agent-browser open http://localhost:3000/login 2>&1
sleep 5

echo "--- Title ---"
agent-browser get title 2>&1

echo "--- Snapshot ---"
agent-browser snapshot 2>&1

echo "--- Screenshot ---"
agent-browser screenshot /tmp/e2e-2-login.png 2>&1

echo "--- Console ---"
agent-browser console 2>&1

echo "--- Errors ---"
agent-browser errors 2>&1

echo "========================================="
echo "=== TEST 3: MARKETING PAGE ==="
echo "========================================="
agent-browser open http://localhost:3000/marketing 2>&1
sleep 5

echo "--- Title ---"
agent-browser get title 2>&1

echo "--- Snapshot ---"
agent-browser snapshot 2>&1

echo "--- Screenshot ---"
agent-browser screenshot /tmp/e2e-3-marketing.png 2>&1

echo "--- Errors ---"
agent-browser errors 2>&1

echo "========================================="
echo "=== TEST 4: CHECK HTML SOURCE ==="
echo "========================================="
agent-browser open http://localhost:3000 2>&1
sleep 3
echo "--- HTML head ---"
agent-browser eval "document.head.innerHTML.substring(0, 3000)" 2>&1
echo ""
echo "--- Body classes ---"
agent-browser eval "document.body.className" 2>&1
echo ""
echo "--- Body bg color ---"
agent-browser eval "getComputedStyle(document.body).backgroundColor" 2>&1
echo ""
echo "--- Body text color ---"
agent-browser eval "getComputedStyle(document.body).color" 2>&1

kill $SERVER_PID 2>/dev/null
echo "========================================="
echo "=== ALL TESTS COMPLETE ==="
echo "========================================="
