#!/bin/bash
cd /home/z/my-project
while true; do
  PORT=3000 BACKEND_PORT=3789 bun scripts/proxy.ts >> /tmp/dmq-proxy.log 2>&1
  sleep 1
done
