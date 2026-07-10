#!/bin/bash
# DeepMindQ - Start app + bridge proxy with auto-restart
# Usage: bash scripts/start-all.sh

PROJECT_DIR="/home/z/my-project"
APP_PORT=8080
BRIDGE_PORT=3001
LOG_DIR="/tmp"

# Kill only our specific servers (PID-based, not pkill -f)
if [ -f /tmp/deepmindq-server.pid ]; then
  kill $(cat /tmp/deepmindq-server.pid) 2>/dev/null
  rm -f /tmp/deepmindq-server.pid
fi
if [ -f /tmp/deepmindq-bridge.pid ]; then
  kill $(cat /tmp/deepmindq-bridge.pid) 2>/dev/null
  rm -f /tmp/deepmindq-bridge.pid
fi
sleep 1

echo "[start-all] Starting DeepMindQ..."

# Start Next.js app with auto-restart on port 8080
(
  cd "$PROJECT_DIR"
  BACKOFF=1
  while true; do
    echo "[$(date '+%H:%M:%S')] Starting Next.js on port $APP_PORT..."
    PORT=$APP_PORT HOSTNAME=0.0.0.0 npx next start -p $APP_PORT 2>&1 | tee "$LOG_DIR/deepmindq.log"
    echo "[$(date '+%H:%M:%S')] Next.js exited, restarting in ${BACKOFF}s..."
    sleep $BACKOFF
    BACKOFF=$((BACKOFF * 2))
    if [ $BACKOFF -gt 30 ]; then BACKOFF=30; fi
  done
) &
APP_PID=$!
echo $APP_PID > /tmp/deepmindq-server.pid
echo "[start-all] Next.js PID: $APP_PID (port $APP_PORT)"

# Wait for app to be ready
echo "[start-all] Waiting for Next.js to be ready..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://localhost:$APP_PORT/ 2>/dev/null | grep -q "200"; then
    echo "[start-all] Next.js is ready!"
    break
  fi
  sleep 1
done

# Start bridge proxy with auto-restart
(
  BACKOFF=1
  while true; do
    echo "[$(date '+%H:%M:%S')] Starting bridge proxy :$BRIDGE_PORT -> :$APP_PORT..."
    node "$PROJECT_DIR/scripts/bridge-proxy.js" 2>&1 | tee "$LOG_DIR/bridge-proxy.log"
    echo "[$(date '+%H:%M:%S')] Bridge proxy exited, restarting in ${BACKOFF}s..."
    sleep $BACKOFF
    BACKOFF=$((BACKOFF * 2))
    if [ $BACKOFF -gt 30 ]; then BACKOFF=30; fi
  done
) &
BRIDGE_PID=$!
echo $BRIDGE_PID > /tmp/deepmindq-bridge.pid
echo "[start-all] Bridge proxy PID: $BRIDGE_PID (:$BRIDGE_PORT -> :$APP_PORT)"

# Final verification
sleep 2
echo ""
echo "=== Verification ==="
echo -n "Direct ($APP_PORT): "
curl -s -o /dev/null -w "%{http_code} (%{size_download}B)" --max-time 5 http://localhost:$APP_PORT/ 2>/dev/null
echo ""
echo -n "Bridge ($BRIDGE_PORT): "
curl -s -o /dev/null -w "%{http_code} (%{size_download}B)" --max-time 5 http://localhost:$BRIDGE_PORT/ 2>/dev/null
echo ""
echo -n "Caddy (81): "
curl -s -o /dev/null -w "%{http_code} (%{size_download}B)" --max-time 10 "http://localhost:81/?XTransformPort=$BRIDGE_PORT" 2>/dev/null
echo ""
echo ""
echo "[start-all] All services running. External URL: http://localhost:81/?XTransformPort=$BRIDGE_PORT"
echo "[start-all] App PID: $APP_PID | Bridge PID: $BRIDGE_PID"