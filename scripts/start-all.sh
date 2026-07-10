#!/bin/bash
# DeepMindQ - Start app + bridge proxy with auto-restart
# Usage: bash scripts/start-all.sh

PROJECT_DIR="/home/z/my-project"
APP_PORT=8080
BRIDGE_PORT=3001
LOG_DIR="/tmp"

# Kill any existing processes
pkill -f "next start" 2>/dev/null
pkill -f "bridge-proxy" 2>/dev/null
sleep 1

echo "[start-all] Starting DeepMindQ..."

# Start Next.js app with auto-restart on port 8080
(
  cd "$PROJECT_DIR"
  while true; do
    echo "[$(date '+%H:%M:%S')] Starting Next.js on port $APP_PORT..."
    PORT=$APP_PORT HOSTNAME=0.0.0.0 npx next start -p $APP_PORT 2>&1 | tee "$LOG_DIR/deepmindq.log"
    echo "[$(date '+%H:%M:%S')] Next.js exited, restarting in 3s..."
    sleep 3
  done
) &
APP_PID=$!
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
  while true; do
    echo "[$(date '+%H:%M:%S')] Starting bridge proxy :$BRIDGE_PORT -> :$APP_PORT..."
    node "$PROJECT_DIR/scripts/bridge-proxy.js" 2>&1 | tee "$LOG_DIR/bridge-proxy.log"
    echo "[$(date '+%H:%M:%S')] Bridge proxy exited, restarting in 3s..."
    sleep 3
  done
) &
BRIDGE_PID=$!
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