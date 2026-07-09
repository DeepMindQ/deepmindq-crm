#!/bin/bash
# DeepMindQ - Auto-restart dev server
cd /home/z/my-project
echo "$(date): Starting DeepMindQ server on port 3000..."
while true; do
  PORT=3000 bun run next dev -p 3000 >> /tmp/deepmindq-server.log 2>&1
  EXIT=$?
  echo "$(date): Server exited (code=$EXIT), restarting in 2s..." >> /tmp/deepmindq-server.log
  sleep 2
done