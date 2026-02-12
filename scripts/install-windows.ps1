#===============================================================================
# WatchNexus Installation Script for Windows
# Supports: Windows 10/11
# Run as Administrator (Right-click -> Run as Administrator)
#===============================================================================

#Requires -RunAsAdministrator
#Requires -Version 5.1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$InstallDir = "$env:ProgramFiles\WatchNexus"
$DataDir = "$env:LOCALAPPDATA\WatchNexus"
$Version = "1.0.0"

# Colors for output
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Err { Write-Host "[ERROR] $args" -ForegroundColor Red }

Write-Host "=============================================="
Write-Host "  WatchNexus Installer - Windows"
Write-Host "=============================================="
Write-Host ""

# Check Windows version
function Test-WindowsVersion {
    $osVersion = [System.Environment]::OSVersion.Version
    if ($osVersion.Major -lt 10) {
        Write-Err "WatchNexus requires Windows 10 or later"
        exit 1
    }
    Write-Info "Windows version: $($osVersion.ToString())"
}

# Check if a command exists
function Test-CommandExists {
    param($Command)
    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

# Install Chocolatey if not present
function Install-Chocolatey {
    if (!(Test-CommandExists "choco")) {
        Write-Info "[1/7] Installing Chocolatey..."
        try {
            Set-ExecutionPolicy Bypass -Scope Process -Force
            [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
            Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
            
            # Refresh environment
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
            
            # Verify installation
            if (!(Test-CommandExists "choco")) {
                throw "Chocolatey installation verification failed"
            }
        } catch {
            Write-Err "Failed to install Chocolatey: $_"
            Write-Warn "Please install Chocolatey manually from https://chocolatey.org/install"
            exit 1
        }
    } else {
        Write-Info "[1/7] Chocolatey already installed"
    }
}

# Install dependencies
function Install-Dependencies {
    Write-Info "[2/7] Installing dependencies..."
    
    # Install Node.js
    if (!(Test-CommandExists "node")) {
        Write-Info "Installing Node.js..."
        choco install nodejs-lts -y --force
    }
    
    # Install Yarn
    if (!(Test-CommandExists "yarn")) {
        Write-Info "Installing Yarn..."
        choco install yarn -y --force
    }
    
    # Install Python
    if (!(Test-CommandExists "python")) {
        Write-Info "Installing Python..."
        choco install python311 -y --force
    }
    
    # Install FFmpeg
    if (!(Test-CommandExists "ffmpeg")) {
        Write-Info "Installing FFmpeg..."
        choco install ffmpeg -y --force
    }
    
    # Install Git
    if (!(Test-CommandExists "git")) {
        Write-Info "Installing Git..."
        choco install git -y --force
    }
    
    # Refresh environment
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    
    # MongoDB - special handling
    Write-Info "Checking MongoDB..."
    if (!(Test-CommandExists "mongod")) {
        Write-Warn "MongoDB not found."
        Write-Host ""
        Write-Host "  MongoDB installation options:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  Option 1 - Download from MongoDB website (recommended):"
        Write-Host "    https://www.mongodb.com/try/download/community"
        Write-Host ""
        Write-Host "  Option 2 - Docker Desktop:"
        Write-Host "    docker run -d --name mongodb -p 27017:27017 mongo:7"
        Write-Host ""
        Write-Host "  Option 3 - MongoDB Atlas (cloud, free tier available):"
        Write-Host "    https://www.mongodb.com/cloud/atlas"
        Write-Host ""
        
        $continue = Read-Host "Continue without MongoDB? (y/n)"
        if ($continue -ne "y") {
            Write-Info "Please install MongoDB and run this script again."
            exit 0
        }
    }
    
    Write-Info "Dependencies check complete"
}

# Create directories
function New-Directories {
    Write-Info "[3/7] Creating directories..."
    
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
    Write-Info "[4/7] Building frontend..."
    
    $frontendPath = Join-Path $ProjectRoot "frontend"
    Set-Location $frontendPath
    
    if (!(Test-Path "package.json")) {
        Write-Err "frontend/package.json not found"
        exit 1
    }
    
    # Clean old builds
    if (Test-Path "node_modules\.cache") {
        Remove-Item -Recurse -Force "node_modules\.cache" -ErrorAction SilentlyContinue
    }
    
    # Install dependencies
    Write-Info "Installing frontend dependencies..."
    if (Test-Path "yarn.lock") {
        yarn install --frozen-lockfile 2>$null
        if ($LASTEXITCODE -ne 0) {
            yarn install
        }
    } else {
        yarn install
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to install frontend dependencies"
        exit 1
    }
    
    # Build
    Write-Info "Building production bundle..."
    yarn build
    
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
        Write-Err "No build output found"
        exit 1
    }
    
    Write-Info "Frontend built (output: $script:FrontendBuildDir)"
}

# Install backend
function Install-Backend {
    Write-Info "[5/7] Installing backend..."
    
    $backendPath = Join-Path $ProjectRoot "backend"
    Set-Location $backendPath
    
    if (!(Test-Path "requirements.txt")) {
        Write-Err "backend/requirements.txt not found"
        exit 1
    }
    
    # Remove old venv if corrupt
    if ((Test-Path "venv") -and !(Test-Path "venv\Scripts\Activate.ps1")) {
        Write-Warn "Corrupt venv detected, removing..."
        Remove-Item -Recurse -Force "venv"
    }
    
    # Create virtual environment
    Write-Info "Creating virtual environment..."
    python -m venv venv
    
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to create virtual environment"
        exit 1
    }
    
    # Activate and install
    & ".\venv\Scripts\Activate.ps1"
    
    Write-Info "Installing Python dependencies..."
    pip install --upgrade pip
    pip install -r requirements.txt
    
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to install Python dependencies"
        deactivate
        exit 1
    }
    
    deactivate
    
    Write-Info "Backend installed"
}

