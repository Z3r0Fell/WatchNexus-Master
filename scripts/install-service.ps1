<#
.SYNOPSIS
    Install WatchNexus as a Windows Service with recovery options and firewall rule.
.DESCRIPTION
    Registers WatchNexus.Core.exe as a Windows service with:
    - Auto-start
    - Recovery: restart on failure (3 attempts), then reboot
    - Firewall rule for the configured port
    - Proper service description
.PARAMETER BinaryPath
    Path to WatchNexus.Core.exe (default: "$env:ProgramFiles\WatchNexus\bin\WatchNexus.Core.exe")
.PARAMETER Port
    HTTP port (default: 8001)
.PARAMETER ServiceName
    Windows service name (default: WatchNexusCore)
.PARAMETER DisplayName
    Display name (default: WatchNexus Core)
.PARAMETER Description
    Service description (default: Self-hosted media server — core service)
.EXAMPLE
    .\scripts\install-service.ps1
    .\scripts\install-service.ps1 -BinaryPath "C:\CustomPath\WatchNexus.Core.exe" -Port 8080
#>
param(
    [string]$BinaryPath = "$env:ProgramFiles\WatchNexus\bin\WatchNexus.Core.exe",
    [int]$Port = 8001,
    [string]$ServiceName = "WatchNexusCore",
    [string]$DisplayName = "WatchNexus Core",
    [string]$Description = "Self-hosted media server — core service"
)

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

# ══════════════════════════════════════════════════════════════════════
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  WatchNexus Windows Service Installer" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ── Prerequisites ────────────────────────────────────────────────────
# Check admin
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: This script must be run as Administrator." -ForegroundColor Red
    exit 1
}

# Check binary exists
if (-not (Test-Path $BinaryPath)) {
    Write-Host "ERROR: Binary not found at $BinaryPath" -ForegroundColor Red
    Write-Host "  Build the project first, or specify -BinaryPath" -ForegroundColor Yellow
    exit 1
}
Write-Host "  Binary : $BinaryPath" -ForegroundColor Gray
Write-Host "  Service: $ServiceName" -ForegroundColor Gray
Write-Host "  Port   : $Port" -ForegroundColor Gray
Write-Host ""

# ── Stop existing service ────────────────────────────────────────────
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "  Stopping existing service '$ServiceName'..." -ForegroundColor Yellow
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    sc.exe delete $ServiceName *>$null
    if ($?) {
        Write-Host "  ✓ Deleted existing service" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Could not delete service (may need reboot)" -ForegroundColor Yellow
    }
}

# ── Create service ───────────────────────────────────────────────────
$binPath = "`"$BinaryPath`" --service --urls http://0.0.0.0:$Port"
Write-Host "  Creating service '$ServiceName'..." -ForegroundColor Yellow

$createArgs = @(
    "create", $ServiceName,
    "binPath=", $binPath,
    "start=", "auto",
    "DisplayName=", $DisplayName
)
$result = sc.exe $createArgs 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to create service: $result" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Service created" -ForegroundColor Green

# ── Set description ──────────────────────────────────────────────────
sc.exe description $ServiceName $Description *>$null
if ($?) { Write-Host "  ✓ Description set" -ForegroundColor Green }

# ── Set recovery options ─────────────────────────────────────────────
Write-Host "  Setting recovery options..." -ForegroundColor Yellow
# Failure 1: restart after 5s
# Failure 2: restart after 5s
# Failure 3: restart after 5s
# Reset fail count after 86400s (1 day)
# Final failure: reboot
sc.exe failure $ServiceName reset=86400 actions=restart/5000/restart/5000/restart/5000 *>$null
if ($?) { Write-Host "  ✓ Recovery: restart on failure (3 attempts, 5s delay)" -ForegroundColor Green }

sc.exe failureflag $ServiceName 1 *>$null
if ($?) { Write-Host "  ✓ Recovery flag set" -ForegroundColor Green }

# ── Set service account (LocalSystem is default) ─────────────────────
# Keep LocalSystem for full access, or switch to NetworkService
# sc.exe config $ServiceName obj="NT AUTHORITY\NetworkService" *>$null

# ── Grant write access to ProgramData (needed for LocalSystem) ───────
$programData = "$env:ProgramData\WatchNexus"
if (-not (Test-Path $programData)) {
    New-Item -ItemType Directory -Path $programData -Force *>$null
    Write-Host "  ✓ Created $programData" -ForegroundColor Green
}
# Grant SYSTEM full control (already has it by default, but ensure)
try {
    icacls $programData /grant "*S-1-5-18:(OI)(CI)F" /T *>$null
    Write-Host "  ✓ SYSTEM has full control on $programData" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Could not set ACL on $programData: $_" -ForegroundColor Yellow
}

# ── Start service ────────────────────────────────────────────────────
Write-Host "  Starting service '$ServiceName'..." -ForegroundColor Yellow
Start-Service -Name $ServiceName -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq "Running") {
    Write-Host "  ✓ Service is RUNNING" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Service status: $($svc.Status)" -ForegroundColor Yellow
    Write-Host "  Check event log or run: sc.exe query $ServiceName" -ForegroundColor Yellow
}

# ── Firewall rule ────────────────────────────────────────────────────
$ruleName = "WatchNexus $Port"
$existingRule = netsh advfirewall firewall show rule name="$ruleName" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Creating firewall rule '$ruleName'..." -ForegroundColor Yellow
    netsh advfirewall firewall add rule name="$ruleName" dir=in action=allow protocol=TCP localport=$Port *>$null
    if ($?) {
        Write-Host "  ✓ Firewall rule created (TCP/$Port inbound)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Could not create firewall rule" -ForegroundColor Yellow
    }
} else {
    Write-Host "  − Firewall rule '$ruleName' already exists" -ForegroundColor Yellow
}

# ── Done ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Installation Complete" -ForegroundColor Cyan
Write-Host "  Service : $ServiceName" -ForegroundColor Gray
Write-Host "  Port    : $Port" -ForegroundColor Gray
Write-Host "  Open    : http://localhost:$Port" -ForegroundColor Gray
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Management commands:" -ForegroundColor White
Write-Host "    sc.exe query $ServiceName" -ForegroundColor Gray
Write-Host "    sc.exe stop $ServiceName" -ForegroundColor Gray
Write-Host "    sc.exe start $ServiceName" -ForegroundColor Gray
Write-Host "    .\scripts\uninstall-service.ps1" -ForegroundColor Gray
Write-Host ""
