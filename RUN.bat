@echo off
chcp 65001 >nul
title Nova EDMS
cd /d "%~dp0"
if exist "%~dp0electron.exe" (
  "%~dp0electron.exe" .
  goto :end
)
echo Starting in browser mode...
set NODE_ENV=production
set PORT=3000
where node >nul 2>nul
if %ERRORLEVEL% == 0 (
  start /b cmd /c "node server.js > server.log 2>&1"
  timeout /t 8 /nobreak >nul
  start http://localhost:3000
  pause
  taskkill /f /im node.exe >nul 2>nul
  goto :end
)
echo Please install Node.js
pause
:end
