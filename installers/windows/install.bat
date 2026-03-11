@echo off
:: WatchNexus Windows Installer (.NET 10)
setlocal EnableDelayedExpansion

set APP_NAME=WatchNexus
set APP_VERSION=3.0.0-beta
set INSTALL_DIR=%LOCALAPPDATA%\WatchNexus
set START_MENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs

echo ================================================
echo   %APP_NAME% v%APP_VERSION% - Windows Installer
echo ================================================
echo.

:: Prerequisite check
echo Checking prerequisites...
echo   -----------------------------------------------

:: Check .NET 10
echo   Checking .NET 10 runtime...
dotnet --list-runtimes 2>nul | findstr "AspNetCore" >nul 2>&1
if errorlevel 1 (
    echo   [MISSING] ASP.NET Core 10 Runtime
    echo.
    echo   ERROR: ASP.NET Core 10 runtime is required.
    echo   Download from: https://dotnet.microsoft.com/download/dotnet/10.0
    echo   Select: ASP.NET Core Runtime 10.x ^(Windows x64 Installer^)
    echo.
    pause
    exit /b 1
) else (
    echo   [OK]      .NET ASP.NET Core Runtime found
)

:: Check Node.js (optional)
where node >nul 2>&1
if errorlevel 1 (
    echo   [INFO]    Node.js not found ^(optional, for frontend build^)
) else (
    for /f "delims=" %%v in ('node --version 2^>nul') do echo   [OK]      Node.js %%v
)

echo   -----------------------------------------------
echo.

:: Create dirs
echo [2/4] Creating installation directory...
if not exist "%INSTALL_DIR%\data" mkdir "%INSTALL_DIR%\data"
if not exist "%INSTALL_DIR%\logs" mkdir "%INSTALL_DIR%\logs"
if not exist "%INSTALL_DIR%\modules" mkdir "%INSTALL_DIR%\modules"

:: Build
echo [3/4] Building WatchNexus...
set SCRIPT_DIR=%~dp0..\..
cd /d "%SCRIPT_DIR%\watchnexus"
dotnet publish core\WatchNexus.Core.csproj -c Release -o "%INSTALL_DIR%\bin" --self-contained false
xcopy /E /I /Y modules "%INSTALL_DIR%\modules" >nul

:: Create launcher
echo [4/4] Creating launcher...
(
echo @echo off
echo set ASPNETCORE_URLS=http://0.0.0.0:8001
echo cd /d "%INSTALL_DIR%\bin"
echo dotnet WatchNexus.Core.dll %%*
) > "%INSTALL_DIR%\WatchNexus.bat"

:: Start menu shortcut
copy /Y "%INSTALL_DIR%\WatchNexus.bat" "%START_MENU%\WatchNexus.bat" >nul

echo.
echo ================================================
echo   Installation complete!
echo ================================================
echo.
echo   Run:       %INSTALL_DIR%\WatchNexus.bat
echo   Dashboard: http://localhost:8001
echo.
pause
