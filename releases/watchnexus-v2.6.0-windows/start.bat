@echo off
cd /d "%~dp0server"

echo Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python 3 is required but not installed.
    echo Download from https://python.org
    pause
    exit /b 1
)

if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing dependencies...
pip install -r requirements.txt --quiet

echo.
echo Starting WatchNexus v2.6.0...
echo Open http://localhost:8001 in your browser
echo.
python server.py
pause
