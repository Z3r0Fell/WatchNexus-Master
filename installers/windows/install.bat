@echo off
:: WatchNexus Windows Installer (.NET 10) — v1.0.1
:: Auto-start via Scheduled Task
setlocal EnableDelayedExpansion

set APP_NAME=WatchNexus
set APP_VERSION=1.0.1
set INSTALL_DIR=%LOCALAPPDATA%\WatchNexus

echo ================================================
echo   %APP_NAME% v%APP_VERSION% - Windows Installer
echo ================================================
echo.

:: Check .NET 10 SDK
dotnet --list-sdks 2>nul | findstr "10.0" >nul 2>&1
if errorlevel 1 (
    echo   [MISSING] .NET 10 SDK
    echo   Download: https://dotnet.microsoft.com/download/dotnet/10.0
    pause
    exit /b 1
) else (
    echo   [OK] .NET 10 SDK
)
echo.

set SCRIPT_DIR=%~dp0..\..

:: Build
echo [1/5] Building WatchNexus...
if not exist "%INSTALL_DIR%\data" mkdir "%INSTALL_DIR%\data"
if not exist "%INSTALL_DIR%\logs" mkdir "%INSTALL_DIR%\logs"
if not exist "%INSTALL_DIR%\bin\modules" mkdir "%INSTALL_DIR%\bin\modules"

cd /d "%SCRIPT_DIR%\src\watchnexus"
dotnet publish core\WatchNexus.Core.csproj -c Release -o "%INSTALL_DIR%\bin" --self-contained false
if errorlevel 1 (
    echo   [ERROR] Build failed
    pause
    exit /b 1
)

echo [2/5] Installing modules...
xcopy /E /I /Y modules "%INSTALL_DIR%\bin\modules" >nul

echo [3/5] Creating launcher...
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

:: Open Windows Firewall port
echo [4/5] Configuring firewall...
netsh advfirewall firewall add rule name="WatchNexus" dir=in action=allow protocol=TCP localport=8001 >nul 2>&1

:: Auto-start via Scheduled Task
echo [5/5] Registering auto-start...
schtasks /delete /tn "WatchNexus" /f >nul 2>&1
schtasks /create /tn "WatchNexus" /tr "wscript.exe \"%INSTALL_DIR%\WatchNexus-Service.vbs\"" /sc onstart /ru "NT AUTHORITY\NetworkService" /f >nul 2>&1
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
