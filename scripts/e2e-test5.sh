#!/bin/bash
cd /home/z/my-project

export DATABASE_URL="file:/home/z/my-project/db/custom.db"
export SESSION_TOKEN_HMAC_SECRET="this-is-a-dev-secret-key-that-is-at-least-32-chars-long-1234"
export NEXTAUTH_SECRET="this-is-a-dev-secret-key-that-is-at-least-32-chars-long-1234"
export TRACKING_SECRET="this-is-a-tracking-secret-min16"
export AUTHORIZED_EMAIL="admin@deepmindq.com"
export API_KEY_ENCRYPTION_KEY="this-is-an-encryption-key-that-is-at-least-32-chars-1234"

# Copy static assets for standalone
mkdir -p .next/standalone/.next/static
cp -r .next/static/* .next/standalone/.next/static/ 2>/dev/null

# Start standalone server
PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js > /tmp/e2e-server5.log 2>&1 &
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

echo "=== Test 1: Check if JS chunks are served ==="
# Get a JS chunk URL from the HTML
JS_URL=$(curl -s http://127.0.0.1:3000 | rg -oP 'src="(/_next/static/chunks/[^"]+)"' | head -1 | rg -oP '"/_next/static/chunks/[^"]+"' | tr -d '"')
echo "Testing JS chunk: $JS_URL"
if [ -n "$JS_URL" ]; then
  JS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000${JS_URL}" --max-time 5)
  echo "JS chunk status: $JS_STATUS"
else
  echo "No JS chunk URL found in HTML"
fi

echo ""
echo "=== Test 2: Navigate and wait longer ==="
agent-browser open http://localhost:3000 2>&1

# Wait for React to hydrate
sleep 10

echo "--- Snapshot ---"
agent-browser snapshot 2>&1

echo "--- Screenshot ---"
agent-browser screenshot /tmp/e2e-5-with-static.png 2>&1

echo "--- Errors ---"
agent-browser errors 2>&1

echo ""
echo "=== Test 3: Check specific resources ==="
echo "--- CSS files ---"
CSS_URL=$(curl -s http://127.0.0.1:3000 | rg -oP 'href="(/_next/static/chunks/[^"]+\.css)"' | head -1 | rg -oP '"/_next/static/chunks/[^"]+\.css"' | tr -d '"')
echo "CSS URL: $CSS_URL"
if [ -n "$CSS_URL" ]; then
  CSS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000${CSS_URL}" --max-time 5)
  echo "CSS status: $CSS_STATUS"
fi

echo ""
echo "--- Font files ---"
FONT_URL=$(curl -s http://127.0.0.1:3000 | rg -oP 'href="(/_next/static/media/[^"]+)"' | head -1 | rg -oP '"/_next/static/media/[^"]+"' | tr -d '"')
echo "Font URL: $FONT_URL"
if [ -n "$FONT_URL" ]; then
  FONT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000${FONT_URL}" --max-time 5)
  echo "Font status: $FONT_STATUS"
fi

echo ""
echo "=== Test 4: Evaluate JS execution ==="
agent-browser eval "typeof window.__next_f" 2>&1
agent-browser eval "typeof window.__NEXT_DATA__" 2>&1

echo ""
echo "--- Performance entries for failed resources ---"
agent-browser eval "performance.getEntriesByType('resource').filter(r => r.responseStatus === 0 || r.transferSize === 0).map(r => r.name + ' status=' + r.responseStatus).join('\\n')" 2>&1

echo ""
echo "--- All resource entries count ---"
agent-browser eval "performance.getEntriesByType('resource').length" 2>&1

echo ""
echo "--- Failed resource count ---"
agent-browser eval "performance.getEntriesByType('resource').filter(r => r.responseStatus >= 400).length" 2>&1

kill $SERVER_PID 2>/dev/null
echo "=== DONE ==="
