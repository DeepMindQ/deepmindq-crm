#!/bin/bash
# Auto-restart wrapper for the Next.js production server
# Uses bun as the runtime since it can bind ports in this environment

cd /home/z/my-project/.next/standalone
export DATABASE_URL="file:/home/z/my-project/db/custom.db"
export PORT=3000

echo "Starting LeadIntel server with auto-restart..."
while true; do
  bun server.js >> /tmp/leadintel.log 2>&1
  EXIT_CODE=$?
  echo "Server exited with code $EXIT_CODE, restarting in 2s..." >> /tmp/leadintel.log
  sleep 2
done