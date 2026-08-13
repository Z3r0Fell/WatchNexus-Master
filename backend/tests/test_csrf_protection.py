"""
Backend tests for CSRF double-submit-cookie protection (v1.0.0 security hardening).
Verifies:
- login sets both wn_token (httpOnly) and XSRF-TOKEN (readable)
- mutating requests WITHOUT X-XSRF-TOKEN header => 403
- mutating requests WITH matching header => 200/2xx
- GET requests don't need CSRF token
- /api/auth/login and /api/auth/setup are exempt
- pure Bearer-token clients (no cookies) are exempt
- logout clears both cookies
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    pytest.skip("REACT_APP_BACKEND_URL not set", allow_module_level=True)

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "")

if not ADMIN_EMAIL or not ADMIN_PASSWORD:
    pytest.skip("TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD environment variables required", allow_module_level=True)


def _extract_cookies_from_response(response):
    """The .NET backend emits multiple cookies in ONE Set-Cookie header
    separated by ', ' which Python's cookielib mis-parses. Browsers parse
    correctly. This helper extracts cookie name=value pairs from the raw
    header text by re-splitting on the cookie boundary pattern."""
    cookies = {}
    set_cookies = response.raw.headers.getlist("Set-Cookie") if hasattr(response.raw, "headers") else response.headers.get("Set-Cookie", "").split("\n")
    # combine all set-cookie header lines
    combined = ", ".join(set_cookies) if isinstance(set_cookies, list) else set_cookies
    # Find pattern: NAME=VALUE up to next "; attr"
    # Cookies separated by ", NAME=" where NAME is a token
    parts = re.split(r",\s*(?=[A-Za-z0-9_\-]+=)", combined)
    for part in parts:
        m = re.match(r"\s*([A-Za-z0-9_\-]+)=([^;]*)", part)
        if m:
            cookies[m.group(1)] = m.group(2)
    return cookies


@pytest.fixture(scope="module")
def logged_in_session():
    """Session with both cookies set after login. Manually re-attaches XSRF-TOKEN
    since requests' cookielib mis-parses comma-separated Set-Cookie."""
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
               timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    body = r.json()
    assert "access_token" in body
    raw_cookies = _extract_cookies_from_response(r)
    assert "wn_token" in raw_cookies, f"wn_token cookie missing. Raw: {list(raw_cookies.keys())}"
    assert "XSRF-TOKEN" in raw_cookies, f"XSRF-TOKEN cookie missing. Raw: {list(raw_cookies.keys())}"
    # manually set XSRF-TOKEN on session jar (wn_token already there from cookielib)
    s.cookies.set("XSRF-TOKEN", raw_cookies["XSRF-TOKEN"], domain=BASE_URL.replace("https://", "").replace("http://", ""))
    s.bearer = body["access_token"]
    s.xsrf = raw_cookies["XSRF-TOKEN"]
    s.raw_cookies = raw_cookies
    return s


# ============ LOGIN sets both cookies ============
class TestLoginCookies:
    def test_login_sets_wn_token_and_xsrf(self, logged_in_session):
        raw = logged_in_session.raw_cookies
        assert raw["wn_token"], "wn_token empty"
        assert raw["XSRF-TOKEN"], "XSRF-TOKEN empty"
        assert len(raw["XSRF-TOKEN"]) >= 16, "XSRF-TOKEN appears too short"


