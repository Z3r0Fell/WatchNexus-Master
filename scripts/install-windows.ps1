#
# WatchNexus Installer for Windows
# PowerShell Script - Run as Administrator
#
# Usage: Right-click and "Run with PowerShell" or:
#   Set-ExecutionPolicy Bypass -Scope Process -Force; .\install-windows.ps1
#

param(
    [string]$InstallDir = "$env:LOCALAPPDATA\WatchNexus",
    [string]$DataDir = "$env:APPDATA\WatchNexus",
    [string]$Version = "1.0.0",
    [switch]$SkipDependencies,
    [switch]$Help
)

# Colors and formatting
$Host.UI.RawUI.WindowTitle = "WatchNexus Installer"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Write-Info { Write-ColorOutput "[INFO] $args" "Cyan" }
function Write-Success { Write-ColorOutput "[✓] $args" "Green" }
function Write-Warning { Write-ColorOutput "[!] $args" "Yellow" }
function Write-Error { Write-ColorOutput "[✗] $args" "Red" }

# Banner
function Show-Banner {
    $banner = @"

    ██╗    ██╗ █████╗ ████████╗ ██████╗██╗  ██╗███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
    ██║    ██║██╔══██╗╚══██╔══╝██╔════╝██║  ██║████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
    ██║ █╗ ██║███████║   ██║   ██║     ███████║██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
    ██║███╗██║██╔══██║   ██║   ██║     ██╔══██║██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
    ╚███╔███╔╝██║  ██║   ██║   ╚██████╗██║  ██║██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
     ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝

                        🍯 Unified Media Pipeline - Windows Installer

"@
    Write-Host $banner -ForegroundColor Magenta
}

# Check if running as Administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Check Windows version
function Test-WindowsVersion {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem
    $version = [System.Environment]::OSVersion.Version
    
    Write-Info "Detected: $($os.Caption) (Build $($os.BuildNumber))"
    
    if ($version.Major -lt 10) {
        Write-Error "Windows 10 or later is required"
        exit 1
    }
}

# Install Chocolatey (package manager)
function Install-Chocolatey {
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        Write-Info "Chocolatey already installed"
        choco upgrade chocolatey -y | Out-Null
    } else {
        Write-Info "Installing Chocolatey..."
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        
        # Refresh environment
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        Write-Success "Chocolatey installed"
    }
}

# Install dependencies via Chocolatey
function Install-Dependencies {
    Write-Info "Installing dependencies..."
    
    $packages = @(
        "python311",
        "nodejs-lts",
        "yarn",
        "mongodb",
        "ffmpeg",
        "git"
    )
    
    foreach ($package in $packages) {
        Write-Info "Installing $package..."
        choco install $package -y --no-progress | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "$package installed"
        }
    }
    
    # Refresh environment variables
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    
    Write-Success "All dependencies installed"
}

