@echo off
chcp 65001 >nul
title Site Secretary - نظام سكرتير الموقع
cd /d "%~dp0"

echo ============================================================
echo   Site Secretary - نظام سكرتير الموقع
echo   Starting application...
echo ============================================================
echo.

REM Try to find Electron (preferred for desktop app experience)
where electron >nul 2>nul
if %ERRORLEVEL% == 0 (
  echo Launching with Electron...
  electron .
  goto :end
)

REM Check if electron.exe exists in node_modules
if exist "node_modules\.bin\electron.cmd" (
  echo Launching with local Electron...
  call node_modules\.bin\electron.cmd .
  goto :end
)

REM Check if electron.exe exists alongside this batch file
if exist "electron.exe" (
  echo Launching with bundled Electron...
  electron.exe .
  goto :end
)

REM Fallback: launch the Next.js server directly in browser
echo Electron not found. Launching in browser mode...
echo.
echo The app will open in your default browser at http://localhost:3000
echo.
echo IMPORTANT: Keep this window open while using the app.
echo Close this window to stop the application.
echo.

REM Try Node.js first
where node >nul 2>nul
if %ERRORLEVEL% == 0 (
  echo Starting Node.js server...
  set NODE_ENV=production
  set PORT=3000
  start /b cmd /c "node server.js ^> server.log 2^>^&1"
  timeout /t 5 /nobreak >nul
  start http://localhost:3000
  echo.
  echo Server is running. Press Ctrl+C to stop.
  echo.
  cmd /k
  goto :end
)

REM Try Bun
where bun >nul 2>nul
if %ERRORLEVEL% == 0 (
  echo Starting Bun server...
  set NODE_ENV=production
  set PORT=3000
  start /b cmd /c "bun server.js ^> server.log 2^>^&1"
  timeout /t 5 /nobreak >nul
  start http://localhost:3000
  echo.
  echo Server is running. Press Ctrl+C to stop.
  echo.
  cmd /k
  goto :end
)

echo.
echo ERROR: Neither Electron nor Node.js/Bun was found.
echo.
echo Please install:
echo   1. Node.js from https://nodejs.org/
echo   OR
echo   2. Place electron.exe in this folder
echo.
pause

:end
