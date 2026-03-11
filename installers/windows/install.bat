@echo off
:: WatchNexus Windows Installer (.NET 8)
setlocal EnableDelayedExpansion

set APP_NAME=WatchNexus
set APP_VERSION=3.0.0-beta
set INSTALL_DIR=%LOCALAPPDATA%\WatchNexus
set START_MENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs

echo ================================================
echo   %APP_NAME% v%APP_VERSION% - Windows Installer
echo ================================================
echo.

:: Check .NET 8
echo [1/4] Checking .NET 8 runtime...
dotnet --list-runtimes 2>nul | findstr "AspNetCore" >nul 2>&1
if errorlevel 1 (
    echo ERROR: ASP.NET Core 8 runtime required.
    echo Download from: https://dotnet.microsoft.com/download/dotnet/8.0
    echo Select: ASP.NET Core Runtime 8.x ^(Windows x64 Installer^)
    pause
    exit /b 1
)
echo   .NET 8 runtime found.

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
