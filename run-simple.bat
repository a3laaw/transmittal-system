@echo off
REM Desktop simple — لا تحتاج أي أمر آخر
if not exist .env (
  echo DATABASE_URL=file:./db/custom.db > .env
)
start "Site Secretary" http://localhost:3000
node .next/standalone/server.js
