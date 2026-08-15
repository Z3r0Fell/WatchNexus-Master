"""
WatchNexus v1.0.0 RTP iteration-23 public-release hardening sweep.

Validates the iteration-23-specific changes:
- CSP header is present on every response, contains script-src 'self' and frame-ancestors 'none'
- X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy present everywhere
- Secret remediation: appsettings.json now blank, but TMDB-backed endpoints still work
  (key loaded from gitignored appsettings.Production.json)
- License/cellar status returns 200 with valid tier info
- Standard login + authenticated GET smoke still green
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    pytest.skip("REACT_APP_BACKEND_URL not set", allow_module_level=True)

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "")
if not ADMIN_EMAIL or not ADMIN_PASSWORD:
    pytest.skip("TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD required", allow_module_level=True)


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# --- Security headers (CSP + friends) on every response ---
class TestSecurityHeadersIter23:
    REQUIRED = [
        ("content-security-policy", None),
        ("x-frame-options", "DENY"),
        ("x-content-type-options", "nosniff"),
        ("referrer-policy", None),  # any value acceptable
    ]

    @pytest.mark.parametrize("path", [
        "/api/health",
        "/api/auth/setup-status",
    ])
    def test_unauth_response_has_security_headers(self, path):
        r = requests.get(f"{BASE_URL}{path}", timeout=10)
        for hdr, expected in self.REQUIRED:
            assert hdr in {k.lower() for k in r.headers.keys()}, f"missing {hdr} on {path}"
            if expected:
                assert r.headers.get(hdr, "").lower() == expected.lower(), \
                    f"{hdr} on {path} expected {expected}, got {r.headers.get(hdr)}"

    @pytest.mark.parametrize("path", [
        "/api/settings",
        "/api/cellar/status",
        "/api/crucible/ffmpeg-status",
    ])
    def test_auth_response_has_security_headers(self, path, admin_headers):
        r = requests.get(f"{BASE_URL}{path}", headers=admin_headers, timeout=10)
        for hdr, expected in self.REQUIRED:
            assert hdr in {k.lower() for k in r.headers.keys()}, f"missing {hdr} on {path}"
            if expected:
                assert r.headers.get(hdr, "").lower() == expected.lower()

    def test_csp_contains_script_src_self(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=10)
        csp = r.headers.get("content-security-policy", "")
        assert "script-src" in csp and "'self'" in csp, f"CSP missing script-src 'self': {csp}"

    def test_csp_contains_frame_ancestors_none(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=10)
        csp = r.headers.get("content-security-policy", "")
        assert "frame-ancestors" in csp and "'none'" in csp, f"CSP missing frame-ancestors 'none': {csp}"

    def test_csp_object_src_none(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=10)
        csp = r.headers.get("content-security-policy", "")
        # belt-and-braces clickjack/object hardening
        assert "object-src" in csp and "'none'" in csp


# --- Secret remediation didn't break TMDB ---
class TestTmdbSecretRemediation:
    def test_tmdb_trending_returns_real_data(self, admin_headers):
        # auth required (TMDB controller likely under [Authorize])
        r = requests.get(f"{BASE_URL}/api/tmdb/trending", headers=admin_headers, timeout=20)
        assert r.status_code == 200, f"trending status {r.status_code}: {r.text[:300]}"
        data = r.json()
        # Accept either {results:[...]} or [..] shape, just confirm non-empty live data
        items = data.get("results") if isinstance(data, dict) else data
        assert isinstance(items, list), f"unexpected shape: {type(data)} {str(data)[:200]}"
        assert len(items) > 0, "TMDB returned an empty result set — Production-only key likely not loaded"
        # spot-check that at least one item has a tmdb-shaped field
        sample = items[0]
        assert isinstance(sample, dict)
        assert any(k in sample for k in ("id", "title", "name", "media_type")), \
            f"item missing TMDB fields: {sample}"

    def test_tmdb_trending_unauth_401(self):
        r = requests.get(f"{BASE_URL}/api/tmdb/trending", timeout=10)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


# --- License/cellar status still ok (offline-license-safe smoke) ---
class TestCellarStatus:
    def test_cellar_status_200(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/cellar/status", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        body = r.json()
        # Tier field should be present (Standard by default in dev)
        tier_field = next((k for k in body if k.lower() == "tier"), None)
        assert tier_field is not None, f"no tier field in cellar status: {body}"


# --- Login + authenticated GETs smoke (the iter22 full set already covers this;
#     keep a tiny subset so iter23 file is self-sufficient) ---
class TestCoreLoginSmokeIter23:
    def test_admin_login_returns_access_token(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=15,
        )
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        assert "access_token" in body and isinstance(body["access_token"], str) and len(body["access_token"]) > 20

    def test_settings_get_200(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/settings", headers=admin_headers, timeout=10)
        assert r.status_code == 200

    def test_health_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert r.status_code == 200
        assert r.json().get("status") == "healthy"


# --- CSP doesn't allow inline by mistake removing 'self' for default-src ---
class TestCspSanity:
    def test_default_src_self(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=10)
        csp = r.headers.get("content-security-policy", "")
        assert "default-src" in csp and "'self'" in csp.split("default-src", 1)[1].split(";", 1)[0]

    def test_base_uri_self(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=10)
        csp = r.headers.get("content-security-policy", "")
        assert "base-uri" in csp and "'self'" in csp.split("base-uri", 1)[1].split(";", 1)[0]
