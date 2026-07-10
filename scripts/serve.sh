#!/bin/bash
cd /home/z/my-project
BACKOFF=1
while true; do
  NODE_OPTIONS="--dns-result-order=ipv4first" npx next start -p 8080 2>>/tmp/next-out.log
  echo "Server crashed, restarting in ${BACKOFF}s..."
  sleep $BACKOFF
  BACKOFF=$((BACKOFF * 2))
  if [ $BACKOFF -gt 30 ]; then BACKOFF=30; fi
done