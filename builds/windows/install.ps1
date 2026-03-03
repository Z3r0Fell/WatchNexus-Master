# WatchNexus Windows Installer (PowerShell)
# Run as Administrator: iwr -useb [url] | iex

$ErrorActionPreference = "Stop"
$Version = "2.7.0"
$InstallDir = "$env:LOCALAPPDATA\WatchNexus"
$DataDir = "$env:USERPROFILE\.watchnexus"

Write-Host ""
Write-Host "  WatchNexus Installer v$Version" -ForegroundColor Cyan
Write-Host "  ================================" -ForegroundColor Cyan
Write-Host ""

# Check admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[!] Some features need admin rights. Re-run as Administrator." -ForegroundColor Yellow
}

# Create directories
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

# Check Python
Write-Host "[*] Checking Python..." -ForegroundColor Gray
$python = Get-Command python -ErrorAction SilentlyContinue
if ($python) {
    $pyVer = & python --version 2>&1
    Write-Host "[+] $pyVer found" -ForegroundColor Green
} else {
    Write-Host "[*] Installing Python 3.11..." -ForegroundColor Gray
    $pyUrl = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
    $pyInstaller = "$env:TEMP\python-installer.exe"
    
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $pyUrl -OutFile $pyInstaller
    
    Start-Process -FilePath $pyInstaller -ArgumentList "/quiet", "InstallAllUsers=0", "PrependPath=1", "Include_pip=1" -Wait
    Remove-Item $pyInstaller
    
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    Write-Host "[+] Python installed" -ForegroundColor Green
}

# Check Node.js
Write-Host "[*] Checking Node.js..." -ForegroundColor Gray
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    $nodeVer = & node --version 2>&1
    Write-Host "[+] Node.js $nodeVer found" -ForegroundColor Green
} else {
    Write-Host "[*] Installing Node.js 20 LTS..." -ForegroundColor Gray
    $nodeUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
    $nodeInstaller = "$env:TEMP\node-installer.msi"
    
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller
    Start-Process msiexec.exe -ArgumentList "/i", $nodeInstaller, "/qn" -Wait
    Remove-Item $nodeInstaller
    
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    Write-Host "[+] Node.js installed" -ForegroundColor Green
}

# Download WatchNexus
Write-Host "[*] Downloading WatchNexus..." -ForegroundColor Gray
Set-Location $InstallDir

$releaseUrl = "https://github.com/watchnexus/watchnexus/releases/download/v$Version/watchnexus-$Version-windows.zip"
$zipFile = "$InstallDir\watchnexus.zip"

try {
    Invoke-WebRequest -Uri $releaseUrl -OutFile $zipFile
    Expand-Archive -Path $zipFile -DestinationPath $InstallDir -Force
    Remove-Item $zipFile
    Write-Host "[+] Downloaded release" -ForegroundColor Green
} catch {
    Write-Host "[!] Release not found, cloning from git..." -ForegroundColor Yellow
    $git = Get-Command git -ErrorAction SilentlyContinue
    if ($git) {
        & git clone --depth 1 https://github.com/watchnexus/watchnexus.git .
    } else {
        Write-Host "[!] Git not found. Download manually from:" -ForegroundColor Red
        Write-Host "    https://github.com/watchnexus/watchnexus/releases" -ForegroundColor Red
        exit 1
    }
}

# Find server directory
$serverDir = $null
@("src\server", "server", "separated\server") | ForEach-Object {
    if (Test-Path "$InstallDir\$_") { $serverDir = "$InstallDir\$_" }
}

if (-not $serverDir) {
    Write-Host "[!] Server directory not found" -ForegroundColor Red
    exit 1
}

# Setup Python venv
Write-Host "[*] Setting up backend..." -ForegroundColor Gray
Set-Location $serverDir

& python -m venv venv
& .\venv\Scripts\Activate.ps1
& pip install --upgrade pip -q
& pip install -r requirements.txt -q
deactivate

# Create env file
if (-not (Test-Path ".env")) {
    $secret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    "JWT_SECRET=$secret" | Out-File -FilePath ".env" -Encoding utf8
    "DATA_DIR=$DataDir" | Out-File -FilePath ".env" -Append -Encoding utf8
}

Write-Host "[+] Backend configured" -ForegroundColor Green

# Create launcher
Write-Host "[*] Creating launcher..." -ForegroundColor Gray
$launcher = @"
@echo off
cd /d "$serverDir"
call venv\Scripts\activate.bat
uvicorn server:app --host 127.0.0.1 --port 8001
"@
$launcher | Out-File -FilePath "$InstallDir\WatchNexus.bat" -Encoding ascii

# Desktop shortcut
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\WatchNexus.lnk")
$Shortcut.TargetPath = "$InstallDir\WatchNexus.bat"
$Shortcut.WorkingDirectory = $InstallDir
$Shortcut.Description = "WatchNexus Media Server"
$Shortcut.Save()

# Start menu shortcut
$startMenu = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\WatchNexus"
New-Item -ItemType Directory -Force -Path $startMenu | Out-Null
$Shortcut = $WshShell.CreateShortcut("$startMenu\WatchNexus.lnk")
$Shortcut.TargetPath = "$InstallDir\WatchNexus.bat"
$Shortcut.WorkingDirectory = $InstallDir
$Shortcut.Save()

Write-Host "[+] Shortcuts created" -ForegroundColor Green

Write-Host ""
Write-Host "  ================================" -ForegroundColor Cyan
Write-Host "  [+] Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Start WatchNexus:" -ForegroundColor White
Write-Host "    Double-click desktop shortcut" -ForegroundColor Gray
Write-Host "    Or run: $InstallDir\WatchNexus.bat" -ForegroundColor Gray
Write-Host ""
Write-Host "  Then open: http://localhost:8001" -ForegroundColor Cyan
Write-Host ""
