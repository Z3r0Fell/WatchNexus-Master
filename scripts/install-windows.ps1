#===============================================================================
# WatchNexus Installation Script for Windows
# v2.6.5 — Installs WatchNexus + registers a Scheduled Task for auto-start
# Run as Administrator
#===============================================================================

#Requires -RunAsAdministrator
#Requires -Version 5.1

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$InstallDir = "$env:ProgramFiles\WatchNexus"
$DataDir = "$env:LOCALAPPDATA\WatchNexus"
$Version = "2.6.5"
$ServiceName = "WatchNexus"

$NodeUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
$PythonUrl = "https://www.python.org/ftp/python/3.11.7/python-3.11.7-amd64.exe"

function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Err { Write-Host "[ERROR] $args" -ForegroundColor Red }

function Test-CommandExists {
    param($Command)
    [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

function Get-FileFromUrl {
    param($Url, $OutputPath, $Description)
    Write-Info "Downloading $Description..."
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        (New-Object System.Net.WebClient).DownloadFile($Url, $OutputPath)
        return $true
    } catch { Write-Err "Download failed: $_"; return $false }
}

function Update-EnvironmentPath {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

Write-Host "`n==============================================`n  WatchNexus Installer - Windows  v$Version`n==============================================`n" -ForegroundColor White

#===============================================================================
# PREREQUISITE CHECK
#===============================================================================
function Test-Prerequisites {
    Write-Host "Checking prerequisites..." -ForegroundColor White
    $found = @(); $missing = @()

    if (Test-CommandExists "python") { $found += "Python   $(python --version 2>&1)" }
    elseif (Test-CommandExists "py") { $found += "Python   $(py --version 2>&1)" }
    else { $missing += "Python 3.10+ (https://www.python.org/downloads/)" }

    if (Test-CommandExists "node") { $found += "Node.js  $(node --version)" }
    else { $missing += "Node.js 20+ (https://nodejs.org/)" }

    if (Test-CommandExists "yarn") { $found += "Yarn     v$(yarn --version)" }
    else { $missing += "Yarn" }

    if (Test-CommandExists "mongod") { $found += "MongoDB  (installed)" }
    else { $missing += "MongoDB 7.x (https://www.mongodb.com/try/download/community)" }

    Write-Host "  Prerequisite Status:" -ForegroundColor Cyan
    Write-Host "  -----------------------------------------------"
    foreach ($item in $found) { Write-Host "  " -NoNewline; Write-Host "OK     " -ForegroundColor Green -NoNewline; Write-Host " $item" }
    foreach ($item in $missing) { Write-Host "  " -NoNewline; Write-Host "MISSING" -ForegroundColor Red -NoNewline; Write-Host " $item" }
    Write-Host "  -----------------------------------------------`n"

    if ($missing.Count -gt 0) {
        $answer = Read-Host "  Install missing dependencies automatically? (y/n)"
        if ($answer -ne "y" -and $answer -ne "Y") { Write-Info "Cancelled."; exit 0 }
    } else { Write-Host "  All prerequisites satisfied!" -ForegroundColor Green }
    Write-Host ""
}

function Install-Dependencies {
    Write-Host "[1/8] Installing dependencies..." -ForegroundColor Cyan
    $tempDir = "$env:TEMP\watchnexus_install"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

    if (!(Test-CommandExists "node")) {
        $nodeMsi = "$tempDir\node.msi"
        if (Get-FileFromUrl $NodeUrl $nodeMsi "Node.js") {
            Start-Process msiexec.exe -ArgumentList "/i `"$nodeMsi`" /qn /norestart" -Wait -NoNewWindow
            Update-EnvironmentPath
        }
    }

    if (!(Test-CommandExists "python") -and !(Test-CommandExists "py")) {
        $pythonExe = "$tempDir\python.exe"
        if (Get-FileFromUrl $PythonUrl $pythonExe "Python") {
            Start-Process $pythonExe -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1" -Wait -NoNewWindow
            Update-EnvironmentPath
        }
    }

    Update-EnvironmentPath
    if (!(Test-CommandExists "yarn") -and (Test-CommandExists "npm")) {
        npm install -g yarn 2>&1 | Out-Null
        Update-EnvironmentPath
    }

    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Info "Dependencies check complete"
}

function New-Directories {
    Write-Host "[2/8] Creating directories..." -ForegroundColor Cyan
    @($InstallDir, "$DataDir\config", "$DataDir\themes", "$DataDir\plugins", "$DataDir\downloads", "$DataDir\media", "$DataDir\logs") | ForEach-Object {
        if (!(Test-Path $_)) { New-Item -ItemType Directory -Path $_ -Force | Out-Null }
    }
    Write-Info "Directories created"
}

function Build-Frontend {
    Write-Host "[3/8] Building frontend..." -ForegroundColor Cyan
    $frontendPath = Join-Path $ProjectRoot "frontend"
    Set-Location $frontendPath
    Update-EnvironmentPath
    $yarnPath = (Get-Command yarn -ErrorAction SilentlyContinue).Source
    if ($yarnPath) { & $yarnPath install 2>&1 | Out-Null; & $yarnPath build }
    else { npm install; npm run build }
    if (Test-Path "build") { $script:FrontendBuildDir = "build" }
    elseif (Test-Path "dist") { $script:FrontendBuildDir = "dist" }
    else { Write-Err "No build output found"; exit 1 }
    Write-Info "Frontend built"
}

function Install-Backend {
    Write-Host "[4/8] Installing backend..." -ForegroundColor Cyan
    $backendPath = Join-Path $ProjectRoot "backend"
    Set-Location $backendPath
    $pythonExe = if (Test-CommandExists "python") { "python" } else { "py" }
    & $pythonExe -m venv venv
    & ".\venv\Scripts\Activate.ps1"
    pip install --upgrade pip 2>&1 | Out-Null
    pip install -r requirements.txt
    deactivate
    Write-Info "Backend installed"
}

function Install-Files {
    Write-Host "[5/8] Installing files..." -ForegroundColor Cyan
    $frontendSource = Join-Path $ProjectRoot "frontend" $script:FrontendBuildDir
    $frontendDest = Join-Path $InstallDir "frontend"
    if (Test-Path $frontendDest) { Remove-Item -Recurse -Force $frontendDest }
    Copy-Item -Path $frontendSource -Destination $frontendDest -Recurse -Force

    $backendDest = Join-Path $InstallDir "backend"
    if (Test-Path $backendDest) { Remove-Item -Recurse -Force $backendDest }
    Copy-Item -Path (Join-Path $ProjectRoot "backend") -Destination $backendDest -Recurse -Force

    @"
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
WATCHNEXUS_PLUGINS_DIR=$DataDir\plugins
WATCHNEXUS_THEMES_DIR=$DataDir\themes
"@ | Out-File -FilePath "$InstallDir\backend\.env" -Encoding UTF8 -Force
    Write-Info "Files installed"
}

function Install-Launchers {
    Write-Host "[6/8] Creating launchers..." -ForegroundColor Cyan

    # Main batch launcher
    @"
@echo off
title WatchNexus Server
cd /d "$InstallDir\backend"
call venv\Scripts\activate.bat
echo.
echo   WatchNexus v$Version
echo   http://localhost:8001
echo   Press Ctrl+C to stop.
echo.
python -m uvicorn server:app --host 0.0.0.0 --port 8001
"@ | Out-File -FilePath "$InstallDir\WatchNexus.bat" -Encoding ASCII -Force

    # Hidden launcher (no console window, for scheduled task)
    @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """$InstallDir\WatchNexus.bat""", 0, False
"@ | Out-File -FilePath "$InstallDir\WatchNexus-Service.vbs" -Encoding ASCII -Force

    # Shortcuts
    try {
        $WshShell = New-Object -ComObject WScript.Shell
        $startMenuPath = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs"

        $Shortcut = $WshShell.CreateShortcut("$startMenuPath\WatchNexus.lnk")
        $Shortcut.TargetPath = "cmd.exe"
        $Shortcut.Arguments = "/c `"$InstallDir\WatchNexus.bat`""
        $Shortcut.WorkingDirectory = $InstallDir
        $Shortcut.Description = "WatchNexus Media Server"
        $Shortcut.Save()

        $DesktopShortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\WatchNexus.lnk")
        $DesktopShortcut.TargetPath = "cmd.exe"
        $DesktopShortcut.Arguments = "/c `"$InstallDir\WatchNexus.bat`""
        $DesktopShortcut.WorkingDirectory = $InstallDir
        $DesktopShortcut.Description = "WatchNexus Media Server"
        $DesktopShortcut.Save()
    } catch { Write-Warn "Could not create shortcuts" }
    Write-Info "Launchers created"
}

#===============================================================================
# SCHEDULED TASK — auto-start at boot, auto-restart on failure
#===============================================================================
function Register-AutoStart {
    Write-Host "[7/8] Registering auto-start (Scheduled Task)..." -ForegroundColor Cyan

    # Remove old task if exists
    Unregister-ScheduledTask -TaskName $ServiceName -Confirm:$false -ErrorAction SilentlyContinue

    # Create the scheduled task
    $Action = New-ScheduledTaskAction `
        -Execute "wscript.exe" `
        -Argument "`"$InstallDir\WatchNexus-Service.vbs`"" `
        -WorkingDirectory $InstallDir

    # Trigger: At system startup
    $TriggerStartup = New-ScheduledTaskTrigger -AtStartup

    # Trigger: At user logon (backup — covers all scenarios)
    $TriggerLogon = New-ScheduledTaskTrigger -AtLogOn

    # Settings: restart on failure, don't stop on idle, run indefinitely
    $Settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -RestartCount 3 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -ExecutionTimeLimit (New-TimeSpan -Days 0) `
        -MultipleInstances IgnoreNew

    # Principal: run whether user is logged on or not
    $Principal = New-ScheduledTaskPrincipal `
        -UserId "$env:USERDOMAIN\$env:USERNAME" `
        -LogonType S4U `
        -RunLevel Highest

    try {
        Register-ScheduledTask `
            -TaskName $ServiceName `
            -Action $Action `
            -Trigger @($TriggerStartup, $TriggerLogon) `
            -Settings $Settings `
            -Principal $Principal `
            -Description "WatchNexus Media Server - Auto-start service" | Out-Null

        Write-Info "Scheduled Task registered: '$ServiceName'"
        Write-Host "  - Triggers: At system startup + At user logon" -ForegroundColor Gray
        Write-Host "  - Restart: 3 retries on failure (1 min interval)" -ForegroundColor Gray
        Write-Host "  - Runs silently in background (no console window)" -ForegroundColor Gray
    } catch {
        Write-Warn "Could not register Scheduled Task: $_"
        Write-Warn "You can add it manually via Task Scheduler."
    }
}

function Add-FirewallRules {
    Write-Host "[8/8] Configuring firewall..." -ForegroundColor Cyan
    try {
        Remove-NetFirewallRule -DisplayName "WatchNexus*" -ErrorAction SilentlyContinue
        New-NetFirewallRule -DisplayName "WatchNexus Backend" -Direction Inbound -LocalPort 8001 -Protocol TCP -Action Allow | Out-Null
        Write-Info "Firewall rules configured"
    } catch { Write-Warn "Firewall config skipped (non-critical)" }
}

function Main {
    try {
        Test-Prerequisites
        Install-Dependencies
        New-Directories
        Build-Frontend
        Install-Backend
        Install-Files
        Install-Launchers
        Register-AutoStart
        Add-FirewallRules

        Write-Host "`n==============================================`n  Installation Complete!  v$Version`n==============================================`n" -ForegroundColor White
        Write-Host "  Access:    " -NoNewline; Write-Host "http://localhost:8001" -ForegroundColor Yellow
        Write-Host "  Install:   $InstallDir"
        Write-Host "  Data:      $DataDir"
        Write-Host ""
        Write-Host "  Auto-start: ENABLED" -ForegroundColor Green
        Write-Host "  WatchNexus will start automatically on every"
        Write-Host "  boot and login. Survives power failures."
        Write-Host ""
        Write-Host "  To manage:"
        Write-Host "    Task Scheduler -> WatchNexus"
        Write-Host "    schtasks /query /tn WatchNexus"
        Write-Host "    schtasks /run /tn WatchNexus      (start now)"
        Write-Host "    schtasks /end /tn WatchNexus      (stop)"
        Write-Host ""
        Write-Host "  To disable auto-start:"
        Write-Host "    schtasks /change /tn WatchNexus /disable"
        Write-Host ""

        if (!(Test-CommandExists "mongod")) {
            Write-Warn "MongoDB is required. Install from:"
            Write-Host "  https://www.mongodb.com/try/download/community" -ForegroundColor Cyan
        }
    } catch {
        Write-Err "Installation failed: $_"
        exit 1
    }
}

Main
