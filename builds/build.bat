@echo off
REM WatchNexus Windows Build Script
REM Builds Windows installers (.exe, .msi)

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%.."
set "SERVER_DIR=%ROOT_DIR%\src\server"
set "WEB_DIR=%ROOT_DIR%\src\web"
set "BUILD_OUTPUT=%ROOT_DIR%\releases\installers"

echo ==========================================
echo   WatchNexus Windows Build System
echo ==========================================
echo.

REM Check Python
python --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Python 3 is required
    echo Download from: https://www.python.org/downloads/
    exit /b 1
)

REM Check Node.js
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Node.js is required
    echo Download from: https://nodejs.org/
    exit /b 1
)

REM Check Yarn
yarn --version >nul 2>&1
if %errorLevel% neq 0 (
    echo Installing Yarn...
    npm install -g yarn
)

REM Parse arguments
if "%1"=="clean" goto :clean
if "%1"=="backend" goto :build_backend
if "%1"=="frontend" goto :build_frontend
if "%1"=="electron" goto :build_electron
if "%1"=="deps" goto :install_deps
if "%1"=="help" goto :usage
goto :build_all

:install_deps
echo.
echo Installing build dependencies...
cd /d "%SERVER_DIR%"
pip install pyinstaller --quiet
pip install -r requirements.txt --quiet

cd /d "%WEB_DIR%"
call yarn install --silent
echo Dependencies installed
goto :eof

:build_backend
echo.
echo Building backend executable...
cd /d "%SERVER_DIR%"

REM Clean previous builds
if exist dist rmdir /s /q dist
if exist build rmdir /s /q build

REM Run PyInstaller
pyinstaller watchnexus.spec --clean --noconfirm

REM Create dist directory for electron-builder
if not exist "%WEB_DIR%\..\backend\dist" mkdir "%WEB_DIR%\..\backend\dist"
copy /Y dist\watchnexus-server.exe "%WEB_DIR%\..\backend\dist\"

echo Backend built successfully
goto :eof

:build_frontend
echo.
echo Building frontend...
cd /d "%WEB_DIR%"
call yarn build
echo Frontend built successfully
goto :eof

:build_electron
echo.
echo Building Windows installer...
cd /d "%WEB_DIR%"
call yarn electron:build:win
echo Windows installer built successfully
goto :collect_releases

:collect_releases
echo.
echo Collecting release artifacts...
if not exist "%BUILD_OUTPUT%" mkdir "%BUILD_OUTPUT%"
if exist "%WEB_DIR%\dist" (
    xcopy /E /I /Y "%WEB_DIR%\dist\*" "%BUILD_OUTPUT%\"
)
echo.
echo Installers are in: %BUILD_OUTPUT%
dir "%BUILD_OUTPUT%" 2>nul
goto :eof

:clean
echo Cleaning build artifacts...
if exist "%SERVER_DIR%\dist" rmdir /s /q "%SERVER_DIR%\dist"
if exist "%SERVER_DIR%\build" rmdir /s /q "%SERVER_DIR%\build"
if exist "%WEB_DIR%\build" rmdir /s /q "%WEB_DIR%\build"
if exist "%WEB_DIR%\dist" rmdir /s /q "%WEB_DIR%\dist"
if exist "%BUILD_OUTPUT%" rmdir /s /q "%BUILD_OUTPUT%"
echo Cleaned
goto :eof

:build_all
call :install_deps
call :build_backend
call :build_frontend
call :build_electron
echo.
echo ==========================================
echo   Build Complete!
echo ==========================================
echo.
echo Installers are in: %BUILD_OUTPUT%
goto :eof

:usage
echo Usage: build.bat [command]
echo.
echo Commands:
echo   (none)    - Build everything
echo   backend   - Build only backend executable
echo   frontend  - Build only frontend
echo   electron  - Build only Windows installer
echo   deps      - Install dependencies only
echo   clean     - Clean all build artifacts
echo   help      - Show this help
goto :eof
