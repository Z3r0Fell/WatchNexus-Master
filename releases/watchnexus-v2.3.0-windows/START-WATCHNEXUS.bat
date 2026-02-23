@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title WatchNexus v2.3.0

echo.
echo ╔════════════════════════════════════════════════╗
echo ║     WatchNexus v2.3.0                        ║
echo ║     Unified Media Pipeline                     ║
echo ║     ZERO EXTERNAL DEPENDENCIES                 ║
echo ╚════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

REM Check for Python
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python not found!
    echo.
    echo Please install Python 3.10 or higher:
    echo   1. Go to https://www.python.org/downloads/
    echo   2. Download Python 3.10+
    echo   3. IMPORTANT: Check "Add Python to PATH" during install
    echo.
    pause
    exit /b 1
)

REM Show Python version
for /f "tokens=*" %%i in ('python --version') do echo   %%i detected

REM Check/create venv
if not exist "backend\venv\Scripts\activate.bat" (
    echo.
    echo [SETUP] First run - setting up Python environment...
    echo   This may take 1-2 minutes.
    echo.
    cd backend
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install --upgrade pip --quiet
    pip install -r requirements.txt
    call deactivate
    cd ..
    echo.
    echo [OK] Setup complete!
)

REM Create minimal .env if needed
if not exist "backend\.env" (
    echo # WatchNexus Configuration> backend\.env
    echo # Database: SQLite (automatic, no setup needed)>> backend\.env
    echo TMDB_API_KEY=8c860bcb88494f598008480abfe24d13>> backend\.env
)

cd backend
call venv\Scripts\activate.bat
echo.
echo   Starting WatchNexus server...
echo.
echo   Open in your browser: http://localhost:8001
echo   Press Ctrl+C to stop
echo.
python -m uvicorn server:app --host 127.0.0.1 --port 8001
