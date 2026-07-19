@echo off
chcp 65001 >nul
title Site Secretary - نظام سكرتير الموقع
cd /d "%~dp0"

echo ============================================================
echo   Site Secretary - نظام سكرتير الموقع
echo   Starting application...
echo ============================================================
echo.

REM Check if electron.exe is bundled alongside this batch file (preferred)
if exist "%~dp0electron.exe" (
  echo Launching Site Secretary with Electron...
  echo.
  echo A desktop window will open shortly. Please wait...
  echo.
  "%~dp0electron.exe" .
  goto :end
)

REM Check if electron.exe is in PATH
where electron >nul 2>nul
if %ERRORLEVEL% == 0 (
  echo Launching with Electron from PATH...
  electron .
  goto :end
)

REM Check if electron is in node_modules
if exist "%~dp0node_modules\.bin\electron.cmd" (
  echo Launching with local Electron...
  call "%~dp0node_modules\.bin\electron.cmd" .
  goto :end
)

REM ============================================================
REM Fallback: Browser mode (requires Node.js)
REM ============================================================
echo Electron not found. Launching in browser mode...
echo.
echo The app will open in your default browser at http://localhost:3000
echo.
echo IMPORTANT: Keep this window open while using the app.
echo Close this window to stop the application.
echo.

REM Set environment variables for the server
set NODE_ENV=production
set PORT=3000
set HOSTNAME=0.0.0.0
set DATABASE_URL=file:%~dp0db\custom.db

REM Use the database in the local db/ folder (Windows path)
if not exist "%~dp0db\custom.db" (
  echo WARNING: Database file not found at db\custom.db
  echo A new empty database will be created.
)

REM Try Node.js first
where node >nul 2>nul
if %ERRORLEVEL% == 0 (
  echo Starting Node.js server...
  start /b cmd /c "node server.js ^> server.log 2^>^&1"
  echo Waiting for server to start...
  timeout /t 10 /nobreak >nul
  echo Opening browser...
  start http://localhost:3000
  echo.
  echo ============================================================
  echo   Server is running at http://localhost:3000
  echo   Close this window to stop the server and exit.
  echo ============================================================
  pause >nul
  taskkill /f /im node.exe >nul 2>nul
  goto :end
)

REM Try Bun
where bun >nul 2>nul
if %ERRORLEVEL% == 0 (
  echo Starting Bun server...
  start /b cmd /c "bun server.js ^> server.log 2^>^&1"
  timeout /t 5 /nobreak >nul
  start http://localhost:3000
  echo.
  echo ============================================================
  echo   Server is running at http://localhost:3000
  echo   Press any key to stop the server and exit.
  echo ============================================================
  pause >nul
  goto :end
)

echo.
echo ============================================================
echo   ERROR: Could not find Electron, Node.js, or Bun.
echo ============================================================
echo.
echo This package should have electron.exe included.
echo If it's missing, please re-download the package.
echo.
echo Alternatively, install Node.js from https://nodejs.org/
echo.
pause

:end
