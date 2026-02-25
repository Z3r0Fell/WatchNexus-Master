@echo off
REM WatchNexus v2.5.13 - Unified Media Pipeline
REM Windows Start Script

echo Starting WatchNexus v2.5.13...
echo =====================================

REM Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python 3 is required but not installed.
    echo Please install Python from https://python.org
    pause
    exit /b 1
)

REM Navigate to script directory
cd /d "%~dp0"

REM Install backend dependencies
echo Installing backend dependencies...
cd server
pip install -r requirements.txt --quiet

REM Start backend server
echo Starting backend server on port 8001...
start "WatchNexus Server" python server.py

REM Wait for server to start
timeout /t 3 >nul

echo.
echo =====================================
echo WatchNexus v2.5.13 is running!
echo =====================================
echo.
echo Open your browser and navigate to:
echo   http://localhost:8001
echo.
echo Close this window to stop the server
echo.

pause
