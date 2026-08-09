#!/bin/bash
cd /home/z/my-project

export DATABASE_URL="file:/home/z/my-project/db/custom.db"
export SESSION_TOKEN_HMAC_SECRET="this-is-a-dev-secret-key-that-is-at-least-32-chars-long-1234"
export NEXTAUTH_SECRET="this-is-a-dev-secret-key-that-is-at-least-32-chars-long-1234"
export TRACKING_SECRET="this-is-a-tracking-secret-min16"
export AUTHORIZED_EMAIL="admin@deepmindq.com"
export API_KEY_ENCRYPTION_KEY="this-is-an-encryption-key-that-is-at-least-32-chars-1234"
export OUTPUT=""

# Use next start (not standalone) 
npx next start -p 3000 -H 0.0.0.0 > /tmp/e2e-server7.log 2>&1 &
SERVER_PID=$!

for i in $(seq 1 30); do
  sleep 1
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 --max-time 2 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" != "000" ]; then
    echo "Server ready! HTTP $HTTP_CODE"
    break
  fi
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "Server died. Log:"
    cat /tmp/e2e-server7.log
    exit 1
  fi
done

if [ "$HTTP_CODE" = "000" ]; then
  echo "Server never became ready"
  exit 1
fi

echo "=== Opening page ==="
agent-browser open http://localhost:3000 2>&1

echo "=== Waiting 15s for hydration ==="
sleep 15

echo "=== Page title ==="
agent-browser get title 2>&1

echo ""
echo "=== Full snapshot ==="
agent-browser snapshot 2>&1

echo ""
echo "=== Screenshot ==="
agent-browser screenshot /tmp/e2e-7-next-start.png 2>&1

echo ""
echo "=== Console messages ==="
agent-browser console 2>&1

echo ""
echo "=== Error messages ==="
agent-browser errors 2>&1

echo ""
echo "=== Body text ==="
agent-browser eval "document.body.innerText.substring(0, 2000)" 2>&1

echo ""
echo "=== __next_f length ==="
agent-browser eval "window.__next_f?.length" 2>&1

echo ""
echo "=== React globals ==="
agent-browser eval "typeof React" 2>&1

echo ""
echo "=== Main content inner HTML (first 3000) ==="
agent-browser eval "document.getElementById('main-content')?.innerHTML?.substring(0, 3000) || 'not found'" 2>&1

echo ""
echo "=== Check dark theme - background colors ==="
agent-browser eval "getComputedStyle(document.documentElement).backgroundColor" 2>&1
agent-browser eval "getComputedStyle(document.body).backgroundColor" 2>&1
agent-browser eval "document.querySelector('[style*=background]')?.getAttribute('style')?.substring(0, 100) || 'no inline bg style'" 2>&1

echo ""
echo "=== Check for Command Palette hint ==="
agent-browser eval "document.body.innerText.includes('⌘') ? 'Has ⌘' : 'No ⌘'" 2>&1
agent-browser eval "document.body.innerText.includes('Command') ? 'Has Command' : 'No Command'" 2>&1

kill $SERVER_PID 2>/dev/null
echo "=== DONE ==="
