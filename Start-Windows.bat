@echo off
setlocal
cd /d "%~dp0\rekordbox"

echo ------------------------------------------
echo    DropCrate - DJ Library Tool Setup      
echo ------------------------------------------

:: Check for Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed.
    echo Please download and install it from: https://nodejs.org/
    pause
    exit /b 1
)

:: Initial setup if node_modules is missing
if not exist node_modules (
    echo [1/2] Installing dependencies (this may take a minute)...
    call npm install
) else (
    echo [1/2] Dependencies already installed.
)

echo [2/2] Starting DropCrate...
echo ------------------------------------------
echo The app will open at: http://localhost:8787
echo ------------------------------------------

:: Ensure desktop is built if dist is missing
if not exist "apps\desktop\dist" (
    echo First time setup: Building frontend assets...
    call npm run build:web
)

call npm run serve:web

pause
