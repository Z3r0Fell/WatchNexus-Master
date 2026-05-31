<#
.SYNOPSIS
    Uninstall WatchNexus Windows Service and clean up.
.DESCRIPTION
    Stops and deletes the WatchNexusCore service, removes firewall rule,
    and kills any stray tray processes.
.PARAMETER ServiceName
    Windows service name (default: WatchNexusCore)
.PARAMETER Port
    Port used for the firewall rule (default: 8001)
.EXAMPLE
    .\scripts\uninstall-service.ps1
    .\scripts\uninstall-service.ps1 -ServiceName WatchNexusCore -Port 8080
#>
param(
    [string]$ServiceName = "WatchNexusCore",
    [int]$Port = 8001
)

#Requires -RunAsAdministrator

$ErrorActionPreference = "Continue"  # Don't stop on cleanup warnings

# ══════════════════════════════════════════════════════════════════════
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  WatchNexus Windows Service Uninstaller" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ── Prerequisites ────────────────────────────────────────────────────
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: This script must be run as Administrator." -ForegroundColor Red
    exit 1
}

# ── 1. Stop the service ──────────────────────────────────────────────
Write-Host "[1/5] Stopping service '$ServiceName'..." -ForegroundColor Yellow
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svc) {
    try {
        Stop-Service -Name $ServiceName -Force -ErrorAction Stop
        Start-Sleep -Seconds 2
        Write-Host "  ✓ Service stopped" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠ Could not stop service: $_" -ForegroundColor Yellow
        # Force kill the process directly
        $procs = Get-Process -Name "WatchNexus.Core" -ErrorAction SilentlyContinue
        if ($procs) {
            $procs | Stop-Process -Force
            Write-Host "  ✓ Killed WatchNexus.Core.exe processes" -ForegroundColor Green
        }
    }
} else {
    Write-Host "  − Service not found (already removed)" -ForegroundColor Yellow
}

# ── 2. Delete the service ────────────────────────────────────────────
Write-Host "[2/5] Deleting service..." -ForegroundColor Yellow
$result = sc.exe delete $ServiceName 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Service deleted" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Could not delete service: $result" -ForegroundColor Yellow
    Write-Host "  (This is normal if the service was already deleted)" -ForegroundColor Yellow
}

# ── 3. Remove firewall rule ──────────────────────────────────────────
Write-Host "[3/5] Removing firewall rule..." -ForegroundColor Yellow
$ruleName = "WatchNexus $Port"
$result = netsh advfirewall firewall delete rule name="$ruleName" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Firewall rule '$ruleName' removed" -ForegroundColor Green
} else {
    Write-Host "  − Firewall rule not found (already removed)" -ForegroundColor Yellow
}

# Also clean up any old firewall rules without port suffix
$oldRule = "WatchNexus"
$result2 = netsh advfirewall firewall delete rule name="$oldRule" dir=in 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Legacy firewall rule '$oldRule' removed" -ForegroundColor Green
}

# ── 4. Kill stray tray processes ─────────────────────────────────────
Write-Host "[4/5] Killing stray processes..." -ForegroundColor Yellow
$trayProcs = Get-Process -Name "WatchNexusTray" -ErrorAction SilentlyContinue
if ($trayProcs) {
    $trayProcs | Stop-Process -Force
    Write-Host "  ✓ Killed WatchNexusTray processes" -ForegroundColor Green
} else {
    Write-Host "  − No tray processes found" -ForegroundColor Gray
}

# Also kill any leftover WatchNexus.Core processes not running as service
$coreProcs = Get-Process -Name "WatchNexus.Core" -ErrorAction SilentlyContinue |
    Where-Object { $_.SessionId -ne 0 }  # Session 0 = service, skip that
if ($coreProcs) {
    $coreProcs | Stop-Process -Force
    Write-Host "  ✓ Killed user-session WatchNexus.Core processes" -ForegroundColor Green
} else {
    Write-Host "  − No user-session WatchNexus.Core processes" -ForegroundColor Gray
}

# ── 5. Clean registry autostart ──────────────────────────────────────
Write-Host "[5/5] Cleaning registry..." -ForegroundColor Yellow
try {
    $regPath = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run"
    $existing = Get-ItemProperty -Path $regPath -Name "WatchNexusTray" -ErrorAction SilentlyContinue
    if ($existing) {
        Remove-ItemProperty -Path $regPath -Name "WatchNexusTray" -Force
        Write-Host "  ✓ Removed autostart registry entry" -ForegroundColor Green
    } else {
        Write-Host "  − No autostart registry entry found" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ⚠ Could not clean registry: $_" -ForegroundColor Yellow
}

# ── Done ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Uninstall Complete" -ForegroundColor Cyan
Write-Host "  To fully remove data, delete:" -ForegroundColor Gray
Write-Host "    $env:ProgramData\WatchNexus (user data, DB, logs)" -ForegroundColor Gray
Write-Host "    Registry: HKLM\Software\WatchNexus" -ForegroundColor Gray
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
