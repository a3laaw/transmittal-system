@echo off
chcp 65001 >nul
title Nova EDMS
cd /d "%~dp0"

REM ====== Electron desktop mode (preferred) ======
if exist "%~dp0electron.exe" (
  if exist "%~dp0electron-main.js" (
    "%~dp0electron.exe" "%~dp0."
    goto :end
  )
  echo ERROR: electron-main.js not found next to electron.exe
  pause
  goto :end
)

REM ====== Browser fallback mode (requires Node.js) ======
echo [Electron not found] Starting in browser mode...
set NODE_ENV=production
set PORT=3000
where node >nul 2>nul
if %ERRORLEVEL% == 0 (
  start /b cmd /c "node server.js > server.log 2>&1"
  timeout /t 8 /nobreak >nul
  start http://localhost:3000
  echo App is running at http://localhost:3000
  echo Close this window to stop the server.
  pause
  taskkill /f /im node.exe >nul 2>nul
  goto :end
)
echo ERROR: Neither electron.exe nor Node.js was found.
echo Please install Node.js from https://nodejs.org/
pause
:end
