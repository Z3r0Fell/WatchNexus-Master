@echo off
setlocal enabledelayedexpansion

echo ==============================================
echo   WatchNexus v1.0.2 - Starting...
echo ==============================================
echo.

cd /d "%~dp0"

REM Check for Python
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Python not found. Please install Python 3.10+
    echo Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Check/create venv
if not exist "backend\venv\Scripts\activate.bat" (
    echo Setting up Python environment (first run)...
    cd backend
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install --upgrade pip
    pip install -r requirements.txt
    call venv\Scripts\deactivate.bat
    cd ..
    echo Setup complete!
    echo.
)

REM Check/create .env
if not exist "backend\.env" (
    echo Creating default configuration...
    (
        echo MONGO_URL=mongodb://localhost:27017
        echo DB_NAME=watchnexus
    ) > backend\.env
)

cd backend
call venv\Scripts\activate.bat
echo.
echo Starting WatchNexus server...
echo Access at: http://localhost:8001
echo Press Ctrl+C to stop.
echo.
python -m uvicorn server:app --host 127.0.0.1 --port 8001
