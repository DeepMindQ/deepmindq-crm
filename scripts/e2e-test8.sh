#!/bin/bash
cd /home/z/my-project

export DATABASE_URL="file:/home/z/my-project/db/custom.db"
export SESSION_TOKEN_HMAC_SECRET="this-is-a-dev-secret-key-that-is-at-least-32-chars-long-1234"
export NEXTAUTH_SECRET="this-is-a-dev-secret-key-that-is-at-least-32-chars-long-1234"
export TRACKING_SECRET="this-is-a-tracking-secret-min16"
export AUTHORIZED_EMAIL="admin@deepmindq.com"
export API_KEY_ENCRYPTION_KEY="this-is-an-encryption-key-that-is-at-least-32-chars-1234"
export OUTPUT=""

npx next start -p 3000 -H 0.0.0.0 > /tmp/e2e-server8.log 2>&1 &
SERVER_PID=$!

for i in $(seq 1 30); do
  sleep 1
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 --max-time 2 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" != "000" ]; then break; fi
  if ! kill -0 $SERVER_PID 2>/dev/null; then echo "Server died."; exit 1; fi
done

echo "=== Setup error capture ==="
agent-browser open http://localhost:3000 2>&1

# Set up error capture before waiting
agent-browser eval "window.__capturedErrors = []; window.addEventListener('error', e => { window.__capturedErrors.push({type:'error', message:e.message, filename:e.filename, lineno:e.lineno, colno:e.colno}); }); window.addEventListener('unhandledrejection', e => { window.__capturedErrors.push({type:'unhandled', reason: e.reason?.message || String(e.reason)}); }); 'Error capture installed'" 2>&1

echo "=== Waiting 15s ==="
sleep 15

echo "=== Captured errors ==="
agent-browser eval "JSON.stringify(window.__capturedErrors, null, 2)" 2>&1

echo ""
echo "=== Console messages via JS ==="
agent-browser eval "(() => { window.__consoleMsgs = []; ['log','warn','error','info'].forEach(lvl => { const orig = console[lvl]; console[lvl] = function() { window.__consoleMsgs.push({level: lvl, args: Array.from(arguments).map(a => typeof a === 'string' ? a : JSON.stringify(a)?.substring(0,200))}); orig.apply(console, arguments); }; }); return 'console capture installed'; })()" 2>&1

echo ""
echo "=== Also check via window.onerror ==="
agent-browser eval "window.__capturedErrors?.length" 2>&1

echo ""
echo "=== Check performance entries for JS errors ==="
agent-browser eval "performance.getEntriesByType('resource').filter(r => r.name.includes('.js')).map(r => r.name + ' size=' + r.transferSize + ' dur=' + r.duration.toFixed(0) + 'ms').join('\\n')" 2>&1

echo ""
echo "=== Check all loaded scripts ==="
agent-browser eval "Array.from(document.querySelectorAll('script[src]')).map(s => s.src).join('\\n')" 2>&1

echo ""
echo "=== Check for any hydration mismatch warnings ==="
agent-browser eval "document.title" 2>&1

echo ""
echo "=== Network requests to API ==="
agent-browser eval "performance.getEntriesByType('resource').filter(r => r.name.includes('/api/')).map(r => r.name + ' -> ' + r.responseStatus).join('\\n')" 2>&1

echo ""
echo "=== Server-side rendered vs client rendered check ==="
agent-browser eval "document.querySelector('#main-content > div > div > p')?.textContent" 2>&1

echo ""
echo "=== Check for Next.js specific globals ==="
agent-browser eval "JSON.stringify(Object.getOwnPropertyNames(window).filter(k => k.startsWith('__')).sort())" 2>&1

echo ""
echo "=== Check Turbopack global ==="
agent-browser eval "typeof __turbopack_load__" 2>&1
agent-browser eval "typeof __turbopack_chunk_load__" 2>&1

echo ""
echo "=== Navigate to marketing page ==="
agent-browser open http://localhost:3000/marketing 2>&1
sleep 10

echo "--- Marketing page snapshot ---"
agent-browser snapshot 2>&1

echo "--- Marketing body text ---"
agent-browser eval "document.body.innerText.substring(0, 500)" 2>&1

echo "--- Marketing errors ---"
agent-browser eval "JSON.stringify(window.__capturedErrors, null, 2)" 2>&1

echo "--- Marketing __next_f ---"
agent-browser eval "window.__next_f?.length" 2>&1

echo ""
echo "=== Try demo page ==="
agent-browser open http://localhost:3000/demo 2>&1
sleep 10

echo "--- Demo snapshot ---"
agent-browser snapshot 2>&1

echo "--- Demo body text ---"
agent-browser eval "document.body.innerText.substring(0, 500)" 2>&1

echo "--- Demo errors ---"
agent-browser eval "JSON.stringify(window.__capturedErrors, null, 2)" 2>&1

kill $SERVER_PID 2>/dev/null
echo "=== DONE ==="
