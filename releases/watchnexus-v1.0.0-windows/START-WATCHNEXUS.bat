@echo off
title WatchNexus Server
echo ===============================================
echo   WatchNexus - Unified Media Pipeline
echo ===============================================
echo.

REM Check if Python venv exists
if not exist "backend\venv\Scripts\activate.bat" (
    echo Setting up Python environment...
    cd backend
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install --upgrade pip
    pip install -r requirements.txt
    cd ..
    echo Setup complete!
    echo.
)

REM Check for .env file
if not exist "backend\.env" (
    echo Creating default configuration...
    echo MONGO_URL=mongodb://localhost:27017 > backend\.env
    echo DB_NAME=watchnexus >> backend\.env
)

cd backend
call venv\Scripts\activate.bat
echo.
echo Starting WatchNexus server...
echo Access the application at: http://localhost:8001
echo Press Ctrl+C to stop the server.
echo.
python -m uvicorn server:app --host 127.0.0.1 --port 8001
