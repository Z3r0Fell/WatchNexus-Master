#===============================================================================
# WatchNexus Installation Script for Windows
# Supports: Windows 10/11 (64-bit)
# Run as Administrator: Right-click -> Run as Administrator
#===============================================================================

#Requires -RunAsAdministrator
#Requires -Version 5.1

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$InstallDir = "$env:ProgramFiles\WatchNexus"
$DataDir = "$env:LOCALAPPDATA\WatchNexus"
$Version = "1.0.0"

# Dependency URLs (direct downloads)
$NodeUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
$PythonUrl = "https://www.python.org/ftp/python/3.11.7/python-3.11.7-amd64.exe"
$GitUrl = "https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/Git-2.43.0-64-bit.exe"
$VCRedistUrl = "https://aka.ms/vs/17/release/vc_redist.x64.exe"

# Colors for output
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Err { Write-Host "[ERROR] $args" -ForegroundColor Red }
function Write-Step { param($num, $total, $msg) Write-Host "[$num/$total] $msg" -ForegroundColor Cyan }

Write-Host ""
Write-Host "=============================================="
Write-Host "  WatchNexus Installer - Windows"
Write-Host "  Version: $Version"
Write-Host "=============================================="
Write-Host ""

# Check Windows version
function Test-WindowsVersion {
    $osVersion = [System.Environment]::OSVersion.Version
    if ($osVersion.Major -lt 10) {
        Write-Err "WatchNexus requires Windows 10 or later"
        exit 1
    }
    Write-Info "Windows version: $($osVersion.ToString()) - OK"
}

# Check if a command exists
function Test-CommandExists {
    param($Command)
    $oldPref = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    $result = [bool](Get-Command $Command -ErrorAction SilentlyContinue)
    $ErrorActionPreference = $oldPref
    return $result
}

# Download file with progress
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

# Refresh environment PATH
function Update-EnvironmentPath {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"
}

