#!/bin/bash
cd /home/z/my-project

export DATABASE_URL="file:/home/z/my-project/db/custom.db"
export SESSION_TOKEN_HMAC_SECRET="this-is-a-dev-secret-key-that-is-at-least-32-chars-long-1234"
export NEXTAUTH_SECRET="this-is-a-dev-secret-key-that-is-at-least-32-chars-long-1234"
export TRACKING_SECRET="this-is-a-tracking-secret-min16"
export AUTHORIZED_EMAIL="admin@deepmindq.com"
export API_KEY_ENCRYPTION_KEY="this-is-an-encryption-key-that-is-at-least-32-chars-1234"

npx next start -p 3000 -H 0.0.0.0 > /tmp/e2e-server10.log 2>&1 &
SERVER_PID=$!

for i in $(seq 1 30); do
  sleep 1
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 --max-time 2 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" != "000" ]; then break; fi
  if ! kill -0 $SERVER_PID 2>/dev/null; then echo "Server died."; exit 1; fi
done

echo "=== FINAL VERIFICATION ==="
echo ""

echo "--- 1. Demo page (server-rendered, fully functional) ---"
agent-browser open http://localhost:3000/demo 2>&1
sleep 5
agent-browser screenshot /tmp/e2e-final-demo.png 2>&1
agent-browser get title 2>&1

echo ""
echo "--- 2. Homepage (client-rendered, stuck in loading) ---"
agent-browser open http://localhost:3000/ 2>&1
sleep 10
agent-browser screenshot /tmp/e2e-final-homepage.png 2>&1

echo ""
echo "--- 3. Marketing page (client-rendered, stuck) ---"
agent-browser open http://localhost:3000/marketing 2>&1
sleep 5
agent-browser screenshot /tmp/e2e-final-marketing.png 2>&1

echo ""
echo "--- 4. Theme verification on homepage ---"
agent-browser open http://localhost:3000/ 2>&1
sleep 3
agent-browser eval "JSON.stringify({htmlBg: getComputedStyle(document.documentElement).backgroundColor, bodyBg: getComputedStyle(document.body).backgroundColor, bodyColor: getComputedStyle(document.body).color, innerBg: document.querySelector('[style*=background]')?.getAttribute('style')?.substring(0, 50)})" 2>&1

echo ""
echo "--- 5. API health check ---"
curl -s http://127.0.0.1:3000/api/health 2>&1 | head -5

echo ""
echo "--- 6. API auth/me ---"
curl -s -w "\nHTTP %{http_code}" http://127.0.0.1:3000/api/auth/me 2>&1 | head -5

echo ""
echo "--- 7. Demo page dark theme ---"
agent-browser open http://localhost:3000/demo 2>&1
sleep 3
agent-browser eval "JSON.stringify({htmlBg: getComputedStyle(document.documentElement).backgroundColor, bodyBg: getComputedStyle(document.body).backgroundColor, bodyColor: getComputedStyle(document.body).color})" 2>&1

kill $SERVER_PID 2>/dev/null
echo ""
echo "=== FINAL DONE ==="
