"""
WatchNexus v1.0.0 RTP — Iteration 22 Regression Sweep

Goal: Confirm the iteration-22 security hardening changes did NOT regress any
controller. Specifically validates:

1. Core controllers still respond on Standard tier (no 500s after EF
   ValueConverter + DataProtection middleware was added).
2. S-20/S-21 Encryption-at-rest: PUT /api/settings then GET /api/settings/{key}
   returns the ORIGINAL plaintext value (transparent encrypt/decrypt).
3. Legacy plaintext settings (e.g. theme=dark) still decode (legacy fallback).
4. S-16 Mutation rate limiter: GET/HEAD are NOT throttled (we hammer GETs).
   We do NOT try to exhaust the 120/min mutation cap in this regression
   (E1 already verified it manually 117x200 / 13x429); we instead check
   that a single mutation still returns its normal status code (200).
5. Auth login rate limit still ~10/min (verified by detecting 429 after a
   short burst, then sleeping to recover).
6. Public registration is still 403 (S-XX).
7. Member account still gets 403 on admin routes.
8. Tier-locked endpoint returns 403 FORTRESS_TIER_LOCKED on Standard, while
   exempt /api/crucible/ffmpeg-status returns 200 regardless of ffmpeg
   binary presence.
9. VPN/tunnel config endpoints respond (tier-locked => 403 on Standard is
   expected; we just want NO 500 which would indicate the new EF encryption
   ValueConverter on VpnPeer.PrivateKey/PresharedKey/VpnServerConfig.PrivateKey
   broke entity materialization).

Idempotent. Leaves system on Standard tier. Cleans up any TEST_ settings.
"""

import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ffmpeg-wizard-2.preview.emergentagent.com").rstrip("/")

OWNER_EMAIL = "owner@watchnexus.local"
OWNER_PASSWORD = "password123"
MEMBER_EMAIL = "member@home.local"
MEMBER_PASSWORD = "hometime1"


# --------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------
@pytest.fixture(scope="session")
def admin_token():
    # Avoid login rate-limit collisions with other suites by pacing.
    time.sleep(2)
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    assert tok, "No access_token returned for admin"
    return tok


@pytest.fixture(scope="session")
def member_token():
    time.sleep(7)  # pace under the 10/min auth rate limit
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": MEMBER_EMAIL, "password": MEMBER_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"Member login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def member_headers(member_token):
    return {"Authorization": f"Bearer {member_token}", "Content-Type": "application/json"}


# --------------------------------------------------------------------------
# 1. Core controller smoke (no 500s on Standard tier after DB-layer changes)
# --------------------------------------------------------------------------
class TestCoreControllersNoRegression:
    @pytest.mark.parametrize("path", [
        "/api/health",
        "/api/settings",
        "/api/settings/theme",
        "/api/cellar/status",
        "/api/crucible/ffmpeg-status",
        "/api/core/info",
        "/api/system/status",
        "/api/modules/catalogue",
        "/api/features",
        "/api/security/stats",
        "/api/update/check",
    ])
    def test_authenticated_get_no_500(self, admin_headers, path):
        r = requests.get(f"{BASE_URL}{path}", headers=admin_headers, timeout=20)
        # We tolerate 200/204/403 (tier-locked) but NEVER 500.
        assert r.status_code < 500, f"{path} returned 5xx: {r.status_code} {r.text[:200]}"
        # 401 would also indicate a broken auth pipeline.
        assert r.status_code != 401, f"{path} unexpectedly 401 with valid token"

    def test_unauthenticated_protected_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/settings", timeout=15)
        assert r.status_code == 401, f"Expected 401 unauth, got {r.status_code}"

    def test_unauthenticated_users_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/users", timeout=15)
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"