# Install files
function Install-Files {
    Write-Info "[6/7] Installing files..."
    
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
    
    Write-Info "Files installed"
}

# Create Windows service and shortcuts
function Install-Service {
    Write-Info "[7/7] Creating shortcuts..."
    
    # Create batch launcher
    $batchContent = @"
@echo off
cd /d "$InstallDir\backend"
call venv\Scripts\activate.bat
python -m uvicorn server:app --host 127.0.0.1 --port 8001
"@
    $batchContent | Out-File -FilePath "$InstallDir\WatchNexus.bat" -Encoding ASCII -Force
    
    # Create PowerShell launcher
    $psContent = @"
`$ErrorActionPreference = "SilentlyContinue"
Set-Location "$InstallDir\backend"
& ".\venv\Scripts\Activate.ps1"
Start-Process -NoNewWindow -FilePath python -ArgumentList "-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", "8001"
Start-Sleep -Seconds 3
Start-Process "http://localhost:8001"
"@
    $psContent | Out-File -FilePath "$InstallDir\Start-WatchNexus.ps1" -Encoding UTF8 -Force
    
    # Create Start Menu shortcut
    try {
        $WshShell = New-Object -ComObject WScript.Shell
        $startMenuPath = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs"
        $Shortcut = $WshShell.CreateShortcut("$startMenuPath\WatchNexus.lnk")
        $Shortcut.TargetPath = "powershell.exe"
        $Shortcut.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$InstallDir\Start-WatchNexus.ps1`""
        $Shortcut.WorkingDirectory = $InstallDir
        $Shortcut.Description = "WatchNexus - Unified Media Pipeline"
        $Shortcut.Save()
        Write-Info "Start Menu shortcut created"
    } catch {
        Write-Warn "Could not create Start Menu shortcut: $_"
    }
    
    # Create Desktop shortcut
    try {
        $DesktopShortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\WatchNexus.lnk")
        $DesktopShortcut.TargetPath = "powershell.exe"
        $DesktopShortcut.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$InstallDir\Start-WatchNexus.ps1`""
        $DesktopShortcut.WorkingDirectory = $InstallDir
        $DesktopShortcut.Description = "WatchNexus - Unified Media Pipeline"
        $DesktopShortcut.Save()
        Write-Info "Desktop shortcut created"
    } catch {
        Write-Warn "Could not create Desktop shortcut: $_"
    }
    
    Write-Info "Shortcuts created"
}

# Add firewall rules
function Add-FirewallRules {
    Write-Info "Adding firewall rules..."
    
    try {
        # Remove existing rules
        Remove-NetFirewallRule -DisplayName "WatchNexus*" -ErrorAction SilentlyContinue
        
        # Add new rules
        New-NetFirewallRule -DisplayName "WatchNexus Backend" -Direction Inbound -LocalPort 8001 -Protocol TCP -Action Allow | Out-Null
        New-NetFirewallRule -DisplayName "WatchNexus Frontend" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow | Out-Null
        
        Write-Info "Firewall rules added"
    } catch {
        Write-Warn "Could not add firewall rules (may require admin): $_"
    }
}

# Main
function Main {
    try {
        Test-WindowsVersion
        Install-Chocolatey
        Install-Dependencies
        New-Directories
        Build-Frontend
        Install-Backend
        Install-Files
        Install-Service
        Add-FirewallRules
        
        Write-Host ""
        Write-Host "=============================================="
        Write-Host "  Installation Complete!"
        Write-Host "=============================================="
        Write-Host ""
        Write-Host "WatchNexus has been installed to:"
        Write-Host "  $InstallDir" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Data directory:"
        Write-Host "  $DataDir" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "To start WatchNexus:" -ForegroundColor Green
        Write-Host "  - Double-click the Desktop shortcut"
        Write-Host "  - Or from Start Menu: WatchNexus"
        Write-Host "  - Or run: $InstallDir\Start-WatchNexus.ps1"
        Write-Host ""
        Write-Host "Access at: http://localhost:8001" -ForegroundColor Yellow
        Write-Host ""
        
        if (!(Test-CommandExists "mongod")) {
            Write-Warn "Remember: MongoDB is required for WatchNexus to function."
            Write-Warn "Please install MongoDB before starting WatchNexus."
        }
        
    } catch {
        Write-Err "Installation failed: $_"
        Write-Host ""
        Write-Host "Error details:" -ForegroundColor Red
        Write-Host $_.Exception.Message
        Write-Host ""
        Write-Host "Stack trace:" -ForegroundColor Red
        Write-Host $_.ScriptStackTrace
        exit 1
    }
}

Main
