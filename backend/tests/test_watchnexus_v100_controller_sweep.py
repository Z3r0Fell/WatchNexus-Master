"""
WatchNexus v1.0.0 RTP — Comprehensive Controller Sweep (iteration 20)

Validates:
1. FFmpeg detection fix (the core regression): /api/crucible/ffmpeg-status MUST
   return 200 + ffmpeg_installed=true on Standard tier (no license).
2. Auth flow (login, setup-status).
3. Tier-gating (Standard => 403 FORTRESS_TIER_LOCKED on Pro/Ultra modules; never 500).
4. License activate/deactivate flips Pro/Ultra endpoints between 403 and 200.
5. Invalid license rejected with 400.
6. Full read-only sweep of every controller's primary GET endpoint while Ultra
   is active — flags any HTTP 500.
7. Honest-501 endpoints (Sprout custom feeds, Gelatin tunnels, quality-profile
   mutations) still return 501.
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ffmpeg-wizard-2.preview.emergentagent.com").rstrip("/")

OWNER_EMAIL = "owner@watchnexus.local"
OWNER_PASSWORD = "password123"

ULTRA_SERIAL = "WNX-ULT-AAAA-BBBB-CCCC"
PRO_SERIAL = "WNX-PRO-AAAA-BBBB-CCCC"
INVALID_SERIAL = "INVALID-KEY-123"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    assert tok, "No access_token returned"
    return tok


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _ensure_standard(auth_headers):
    """Make sure no license is active (best-effort, ignore failures)."""
    try:
        requests.post(f"{BASE_URL}/api/cellar/deactivate", headers=auth_headers, timeout=15)
    except Exception:
        pass


def _current_tier(auth_headers):
    try:
        r = requests.get(f"{BASE_URL}/api/cellar/status", headers=auth_headers, timeout=10)
        if r.status_code == 200:
            return (r.json().get("tier") or "").lower()
    except Exception:
        pass
    return ""


def _ensure_ultra(auth_headers):
    if _current_tier(auth_headers) == "ultra":
        return
    # If currently Pro (or other), deactivate first
    if _current_tier(auth_headers) in ("pro", "standard"):
        try:
            requests.post(f"{BASE_URL}/api/cellar/deactivate", headers=auth_headers, timeout=15)
        except Exception:
            pass
    r = requests.post(
        f"{BASE_URL}/api/cellar/activate",
        headers=auth_headers,
        json={"serial": ULTRA_SERIAL},
        timeout=20,
    )
    assert r.status_code == 200, f"Ultra activation failed: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("success") is True
    assert body.get("tier", "").lower() == "ultra"


# ---------- 1. Auth flow ----------
class TestAuth:
    def test_setup_status(self):
        r = requests.get(f"{BASE_URL}/api/auth/setup-status", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("needs_setup") is False
        assert data.get("user_count", 0) >= 1

    def test_login_returns_jwt(self, token):
        assert isinstance(token, str) and len(token) > 20

    def test_login_invalid_creds(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": OWNER_EMAIL, "password": "wrongpw"},
            timeout=15,
        )
        assert r.status_code in (400, 401, 403)


# ---------- 2. FFmpeg fix (the bug) ----------
class TestFfmpegFix:
    def test_ffmpeg_status_on_standard_tier(self, auth_headers):
        _ensure_standard(auth_headers)
        r = requests.get(f"{BASE_URL}/api/crucible/ffmpeg-status", headers=auth_headers, timeout=15)
        assert r.status_code == 200, f"Expected 200, got {r.status_code} {r.text[:300]}"
        data = r.json()
        # not a tier-lock error
        assert data.get("error") != "FORTRESS_TIER_LOCKED"
        assert data.get("ffmpeg_installed") is True, f"ffmpeg_installed missing/false: {data}"
        assert data.get("ffprobe_installed") is True, f"ffprobe_installed missing/false: {data}"


# ---------- 3. Tier-gating on Standard ----------
PRO_GATED = [
    "/api/compote/indexers",
    "/api/fondue/status",
    "/api/saffron/tasks",
    "/api/sprout/feed/recent",
    "/api/bastion/status",
]
ULTRA_GATED = [
    "/api/crucible/profiles",
    "/api/strudel/status",
    "/api/security/stats",
    "/api/parfait/status",
    "/api/chowder/servers",
]


class TestTierGatingStandard:
    @pytest.mark.parametrize("path", PRO_GATED + ULTRA_GATED)
    def test_gated_returns_403_not_500(self, auth_headers, path):
        _ensure_standard(auth_headers)
        r = requests.get(f"{BASE_URL}{path}", headers=auth_headers, timeout=20)
        assert r.status_code != 500, f"500 crash at {path}: {r.text[:200]}"
        assert r.status_code == 403, f"Expected 403 at {path}, got {r.status_code}: {r.text[:200]}"
        body = r.json()
        assert body.get("error") == "FORTRESS_TIER_LOCKED", f"Wrong gate body @ {path}: {body}"


# ---------- 4. License activate/deactivate ----------
class TestLicense:
    def test_invalid_serial_rejected(self, auth_headers):
        _ensure_standard(auth_headers)
        r = requests.post(
            f"{BASE_URL}/api/cellar/activate",
            headers=auth_headers,
            json={"serial": INVALID_SERIAL},
            timeout=20,
        )
        assert r.status_code in (400, 422), f"Expected 400 for invalid, got {r.status_code}"
        body = r.json()
        assert body.get("success") in (False, None)

    def test_activate_ultra_then_endpoints_unlock(self, auth_headers):
        _ensure_ultra(auth_headers)
        # Sample endpoints should now return 200 (or not 403)
        sample = ["/api/crucible/profiles", "/api/strudel/status", "/api/compote/indexers",
                  "/api/saffron/tasks", "/api/parfait/status"]
        for p in sample:
            r = requests.get(f"{BASE_URL}{p}", headers=auth_headers, timeout=20)
            assert r.status_code != 403, f"Still tier-locked after Ultra activation @ {p}"
            assert r.status_code != 500, f"500 crash @ {p}: {r.text[:200]}"

    def test_deactivate_relocks(self, auth_headers):
        _ensure_ultra(auth_headers)
        r = requests.post(f"{BASE_URL}/api/cellar/deactivate", headers=auth_headers, timeout=20)
        assert r.status_code == 200, f"Deactivate failed: {r.status_code} {r.text[:200]}"
        # Pick one Pro and one Ultra endpoint and confirm they 403 again
        for p in ["/api/compote/indexers", "/api/crucible/profiles"]:
            rr = requests.get(f"{BASE_URL}{p}", headers=auth_headers, timeout=15)
            assert rr.status_code == 403, f"Expected re-lock 403 @ {p}, got {rr.status_code}"


# ---------- 5. Full controller sweep (Ultra active) ----------
# One safe primary GET per controller (or a public one if no auth needed).
CONTROLLER_GETS = [
    ("backlog",            "/api/backlog/issues"),
    ("bot",                "/api/bot/featured-film"),
    ("bridge",             "/api/bridge/status"),
    ("brine",              "/api/brine/indexers"),
    ("cellar",             "/api/cellar/status"),
    ("chowder",            "/api/chowder/servers"),
    ("codename-alias",     "/api/aliases"),
    ("content",            "/api/content/discover"),
    ("core",               "/api/core/info"),
    ("core-modules",       "/api/modules/catalogue"),
    ("crucible",           "/api/crucible/profiles"),
    ("crumbs",             "/api/crumbs/status"),
    ("drizzle",            "/api/drizzle/status"),
    ("feature",            "/api/features"),
    ("filesystem",         "/api/filesystem/list?path=/tmp"),
    ("gadgets",            "/api/gadgets/catalogue"),
    ("gamebot",            "/api/gamebot/status"),
    ("iptv",               "/api/iptv/status"),
    ("ladle",              "/api/ladle/categories"),
    ("libraries",          "/api/libraries"),
    ("matrix",             "/api/matrix/rooms"),
    ("mediabridge",        "/api/mediabridge/status"),
    ("media",              "/api/media/items?limit=1"),
    ("menu",               "/api/menu/status"),
    ("meringue",           "/api/meringue/status"),
    ("parfait",            "/api/parfait/status"),
    ("pepper",             "/api/pepper/status"),
    ("photos",             "/api/photos/albums"),
    ("podcasts",           "/api/podcasts/search?q=tech"),
    ("pretzel",            "/api/pretzel/status"),
    ("qbittorrent",        "/api/qbittorrent/torrents"),
    ("radio",              "/api/radio/stations"),
    ("rind",               "/api/rind/status"),
    ("roux",               "/api/roux/status"),
    ("security",           "/api/security/stats"),
    ("settings",           "/api/settings"),
    ("sprout",             "/api/sprout/feed/recent"),
    ("strudel",            "/api/strudel/status"),
    ("strudel-pipeline",   "/api/strudel/pipeline/status"),
    ("subtitles",          "/api/subtitles/providers"),
    ("synapse-admin",      "/api/synapse/status"),
    ("system",             "/api/system/status"),
    ("truffle",            "/api/truffle/status"),
    ("update",             "/api/update/check"),
    ("utility",            "/api/playlists/types"),
    ("vpn",                "/api/vpn/status"),
    ("weather",            "/api/weather/search?q=Paris"),
    ("webvideo",           "/api/webvideo/status"),
    ("bastion",            "/api/bastion/status"),
    ("fondue",             "/api/fondue/status"),
    ("saffron",            "/api/saffron/tasks"),
    ("compote",            "/api/compote/indexers"),
    ("fortress",           "/api/fortress/status"),
]


class TestControllerSweep:
    @pytest.fixture(scope="class", autouse=True)
    def activate_ultra(self, auth_headers):
        _ensure_ultra(auth_headers)
        yield
        # leave Ultra active for inspection; final cleanup test handles deactivate

    @pytest.mark.parametrize("name,path", CONTROLLER_GETS)
    def test_controller_get_no_500(self, auth_headers, name, path):
        r = requests.get(f"{BASE_URL}{path}", headers=auth_headers, timeout=25)
        # Any of these are acceptable; 500 is the only hard fail.
        assert r.status_code != 500, f"500 CRASH @ {name} {path}: {r.text[:300]}"
        assert r.status_code in (200, 201, 204, 400, 401, 403, 404, 405, 409, 501, 502, 503), (
            f"Unexpected status {r.status_code} @ {name} {path}: {r.text[:200]}"
        )


# ---------- 6. Honest 501 endpoints ----------
class TestHonest501:
    def test_sprout_custom_feed_501(self, auth_headers):
        _ensure_ultra(auth_headers)
        r = requests.post(
            f"{BASE_URL}/api/sprout/feeds",
            headers=auth_headers,
            json={"name": "TEST_custom", "query": "foo"},
            timeout=15,
        )
        assert r.status_code == 501, f"Expected 501, got {r.status_code}: {r.text[:200]}"

    def test_gelatin_tunnel_create_501(self, auth_headers):
        _ensure_ultra(auth_headers)
        r = requests.post(
            f"{BASE_URL}/api/gelatin/tunnel/create",
            headers=auth_headers,
            json={"name": "TEST_tunnel"},
            timeout=15,
        )
        assert r.status_code == 501, f"Expected 501, got {r.status_code}: {r.text[:200]}"

    def test_quality_profiles_create_501(self, auth_headers):
        _ensure_ultra(auth_headers)
        r = requests.post(
            f"{BASE_URL}/api/quality-profiles",
            headers=auth_headers,
            json={"name": "TEST_qp"},
            timeout=15,
        )
        assert r.status_code == 501, f"Expected 501, got {r.status_code}: {r.text[:200]}"


# ---------- 7. Final cleanup: leave system on Standard ----------
class TestZCleanup:
    def test_deactivate_final(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/cellar/deactivate", headers=auth_headers, timeout=15)
        assert r.status_code == 200