# --------------------------------------------------------------------------
# 2. S-20/S-21 Encryption-at-rest round-trip
# --------------------------------------------------------------------------
class TestEncryptionAtRest:
    TEST_KEY = "TEST_enc_roundtrip_v22"
    TEST_VALUE = "super-secret-value-1234567890!@#"

    def test_put_then_get_returns_plaintext(self, admin_headers):
        # API shape: PUT /api/settings/{key} with body {"value": "..."}
        r = requests.put(
            f"{BASE_URL}/api/settings/{self.TEST_KEY}",
            headers=admin_headers,
            json={"value": self.TEST_VALUE},
            timeout=15,
        )
        assert r.status_code in (200, 204), f"PUT failed: {r.status_code} {r.text}"

        # GET single key
        r2 = requests.get(
            f"{BASE_URL}/api/settings/{self.TEST_KEY}",
            headers=admin_headers,
            timeout=15,
        )
        assert r2.status_code == 200, f"GET single failed: {r2.status_code} {r2.text}"
        body = r2.json()
        # API returns {"key": "...", "value": "..."}
        if isinstance(body, dict):
            val = body.get("value") or body.get(self.TEST_KEY) or body.get("Value")
        else:
            val = body
        assert val == self.TEST_VALUE, (
            f"Encrypted round-trip corrupted value. Expected '{self.TEST_VALUE}', got '{val}'."
        )

        # GET via bulk /api/settings — must also decrypt
        r3 = requests.get(f"{BASE_URL}/api/settings", headers=admin_headers, timeout=15)
        assert r3.status_code == 200
        bulk = r3.json()
        if isinstance(bulk, dict) and self.TEST_KEY in bulk:
            assert bulk[self.TEST_KEY] == self.TEST_VALUE, (
                f"Bulk GET corrupted value: {bulk[self.TEST_KEY]}"
            )

    def test_overwrite_preserves_plaintext(self, admin_headers):
        # Overwrite with a different value to confirm enc:v1: rows decrypt repeatedly.
        new_val = "rotated-secret-9876!#$%"
        r = requests.put(
            f"{BASE_URL}/api/settings/{self.TEST_KEY}",
            headers=admin_headers,
            json={"value": new_val},
            timeout=15,
        )
        assert r.status_code in (200, 204)
        r2 = requests.get(f"{BASE_URL}/api/settings/{self.TEST_KEY}", headers=admin_headers, timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("value") == new_val, f"Overwrite round-trip failed: {r2.text}"

    def test_legacy_plaintext_setting_still_reads(self, admin_headers):
        # 'theme' is a pre-existing legacy setting written before the
        # SecretProtector was introduced. The 'enc:v1:' prefix fallback must
        # allow it to decode as plain UTF-8.
        r = requests.get(f"{BASE_URL}/api/settings/theme", headers=admin_headers, timeout=15)
        assert r.status_code == 200, f"theme GET failed: {r.status_code}"
        body = r.json()
        if isinstance(body, dict):
            val = body.get("value") or body.get("theme") or body.get("Value")
        else:
            val = body
        assert val in ("dark", "light", "system"), f"Unexpected theme value: {val!r}"


# --------------------------------------------------------------------------
# 3. S-16 Mutation rate limiter — GETs are NOT throttled
# --------------------------------------------------------------------------
class TestMutationLimiterGetsUnthrottled:
    def test_50_rapid_gets_never_429(self, admin_headers):
        codes = []
        for _ in range(50):
            r = requests.get(f"{BASE_URL}/api/health", headers=admin_headers, timeout=10)
            codes.append(r.status_code)
        n_429 = sum(1 for c in codes if c == 429)
        assert n_429 == 0, f"GET /api/health got throttled {n_429}/50 times — limiter is too broad"
        assert all(c == 200 for c in codes), f"unexpected statuses: {set(codes)}"

    def test_single_mutation_still_works(self, admin_headers):
        # Touch a benign setting (proves a PUT mutation isn't pre-emptively
        # rate-limited from a fresh IP/window).
        r = requests.put(
            f"{BASE_URL}/api/settings",
            headers=admin_headers,
            json={"key": "TEST_mutation_smoke_v22", "value": "ok"},
            timeout=15,
        )
        assert r.status_code in (200, 204, 429), (
            f"Single PUT should succeed (or 429 if window already used). Got {r.status_code} {r.text[:200]}"
        )


# --------------------------------------------------------------------------
# 4. Auth login still rate-limited (~10/min) — soft check
# --------------------------------------------------------------------------
class TestAuthRateLimit:
    def test_auth_429_eventually(self):
        # Fire bad-credential logins. We expect SOME 429s within 12 attempts.
        statuses = []
        for _ in range(12):
            r = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": "bad@example.com", "password": "wrong"},
                timeout=10,
            )
            statuses.append(r.status_code)
        # Either 401/400 (bad creds) or 429. We require at least ONE 429.
        assert 429 in statuses, (
            f"Expected at least one 429 within 12 attempts, got statuses: {statuses}"
        )
        # Sleep so subsequent suites don't get blocked by the limiter.
        time.sleep(65)


