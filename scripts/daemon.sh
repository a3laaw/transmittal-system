#!/bin/bash
# Double-fork daemon to keep server alive
cd /home/z/my-project

while true; do
  NODE_ENV=production node .next/standalone/server.js >> /tmp/prod.log 2>&1
  EXIT=$?
  echo "[$(date)] Server exited ($EXIT), restarting in 3s..." >> /tmp/keepalive.log
  sleep 3
done
