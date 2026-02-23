@echo off
REM WatchNexus Beacon - System Tray Launcher (Windows)
REM Double-click this file to start WatchNexus

echo ============================================
echo   WatchNexus Beacon - Starting...
echo ============================================
echo.

cd /d "%~dp0"

REM Check for Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found!
    echo Please install Python 3.8+ from https://python.org
    pause
    exit /b 1
)

REM Check/Install dependencies
echo Checking dependencies...
pip show pystray >nul 2>&1
if errorlevel 1 (
    echo Installing required packages...
    pip install pystray pillow requests psutil --quiet
)

REM Start the tray app
echo Starting WatchNexus Beacon...
echo.
pythonw tray_app.py %*
