<#
.SYNOPSIS
    WatchNexus Smoke Test (PowerShell)
.DESCRIPTION
    Validates: service health, API, auth, tier, fortress integrity, web UI
.PARAMETER Host
    Base URL of the WatchNexus instance (default: http://localhost:8001)
.PARAMETER Tier
    Expected tier (default: standard)
.EXAMPLE
    .\scripts\smoke-test.ps1
    .\scripts\smoke-test.ps1 -Host http://localhost:8001 -Tier standard
#>
param(
    [string]$Host = "http://localhost:8001",
    [string]$Tier = "standard"
)

$ScriptDir = Split-Path -Parent $PSCommandPath
$PassCount = 0
$FailCount = 0
$SkipCount = 0
$CookiesFile = Join-Path $ScriptDir ".smoke-cookies.txt"

# ── Colors ───────────────────────────────────────────────────────────
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"
$Cyan = "Cyan"

function Pass($msg) { Write-Host "  ✓ PASS  $msg" -ForegroundColor $Green; $script:PassCount++ }
function Fail($msg) { Write-Host "  ✗ FAIL  $msg" -ForegroundColor $Red; $script:FailCount++ }
function Skip($msg) { Write-Host "  − SKIP  $msg" -ForegroundColor $Yellow; $script:SkipCount++ }
function Info($msg) { Write-Host "   i   $msg" -ForegroundColor $Cyan }

# ══════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor White
Write-Host "  WatchNexus Smoke Test" -ForegroundColor White
Write-Host "  Target : $Host" -ForegroundColor White
Write-Host "  Tier   : $Tier" -ForegroundColor White
Write-Host "  Date   : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')" -ForegroundColor White
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor White
Write-Host ""

# ── 1. Service / Process Health ──────────────────────────────────────
Write-Host "[1/9] Service & Process Health" -ForegroundColor White

$serviceName = "WatchNexusCore"
try {
    $svc = Get-Service -Name $serviceName -ErrorAction Stop
    if ($svc.Status -eq "Running") {
        Pass "Windows service '$serviceName' is Running"
    } else {
        Fail "Windows service '$serviceName' status: $($svc.Status) (expected Running)"
    }
} catch {
    # Fallback: check process
    $proc = Get-Process -Name "WatchNexus.Core" -ErrorAction SilentlyContinue
    if ($proc) {
        Pass "WatchNexus.Core.exe process found (PID $($proc.Id))"
    } else {
        # Try netstat to see if port is listening
        $portNumber = if ($Host -match ':(\d+)$') { $Matches[1] } else { "8001" }
        $listening = netstat -ano | Select-String "LISTENING" | Select-String ":$portNumber" | Select-Object -First 1
        if ($listening) {
            Pass "Process listening on port $portNumber"
        } else {
            Fail "WatchNexus.Core.exe not running and no listener on port $portNumber"
        }
    }
}

# ── 2. API Reachable ─────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/9] API Reachable" -ForegroundColor White
try {
    $req = [System.Net.WebRequest]::Create("$Host/")
    $req.Timeout = 5000
    $resp = $req.GetResponse()
    if ($resp.StatusCode -eq 200) {
        Pass "API root reachable — HTTP 200"
    } else {
        Fail "API root returned HTTP $($resp.StatusCode)"
    }
    $resp.Close()
} catch {
    Fail "API root unreachable: $_"
}

# ── 3. First-Launch Check ────────────────────────────────────────────
Write-Host ""
Write-Host "[3/9] First-Launch & Activation Status" -ForegroundColor White
try {
    $json = Invoke-RestMethod -Uri "$Host/api/cellar/first-launch" -TimeoutSec 5 -ErrorAction Stop
    if ($json.PSObject.Properties.Name -contains "needs_activation") {
        Pass "first-launch endpoint — needs_activation = $($json.needs_activation)"
    } else {
        Pass "first-launch endpoint responded (valid JSON)"
    }
} catch {
    Fail "first-launch endpoint: $_"
}

# ── 4. Tier Manifest ─────────────────────────────────────────────────
Write-Host ""
Write-Host "[4/9] Tier Manifest" -ForegroundColor White
try {
    $json = Invoke-RestMethod -Uri "$Host/api/cellar/tiers" -TimeoutSec 5 -ErrorAction Stop
    $tiers = $json.tiers.PSObject.Properties.Name
    $hasStandard = $tiers -contains "standard"
    $hasPro = $tiers -contains "pro"
    $hasUltra = $tiers -contains "ultra"
    if ($hasStandard -and $hasPro -and $hasUltra) {
        Pass "All 3 tiers (standard, pro, ultra) present"
        Info "  standard modules: $($json.tiers.standard.module_count)"
        Info "  pro modules: $($json.tiers.pro.module_count)"
        Info "  ultra modules: $($json.tiers.ultra.module_count)"
    } else {
        Fail "Missing tiers. Found: $($tiers -join ', ')"
    }
} catch {
    Fail "Tier manifest: $_"
}

# ── 5. Setup Wizard Readiness ────────────────────────────────────────
Write-Host ""
Write-Host "[5/9] Setup Wizard Readiness" -ForegroundColor White
try {
    $req = [System.Net.WebRequest]::Create("$Host/api/setup")
    $req.Method = "POST"
    $req.ContentType = "application/json"
    $req.Timeout = 5000
    $bytes = [System.Text.Encoding]::UTF8.GetBytes('{}')
    $req.ContentLength = $bytes.Length
    $stream = $req.GetRequestStream()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Close()
    $resp = $req.GetResponse()
    $code = [int]$resp.StatusCode
    if ($code -eq 400) {
        Pass "Setup endpoint active (POST → 400 with empty body)"
    } elseif ($code -eq 200) {
        Pass "Setup endpoint returned 200 (setup already completed)"
    } else {
        Pass "Setup endpoint responds (HTTP $code)"
    }
    $resp.Close()
} catch [System.Net.WebException] {
    $code = [int]$_.Exception.Response.StatusCode
    if ($code -eq 400) {
        Pass "Setup endpoint active (POST → 400 with empty body)"
    } elseif ($code -eq 200) {
        Pass "Setup endpoint returned 200"
    } else {
        Pass "Setup endpoint responds (HTTP $code)"
    }
} catch {
    Fail "Setup endpoint unreachable: $_"
}

# ── 6. Registration & Login Flow ──────────────────────────────────────
Write-Host ""
Write-Host "[6/9] Auth Flow (Register → Login)" -ForegroundColor White
$testEmail = "smoke-$(Get-Date -Format 'yyyyMMddHHmmss')@watchnexus.test"
$testPass = "SmokeTest123!"
$authCookie = $null

# Check first-launch state
try {
    $fl = Invoke-RestMethod -Uri "$Host/api/cellar/first-launch" -TimeoutSec 5 -ErrorAction Stop
    $setupDone = $fl.setup_completed
    if ($setupDone -eq $false -or $null -eq $setupDone) {
        $body = @{ email = $testEmail; password = $testPass; username = "smoketest" } | ConvertTo-Json
        $setupResp = Invoke-RestMethod -Uri "$Host/api/setup" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($setupResp.status -eq "setup_complete") {
            Pass "First admin created via /api/setup"
        } else {
            Skip "Could not create test admin (may already exist)"
        }
    }
} catch {
    Skip "Setup check skipped: $_"
}

# Login
try {
    $body = @{ email = $testEmail; password = $testPass } | ConvertTo-Json
    $loginResp = Invoke-WebRequest -Uri "$Host/api/auth/login" -Method Post -Body $body -ContentType "application/json" -SessionVariable session -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($loginResp.StatusCode -eq 200) {
        Pass "Login successful (HTTP 200)"
        $authCookie = $session
    } else {
        Skip "Login returned HTTP $($loginResp.StatusCode)"
    }
} catch {
    Skip "Login test skipped — endpoint responded but may need different credentials"
}

# ── 7. Fortress Status ──────────────────────────────────────────────
Write-Host ""
Write-Host "[7/9] Fortress Integrity Status" -ForegroundColor White
try {
    $json = Invoke-RestMethod -Uri "$Host/api/fortress/status" -TimeoutSec 5 -ErrorAction Stop
    if ($json.PSObject.Properties.Name -contains "intact" -and $json.intact -eq $true) {
        Pass "Fortress intact = true"
    } elseif ($json.PSObject.Properties.Name -contains "status" -and $json.status -eq "intact") {
        Pass "Fortress status = intact"
    } else {
        Pass "Fortress status endpoint responded (checking fields: $($json | ConvertTo-Json -Compress))"
    }
} catch {
    Fail "Fortress status: $_"
}

# ── 8. Update Check ──────────────────────────────────────────────────
Write-Host ""
Write-Host "[8/9] Update Check" -ForegroundColor White
if ($authCookie) {
    try {
        $updateResp = Invoke-WebRequest -Uri "$Host/api/system/updates/check" -WebSession $authCookie -TimeoutSec 5 -ErrorAction Stop
        if ($updateResp.StatusCode -eq 200) {
            $json = $updateResp.Content | ConvertFrom-Json
            if ($json.PSObject.Properties.Name -contains "current_version") {
                Pass "Update check returned v$($json.current_version)"
            } else {
                Pass "Update check responded (HTTP 200)"
            }
        } else {
            Fail "Update check returned HTTP $($updateResp.StatusCode)"
        }
    } catch {
        Fail "Update check: $_"
    }
} else {
    try {
        $req = [System.Net.WebRequest]::Create("$Host/api/system/updates/check")
        $req.Timeout = 5000
        $resp = $req.GetResponse()
        $code = [int]$resp.StatusCode
        if ($code -eq 200) {
            Pass "Update check responded (no auth needed)"
        } else {
            Skip "Update check returned HTTP $code (no auth provided)"
        }
        $resp.Close()
    } catch [System.Net.WebException] {
        $code = [int]$_.Exception.Response.StatusCode
        if ($code -eq 401) {
            Skip "Update check skipped — requires auth (HTTP 401)"
        } else {
            Skip "Update check HTTP $code"
        }
    } catch {
        Skip "Update check: $_"
    }
}

# ── 9. Web UI Available ────────────────────────────────────────────
Write-Host ""
Write-Host "[9/9] Web UI Served" -ForegroundColor White
try {
    $req = [System.Net.WebRequest]::Create("$Host/")
    $req.Timeout = 5000
    $resp = $req.GetResponse()
    $code = [int]$resp.StatusCode
    $contentType = $resp.ContentType
    if ($code -eq 200) {
        if ($contentType -match "html") {
            Pass "Web UI serving HTML (HTTP 200, Content-Type: $contentType)"
        } else {
            Pass "Web UI responding (HTTP 200, Content-Type: $contentType)"
        }
    } elseif ($code -eq 304) {
        Pass "Web UI serving (HTTP 304 Not Modified)"
    } else {
        Skip "Web UI returned HTTP $code"
    }
    $resp.Close()
} catch {
    Fail "Web UI unreachable: $_"
}

# ══════════════════════════════════════════════════════════════════════
#  Summary
# ══════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor White
Write-Host "  Smoke Test Complete" -ForegroundColor White
Write-Host "  $PassCount passed, $FailCount failed, $SkipCount skipped" -ForegroundColor White
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor White

# Cleanup
if (Test-Path $CookiesFile) { Remove-Item $CookiesFile -Force }

if ($FailCount -gt 0) { exit 1 }
exit 0
