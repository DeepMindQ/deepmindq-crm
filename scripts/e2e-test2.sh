#!/bin/bash
cd /home/z/my-project

export DATABASE_URL="file:/home/z/my-project/db/custom.db"
export SESSION_TOKEN_HMAC_SECRET="this-is-a-dev-secret-key-that-is-at-least-32-chars-long-1234"
export NEXTAUTH_SECRET="this-is-a-dev-secret-key-that-is-at-least-32-chars-long-1234"
export TRACKING_SECRET="this-is-a-tracking-secret-min16"
export AUTHORIZED_EMAIL="admin@deepmindq.com"
export API_KEY_ENCRYPTION_KEY="this-is-an-encryption-key-that-is-at-least-32-chars-1234"

# Start standalone server
PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js > /tmp/e2e-server2.log 2>&1 &
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
    cat /tmp/e2e-server2.log
    exit 1
  fi
done

if [ "$HTTP_CODE" = "000" ]; then
  echo "Server never became ready"
  exit 1
fi

echo "=== NAVIGATION ==="
agent-browser open http://localhost:3000 2>&1

echo "=== WAITING FOR FULL LOAD ==="
sleep 3
agent-browser wait --load networkidle 2>&1 || echo "networkidle timeout"
sleep 2

echo "=== PAGE TITLE ==="
agent-browser get title 2>&1

echo "=== FULL SNAPSHOT ==="
agent-browser snapshot 2>&1

echo "=== SCREENSHOT ==="
agent-browser screenshot /tmp/e2e-homepage.png 2>&1

echo "=== BROWSER ERRORS ==="
agent-browser errors 2>&1

echo "=== BROWSER CONSOLE ==="
agent-browser console 2>&1

kill $SERVER_PID 2>/dev/null
echo "=== DONE ==="
