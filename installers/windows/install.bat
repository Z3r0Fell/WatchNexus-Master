@echo off
:: WatchNexus Windows Installer (.NET 10) — v2.6.5
:: Auto-start via Scheduled Task
setlocal EnableDelayedExpansion

set APP_NAME=WatchNexus
set APP_VERSION=2.6.5
set INSTALL_DIR=%LOCALAPPDATA%\WatchNexus

echo ================================================
echo   %APP_NAME% v%APP_VERSION% - Windows Installer
echo ================================================
echo.

:: Check .NET 10
dotnet --list-runtimes 2>nul | findstr "AspNetCore" >nul 2>&1
if errorlevel 1 (
    echo   [MISSING] ASP.NET Core 10 Runtime
    echo   Download: https://dotnet.microsoft.com/download/dotnet/10.0
    pause
    exit /b 1
) else (
    echo   [OK] .NET ASP.NET Core Runtime
)
echo.

set SCRIPT_DIR=%~dp0..\..

:: Build
echo [1/4] Building WatchNexus...
if not exist "%INSTALL_DIR%\data" mkdir "%INSTALL_DIR%\data"
if not exist "%INSTALL_DIR%\logs" mkdir "%INSTALL_DIR%\logs"
if not exist "%INSTALL_DIR%\modules" mkdir "%INSTALL_DIR%\modules"

cd /d "%SCRIPT_DIR%\watchnexus"
dotnet publish core\WatchNexus.Core.csproj -c Release -o "%INSTALL_DIR%\bin" --self-contained false

echo [2/4] Installing modules...
xcopy /E /I /Y modules "%INSTALL_DIR%\modules" >nul

echo [3/4] Creating launcher...
(
echo @echo off
echo set ASPNETCORE_URLS=http://0.0.0.0:8001
echo cd /d "%INSTALL_DIR%\bin"
echo dotnet WatchNexus.Core.dll %%*
) > "%INSTALL_DIR%\WatchNexus.bat"

:: Hidden launcher (no console window)
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.Run """%INSTALL_DIR%\WatchNexus.bat""", 0, False
) > "%INSTALL_DIR%\WatchNexus-Service.vbs"

:: Auto-start via Scheduled Task
echo [4/4] Registering auto-start...
schtasks /delete /tn "WatchNexus" /f >nul 2>&1
schtasks /create /tn "WatchNexus" /tr "wscript.exe \"%INSTALL_DIR%\WatchNexus-Service.vbs\"" /sc onstart /ru "%USERNAME%" /rl highest /f >nul 2>&1
if errorlevel 1 (
    echo   [WARN] Could not create startup task. Add manually via Task Scheduler.
) else (
    echo   [OK] Scheduled Task registered — starts at boot
)

echo.
echo ================================================
echo   Installation complete!  v%APP_VERSION%
echo ================================================
echo.
echo   Dashboard: http://localhost:8001
echo   Install:   %INSTALL_DIR%
echo.
echo   Auto-start: ENABLED
echo   WatchNexus starts on every boot.
echo.
echo   To disable: schtasks /change /tn WatchNexus /disable
echo.
pause
