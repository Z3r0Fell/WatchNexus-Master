#===============================================================================
# WatchNexus Installation Script for Windows
# v2.8.3 — Self-contained .NET 10 build (no runtime dependencies needed)
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
$Version = "2.8.3"
$ServiceName = "WatchNexus"
$Port = 8002

function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Err { Write-Host "[ERROR] $args" -ForegroundColor Red }

Write-Host "`n==============================================`n  WatchNexus Installer - Windows  v$Version`n==============================================`n" -ForegroundColor White

#===============================================================================
# LOCATE RELEASE BUILD
#===============================================================================
function Find-ReleaseBuild {
    Write-Host "Locating release build..." -ForegroundColor White

    # Look for the executable in common locations
    $searchPaths = @(
        (Join-Path $ProjectRoot "WatchNexus.Core.exe"),
        (Join-Path $ProjectRoot "win-x64" "WatchNexus.Core.exe"),
        (Join-Path $ProjectRoot "release_builds" "win-x64" "WatchNexus.Core.exe")
    )

    foreach ($path in $searchPaths) {
        if (Test-Path $path) {
            $script:SourceDir = Split-Path -Parent $path
            Write-Info "Found release build at: $($script:SourceDir)"
            return
        }
    }

    Write-Err "Could not find WatchNexus.Core.exe"
    Write-Err "Run this script from the extracted release archive directory."
    exit 1
}

#===============================================================================
# INSTALL
#===============================================================================
function New-Directories {
    Write-Host "[1/5] Creating directories..." -ForegroundColor Cyan
    @($InstallDir, "$DataDir\config", "$DataDir\logs") | ForEach-Object {
        if (!(Test-Path $_)) { New-Item -ItemType Directory -Path $_ -Force | Out-Null }
    }
    Write-Info "Directories created"
}

function Install-Files {
    Write-Host "[2/5] Installing files..." -ForegroundColor Cyan
    # Copy entire release build to install directory
    if (Test-Path $InstallDir) {
        # Preserve data directory
        $dataPath = Join-Path $InstallDir "data"
        $hadData = Test-Path $dataPath
        if ($hadData) {
            $tempData = "$env:TEMP\watchnexus_data_backup"
            Copy-Item -Path $dataPath -Destination $tempData -Recurse -Force
        }
        Remove-Item -Recurse -Force "$InstallDir\*" -ErrorAction SilentlyContinue
        if ($hadData) {
            Copy-Item -Path $tempData -Destination $dataPath -Recurse -Force
            Remove-Item -Recurse -Force $tempData -ErrorAction SilentlyContinue
        }
    }
    Copy-Item -Path "$($script:SourceDir)\*" -Destination $InstallDir -Recurse -Force
    Write-Info "Files installed to $InstallDir"
}

function Install-Launchers {
    Write-Host "[3/5] Creating launchers..." -ForegroundColor Cyan

    # Main batch launcher
    @"
@echo off
title WatchNexus Server
cd /d "$InstallDir"
echo.
echo   WatchNexus v$Version
echo   http://localhost:$Port
echo   Press Ctrl+C to stop.
echo.
WatchNexus.Core.exe
"@ | Out-File -FilePath "$InstallDir\WatchNexus.bat" -Encoding ASCII -Force

    # Hidden launcher (no console window, for scheduled task)
    @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """$InstallDir\WatchNexus.bat""", 0, False
"@ | Out-File -FilePath "$InstallDir\WatchNexus-Service.vbs" -Encoding ASCII -Force

    # Desktop shortcut
    try {
        $WshShell = New-Object -ComObject WScript.Shell
        $Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\WatchNexus.lnk")
        $Shortcut.TargetPath = "$InstallDir\WatchNexus.Core.exe"
        $Shortcut.WorkingDirectory = $InstallDir
        $Shortcut.Description = "WatchNexus Media Server v$Version"
        $Shortcut.Save()
        Write-Info "Desktop shortcut created"
    } catch { Write-Warn "Could not create desktop shortcut" }

    Write-Info "Launchers created"
}

#===============================================================================
# SCHEDULED TASK — auto-start at boot, auto-restart on failure
#===============================================================================
function Register-AutoStart {
    Write-Host "[4/5] Registering auto-start (Scheduled Task)..." -ForegroundColor Cyan

    Unregister-ScheduledTask -TaskName $ServiceName -Confirm:$false -ErrorAction SilentlyContinue

    $Action = New-ScheduledTaskAction `
        -Execute "wscript.exe" `
        -Argument "`"$InstallDir\WatchNexus-Service.vbs`"" `
        -WorkingDirectory $InstallDir

    $TriggerStartup = New-ScheduledTaskTrigger -AtStartup
    $TriggerLogon = New-ScheduledTaskTrigger -AtLogOn

    $Settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -RestartCount 3 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -ExecutionTimeLimit (New-TimeSpan -Days 0) `
        -MultipleInstances IgnoreNew

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
            -Description "WatchNexus Media Server v$Version - Auto-start service" | Out-Null

        Write-Info "Scheduled Task registered: '$ServiceName'"
        Write-Host "  - Triggers: At system startup + At user logon" -ForegroundColor Gray
        Write-Host "  - Restart: 3 retries on failure (1 min interval)" -ForegroundColor Gray
    } catch {
        Write-Warn "Could not register Scheduled Task: $_"
    }
}

function Add-FirewallRules {
    Write-Host "[5/5] Configuring firewall..." -ForegroundColor Cyan
    try {
        Remove-NetFirewallRule -DisplayName "WatchNexus*" -ErrorAction SilentlyContinue
        New-NetFirewallRule -DisplayName "WatchNexus Server" -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow | Out-Null
        Write-Info "Firewall rule added for port $Port"
    } catch { Write-Warn "Firewall config skipped (non-critical)" }
}

function Main {
    try {
        Find-ReleaseBuild
        New-Directories
        Install-Files
        Install-Launchers
        Register-AutoStart
        Add-FirewallRules

        Write-Host "`n==============================================`n  Installation Complete!  v$Version`n==============================================`n" -ForegroundColor White
        Write-Host "  Access:    " -NoNewline; Write-Host "http://localhost:$Port" -ForegroundColor Yellow
        Write-Host "  Install:   $InstallDir"
        Write-Host "  Data:      $InstallDir\data"
        Write-Host ""
        Write-Host "  Auto-start: ENABLED" -ForegroundColor Green
        Write-Host "  System tray icon will appear when running."
        Write-Host ""
        Write-Host "  To manage:"
        Write-Host "    schtasks /query /tn WatchNexus"
        Write-Host "    schtasks /run /tn WatchNexus      (start now)"
        Write-Host "    schtasks /end /tn WatchNexus      (stop)"
        Write-Host ""
        Write-Host "  No additional dependencies required (self-contained .NET 10 build)."
        Write-Host ""
    } catch {
        Write-Err "Installation failed: $_"
        exit 1
    }
}

Main
