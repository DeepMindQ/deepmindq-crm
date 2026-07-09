#!/bin/bash
# DeepMindQ - Persistent backend auto-restart
cd /home/z/my-project/.next/standalone
export DATABASE_URL="file:/home/z/my-project/db/custom.db"
while true; do
  PORT=3789 bun server.js >> /tmp/dmq-backend.log 2>&1
  sleep 1
done