@echo off
REM WatchNexus v2.5.10 - Unified Media Pipeline
REM Windows Start Script

echo Starting WatchNexus v2.5.10...
echo =====================================

REM Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Python is required but not installed.
    echo Please install Python 3.9+ from https://python.org
    pause
    exit /b 1
)

REM Navigate to script directory
cd /d "%~dp0"

REM Install backend dependencies
echo Installing backend dependencies...
cd backend
pip install -r requirements.txt --quiet

REM Start backend server
echo Starting backend server on port 8001...
start /B python server.py

REM Wait for server to start
timeout /t 3 >nul

echo.
echo =====================================
echo WatchNexus v2.5.10 is running!
echo =====================================
echo.
echo Open your browser and navigate to:
echo   http://localhost:8001
echo.
echo Press any key to stop the server...
echo.

pause

REM Kill Python processes
taskkill /f /im python.exe >nul 2>nul
