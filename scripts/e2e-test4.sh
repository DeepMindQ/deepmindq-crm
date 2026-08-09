#!/bin/bash
cd /home/z/my-project

export DATABASE_URL="file:/home/z/my-project/db/custom.db"
export SESSION_TOKEN_HMAC_SECRET="this-is-a-dev-secret-key-that-is-at-least-32-chars-long-1234"
export NEXTAUTH_SECRET="this-is-a-dev-secret-key-that-is-at-least-32-chars-long-1234"
export TRACKING_SECRET="this-is-a-tracking-secret-min16"
export AUTHORIZED_EMAIL="admin@deepmindq.com"
export API_KEY_ENCRYPTION_KEY="this-is-an-encryption-key-that-is-at-least-32-chars-1234"

# Start standalone server
PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js > /tmp/e2e-server4.log 2>&1 &
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

echo "=== INVESTIGATING LOADING STATE ==="

agent-browser open http://localhost:3000/login 2>&1

# Wait longer for hydration
sleep 8

echo "--- Full body innerHTML (truncated) ---"
agent-browser eval "document.body.innerHTML.substring(0, 5000)" 2>&1

echo ""
echo "--- Root div contents ---"
agent-browser eval "document.getElementById('__next') ? document.getElementById('__next').innerHTML.substring(0, 3000) : 'No __next div'" 2>&1

echo ""
echo "--- All script tags ---"
agent-browser eval "document.querySelectorAll('script').length" 2>&1

echo ""
echo "--- React root ---"
agent-browser eval "document.querySelector('[data-reactroot]') ? 'has reactroot' : 'no reactroot'" 2>&1
agent-browser eval "document.getElementById('__next') ? 'has __next' : 'no __next'" 2>&1

echo ""
echo "--- Check if any React rendering happened ---"
agent-browser eval "document.querySelectorAll('[class*=dashboard], [class*=login], [class*=app], [class*=sidebar], [class*=header]').length" 2>&1

echo ""
echo "--- Computed styles of loading text ---"
agent-browser eval "(() => { const p = document.querySelector('p'); return p ? { text: p.textContent, display: getComputedStyle(p).display, fontSize: getComputedStyle(p).fontSize, color: getComputedStyle(p).color } : 'no p element'; })()" 2>&1

echo ""
echo "--- HTML element background ---"
agent-browser eval "getComputedStyle(document.documentElement).backgroundColor" 2>&1
agent-browser eval "getComputedStyle(document.documentElement).color" 2>&1
agent-browser eval "document.documentElement.classList.toString()" 2>&1

echo ""
echo "--- CSS dark/light class ---"
agent-browser eval "document.documentElement.className" 2>&1
agent-browser eval "document.documentElement.getAttribute('data-theme')" 2>&1
agent-browser eval "document.documentElement.getAttribute('class')" 2>&1

echo ""
echo "--- Check loaded stylesheets ---"
agent-browser eval "document.querySelectorAll('link[rel=stylesheet]').length + ' stylesheets loaded'" 2>&1
agent-browser eval "Array.from(document.querySelectorAll('link[rel=stylesheet]')).map(l => l.href).join('\\n')" 2>&1

echo ""
echo "--- Console after wait ---"
agent-browser console 2>&1

echo ""
echo "--- Network requests (if available) ---"
agent-browser eval "performance.getEntriesByType('resource').filter(r => r.initiatorType === 'fetch' || r.initiatorType === 'xmlhttprequest').map(r => r.name + ' -> ' + r.responseStatus).join('\\n')" 2>&1

echo ""
echo "--- Full page snapshot after long wait ---"
agent-browser snapshot 2>&1

echo ""
echo "--- Screenshot after long wait ---"
agent-browser screenshot /tmp/e2e-4-login-detailed.png 2>&1

echo ""
echo "--- Check localStorage ---"
agent-browser eval "Object.keys(localStorage).join(', ')" 2>&1

echo ""
echo "--- Check cookies ---"
agent-browser eval "document.cookie" 2>&1

kill $SERVER_PID 2>/dev/null
echo "=== DONE ==="
