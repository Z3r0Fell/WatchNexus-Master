#===============================================================================
# WatchNexus Installation Script for Windows
# Supports: Windows 10/11 (64-bit)
# Run as Administrator: Right-click -> Run as Administrator
# v3.0.0-beta
#===============================================================================

#Requires -RunAsAdministrator
#Requires -Version 5.1

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$InstallDir = "$env:ProgramFiles\WatchNexus"
$DataDir = "$env:LOCALAPPDATA\WatchNexus"
$Version = "3.0.0-beta"

$NodeUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
$PythonUrl = "https://www.python.org/ftp/python/3.11.7/python-3.11.7-amd64.exe"
$GitUrl = "https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/Git-2.43.0-64-bit.exe"
$VCRedistUrl = "https://aka.ms/vs/17/release/vc_redist.x64.exe"

function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Err { Write-Host "[ERROR] $args" -ForegroundColor Red }
function Write-Step { param($num, $total, $msg) Write-Host "[$num/$total] $msg" -ForegroundColor Cyan }

function Test-CommandExists {
    param($Command)
    $oldPref = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    $result = [bool](Get-Command $Command -ErrorAction SilentlyContinue)
    $ErrorActionPreference = $oldPref
    return $result
}

function Get-FileFromUrl {
    param($Url, $OutputPath, $Description)
    Write-Info "Downloading $Description..."
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $webClient = New-Object System.Net.WebClient
        $webClient.DownloadFile($Url, $OutputPath)
        return $true
    } catch {
        Write-Err "Failed to download $Description : $_"
        return $false
    }
}

function Update-EnvironmentPath {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"
}

Write-Host ""
Write-Host "==============================================`n  WatchNexus Installer - Windows  v$Version`n==============================================" -ForegroundColor White
Write-Host ""

#===============================================================================
# PREREQUISITE CHECK
#===============================================================================
function Test-Prerequisites {
    Write-Host "Checking prerequisites..." -ForegroundColor White
    Write-Host ""

    $found = @()
    $missing = @()

    # Python
    if (Test-CommandExists "python") {
        $pyVer = python --version 2>&1
        $found += "Python   $pyVer"
    } elseif (Test-CommandExists "py") {
        $pyVer = py --version 2>&1
        $found += "Python   $pyVer"
    } else {
        $missing += "Python 3.10+ (https://www.python.org/downloads/)"
    }

    # Node.js
    if (Test-CommandExists "node") {
        $nodeVer = node --version 2>&1
        $found += "Node.js  $nodeVer"
    } else {
        $missing += "Node.js 20+ (https://nodejs.org/)"
    }

    # Yarn
    if (Test-CommandExists "yarn") {
        $yarnVer = yarn --version 2>&1
        $found += "Yarn     v$yarnVer"
    } else {
        $missing += "Yarn (installed automatically via npm)"
    }

    # Git
    if (Test-CommandExists "git") {
        $gitVer = git --version 2>&1
        $found += "Git      $gitVer"
    } else {
        $missing += "Git (https://git-scm.com/download/win)"
    }

    # MongoDB
    if (Test-CommandExists "mongod") {
        $found += "MongoDB  (installed)"
    } else {
        $missing += "MongoDB 7.x (https://www.mongodb.com/try/download/community)"
    }

    # FFmpeg
    if (Test-CommandExists "ffmpeg") {
        $found += "FFmpeg   (installed)"
    } else {
        $missing += "FFmpeg (optional, for transcoding)"
    }

    Write-Host "  Prerequisite Status:" -ForegroundColor Cyan
    Write-Host "  -----------------------------------------------"
    foreach ($item in $found) {
        Write-Host "  " -NoNewline; Write-Host "OK     " -ForegroundColor Green -NoNewline; Write-Host " $item"
    }
    foreach ($item in $missing) {
        Write-Host "  " -NoNewline; Write-Host "MISSING" -ForegroundColor Red -NoNewline; Write-Host " $item"
    }
    Write-Host "  -----------------------------------------------"
    Write-Host ""

    if ($missing.Count -gt 0) {
        Write-Host "  The following prerequisites are missing:" -ForegroundColor Yellow
        foreach ($item in $missing) {
            Write-Host "    - $item"
        }
        Write-Host ""
        $answer = Read-Host "  The installer can attempt to install missing dependencies. Continue? (y/n)"
        if ($answer -ne "y" -and $answer -ne "Y") {
            Write-Host ""
            Write-Info "Installation cancelled. Please install the prerequisites manually."
            Write-Host "  - Python 3.10+: https://www.python.org/downloads/"
            Write-Host "  - Node.js 20:   https://nodejs.org/"
            Write-Host "  - MongoDB 7:    https://www.mongodb.com/try/download/community"
            Write-Host "  - Git:          https://git-scm.com/download/win"
            exit 0
        }
    } else {
        Write-Host "  All prerequisites satisfied!" -ForegroundColor Green
    }
    Write-Host ""
}