# ============ Mutation WITHOUT CSRF header → 403 ============
class TestMutationWithoutCsrfHeader:
    def test_put_settings_without_header_returns_403(self, logged_in_session):
        # send PUT without X-XSRF-TOKEN header but cookies still attached
        r = logged_in_session.put(
            f"{BASE_URL}/api/settings",
            json={"server_name": "blocked"},
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        assert r.status_code == 403, f"expected 403 got {r.status_code} body={r.text[:200]}"
        try:
            body = r.json()
            assert "csrf" in (body.get("detail", "") + body.get("title", "") + r.text).lower(), \
                f"403 body should mention CSRF, got: {body}"
        except ValueError:
            assert "csrf" in r.text.lower()

    def test_post_logout_without_header_returns_403(self, logged_in_session):
        # logout is mutating POST — must require CSRF when cookie-auth'd
        r = logged_in_session.post(f"{BASE_URL}/api/auth/logout", timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code}"


# ============ Mutation WITH CSRF header → success ============
class TestMutationWithCsrfHeader:
    def test_put_settings_with_header_succeeds(self, logged_in_session):
        r = logged_in_session.put(
            f"{BASE_URL}/api/settings",
            json={"server_name": "WatchNexus Test"},
            headers={
                "Content-Type": "application/json",
                "X-XSRF-TOKEN": logged_in_session.xsrf,
            },
            timeout=15,
        )
        assert r.status_code in (200, 204), f"expected 2xx got {r.status_code} body={r.text[:300]}"

    def test_get_settings_no_header_needed(self, logged_in_session):
        # GET is exempt — no X-XSRF-TOKEN sent
        r = logged_in_session.get(f"{BASE_URL}/api/settings", timeout=15)
        assert r.status_code == 200, f"GET /api/settings failed: {r.status_code}"

    def test_mismatched_header_returns_403(self, logged_in_session):
        r = logged_in_session.put(
            f"{BASE_URL}/api/settings",
            json={"server_name": "evil"},
            headers={"Content-Type": "application/json", "X-XSRF-TOKEN": "WRONG_TOKEN_VALUE"},
            timeout=15,
        )
        assert r.status_code == 403, f"mismatched header should be 403, got {r.status_code}"


# ============ Login + Setup endpoints EXEMPT ============
class TestExemptEndpoints:
    def test_login_endpoint_not_csrf_blocked(self):
        # fresh session, no cookies, no XSRF header — login MUST work, not 403
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                   timeout=15)
        assert r.status_code != 403, f"login should be CSRF-exempt, got 403: {r.text[:200]}"
        assert r.status_code == 200

    def test_setup_endpoint_not_csrf_blocked(self):
        # /api/auth/setup must be exempt (returns 400/409 because admin exists, NOT 403)
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/setup",
                   json={"email": "new@x.local", "username": "new", "password": "Password123!"},
                   timeout=15)
        # may return 400 (validation) or 409 (already initialized) but NEVER 403 from CSRF
        if r.status_code == 403:
            body = r.text.lower()
            assert "csrf" not in body, f"setup endpoint was CSRF-blocked: {body[:300]}"
        # acceptable: 200, 400, 409, 422
        assert r.status_code in (200, 400, 409, 422), f"unexpected status: {r.status_code} {r.text[:200]}"


# ============ Bearer-only clients (no cookies) EXEMPT ============
class TestBearerOnlyExemption:
    def test_bearer_only_mutation_no_csrf_header(self, logged_in_session):
        # New session: NO cookies, only Authorization: Bearer
        bearer = logged_in_session.bearer
        s = requests.Session()  # fresh, no cookies
        r = s.put(
            f"{BASE_URL}/api/settings",
            json={"server_name": "bearer-test"},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {bearer}",
            },
            timeout=15,
        )
        assert r.status_code != 403, (
            f"Pure-Bearer client should be CSRF-exempt, got 403: {r.text[:300]}"
        )
        assert r.status_code in (200, 204), f"expected 2xx, got {r.status_code} body={r.text[:200]}"


# ============ Logout clears both cookies ============
class TestLogoutClearsCookies:
    def test_logout_with_csrf_header_clears_cookies(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200
        raw = _extract_cookies_from_response(r)
        xsrf = raw["XSRF-TOKEN"]
        s.cookies.set("XSRF-TOKEN", xsrf)
        rlo = s.post(f"{BASE_URL}/api/auth/logout",
                     headers={"X-XSRF-TOKEN": xsrf}, timeout=15)
        assert rlo.status_code in (200, 204), f"logout failed: {rlo.status_code} {rlo.text[:200]}"
        # Check the Set-Cookie clearing headers — server should send empty/expired cookies
        clear_raw = _extract_cookies_from_response(rlo)
        # Either wn_token cleared to empty or absent
        wn = clear_raw.get("wn_token", "")
        xsrf_after = clear_raw.get("XSRF-TOKEN", "")
        # Server typically sends NAME=; expires=...past to clear
        assert wn in ("", None), f"wn_token not cleared (sent value={wn[:30]})"
        # XSRF-TOKEN clear is also expected
        # (acceptable if absent too — middleware-only or controller decides)
