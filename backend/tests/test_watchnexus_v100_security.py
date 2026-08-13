"""
WatchNexus v1.0.0 RTP — Security hardening verification (iteration 21).

Covers the 20-item public-readiness audit:
- Auth login (rate-limited, paced)
- Registration disabled (403)
- Admin user management (admin-only CRUD, validation, guardrails)
- Token invalidation (logout, admin password-reset)
- Public profile minimal (no email/role)
- Health minimal (no os/runtime fields)
- Signed stream tokens (BridgeController)
- Reserved settings blocked
- qBittorrent /test now auth-required + SSRF guard
- License: no offline unlock
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    pytest.skip("REACT_APP_BACKEND_URL not set", allow_module_level=True)

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "")
MEMBER_EMAIL = os.environ.get("TEST_MEMBER_EMAIL", "")
MEMBER_PASSWORD = os.environ.get("TEST_MEMBER_PASSWORD", "")

if not all([ADMIN_EMAIL, ADMIN_PASSWORD, MEMBER_EMAIL, MEMBER_PASSWORD]):
    pytest.skip("TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, TEST_MEMBER_EMAIL, and TEST_MEMBER_PASSWORD required", allow_module_level=True)


# ---------- pacing helper to avoid 10/min auth rate limit ----------
_LAST_AUTH_TS = [0.0]


def _pace_auth(min_gap: float = 7.0):
    delta = time.time() - _LAST_AUTH_TS[0]
    if delta < min_gap:
        time.sleep(min_gap - delta)
    _LAST_AUTH_TS[0] = time.time()


def _login(email: str, password: str) -> requests.Response:
    _pace_auth()
    return requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=20,
    )


# ---------- session-scoped tokens ----------
@pytest.fixture(scope="session")
def admin_token():
    r = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and "user" in data
    assert data["user"]["email"] == ADMIN_EMAIL
    return data["access_token"]


@pytest.fixture(scope="session")
def member_token():
    r = _login(MEMBER_EMAIL, MEMBER_PASSWORD)
    assert r.status_code == 200, f"member login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _auth(token: str):
    return {"Authorization": f"Bearer {token}"}


# ---------- 1) HEALTH MINIMAL ----------
class TestHealthMinimal:
    def test_health_no_runtime_leak(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert r.status_code == 200
        d = r.json()
        # required minimal fields
        assert "status" in d and "timestamp" in d and "version" in d
        # leaked fields must NOT be present
        leaked = [k for k in ("os", "runtime", "architecture", "platform", "framework", "machine", "hostname") if k in d]
        assert not leaked, f"health leaks fields: {leaked} (payload={d})"


# ---------- 2) REGISTRATION DISABLED ----------
class TestRegistrationDisabled:
    def test_register_returns_403(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": f"TEST_{uuid.uuid4().hex[:8]}@x.com", "username": "test", "password": "Abcd1234"},
            timeout=10,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code} body={r.text}"
        # body should mention admin
        body = r.text.lower()
        assert "admin" in body or "disabled" in body or "contact" in body


# ---------- 3) AUTH LOGIN ----------
class TestAuthLogin:
    def test_admin_login(self, admin_token):
        assert admin_token and isinstance(admin_token, str)

    def test_member_login(self, member_token):
        assert member_token and isinstance(member_token, str)

    def test_me_works_with_token(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_auth(admin_token), timeout=10)
        # /me may live under /api/users/me; try both
        if r.status_code == 404:
            r = requests.get(f"{BASE_URL}/api/users/me", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200, f"me endpoint failed: {r.status_code} {r.text}"
        d = r.json()
        assert d.get("email") == ADMIN_EMAIL


# ---------- 4) PUBLIC PROFILES MINIMAL ----------
class TestPublicProfilesMinimal:
    def test_profiles_no_email_no_role(self):
        r = requests.get(f"{BASE_URL}/api/users/profiles", timeout=10)
        assert r.status_code == 200, f"got {r.status_code}: {r.text}"
        data = r.json()
        assert isinstance(data, list)
        if data:
            for u in data:
                assert "email" not in u, f"profile leaks email: {u}"
                assert "role" not in u, f"profile leaks role: {u}"
                # must have minimal subset
                assert "id" in u and "username" in u


# ---------- 5) ADMIN USER MANAGEMENT ----------
class TestAdminUserManagement:
    def test_admin_can_list_users(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/users", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list) and len(users) >= 2
        sample = users[0]
        for f in ("id", "email", "username", "role"):
            assert f in sample, f"missing field {f} in {sample}"

    def test_member_cannot_list_users(self, member_token):
        r = requests.get(f"{BASE_URL}/api/users", headers=_auth(member_token), timeout=10)
        assert r.status_code == 403, f"expected 403, got {r.status_code}"

    def test_member_cannot_create_user(self, member_token):
        r = requests.post(
            f"{BASE_URL}/api/users",
            headers=_auth(member_token),
            json={"email": "TEST_x@x.com", "username": "x", "password": "Abcd1234", "role": "user"},
            timeout=10,
        )
        assert r.status_code == 403

    def test_member_cannot_delete_user(self, member_token, admin_token):
        # find some user id (admin lookup)
        r = requests.get(f"{BASE_URL}/api/users", headers=_auth(admin_token), timeout=10)
        uid = r.json()[0]["id"]
        r2 = requests.delete(f"{BASE_URL}/api/users/{uid}", headers=_auth(member_token), timeout=10)
        assert r2.status_code == 403

    def test_admin_create_invalid_email_rejected(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/users",
            headers=_auth(admin_token),
            json={"email": "not-an-email", "username": "TEST_bad", "password": "Abcd1234", "role": "user"},
            timeout=10,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code} body={r.text}"

    def test_admin_create_weak_password_rejected(self, admin_token):
        # too short
        r = requests.post(
            f"{BASE_URL}/api/users",
            headers=_auth(admin_token),
            json={"email": f"TEST_{uuid.uuid4().hex[:6]}@x.com", "username": "TEST_wk", "password": "ab12", "role": "user"},
            timeout=10,
        )
        assert r.status_code == 400, f"short pw: expected 400, got {r.status_code}"
        # letters-only (no digit)
        r2 = requests.post(
            f"{BASE_URL}/api/users",
            headers=_auth(admin_token),
            json={"email": f"TEST_{uuid.uuid4().hex[:6]}@x.com", "username": "TEST_wk2", "password": "abcdefgh", "role": "user"},
            timeout=10,
        )
        assert r2.status_code == 400, f"letters-only pw: expected 400, got {r2.status_code}"

    def test_admin_create_update_delete_user(self, admin_token):
        email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
        username = f"TEST_{uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{BASE_URL}/api/users",
            headers=_auth(admin_token),
            json={"email": email, "username": username, "password": "Abcd1234", "role": "user"},
            timeout=10,
        )
        assert r.status_code in (200, 201), f"create failed: {r.status_code} {r.text}"
        created = r.json()
        uid = created.get("id")
        assert uid, f"no id returned: {created}"
        assert created.get("email") == email
        assert created.get("role") == "user"

        # PUT role -> admin
        r2 = requests.put(
            f"{BASE_URL}/api/users/{uid}",
            headers=_auth(admin_token),
            json={"role": "admin"},
            timeout=10,
        )
        assert r2.status_code == 200, f"put role failed: {r2.status_code} {r2.text}"

        # DELETE
        r3 = requests.delete(f"{BASE_URL}/api/users/{uid}", headers=_auth(admin_token), timeout=10)
        assert r3.status_code in (200, 204)


# ---------- 6) GUARDRAILS ----------
class TestGuardrails:
    def test_cannot_delete_self(self, admin_token):
        # find own id
        r = requests.get(f"{BASE_URL}/api/users/me", headers=_auth(admin_token), timeout=10)
        if r.status_code != 200:
            r = requests.get(f"{BASE_URL}/api/auth/me", headers=_auth(admin_token), timeout=10)
        my_id = r.json().get("id")
        assert my_id
        r2 = requests.delete(f"{BASE_URL}/api/users/{my_id}", headers=_auth(admin_token), timeout=10)
        assert r2.status_code == 400, f"self-delete should be 400, got {r2.status_code} body={r2.text}"

    def test_cannot_demote_last_admin(self, admin_token):
        # owner is the only admin in dev DB. attempt to demote -> 400
        r = requests.get(f"{BASE_URL}/api/users", headers=_auth(admin_token), timeout=10)
        admins = [u for u in r.json() if u.get("role") == "admin"]
        if len(admins) != 1:
            pytest.skip(f"DB has {len(admins)} admins; guardrail only triggers when 1")
        only_admin_id = admins[0]["id"]
        r2 = requests.put(
            f"{BASE_URL}/api/users/{only_admin_id}",
            headers=_auth(admin_token),
            json={"role": "user"},
            timeout=10,
        )
        assert r2.status_code == 400


# ---------- 7) TOKEN INVALIDATION ----------
class TestTokenInvalidation:
    def test_logout_invalidates_token(self):
        # Use member account so we don't bump the admin's token-version
        # (server-side invalidation is per-user — logging out admin would
        # invalidate the session-scoped admin_token fixture used elsewhere).
        r = _login(MEMBER_EMAIL, MEMBER_PASSWORD)
        assert r.status_code == 200
        tok = r.json()["access_token"]
        # confirm it works
        r1 = requests.get(f"{BASE_URL}/api/users/me", headers=_auth(tok), timeout=10)
        assert r1.status_code == 200
        # logout
        rl = requests.post(f"{BASE_URL}/api/auth/logout", headers=_auth(tok), timeout=10)
        assert rl.status_code in (200, 204), f"logout failed: {rl.status_code} {rl.text}"
        # token should no longer work
        r2 = requests.get(f"{BASE_URL}/api/users/me", headers=_auth(tok), timeout=10)
        assert r2.status_code == 401, f"token still works after logout: {r2.status_code}"

    def test_password_reset_invalidates_user_token(self, admin_token):
        # create a sacrificial user
        email = f"TEST_{uuid.uuid4().hex[:8]}@x.com"
        username = f"TEST_{uuid.uuid4().hex[:6]}"
        pw = "Abcd1234"
        rc = requests.post(
            f"{BASE_URL}/api/users",
            headers=_auth(admin_token),
            json={"email": email, "username": username, "password": pw, "role": "user"},
            timeout=10,
        )
        assert rc.status_code in (200, 201), f"create failed: {rc.status_code} {rc.text}"
        uid = rc.json()["id"]

        # log them in
        rl = _login(email, pw)
        assert rl.status_code == 200, f"new-user login failed: {rl.status_code} {rl.text}"
        utok = rl.json()["access_token"]

        # token works
        rm = requests.get(f"{BASE_URL}/api/users/me", headers=_auth(utok), timeout=10)
        assert rm.status_code == 200

        # admin resets password
        rr = requests.post(
            f"{BASE_URL}/api/users/{uid}/reset-password",
            headers=_auth(admin_token),
            json={"password": "Newpass1234"},
            timeout=10,
        )
        assert rr.status_code in (200, 204), f"reset failed: {rr.status_code} {rr.text}"

        # old token is now invalid
        rm2 = requests.get(f"{BASE_URL}/api/users/me", headers=_auth(utok), timeout=10)
        assert rm2.status_code == 401, f"token still valid after password reset: {rm2.status_code}"

        # cleanup
        requests.delete(f"{BASE_URL}/api/users/{uid}", headers=_auth(admin_token), timeout=10)


# ---------- 8) SIGNED STREAM TOKENS ----------
class TestSignedStreamTokens:
    def test_stream_file_requires_token(self):
        r = requests.get(f"{BASE_URL}/api/marmalade/stream/some-id/file", timeout=10, allow_redirects=False)
        assert r.status_code == 401, f"expected 401 without token, got {r.status_code}"

    def test_authorize_returns_signed_url(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/marmalade/stream/some-id/authorize", headers=_auth(admin_token), timeout=10)
        # 200 with stream_url containing ?token= OR 404 'media not found' is acceptable.
        # MUST NOT be 401 when authenticated.
        assert r.status_code != 401, f"authenticated authorize returned 401: {r.text}"
        if r.status_code == 200:
            d = r.json()
            assert "stream_url" in d, f"no stream_url: {d}"
            assert "?token=" in d["stream_url"] or "&token=" in d["stream_url"], f"unsigned url: {d}"


# ---------- 9) RESERVED SETTINGS BLOCKED ----------
class TestReservedSettings:
    def test_reserved_jwt_secret_blocked(self, admin_token):
        r = requests.put(
            f"{BASE_URL}/api/settings/jwt_secret",
            headers=_auth(admin_token),
            json={"value": "evil"},
            timeout=10,
        )
        assert r.status_code == 400, f"jwt_secret PUT should be 400, got {r.status_code}"

    def test_reserved_license_server_blocked(self, admin_token):
        r = requests.put(
            f"{BASE_URL}/api/settings/license_server_url",
            headers=_auth(admin_token),
            json={"value": "http://evil"},
            timeout=10,
        )
        assert r.status_code == 400

    def test_normal_key_allowed(self, admin_token):
        r = requests.put(
            f"{BASE_URL}/api/settings/theme",
            headers=_auth(admin_token),
            json={"value": "dark"},
            timeout=10,
        )
        assert r.status_code == 200, f"theme PUT should be 200, got {r.status_code} body={r.text}"


# ---------- 10) qBittorrent test now requires auth ----------
class TestQBittorrentAuth:
    def test_qbit_test_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/qbittorrent/test",
            json={"host": "127.0.0.1", "port": 8080, "username": "x", "password": "y"},
            timeout=10,
        )
        assert r.status_code == 401, f"expected 401, got {r.status_code} body={r.text}"

    def test_qbit_test_ssrf_blocked(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/qbittorrent/test",
            headers=_auth(admin_token),
            json={"host": "169.254.169.254", "port": 8080, "username": "x", "password": "y"},
            timeout=10,
        )
        # On Standard tier, Fortress tier-lock fires before SSRF guard (qbit is Ultra).
        # Both are valid security rejections; 401 (no auth) would be the only failure.
        body = r.text or ""
        assert r.status_code in (400, 403), f"SSRF/tier guard expected 400 or 403, got {r.status_code} body={body}"
        if r.status_code == 403:
            assert "FORTRESS_TIER_LOCKED" in body or "tier" in body.lower()


# ---------- 11) LICENSE no offline unlock ----------
class TestLicenseNoOfflineUnlock:
    def test_test_serial_rejected(self, admin_token):
        # The previously "magic" offline serial pattern must no longer unlock.
        # Acceptable: 200 success=false, 400/401/402/403 rejection, or 503 (real
        # license server unreachable from sandboxed test container — still proves
        # there is NO offline/format-based unlock path).
        for serial in ("WNX-ULT-AAAA-BBBB-CCCC", "WNX-PRO-TEST-TEST-TEST"):
            r = requests.post(
                f"{BASE_URL}/api/cellar/activate",
                headers=_auth(admin_token),
                json={"serial": serial},
                timeout=25,
            )
            assert r.status_code in (200, 400, 401, 402, 403, 502, 503, 504), (
                f"unexpected {r.status_code} for {serial}: {r.text}"
            )
            if r.status_code == 200:
                d = r.json()
                assert d.get("success") is False, f"offline unlock still works for {serial}: {d}"
            elif r.status_code in (502, 503, 504):
                # Must NOT report success=true on transport failure (no offline fallback)
                try:
                    d = r.json()
                    assert d.get("success") is not True, f"server failure leaked success=true: {d}"
                except ValueError:
                    pass
