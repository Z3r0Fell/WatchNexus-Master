@echo off
setlocal EnableDelayedExpansion

:: WatchNexus Windows Installer
:: Downloads and installs prerequisites automatically

set VERSION=2.6.1
set INSTALL_DIR=%LOCALAPPDATA%\WatchNexus
set DATA_DIR=%USERPROFILE%\.watchnexus
set DOWNLOAD_URL=https://github.com/watchnexus/watchnexus/releases/download/v%VERSION%

title WatchNexus Installer v%VERSION%

echo.
echo   WatchNexus Installer v%VERSION%
echo   ================================
echo.

:: Check admin rights for installing dependencies
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Some features require administrator privileges.
    echo [!] Right-click and "Run as administrator" for full install.
    echo.
)

:: Create directories
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

:: Check/Install Python
echo [*] Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] Python not found. Downloading...
    call :install_python
) else (
    for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYVER=%%i
    echo [+] Python !PYVER! found
)

:: Check/Install Node.js
echo [*] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] Node.js not found. Downloading...
    call :install_node
) else (
    for /f "tokens=1" %%i in ('node --version') do set NODEVER=%%i
    echo [+] Node.js !NODEVER! found
)

:: Download WatchNexus
echo [*] Downloading WatchNexus...
cd /d "%INSTALL_DIR%"

:: Try PowerShell download
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%DOWNLOAD_URL%/watchnexus-%VERSION%-windows.zip' -OutFile 'watchnexus.zip'}" 2>nul

if exist watchnexus.zip (
    echo [*] Extracting...
    powershell -Command "Expand-Archive -Path watchnexus.zip -DestinationPath . -Force"
    del watchnexus.zip
    echo [+] Downloaded release package
) else (
    echo [!] Release not found, will clone from git...
    where git >nul 2>&1
    if %errorlevel% equ 0 (
        git clone --depth 1 https://github.com/watchnexus/watchnexus.git .
    ) else (
        echo [!] Git not installed. Please download manually from:
        echo     https://github.com/watchnexus/watchnexus/releases
        pause
        exit /b 1
    )
)

:: Setup Python environment
echo [*] Setting up backend...
cd /d "%INSTALL_DIR%"

:: Find server directory
set SERVER_DIR=
if exist "src\server" set SERVER_DIR=src\server
if exist "server" set SERVER_DIR=server
if exist "separated\server" set SERVER_DIR=separated\server

if "!SERVER_DIR!"=="" (
    echo [!] Server directory not found
    pause
    exit /b 1
)

cd /d "%INSTALL_DIR%\!SERVER_DIR!"

python -m venv venv
call venv\Scripts\activate.bat
pip install --upgrade pip -q
pip install -r requirements.txt -q
call venv\Scripts\deactivate.bat

:: Create env file
if not exist .env (
    echo JWT_SECRET=%RANDOM%%RANDOM%%RANDOM%%RANDOM%> .env
    echo DATA_DIR=%DATA_DIR%>> .env
)

echo [+] Backend configured

:: Create start script
echo [*] Creating launcher...
cd /d "%INSTALL_DIR%"

(
echo @echo off
echo cd /d "%INSTALL_DIR%\!SERVER_DIR!"
echo call venv\Scripts\activate.bat
echo uvicorn server:app --host 127.0.0.1 --port 8001
) > "%INSTALL_DIR%\WatchNexus.bat"

:: Create desktop shortcut
echo [*] Creating shortcuts...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%USERPROFILE%\Desktop\WatchNexus.lnk'); $s.TargetPath = '%INSTALL_DIR%\WatchNexus.bat'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.Description = 'WatchNexus Media Server'; $s.Save()"

:: Start menu shortcut
set START_MENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs
if not exist "%START_MENU%\WatchNexus" mkdir "%START_MENU%\WatchNexus"
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%START_MENU%\WatchNexus\WatchNexus.lnk'); $s.TargetPath = '%INSTALL_DIR%\WatchNexus.bat'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.Save()"

echo [+] Shortcuts created

echo.
echo   ================================
echo   [+] Installation complete!
echo.
echo   Start WatchNexus:
echo     Double-click desktop shortcut, or
echo     Run: %INSTALL_DIR%\WatchNexus.bat
echo.
echo   Then open: http://localhost:8001
echo.
pause
exit /b 0

:: Functions

:install_python
echo [*] Downloading Python installer...
set PY_URL=https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe
set PY_INSTALLER=%TEMP%\python-installer.exe

powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%PY_URL%' -OutFile '%PY_INSTALLER%'"

if exist "%PY_INSTALLER%" (
    echo [*] Installing Python 3.11...
    "%PY_INSTALLER%" /quiet InstallAllUsers=0 PrependPath=1 Include_pip=1
    del "%PY_INSTALLER%"
    
    :: Refresh PATH
    set "PATH=%LOCALAPPDATA%\Programs\Python\Python311;%LOCALAPPDATA%\Programs\Python\Python311\Scripts;%PATH%"
    
    echo [+] Python installed
) else (
    echo [!] Failed to download Python. Install manually from python.org
)
goto :eof

:install_node
echo [*] Downloading Node.js installer...
set NODE_URL=https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi
set NODE_INSTALLER=%TEMP%\node-installer.msi

powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_INSTALLER%'"

if exist "%NODE_INSTALLER%" (
    echo [*] Installing Node.js 20 LTS...
    msiexec /i "%NODE_INSTALLER%" /qn
    del "%NODE_INSTALLER%"
    
    echo [+] Node.js installed
    echo [!] You may need to restart your terminal for PATH changes
) else (
    echo [!] Failed to download Node.js. Install manually from nodejs.org
)
goto :eof
