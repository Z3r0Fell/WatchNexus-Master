#===============================================================================
# WatchNexus Installation Script for Windows
# Supports: Windows 10/11
# Run as Administrator
#===============================================================================

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$InstallDir = "$env:ProgramFiles\WatchNexus"
$DataDir = "$env:LOCALAPPDATA\WatchNexus"
$Version = "1.0.0"

Write-Host "=============================================="
Write-Host "  WatchNexus Installer - Windows"
Write-Host "=============================================="
Write-Host ""

# Check Windows version
function Test-WindowsVersion {
    $osVersion = [System.Environment]::OSVersion.Version
    if ($osVersion.Major -lt 10) {
        Write-Error "WatchNexus requires Windows 10 or later"
        exit 1
    }
    Write-Host "Windows version: $($osVersion.ToString()) ✓"
}

# Install Chocolatey if not present
function Install-Chocolatey {
    if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
        Write-Host "[1/7] Installing Chocolatey..."
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        
        # Refresh environment
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    } else {
        Write-Host "[1/7] Chocolatey already installed ✓"
    }
}

# Install dependencies
function Install-Dependencies {
    Write-Host "[2/7] Installing dependencies..."
    
    # Install required packages
    choco install -y `
        nodejs-lts `
        yarn `
        python311 `
        mongodb `
        ffmpeg `
        git
    
    # Refresh environment
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    
    # Start MongoDB service
    Start-Service MongoDB
    Set-Service MongoDB -StartupType Automatic
    
    Write-Host "✓ Dependencies installed"
}

# Create directories
function New-Directories {
    Write-Host "[3/7] Creating directories..."
    
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
    
    Write-Host "✓ Directories created"
}

# Build frontend
function Build-Frontend {
    Write-Host "[4/7] Building frontend..."
    
    Set-Location "$ProjectRoot\frontend"
    yarn install --frozen-lockfile
    yarn build
    
    Write-Host "✓ Frontend built"
}

# Install backend
function Install-Backend {
    Write-Host "[5/7] Installing backend..."
    
    Set-Location "$ProjectRoot\backend"
    
    # Create virtual environment
    python -m venv venv
    & ".\venv\Scripts\Activate.ps1"
    
    pip install --upgrade pip
    pip install -r requirements.txt
    
    deactivate
    
    Write-Host "✓ Backend installed"
}

# Install files
function Install-Files {
    Write-Host "[6/7] Installing files..."
    
    # Copy frontend
    Copy-Item -Path "$ProjectRoot\frontend\build" -Destination "$InstallDir\frontend" -Recurse -Force
    
    # Copy backend
    Copy-Item -Path "$ProjectRoot\backend\*" -Destination "$InstallDir\backend" -Recurse -Force
    
    # Create environment file
    @"
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
WATCHNEXUS_PLUGINS_DIR=$DataDir\plugins
WATCHNEXUS_THEMES_DIR=$DataDir\themes
"@ | Out-File -FilePath "$InstallDir\backend\.env" -Encoding UTF8
    
    Write-Host "✓ Files installed"
}

# Create Windows service and shortcuts
function Install-Service {
    Write-Host "[7/7] Creating service and shortcuts..."
    
    # Create launcher script
    $launcherPath = "$InstallDir\WatchNexus.bat"
    @"
@echo off
cd /d "$InstallDir\backend"
call venv\Scripts\activate.bat
python -m uvicorn server:app --host 127.0.0.1 --port 8001
"@ | Out-File -FilePath $launcherPath -Encoding ASCII
    
    # Create PowerShell launcher
    $psLauncherPath = "$InstallDir\Start-WatchNexus.ps1"
    @"
`$ErrorActionPreference = "SilentlyContinue"
Set-Location "$InstallDir\backend"
& ".\venv\Scripts\Activate.ps1"
Start-Process -NoNewWindow python -ArgumentList "-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", "8001"
Start-Sleep -Seconds 3
Start-Process "http://localhost:8001"
"@ | Out-File -FilePath $psLauncherPath -Encoding UTF8
    
    # Create Start Menu shortcut
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut("$env:ProgramData\Microsoft\Windows\Start Menu\Programs\WatchNexus.lnk")
    $Shortcut.TargetPath = "powershell.exe"
    $Shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$psLauncherPath`""
    $Shortcut.WorkingDirectory = $InstallDir
    $Shortcut.IconLocation = "$InstallDir\frontend\watchnexus-logo.ico"
    $Shortcut.Description = "WatchNexus - Unified Media Pipeline"
    $Shortcut.Save()
    
    # Create Desktop shortcut
    $DesktopShortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\WatchNexus.lnk")
    $DesktopShortcut.TargetPath = "powershell.exe"
    $DesktopShortcut.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$psLauncherPath`""
    $DesktopShortcut.WorkingDirectory = $InstallDir
    $DesktopShortcut.Description = "WatchNexus - Unified Media Pipeline"
    $DesktopShortcut.Save()
    
    # Install as Windows service using NSSM (optional)
    if (Get-Command nssm -ErrorAction SilentlyContinue) {
        nssm install WatchNexus "$InstallDir\backend\venv\Scripts\python.exe" "-m uvicorn server:app --host 127.0.0.1 --port 8001"
        nssm set WatchNexus AppDirectory "$InstallDir\backend"
        nssm set WatchNexus DisplayName "WatchNexus Media Server"
        nssm set WatchNexus Description "Unified, self-hosted media pipeline"
        nssm set WatchNexus Start SERVICE_AUTO_START
        nssm set WatchNexus AppStdout "$DataDir\logs\server.log"
        nssm set WatchNexus AppStderr "$DataDir\logs\error.log"
        
        Write-Host "Windows service 'WatchNexus' created"
        Write-Host "Start with: nssm start WatchNexus"
    } else {
        Write-Host "Note: Install NSSM for Windows service support: choco install nssm"
    }
    
    Write-Host "✓ Service and shortcuts created"
}

# Add firewall rules
function Add-FirewallRules {
    Write-Host "Adding firewall rules..."
    
    # Remove existing rules
    Remove-NetFirewallRule -DisplayName "WatchNexus*" -ErrorAction SilentlyContinue
    
    # Add new rules
    New-NetFirewallRule -DisplayName "WatchNexus Backend" -Direction Inbound -LocalPort 8001 -Protocol TCP -Action Allow | Out-Null
    New-NetFirewallRule -DisplayName "WatchNexus Frontend" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow | Out-Null
    
    Write-Host "✓ Firewall rules added"
}

# Main
function Main {
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
    Write-Host "  $InstallDir"
    Write-Host ""
    Write-Host "Data directory:"
    Write-Host "  $DataDir"
    Write-Host ""
    Write-Host "To start WatchNexus:"
    Write-Host "  - Double-click the Desktop shortcut"
    Write-Host "  - Or from Start Menu: WatchNexus"
    Write-Host "  - Or run: $InstallDir\Start-WatchNexus.ps1"
    Write-Host ""
    Write-Host "Access at: http://localhost:8001"
    Write-Host ""
    Write-Host "MongoDB service:"
    Write-Host "  Start-Service MongoDB"
    Write-Host "  Stop-Service MongoDB"
    Write-Host ""
}

Main
