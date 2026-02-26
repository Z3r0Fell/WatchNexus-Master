@echo off
cd /d "%~dp0server"

python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python 3 is required.
    echo Download from https://python.org
    pause
    exit /b 1
)

if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat
echo Installing dependencies...
pip install -r requirements.txt --quiet

echo.
echo ==========================================
echo   WatchNexus v2.6.0 - Starting...
echo   Open http://localhost:8001 in browser
echo ==========================================
echo.
python server.py
pause
