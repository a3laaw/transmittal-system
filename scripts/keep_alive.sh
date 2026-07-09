#!/bin/bash
# Keep the Next.js server alive — restart if it dies
cd /home/z/my-project

while true; do
  echo "[$(date)] Starting server..."
  NODE_ENV=production node .next/standalone/server.js > /tmp/prod.log 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 3s..."
  sleep 3
done
