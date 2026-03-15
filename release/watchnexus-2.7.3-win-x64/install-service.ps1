#Requires -RunAsAdministrator
$svcName = "WatchNexus"
$binPath = Join-Path $PSScriptRoot "WatchNexus.Core.exe"
$env:ASPNETCORE_URLS = "http://0.0.0.0:8001"

if (Get-Service -Name $svcName -ErrorAction SilentlyContinue) {
    Write-Host "Stopping existing $svcName service..."
    Stop-Service $svcName -Force
    sc.exe delete $svcName
    Start-Sleep 2
}

Write-Host "Installing $svcName as a Windows service..."
New-Service -Name $svcName -BinaryPathName $binPath -DisplayName "WatchNexus Media Server" `
    -StartupType Automatic -Description "WatchNexus v2.7.3 unified media pipeline"

Write-Host "Starting $svcName..."
Start-Service $svcName
Write-Host "WatchNexus installed and running at http://localhost:8001"
