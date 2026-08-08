#!/bin/bash
cd /home/z/my-project

export DATABASE_URL="file:/home/z/my-project/db/custom.db"
export SESSION_TOKEN_HMAC_SECRET="this-is-a-dev-secret-key-that-is-at-least-32-chars-long-1234"
export NEXTAUTH_SECRET="this-is-a-dev-secret-key-that-is-at-least-32-chars-long-1234"
export TRACKING_SECRET="this-is-a-tracking-secret-min16"
export AUTHORIZED_EMAIL="admin@deepmindq.com"
export API_KEY_ENCRYPTION_KEY="this-is-an-encryption-key-that-is-at-least-32-chars-1234"

mkdir -p .next/standalone/.next/static
cp -r .next/static/* .next/standalone/.next/static/ 2>/dev/null

PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js > /tmp/e2e-server6.log 2>&1 &
SERVER_PID=$!

for i in $(seq 1 30); do
  sleep 1
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 --max-time 2 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" != "000" ]; then break; fi
  if ! kill -0 $SERVER_PID 2>/dev/null; then echo "Server died."; exit 1; fi
done

echo "=== Opening page ==="
agent-browser open http://localhost:3000 2>&1

echo "=== Waiting 10s for hydration ==="
sleep 10

echo "=== All console messages ==="
agent-browser console 2>&1

echo ""
echo "=== Error details ==="
agent-browser errors 2>&1

echo ""
echo "=== Checking for unhandled errors via JS ==="
agent-browser eval "(() => { let errs = []; window.addEventListener('error', e => errs.push('error: ' + e.message)); window.addEventListener('unhandledrejection', e => errs.push('unhandled: ' + e.reason)); return 'listener added'; })()" 2>&1
sleep 3
agent-browser eval "(() => { let errs = []; window.addEventListener('error', e => errs.push('error: ' + e.message)); window.addEventListener('unhandledrejection', e => errs.push('unhandled: ' + e.reason)); return 'listener added2'; })()" 2>&1

echo ""
echo "=== React root status ==="
agent-browser eval "document.getElementById('__next')?.innerHTML?.substring(0, 500) || '__next not found'" 2>&1

echo ""
echo "=== Check React internals ==="
agent-browser eval "typeof __webpack_require__" 2>&1
agent-browser eval "typeof __next_f" 2>&1
agent-browser eval "JSON.stringify(Object.keys(window.__next_f || {}).slice(0,5))" 2>&1
agent-browser eval "window.__next_f?.length" 2>&1

echo ""
echo "=== Check if React is loaded ==="
agent-browser eval "typeof React" 2>&1
agent-browser eval "typeof ReactDOM" 2>&1
agent-browser eval "typeof ReactDOMClient" 2>&1

echo ""
echo "=== Full body text content ==="
agent-browser eval "document.body.innerText.substring(0, 1000)" 2>&1

echo ""
echo "=== Main content div children ==="
agent-browser eval "(() => { const mc = document.getElementById('main-content'); return mc ? mc.innerHTML.substring(0, 2000) : 'not found'; })()" 2>&1

echo ""
echo "=== Check __next_rsc or similar globals ==="
agent-browser eval "Object.keys(window).filter(k => k.startsWith('__next')).join(', ')" 2>&1

kill $SERVER_PID 2>/dev/null
echo "=== DONE ==="
