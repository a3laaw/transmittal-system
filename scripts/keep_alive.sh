#!/bin/bash
# Keep the Next.js production server alive — restart if it dies
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting server..." >> /tmp/keepalive.log
  NODE_ENV=production exec node .next/standalone/server.js 2>&1 | tee -a /tmp/prod.log
  echo "[$(date)] Server exited, restarting in 3s..." >> /tmp/keepalive.log
  sleep 3
done
