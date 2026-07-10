#!/bin/bash
cd /home/z/my-project
while true; do
  NODE_OPTIONS="--dns-result-order=ipv4first" npx next start -p 8080 2>>/tmp/next-out.log
  sleep 1
done