# Install dependencies without Chocolatey
function Install-Dependencies {
    Write-Step 1 7 "Installing dependencies..."
    
    $tempDir = "$env:TEMP\watchnexus_install"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    
    # Install Node.js
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
    
    # Install Python
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
    
    # Install Git
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
    
    # Install VC++ Redistributable (silent)
    Write-Info "Ensuring Visual C++ Redistributable is installed..."
    $vcExe = "$tempDir\vc_redist.exe"
    if (Get-FileFromUrl $VCRedistUrl $vcExe "VC++ Redistributable") {
        Start-Process $vcExe -ArgumentList "/quiet /norestart" -Wait -NoNewWindow -ErrorAction SilentlyContinue
    }
    
    # Install Yarn
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
    
    # Cleanup temp files
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    
    # MongoDB check
    Write-Info "Checking MongoDB..."
    if (!(Test-CommandExists "mongod")) {
        Write-Host ""
        Write-Warn "MongoDB not found. WatchNexus requires MongoDB to function."
        Write-Host ""
        Write-Host "  MongoDB installation options:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  Option 1 - Download MSI installer (recommended):"
        Write-Host "    https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.5-signed.msi"
        Write-Host ""
        Write-Host "  Option 2 - Docker Desktop:"
        Write-Host "    docker run -d --name mongodb -p 27017:27017 mongo:7"
        Write-Host ""
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

# Create directories
function New-Directories {
    Write-Step 2 7 "Creating directories..."
    
    $dirs = @(
        $InstallDir,
        "$DataDir\config",
        "$DataDir\themes",
        "$DataDir\plugins", 
        "$DataDir\downloads",
        "$DataDir\media",
        "$DataDir\logs"
    )
    
    foreach ($dir in $dirs) {
        if (!(Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }
    
    Write-Info "Directories created"
}

# Build frontend
function Build-Frontend {
    Write-Step 3 7 "Building frontend..."
    
    $frontendPath = Join-Path $ProjectRoot "frontend"
    
    if (!(Test-Path "$frontendPath\package.json")) {
        Write-Err "frontend/package.json not found at $frontendPath"
        Write-Err "Make sure you're running this script from the WatchNexus project directory"
        exit 1
    }
    
    Set-Location $frontendPath
    
    # Clean old builds
    if (Test-Path "node_modules\.cache") {
        Remove-Item -Recurse -Force "node_modules\.cache" -ErrorAction SilentlyContinue
    }
    
    # Install dependencies
    Write-Info "Installing frontend dependencies..."
    Update-EnvironmentPath
    
    $yarnPath = (Get-Command yarn -ErrorAction SilentlyContinue).Source
    if ($yarnPath) {
        & $yarnPath install 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "yarn install with lockfile failed, retrying..."
            & $yarnPath install
        }
    } else {
        npm install
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to install frontend dependencies"
        exit 1
    }
    
    # Build
    Write-Info "Building production bundle..."
    if ($yarnPath) {
        & $yarnPath build
    } else {
        npm run build
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Frontend build failed"
        exit 1
    }
    
    # Determine output directory
    if (Test-Path "build") {
        $script:FrontendBuildDir = "build"
    } elseif (Test-Path "dist") {
        $script:FrontendBuildDir = "dist"
    } else {
        Write-Err "No build output found (expected 'build' or 'dist' directory)"
        exit 1
    }
    
    Write-Info "Frontend built (output: $script:FrontendBuildDir)"
}

# Install backend
function Install-Backend {
    Write-Step 4 7 "Installing backend..."
    
    $backendPath = Join-Path $ProjectRoot "backend"
    
    if (!(Test-Path "$backendPath\requirements.txt")) {
        Write-Err "backend/requirements.txt not found"
        exit 1
    }
    
    Set-Location $backendPath
    
    # Remove old venv if corrupt
    if ((Test-Path "venv") -and !(Test-Path "venv\Scripts\Activate.ps1")) {
        Write-Warn "Corrupt venv detected, removing..."
        Remove-Item -Recurse -Force "venv"
    }
    
    # Find Python executable
    $pythonExe = if (Test-CommandExists "python") { "python" } elseif (Test-CommandExists "py") { "py -3" } else { $null }
    
    if (!$pythonExe) {
        Write-Err "Python not found. Please install Python 3.10+ and try again."
        exit 1
    }
    
    # Create virtual environment
    Write-Info "Creating virtual environment..."
    if ($pythonExe -eq "py -3") {
        py -3 -m venv venv
    } else {
        python -m venv venv
    }
    
    if ($LASTEXITCODE -ne 0 -or !(Test-Path "venv\Scripts\Activate.ps1")) {
        Write-Err "Failed to create virtual environment"
        exit 1
    }
    
    # Activate and install
    & ".\venv\Scripts\Activate.ps1"
    
    Write-Info "Upgrading pip..."
    pip install --upgrade pip 2>&1 | Out-Null
    
    Write-Info "Installing Python dependencies (this may take a few minutes)..."
    pip install -r requirements.txt
    
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to install Python dependencies"
        deactivate
        exit 1
    }
    
    deactivate
    
    Write-Info "Backend installed"
}

# Install files to program directory
function Install-Files {
    Write-Step 5 7 "Installing files..."
    
    $frontendSource = Join-Path $ProjectRoot "frontend" $script:FrontendBuildDir
    $backendSource = Join-Path $ProjectRoot "backend"
    
    # Copy frontend
    $frontendDest = Join-Path $InstallDir "frontend"
    if (Test-Path $frontendDest) {
        Remove-Item -Recurse -Force $frontendDest
    }
    Copy-Item -Path $frontendSource -Destination $frontendDest -Recurse -Force
    
    # Copy backend
    $backendDest = Join-Path $InstallDir "backend"
    if (Test-Path $backendDest) {
        Remove-Item -Recurse -Force $backendDest
    }
    Copy-Item -Path $backendSource -Destination $backendDest -Recurse -Force
    
    # Create environment file
    $envContent = @"
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
WATCHNEXUS_PLUGINS_DIR=$DataDir\plugins
WATCHNEXUS_THEMES_DIR=$DataDir\themes
"@
    $envContent | Out-File -FilePath "$InstallDir\backend\.env" -Encoding UTF8 -Force
    
    Write-Info "Files installed to $InstallDir"
}

# Create launcher scripts and shortcuts
function Install-Launchers {
    Write-Step 6 7 "Creating launchers..."
    
    # Create batch launcher
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
    
    # Create PowerShell launcher (opens browser)
    $psContent = @"
`$ErrorActionPreference = "SilentlyContinue"
Set-Location "$InstallDir\backend"
& ".\venv\Scripts\Activate.ps1"

# Start backend in background
`$job = Start-Job -ScriptBlock {
    Set-Location "$InstallDir\backend"
    & ".\venv\Scripts\Activate.ps1"
    python -m uvicorn server:app --host 127.0.0.1 --port 8001
}

# Wait for backend to start
Start-Sleep -Seconds 4

# Open browser
Start-Process "http://localhost:8001"

# Keep script running and show status
Write-Host "WatchNexus is running at http://localhost:8001" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop..." -ForegroundColor Yellow
Wait-Job `$job
"@
    $psContent | Out-File -FilePath "$InstallDir\Start-WatchNexus.ps1" -Encoding UTF8 -Force
    
    # Create Start Menu shortcut
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
    } catch {
        Write-Warn "Could not create Start Menu shortcut"
    }
    
    # Create Desktop shortcut
    try {
        $DesktopShortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\WatchNexus.lnk")
        $DesktopShortcut.TargetPath = "cmd.exe"
        $DesktopShortcut.Arguments = "/c `"$InstallDir\WatchNexus.bat`""
        $DesktopShortcut.WorkingDirectory = $InstallDir
        $DesktopShortcut.Description = "WatchNexus - Unified Media Pipeline"
        $DesktopShortcut.Save()
        Write-Info "Desktop shortcut created"
    } catch {
        Write-Warn "Could not create Desktop shortcut"
    }
    
    Write-Info "Launchers created"
}

# Add firewall rules
function Add-FirewallRules {
    Write-Step 7 7 "Configuring firewall..."
    
    try {
        # Remove existing rules
        Remove-NetFirewallRule -DisplayName "WatchNexus*" -ErrorAction SilentlyContinue
        
        # Add new rules
        New-NetFirewallRule -DisplayName "WatchNexus Backend" -Direction Inbound -LocalPort 8001 -Protocol TCP -Action Allow | Out-Null
        
        Write-Info "Firewall rules configured"
    } catch {
        Write-Warn "Could not configure firewall (non-critical)"
    }
}

# Main execution
function Main {
    try {
        Test-WindowsVersion
        Install-Dependencies
        New-Directories
        Build-Frontend
        Install-Backend
        Install-Files
        Install-Launchers
        Add-FirewallRules
        
        Write-Host ""
        Write-Host "=============================================="
        Write-Host "  Installation Complete!"
        Write-Host "=============================================="
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
        Write-Host "Access at: " -NoNewline
        Write-Host "http://localhost:8001" -ForegroundColor Yellow
        Write-Host ""
        
        if (!(Test-CommandExists "mongod")) {
            Write-Host ""
            Write-Warn "IMPORTANT: MongoDB is required for WatchNexus to function."
            Write-Warn "Please install MongoDB before starting WatchNexus."
            Write-Host "  Download: https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.5-signed.msi" -ForegroundColor Cyan
        }
        
    } catch {
        Write-Err "Installation failed: $_"
        Write-Host ""
        Write-Host "Error details:" -ForegroundColor Red
        Write-Host $_.Exception.Message
        Write-Host ""
        Write-Host "For troubleshooting, see: docs/BUILD_GUIDE.md" -ForegroundColor Yellow
        exit 1
    }
}

Main