# Create directories
function New-Directories {
    Write-Info "Creating directories..."
    
    $directories = @(
        $InstallDir,
        "$DataDir\downloads",
        "$DataDir\library",
        "$DataDir\cache",
        "$DataDir\logs",
        "$DataDir\config"
    )
    
    foreach ($dir in $directories) {
        if (!(Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }
    
    Write-Success "Directories created"
}

# Download and install WatchNexus
function Install-WatchNexus {
    Write-Info "Installing WatchNexus..."
    
    # Check for local source
    if (Test-Path ".\backend" -and Test-Path ".\frontend") {
        Write-Info "Installing from local source..."
        Copy-Item -Path ".\backend" -Destination $InstallDir -Recurse -Force
        Copy-Item -Path ".\frontend" -Destination $InstallDir -Recurse -Force
    } else {
        Write-Info "Downloading WatchNexus v$Version..."
        
        $downloadUrl = "https://github.com/watchnexus/watchnexus/releases/download/v$Version/watchnexus-$Version-windows.zip"
        $zipPath = "$env:TEMP\watchnexus.zip"
        
        try {
            Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing
            Expand-Archive -Path $zipPath -DestinationPath $InstallDir -Force
            Remove-Item $zipPath -Force
        } catch {
            Write-Warning "Could not download release, please install from source"
            return
        }
    }
    
    # Setup Python virtual environment
    Write-Info "Setting up Python environment..."
    Push-Location "$InstallDir\backend"
    
    python -m venv venv
    & ".\venv\Scripts\pip.exe" install --upgrade pip
    & ".\venv\Scripts\pip.exe" install -r requirements.txt
    
    Pop-Location
    
    # Setup frontend
    Write-Info "Setting up frontend..."
    Push-Location "$InstallDir\frontend"
    
    yarn install
    
    Pop-Location
    
    Write-Success "WatchNexus installed to $InstallDir"
}

# Create configuration files
function New-Configuration {
    Write-Info "Creating configuration..."
    
    $configDir = "$DataDir\config"
    
    # Generate JWT secret
    $jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
    
    # Backend .env
    @"
# WatchNexus Backend Configuration
MONGO_URL=mongodb://localhost:27017
DB_NAME=watchnexus
DOWNLOAD_PATH=$DataDir\downloads
LIBRARY_PATH=$DataDir\library
JWT_SECRET=$jwtSecret
CORS_ORIGINS=*
"@ | Out-File -FilePath "$configDir\backend.env" -Encoding utf8
    
    # Frontend .env
    @"
# WatchNexus Frontend Configuration
REACT_APP_BACKEND_URL=http://localhost:8001
"@ | Out-File -FilePath "$configDir\frontend.env" -Encoding utf8
    
    # Copy to install directory
    Copy-Item "$configDir\backend.env" "$InstallDir\backend\.env" -Force
    Copy-Item "$configDir\frontend.env" "$InstallDir\frontend\.env" -Force
    
    Write-Success "Configuration created"
}

# Create Windows Service using NSSM
function New-WindowsService {
    Write-Info "Creating Windows service..."
    
    # Install NSSM if not present
    if (!(Get-Command nssm -ErrorAction SilentlyContinue)) {
        choco install nssm -y | Out-Null
    }
    
    # Remove existing service if present
    nssm stop WatchNexusBackend 2>$null
    nssm remove WatchNexusBackend confirm 2>$null
    
    # Create new service
    $pythonExe = "$InstallDir\backend\venv\Scripts\python.exe"
    $uvicornModule = "uvicorn"
    $uvicornArgs = "server:app --host 0.0.0.0 --port 8001"
    
    nssm install WatchNexusBackend $pythonExe -m $uvicornModule $uvicornArgs
    nssm set WatchNexusBackend AppDirectory "$InstallDir\backend"
    nssm set WatchNexusBackend DisplayName "WatchNexus Backend"
    nssm set WatchNexusBackend Description "WatchNexus Media Server Backend"
    nssm set WatchNexusBackend Start SERVICE_AUTO_START
    nssm set WatchNexusBackend AppStdout "$DataDir\logs\backend.log"
    nssm set WatchNexusBackend AppStderr "$DataDir\logs\backend.error.log"
    nssm set WatchNexusBackend AppRotateFiles 1
    nssm set WatchNexusBackend AppRotateBytes 1048576
    
    Write-Success "Windows service created"
}

# Start MongoDB
function Start-MongoDB {
    Write-Info "Starting MongoDB..."
    
    # Check if MongoDB service exists
    $mongoService = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
    
    if ($mongoService) {
        if ($mongoService.Status -ne "Running") {
            Start-Service MongoDB
        }
        Write-Success "MongoDB is running"
    } else {
        Write-Warning "MongoDB service not found. Starting manually..."
        
        # Create data directory
        $mongoDataDir = "$DataDir\mongodb"
        if (!(Test-Path $mongoDataDir)) {
            New-Item -ItemType Directory -Path $mongoDataDir -Force | Out-Null
        }
        
        # Start MongoDB in background
        $mongod = Get-Command mongod -ErrorAction SilentlyContinue
        if ($mongod) {
            Start-Process -FilePath $mongod.Source -ArgumentList "--dbpath `"$mongoDataDir`"" -WindowStyle Hidden
            Write-Success "MongoDB started"
        } else {
            Write-Error "MongoDB not found"
        }
    }
}

# Start WatchNexus
function Start-WatchNexus {
    Write-Info "Starting WatchNexus..."
    
    # Start service
    nssm start WatchNexusBackend 2>$null
    
    # Wait for startup
    Start-Sleep -Seconds 5
    
    # Verify
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8001/api/health" -UseBasicParsing -TimeoutSec 10
        if ($response.Content -match "healthy") {
            Write-Success "WatchNexus is running"
        }
    } catch {
        Write-Warning "WatchNexus may not be running correctly"
    }
}

# Create Start Menu shortcuts
function New-Shortcuts {
    Write-Info "Creating shortcuts..."
    
    $startMenuPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\WatchNexus"
    
    if (!(Test-Path $startMenuPath)) {
        New-Item -ItemType Directory -Path $startMenuPath -Force | Out-Null
    }
    
    # Create shortcut to web interface
    $shell = New-Object -ComObject WScript.Shell
    
    $shortcut = $shell.CreateShortcut("$startMenuPath\WatchNexus.lnk")
    $shortcut.TargetPath = "http://localhost:8001"
    $shortcut.Description = "Open WatchNexus in browser"
    $shortcut.Save()
    
    # Create shortcut to uninstaller
    $uninstallShortcut = $shell.CreateShortcut("$startMenuPath\Uninstall WatchNexus.lnk")
    $uninstallShortcut.TargetPath = "powershell.exe"
    $uninstallShortcut.Arguments = "-ExecutionPolicy Bypass -File `"$InstallDir\uninstall.ps1`""
    $uninstallShortcut.Description = "Uninstall WatchNexus"
    $uninstallShortcut.Save()
    
    # Desktop shortcut
    $desktopShortcut = $shell.CreateShortcut("$env:USERPROFILE\Desktop\WatchNexus.lnk")
    $desktopShortcut.TargetPath = "http://localhost:8001"
    $desktopShortcut.Description = "Open WatchNexus"
    $desktopShortcut.Save()
    
    Write-Success "Shortcuts created"
}

# Create uninstaller
function New-Uninstaller {
    $uninstallScript = @'
# WatchNexus Uninstaller
Write-Host "Uninstalling WatchNexus..." -ForegroundColor Yellow

# Stop and remove service
nssm stop WatchNexusBackend 2>$null
nssm remove WatchNexusBackend confirm 2>$null

# Remove files
$InstallDir = "$env:LOCALAPPDATA\WatchNexus"
$DataDir = "$env:APPDATA\WatchNexus"

Remove-Item -Path $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\WatchNexus" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:USERPROFILE\Desktop\WatchNexus.lnk" -Force -ErrorAction SilentlyContinue

# Ask about data
$keepData = Read-Host "Keep user data (library, downloads)? [Y/n]"
if ($keepData -eq "n" -or $keepData -eq "N") {
    Remove-Item -Path $DataDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "WatchNexus uninstalled" -ForegroundColor Green
Read-Host "Press Enter to exit"
'@
    
    $uninstallScript | Out-File -FilePath "$InstallDir\uninstall.ps1" -Encoding utf8
}

# Main installation
function Main {
    Show-Banner
    
    if ($Help) {
        @"
WatchNexus Windows Installer

Usage: .\install-windows.ps1 [options]

Options:
  -InstallDir <path>    Installation directory (default: %LOCALAPPDATA%\WatchNexus)
  -DataDir <path>       Data directory (default: %APPDATA%\WatchNexus)
  -Version <version>    Version to install (default: 1.0.0)
  -SkipDependencies     Skip installing dependencies
  -Help                 Show this help message

Examples:
  .\install-windows.ps1
  .\install-windows.ps1 -InstallDir "D:\WatchNexus"
  .\install-windows.ps1 -SkipDependencies
"@
        return
    }
    
    # Check admin rights
    if (!(Test-Administrator)) {
        Write-Warning "This script should be run as Administrator for best results"
        $response = Read-Host "Continue anyway? [y/N]"
        if ($response -ne "y" -and $response -ne "Y") {
            exit 0
        }
    }
    
    Test-WindowsVersion
    
    if (!$SkipDependencies) {
        Install-Chocolatey
        Install-Dependencies
    }
    
    New-Directories
    Install-WatchNexus
    New-Configuration
    Start-MongoDB
    New-WindowsService
    Start-WatchNexus
    New-Shortcuts
    New-Uninstaller
    
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║          WatchNexus Installation Complete! 🎉                ║" -ForegroundColor Green
    Write-Host "╠══════════════════════════════════════════════════════════════╣" -ForegroundColor Green
    Write-Host "║  Access WatchNexus at: http://localhost:8001                 ║" -ForegroundColor Green
    Write-Host "║                                                              ║" -ForegroundColor Green
    Write-Host "║  Manage service:                                             ║" -ForegroundColor Green
    Write-Host "║    Start: nssm start WatchNexusBackend                       ║" -ForegroundColor Green
    Write-Host "║    Stop:  nssm stop WatchNexusBackend                        ║" -ForegroundColor Green
    Write-Host "║    Status: nssm status WatchNexusBackend                     ║" -ForegroundColor Green
    Write-Host "║                                                              ║" -ForegroundColor Green
    Write-Host "║  Logs: $DataDir\logs                           ║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    
    # Open in browser
    Start-Process "http://localhost:8001"
}

Main