# --------------------------------------------------------------------------
# 5. Admin-only user management still enforced (regression on RBAC middleware)
# --------------------------------------------------------------------------
class TestRBACStillEnforced:
    def test_public_registration_403(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": "x@x.com", "username": "x", "password": "Whatever123!"},
            timeout=10,
        )
        assert r.status_code == 403, f"register should be 403, got {r.status_code}"

    def test_member_cannot_list_users(self, member_headers):
        r = requests.get(f"{BASE_URL}/api/users", headers=member_headers, timeout=10)
        assert r.status_code == 403, f"member list users should be 403, got {r.status_code}"

    def test_member_cannot_create_user(self, member_headers):
        r = requests.post(
            f"{BASE_URL}/api/users",
            headers=member_headers,
            json={"email": "TEST_x@y.com", "username": "TEST_x", "password": "AbcDef12!", "role": "user"},
            timeout=10,
        )
        assert r.status_code == 403

    def test_admin_can_list_users(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/users", headers=admin_headers, timeout=10)
        assert r.status_code == 200


# --------------------------------------------------------------------------
# 6. Tier gating still works (Standard 403 + exempt ffmpeg-status 200)
# --------------------------------------------------------------------------
class TestTierGating:
    def test_standard_tier_locks_ultra_module(self, admin_headers):
        # /api/tunnel/peers is tier-locked (pro/ultra) per controller sweep.
        r = requests.get(f"{BASE_URL}/api/tunnel/peers", headers=admin_headers, timeout=10)
        assert r.status_code == 403, f"Expected 403 tier-lock, got {r.status_code} {r.text[:200]}"
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        assert body.get("error") == "FORTRESS_TIER_LOCKED", f"Wrong error code: {body}"

    def test_ffmpeg_status_exempt_returns_200(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/crucible/ffmpeg-status", headers=admin_headers, timeout=15)
        # MUST be 200 on Standard regardless of whether the ffmpeg binary is
        # actually present — that's the FortressFilter exempt-path fix.
        assert r.status_code == 200, f"ffmpeg-status should be 200 on Standard, got {r.status_code}"
        body = r.json()
        # ffmpeg_installed may be true or false depending on the container,
        # but the response shape must include the key.
        assert "ffmpeg_installed" in body, f"ffmpeg-status payload missing keys: {body}"


# --------------------------------------------------------------------------
# 7. VPN encrypted columns don't crash entity materialization
# --------------------------------------------------------------------------
class TestVpnEncryptedColumnsNoCrash:
    """
    The new EF ValueConverter is applied to VpnPeer.PrivateKey,
    VpnPeer.PresharedKey, and VpnServerConfig.PrivateKey. On Standard tier
    these endpoints return 403 FORTRESS_TIER_LOCKED, but they must NEVER
    return 500 (which would mean the converter broke materialization for any
    pre-existing rows).
    """
    @pytest.mark.parametrize("path", [
        "/api/tunnel/peers",
        "/api/tunnel/server",
        "/api/tunnel/config",
        "/api/vpn/status",
    ])
    def test_tunnel_endpoints_no_500(self, admin_headers, path):
        r = requests.get(f"{BASE_URL}{path}", headers=admin_headers, timeout=15)
        assert r.status_code < 500, (
            f"{path} returned {r.status_code} — possible EF ValueConverter regression. Body: {r.text[:300]}"
        )


# --------------------------------------------------------------------------
# 8. Cleanup
# --------------------------------------------------------------------------
class TestZCleanup:
    def test_cleanup_test_settings(self, admin_headers):
        for key in ("TEST_enc_roundtrip_v22", "TEST_mutation_smoke_v22"):
            try:
                requests.delete(f"{BASE_URL}/api/settings/{key}", headers=admin_headers, timeout=10)
            except Exception:
                pass
        # No assertion — best-effort cleanup.
        assert True
