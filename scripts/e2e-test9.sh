#!/bin/bash
cd /home/z/my-project

export DATABASE_URL="file:/home/z/my-project/db/custom.db"
export SESSION_TOKEN_HMAC_SECRET="this-is-a-dev-secret-key-that-is-at-least-32-chars-long-1234"
export NEXTAUTH_SECRET="this-is-a-dev-secret-key-that-is-at-least-32-chars-long-1234"
export TRACKING_SECRET="this-is-a-tracking-secret-min16"
export AUTHORIZED_EMAIL="admin@deepmindq.com"
export API_KEY_ENCRYPTION_KEY="this-is-an-encryption-key-that-is-at-least-32-chars-1234"
export OUTPUT=""

npx next start -p 3000 -H 0.0.0.0 > /tmp/e2e-server9.log 2>&1 &
SERVER_PID=$!

for i in $(seq 1 30); do
  sleep 1
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 --max-time 2 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" != "000" ]; then break; fi
  if ! kill -0 $SERVER_PID 2>/dev/null; then echo "Server died."; exit 1; fi
done

echo "=== Test 1: JS execution works ==="
agent-browser open http://localhost:3000 2>&1
agent-browser eval "window.testVar = 'hello'; 'set'" 2>&1
sleep 2
agent-browser eval "window.testVar" 2>&1

echo ""
echo "=== Test 2: Check turbopack chunk content ==="
agent-browser eval "fetch('/_next/static/chunks/turbopack-21nvqcvdhje_8.js').then(r => r.text()).then(t => t.substring(0, 300))" 2>&1

echo ""
echo "=== Test 3: Check bootstrap chunk ==="
agent-browser eval "fetch('/_next/static/chunks/08xkargds_ud8.js').then(r => r.text()).then(t => t.substring(0, 500))" 2>&1

echo ""
echo "=== Test 4: Wait and check __next_f after more time ==="
sleep 10
agent-browser eval "window.__next_f.length" 2>&1
agent-browser eval "window.__next_f" 2>&1

echo ""
echo "=== Test 5: Check RSC init script ==="
agent-browser eval "document.querySelector('script#_R_')?.src" 2>&1
agent-browser eval "document.querySelector('script#_R_')?.async" 2>&1

echo ""
echo "=== Test 6: Check all inline scripts ==="
agent-browser eval "Array.from(document.querySelectorAll('script:not([src])')).map((s,i) => 'Script ' + i + ': ' + s.textContent?.substring(0, 100)).join('\\n')" 2>&1

echo ""
echo "=== Test 7: Force re-check __next_f ==="
agent-browser eval "self.__next_f === window.__next_f" 2>&1

echo ""
echo "=== Test 8: Check if turbopack loaded ==="
agent-browser eval "typeof __turbopack_load__" 2>&1
agent-browser eval "typeof __webpack_require__" 2>&1
agent-browser eval "typeof __webpack_modules__" 2>&1
agent-browser eval "typeof __webpack_chunk_load__" 2>&1

echo ""
echo "=== Test 9: Check window.__next_rsc ==="
agent-browser eval "typeof window.__next_rsc_server_context" 2>&1
agent-browser eval "JSON.stringify(Object.keys(window).filter(k => k.includes('next') || k.includes('webpack') || k.includes('turbopack')).sort())" 2>&1

echo ""
echo "=== Test 10: Check loading.tsx is the one showing ==="
agent-browser eval "document.querySelector('[style*=\"#0a0c10\"]')?.parentElement?.innerHTML?.substring(0, 200)" 2>&1

echo ""
echo "=== Test 11: Run the page-level check directly ==="
agent-browser eval "fetch('/api/auth/me').then(r => ({status: r.status, ok: r.ok})).catch(e => ({error: e.message}))" 2>&1

echo ""
echo "=== Test 12: Manually trigger the auth check ==="
agent-browser eval "fetch('/api/auth/me').then(r => r.ok).then(ok => { if (!ok) { const mc = document.getElementById('main-content'); if (mc) mc.innerHTML = '<p>Auth check: not logged in (expected)</p>'; } else { mc.innerHTML = '<p>Auth check: logged in!</p>'; } })" 2>&1
sleep 2
agent-browser snapshot 2>&1

kill $SERVER_PID 2>/dev/null
echo "=== DONE ==="