function Test-WindowsVersion {
    $osVersion = [System.Environment]::OSVersion.Version
    if ($osVersion.Major -lt 10) {
        Write-Err "WatchNexus requires Windows 10 or later"
        exit 1
    }
    Write-Info "Windows version: $($osVersion.ToString()) - OK"
}

function Install-Dependencies {
    Write-Step 1 7 "Installing dependencies..."
    
    $tempDir = "$env:TEMP\watchnexus_install"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    
    if (!(Test-CommandExists "node")) {
        Write-Info "Installing Node.js..."
        $nodeMsi = "$tempDir\node.msi"
        if (Get-FileFromUrl $NodeUrl $nodeMsi "Node.js") {
            Start-Process msiexec.exe -ArgumentList "/i `"$nodeMsi`" /qn /norestart" -Wait -NoNewWindow
            Update-EnvironmentPath
        }
    } else {
        Write-Info "Node.js already installed: $(node --version)"
    }
    
    if (!(Test-CommandExists "python") -and !(Test-CommandExists "py")) {
        Write-Info "Installing Python..."
        $pythonExe = "$tempDir\python.exe"
        if (Get-FileFromUrl $PythonUrl $pythonExe "Python") {
            Start-Process $pythonExe -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1 Include_test=0" -Wait -NoNewWindow
            Update-EnvironmentPath
        }
    } else {
        $pyVersion = if (Test-CommandExists "python") { python --version 2>&1 } else { py --version 2>&1 }
        Write-Info "Python already installed: $pyVersion"
    }
    
    if (!(Test-CommandExists "git")) {
        Write-Info "Installing Git..."
        $gitExe = "$tempDir\git.exe"
        if (Get-FileFromUrl $GitUrl $gitExe "Git") {
            Start-Process $gitExe -ArgumentList "/VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS" -Wait -NoNewWindow
            Update-EnvironmentPath
        }
    } else {
        Write-Info "Git already installed: $(git --version)"
    }
    
    Write-Info "Ensuring Visual C++ Redistributable is installed..."
    $vcExe = "$tempDir\vc_redist.exe"
    if (Get-FileFromUrl $VCRedistUrl $vcExe "VC++ Redistributable") {
        Start-Process $vcExe -ArgumentList "/quiet /norestart" -Wait -NoNewWindow -ErrorAction SilentlyContinue
    }
    
    Update-EnvironmentPath
    if (!(Test-CommandExists "yarn")) {
        Write-Info "Installing Yarn..."
        if (Test-CommandExists "npm") {
            npm install -g yarn 2>&1 | Out-Null
            Update-EnvironmentPath
        } else {
            Write-Warn "npm not found, cannot install yarn"
        }
    } else {
        Write-Info "Yarn already installed: $(yarn --version)"
    }
    
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    
    Write-Info "Checking MongoDB..."
    if (!(Test-CommandExists "mongod")) {
        Write-Host ""
        Write-Warn "MongoDB not found. WatchNexus requires MongoDB to function."
        Write-Host ""
        Write-Host "  MongoDB installation options:" -ForegroundColor Cyan
        Write-Host "  Option 1 - Download MSI installer (recommended):"
        Write-Host "    https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.5-signed.msi"
        Write-Host "  Option 2 - Docker Desktop:"
        Write-Host "    docker run -d --name mongodb -p 27017:27017 mongo:7"
        Write-Host "  Option 3 - MongoDB Atlas (cloud, free tier):"
        Write-Host "    https://www.mongodb.com/cloud/atlas"
        Write-Host ""
        
        $continue = Read-Host "Continue without MongoDB? (y/n)"
        if ($continue -ne "y" -and $continue -ne "Y") {
            Write-Info "Please install MongoDB and run this script again."
            exit 0
        }
    } else {
        Write-Info "MongoDB found"
    }
    
    Write-Info "Dependencies check complete"
}

function New-Directories {
    Write-Step 2 7 "Creating directories..."
    $dirs = @($InstallDir, "$DataDir\config", "$DataDir\themes", "$DataDir\plugins", "$DataDir\downloads", "$DataDir\media", "$DataDir\logs")
    foreach ($dir in $dirs) {
        if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    }
    Write-Info "Directories created"
}

function Build-Frontend {
    Write-Step 3 7 "Building frontend..."
    $frontendPath = Join-Path $ProjectRoot "frontend"
    if (!(Test-Path "$frontendPath\package.json")) {
        Write-Err "frontend/package.json not found at $frontendPath"; exit 1
    }
    Set-Location $frontendPath
    if (Test-Path "node_modules\.cache") {
        Remove-Item -Recurse -Force "node_modules\.cache" -ErrorAction SilentlyContinue
    }
    Write-Info "Installing frontend dependencies..."
    Update-EnvironmentPath
    $yarnPath = (Get-Command yarn -ErrorAction SilentlyContinue).Source
    if ($yarnPath) {
        & $yarnPath install 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { & $yarnPath install }
    } else { npm install }
    if ($LASTEXITCODE -ne 0) { Write-Err "Failed to install frontend dependencies"; exit 1 }
    Write-Info "Building production bundle..."
    if ($yarnPath) { & $yarnPath build } else { npm run build }
    if ($LASTEXITCODE -ne 0) { Write-Err "Frontend build failed"; exit 1 }
    if (Test-Path "build") { $script:FrontendBuildDir = "build" }
    elseif (Test-Path "dist") { $script:FrontendBuildDir = "dist" }
    else { Write-Err "No build output found"; exit 1 }
    Write-Info "Frontend built (output: $script:FrontendBuildDir)"
}

function Install-Backend {
    Write-Step 4 7 "Installing backend..."
    $backendPath = Join-Path $ProjectRoot "backend"
    if (!(Test-Path "$backendPath\requirements.txt")) { Write-Err "backend/requirements.txt not found"; exit 1 }
    Set-Location $backendPath
    if ((Test-Path "venv") -and !(Test-Path "venv\Scripts\Activate.ps1")) {
        Write-Warn "Corrupt venv detected, removing..."; Remove-Item -Recurse -Force "venv"
    }
    $pythonExe = if (Test-CommandExists "python") { "python" } elseif (Test-CommandExists "py") { "py -3" } else { $null }
    if (!$pythonExe) { Write-Err "Python not found."; exit 1 }
    Write-Info "Creating virtual environment..."
    if ($pythonExe -eq "py -3") { py -3 -m venv venv } else { python -m venv venv }
    if ($LASTEXITCODE -ne 0 -or !(Test-Path "venv\Scripts\Activate.ps1")) { Write-Err "Failed to create virtual environment"; exit 1 }
    & ".\venv\Scripts\Activate.ps1"
    Write-Info "Upgrading pip..."; pip install --upgrade pip 2>&1 | Out-Null
    Write-Info "Installing Python dependencies..."; pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) { Write-Err "Failed to install Python dependencies"; deactivate; exit 1 }
    deactivate
    Write-Info "Backend installed"
}

function Install-Files {
    Write-Step 5 7 "Installing files..."
    $frontendSource = Join-Path $ProjectRoot "frontend" $script:FrontendBuildDir
    $backendSource = Join-Path $ProjectRoot "backend"
    $frontendDest = Join-Path $InstallDir "frontend"
    if (Test-Path $frontendDest) { Remove-Item -Recurse -Force $frontendDest }
    Copy-Item -Path $frontendSource -Destination $frontendDest -Recurse -Force
    $backendDest = Join-Path $InstallDir "backend"
    if (Test-Path $backendDest) { Remove-Item -Recurse -Force $backendDest }
    Copy-Item -Path $backendSource -Destination $backendDest -Recurse -Force
    $envContent = @"
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
WATCHNEXUS_PLUGINS_DIR=$DataDir\plugins
WATCHNEXUS_THEMES_DIR=$DataDir\themes
"@
    $envContent | Out-File -FilePath "$InstallDir\backend\.env" -Encoding UTF8 -Force
    Write-Info "Files installed to $InstallDir"
}

function Install-Launchers {
    Write-Step 6 7 "Creating launchers..."
    $batchContent = @"
@echo off
title WatchNexus Server
cd /d "$InstallDir\backend"
call venv\Scripts\activate.bat
echo Starting WatchNexus...
echo.
echo Access the application at: http://localhost:8001
echo Press Ctrl+C to stop the server.
echo.
python -m uvicorn server:app --host 127.0.0.1 --port 8001
"@
    $batchContent | Out-File -FilePath "$InstallDir\WatchNexus.bat" -Encoding ASCII -Force
    try {
        $WshShell = New-Object -ComObject WScript.Shell
        $startMenuPath = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs"
        $Shortcut = $WshShell.CreateShortcut("$startMenuPath\WatchNexus.lnk")
        $Shortcut.TargetPath = "cmd.exe"
        $Shortcut.Arguments = "/c `"$InstallDir\WatchNexus.bat`""
        $Shortcut.WorkingDirectory = $InstallDir
        $Shortcut.Description = "WatchNexus - Unified Media Pipeline"
        $Shortcut.Save()
        Write-Info "Start Menu shortcut created"
    } catch { Write-Warn "Could not create Start Menu shortcut" }
    try {
        $DesktopShortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\WatchNexus.lnk")
        $DesktopShortcut.TargetPath = "cmd.exe"
        $DesktopShortcut.Arguments = "/c `"$InstallDir\WatchNexus.bat`""
        $DesktopShortcut.WorkingDirectory = $InstallDir
        $DesktopShortcut.Description = "WatchNexus - Unified Media Pipeline"
        $DesktopShortcut.Save()
        Write-Info "Desktop shortcut created"
    } catch { Write-Warn "Could not create Desktop shortcut" }
    Write-Info "Launchers created"
}

function Add-FirewallRules {
    Write-Step 7 7 "Configuring firewall..."
    try {
        Remove-NetFirewallRule -DisplayName "WatchNexus*" -ErrorAction SilentlyContinue
        New-NetFirewallRule -DisplayName "WatchNexus Backend" -Direction Inbound -LocalPort 8001 -Protocol TCP -Action Allow | Out-Null
        Write-Info "Firewall rules configured"
    } catch { Write-Warn "Could not configure firewall (non-critical)" }
}

function Main {
    try {
        Test-WindowsVersion
        Test-Prerequisites
        Install-Dependencies
        New-Directories
        Build-Frontend
        Install-Backend
        Install-Files
        Install-Launchers
        Add-FirewallRules
        
        Write-Host "`n==============================================`n  Installation Complete!`n==============================================" -ForegroundColor White
        Write-Host ""
        Write-Host "WatchNexus installed to:" -ForegroundColor White
        Write-Host "  $InstallDir" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Data directory:" -ForegroundColor White
        Write-Host "  $DataDir" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "To start WatchNexus:" -ForegroundColor Green
        Write-Host "  - Double-click the Desktop shortcut"
        Write-Host "  - Or from Start Menu: WatchNexus"
        Write-Host "  - Or run: $InstallDir\WatchNexus.bat"
        Write-Host ""
        Write-Host "Access at: " -NoNewline; Write-Host "http://localhost:8001" -ForegroundColor Yellow
        Write-Host ""
        
        if (!(Test-CommandExists "mongod")) {
            Write-Warn "IMPORTANT: MongoDB is required for WatchNexus to function."
            Write-Warn "Please install MongoDB before starting WatchNexus."
            Write-Host "  Download: https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.5-signed.msi" -ForegroundColor Cyan
        }
    } catch {
        Write-Err "Installation failed: $_"
        Write-Host "Error details:" -ForegroundColor Red
        Write-Host $_.Exception.Message
        exit 1
    }
}

Main
