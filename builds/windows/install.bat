@echo off
REM WatchNexus Windows Installer
REM Installs all dependencies and sets up the application

echo ==========================================
echo   WatchNexus Windows Installer
echo ==========================================
echo.

REM Check for administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo This installer requires administrator privileges.
    echo Please right-click and select "Run as administrator"
    pause
    exit /b 1
)

REM Set installation directory
set "INSTALL_DIR=%USERPROFILE%\WatchNexus"
set "DATA_DIR=%USERPROFILE%\.watchnexus"

REM Create directories
echo Creating directories...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"
if not exist "%DATA_DIR%\logs" mkdir "%DATA_DIR%\logs"
if not exist "%DATA_DIR%\backups" mkdir "%DATA_DIR%\backups"
if not exist "%DATA_DIR%\cache" mkdir "%DATA_DIR%\cache"

REM Check for Python
echo.
echo Checking for Python...
python --version >nul 2>&1
if %errorLevel% neq 0 (
    echo Python not found!
    echo.
    echo Please install Python 3.10+ from:
    echo   https://www.python.org/downloads/
    echo.
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)
echo Python found.

REM Check for Node.js
echo.
echo Checking for Node.js...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo Node.js not found!
    echo.
    echo Please install Node.js LTS from:
    echo   https://nodejs.org/
    pause
    exit /b 1
)
echo Node.js found.

REM Check for Yarn
echo.
echo Checking for Yarn...
yarn --version >nul 2>&1
if %errorLevel% neq 0 (
    echo Installing Yarn...
    npm install -g yarn
)
echo Yarn available.

REM Copy application files
echo.
echo Copying application files...
set "SCRIPT_DIR=%~dp0"

if exist "%SCRIPT_DIR%server" (
    xcopy /E /I /Y "%SCRIPT_DIR%server" "%INSTALL_DIR%\server"
) else if exist "%SCRIPT_DIR%..\separated\server" (
    xcopy /E /I /Y "%SCRIPT_DIR%..\separated\server" "%INSTALL_DIR%\server"
)

if exist "%SCRIPT_DIR%web" (
    xcopy /E /I /Y "%SCRIPT_DIR%web" "%INSTALL_DIR%\web"
) else if exist "%SCRIPT_DIR%..\separated\web" (
    xcopy /E /I /Y "%SCRIPT_DIR%..\separated\web" "%INSTALL_DIR%\web"
)

REM Setup Python virtual environment
echo.
echo Setting up Python environment...
cd /d "%INSTALL_DIR%\server"
python -m venv venv
call venv\Scripts\activate.bat
pip install --upgrade pip
pip install -r requirements.txt
call venv\Scripts\deactivate.bat

REM Setup Node.js dependencies
echo.
echo Setting up Node.js environment...
if exist "%INSTALL_DIR%\web\package.json" (
    cd /d "%INSTALL_DIR%\web"
    call yarn install --production
)

REM Create environment file
echo.
echo Creating environment configuration...
if not exist "%INSTALL_DIR%\server\.env" (
    echo # WatchNexus Configuration > "%INSTALL_DIR%\server\.env"
    echo JWT_SECRET=change-this-to-a-secure-random-string >> "%INSTALL_DIR%\server\.env"
    echo. >> "%INSTALL_DIR%\server\.env"
    echo # Optional: TMDB API key for metadata >> "%INSTALL_DIR%\server\.env"
    echo # TMDB_API_KEY=your-key-here >> "%INSTALL_DIR%\server\.env"
    echo. >> "%INSTALL_DIR%\server\.env"
    echo DATA_DIR=%DATA_DIR% >> "%INSTALL_DIR%\server\.env"
)

REM Create start script
echo.
echo Creating start script...
(
echo @echo off
echo cd /d "%INSTALL_DIR%\server"
echo call venv\Scripts\activate.bat
echo uvicorn server:app --host 0.0.0.0 --port 8001
) > "%INSTALL_DIR%\start.bat"

REM Create desktop shortcut
echo.
echo Creating desktop shortcut...
set "SHORTCUT=%USERPROFILE%\Desktop\WatchNexus.lnk"
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = '%INSTALL_DIR%\start.bat'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.Description = 'WatchNexus Media Server'; $s.Save()"

REM Create Start Menu shortcut
set "START_MENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs"
if not exist "%START_MENU%\WatchNexus" mkdir "%START_MENU%\WatchNexus"
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%START_MENU%\WatchNexus\WatchNexus.lnk'); $s.TargetPath = '%INSTALL_DIR%\start.bat'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.Save()"

echo.
echo ==========================================
echo   Installation Complete!
echo ==========================================
echo.
echo Installation directory: %INSTALL_DIR%
echo.
echo To start WatchNexus:
echo   Double-click the desktop shortcut, or
echo   Run: %INSTALL_DIR%\start.bat
echo.
echo Then open: http://localhost:8001
echo.
echo Note: For FFmpeg support (video transcoding), download from:
echo   https://ffmpeg.org/download.html
echo   and add to your system PATH.
echo.
pause
