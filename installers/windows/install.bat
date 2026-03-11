@echo off
:: WatchNexus Windows Installer
:: Creates a portable installation with optional system tray launcher

setlocal EnableDelayedExpansion

set APP_NAME=WatchNexus
set APP_VERSION=2.8.0
set INSTALL_DIR=%LOCALAPPDATA%\WatchNexus
set START_MENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs\WatchNexus

echo ================================================
echo   %APP_NAME% v%APP_VERSION% - Windows Installer
echo ================================================
echo.

:: Check Python
echo [1/6] Checking dependencies...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python 3 is required but not found.
    echo Download from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is required but not found.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)
echo   All dependencies found.

:: Create directories
echo [2/6] Creating installation directory...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%START_MENU%" mkdir "%START_MENU%"

:: Copy backend
echo [3/6] Installing backend...
set SCRIPT_DIR=%~dp0..\..
xcopy /E /I /Y "%SCRIPT_DIR%\src\server" "%INSTALL_DIR%\backend" >nul

cd /d "%INSTALL_DIR%\backend"
python -m venv venv
call venv\Scripts\activate.bat
pip install --quiet -r requirements.txt
call deactivate

:: Build frontend
echo [4/6] Building frontend...
set TEMP_WEB=%TEMP%\watchnexus-web-build
xcopy /E /I /Y "%SCRIPT_DIR%\src\web" "%TEMP_WEB%" >nul
cd /d "%TEMP_WEB%"
call yarn install --frozen-lockfile --silent 2>nul
call yarn build 2>nul
xcopy /E /I /Y build "%INSTALL_DIR%\backend\frontend_build" >nul
rd /s /q "%TEMP_WEB%"

:: Copy tray app
echo [5/6] Installing tray application...
copy /Y "%SCRIPT_DIR%\tray_app.py" "%INSTALL_DIR%\" >nul 2>&1
copy /Y "%SCRIPT_DIR%\launch.py" "%INSTALL_DIR%\" >nul 2>&1

:: Create launcher batch files
echo [6/6] Creating shortcuts...

:: Server launcher
(
echo @echo off
echo cd /d "%INSTALL_DIR%\backend"
echo call venv\Scripts\activate.bat
echo echo WatchNexus starting on http://localhost:8001
echo python -m uvicorn server:app --host 0.0.0.0 --port 8001
) > "%INSTALL_DIR%\watchnexus-server.bat"

:: Tray launcher
(
echo @echo off
echo cd /d "%INSTALL_DIR%"
echo call backend\venv\Scripts\activate.bat
echo start /B pythonw tray_app.py --port 8001
) > "%INSTALL_DIR%\watchnexus-tray.bat"

:: Create Start Menu shortcuts
(
echo @echo off
echo start "" "%INSTALL_DIR%\watchnexus-tray.bat"
) > "%START_MENU%\WatchNexus.bat"

echo.
echo ================================================
echo   Installation complete!
echo ================================================
echo.
echo   Server:     %INSTALL_DIR%\watchnexus-server.bat
echo   Tray App:   %INSTALL_DIR%\watchnexus-tray.bat
echo   Dashboard:  http://localhost:8001
echo   Data dir:   %INSTALL_DIR%
echo.
echo   Start Menu entry created.
echo.
pause
