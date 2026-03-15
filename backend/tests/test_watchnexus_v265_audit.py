"""
WatchNexus v2.6.5 Full Code Audit Tests
=======================================
Tests all endpoints including new features:
- Matrix/Jellyfin/Synapse Admin controllers
- GameBot image processing
- Bot background service status endpoints
- Crumbs API (12 services)
- Gadgets/Plugins (10 items)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "password"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if resp.status_code == 200:
        return resp.json().get("access_token")
    # Try registering if login fails
    reg_resp = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "username": "admin"
    })
    if reg_resp.status_code in [200, 201]:
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if login_resp.status_code == 200:
            return login_resp.json().get("access_token")
    pytest.skip("Authentication failed")


@pytest.fixture
def api_client(auth_token):
    """Create authenticated API client"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


# ── Authentication Tests ──────────────────────────────────────────────

class TestAuth:
    """Authentication endpoint tests"""

    def test_login_returns_access_token(self):
        """POST /api/auth/login returns access_token"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert isinstance(data["access_token"], str)
        assert len(data["access_token"]) > 50  # JWT tokens are long
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL

    def test_register_existing_email_fails(self, api_client):
        """GET/POST /api/auth/register with existing email returns error"""
        resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL,
            "password": "newpassword",
            "username": "newuser"
        })
        # Should fail for existing email
        assert resp.status_code in [400, 409]
        data = resp.json()
        assert "already" in str(data).lower() or "exist" in str(data).lower() or "detail" in data


# ── System Info Tests ──────────────────────────────────────────────

class TestSystemEndpoints:
    """System info and stats endpoints"""

    def test_system_info_returns_version_265(self, api_client):
        """GET /api/system/info returns version 2.6.5"""
        resp = api_client.get(f"{BASE_URL}/api/system/info")
        assert resp.status_code == 200
        data = resp.json()
        assert "version" in data
        assert data["version"] == "2.6.5"

    def test_system_stats_returns_server_stats(self, api_client):
        """GET /api/system/stats returns server stats"""
        resp = api_client.get(f"{BASE_URL}/api/system/stats")
        assert resp.status_code == 200
        data = resp.json()
        # Should have memory, cpu, uptime stats
        assert "memory_mb" in data or "memory" in data or "uptime" in data


# ── Crumbs API Management Tests (12 services) ──────────────────────────────────────────────

class TestCrumbsApiManagement:
    """Crumbs API Management - now with 12 services"""

    def test_crumbs_services_returns_12_services(self, api_client):
        """GET /api/crumbs/services returns 12 services"""
        resp = api_client.get(f"{BASE_URL}/api/crumbs/services")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 12
        
        # Check all expected services exist
        service_ids = [s["id"] for s in data]
        expected = ["tmdb", "opensubtitles", "addic7ed", "subscene", "podnapisi", 
                    "yifysubtitles", "qbittorrent", "openweathermap", 
                    "matrix", "jellyfin", "synapse", "omdb"]
        for svc in expected:
            assert svc in service_ids, f"Missing service: {svc}"

    def test_crumbs_tmdb_save(self, api_client):
        """PUT /api/crumbs/tmdb saves TMDB API key"""
        resp = api_client.put(f"{BASE_URL}/api/crumbs/tmdb", json={
            "enabled": True,
            "fields": {"api_key": "test_key_12345"}
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") == "saved"

    def test_crumbs_test_podnapisi_reachability(self, api_client):
        """POST /api/crumbs/test/podnapisi tests Podnapisi reachability"""
        resp = api_client.post(f"{BASE_URL}/api/crumbs/test/podnapisi")
        assert resp.status_code == 200
        data = resp.json()
        assert "success" in data
        assert "message" in data

    def test_crumbs_configured_returns_list(self, api_client):
        """GET /api/crumbs/configured returns configured list"""
        resp = api_client.get(f"{BASE_URL}/api/crumbs/configured")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)


# ── Gadgets Endpoints Tests ──────────────────────────────────────────────

class TestGadgetsEndpoints:
    """Weather, Podcasts, Radio gadgets"""

    def test_weather_with_coords(self, api_client):
        """GET /api/gadgets/weather?lat=51&lon=0 returns Open-Meteo weather"""
        resp = api_client.get(f"{BASE_URL}/api/gadgets/weather", params={"lat": 51, "lon": 0})
        assert resp.status_code == 200
        data = resp.json()
        # Should have weather data or error message
        assert isinstance(data, dict)

    def test_weather_search_london(self, api_client):
        """GET /api/gadgets/weather/search?q=London returns locations"""
        resp = api_client.get(f"{BASE_URL}/api/gadgets/weather/search", params={"q": "London"})
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "name" in data[0] or "latitude" in data[0]

    def test_podcasts_search_tech(self, api_client):
        """GET /api/gadgets/podcasts/search?q=tech returns iTunes results"""
        resp = api_client.get(f"{BASE_URL}/api/gadgets/podcasts/search", params={"q": "tech"})
        assert resp.status_code == 200
        data = resp.json()
        # iTunes API returns {resultCount, results} object
        assert isinstance(data, dict)
        assert "results" in data or "resultCount" in data

    def test_radio_stations_limit(self, api_client):
        """GET /api/gadgets/radio/stations?limit=3 returns radio stations"""
        resp = api_client.get(f"{BASE_URL}/api/gadgets/radio/stations", params={"limit": 3})
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_radio_countries(self, api_client):
        """GET /api/gadgets/radio/countries returns countries"""
        resp = api_client.get(f"{BASE_URL}/api/gadgets/radio/countries")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)


# ── IPTV/Subtitles/Playlists Tests ──────────────────────────────────────────────

class TestMediaEndpoints:
    """IPTV, Subtitles, Playlists endpoints"""

    def test_iptv_sources(self, api_client):
        """GET /api/iptv/sources returns sources"""
        resp = api_client.get(f"{BASE_URL}/api/iptv/sources")
        assert resp.status_code == 200

    def test_subtitles_settings(self, api_client):
        """GET /api/subtitles/settings returns provider settings"""
        resp = api_client.get(f"{BASE_URL}/api/subtitles/settings")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict)

    def test_drizzle_playlists_get(self, api_client):
        """GET /api/drizzle/playlists returns playlists"""
        resp = api_client.get(f"{BASE_URL}/api/drizzle/playlists")
        assert resp.status_code == 200

    def test_drizzle_playlists_create(self, api_client):
        """POST /api/drizzle/playlists creates a playlist"""
        resp = api_client.post(f"{BASE_URL}/api/drizzle/playlists", json={
            "name": "Test Playlist v265"
        })
        assert resp.status_code in [200, 201]
        data = resp.json()
        assert "id" in data or "status" in data


# ── QBittorrent/Milk/Ripen Tests ──────────────────────────────────────────────

class TestUtilityEndpoints:
    """QBittorrent, themes, gadgets"""

    def test_qbittorrent_status(self, api_client):
        """GET /api/qbittorrent/status returns status"""
        resp = api_client.get(f"{BASE_URL}/api/qbittorrent/status")
        assert resp.status_code == 200
        data = resp.json()
        # Expected: not_configured without real qBit instance
        assert "connected" in data or "status" in data

    def test_milk_themes(self, api_client):
        """GET /api/milk/themes returns themes"""
        resp = api_client.get(f"{BASE_URL}/api/milk/themes")
        assert resp.status_code == 200

    def test_ripen_installed_returns_gadgets(self, api_client):
        """GET /api/ripen/installed returns gadgets object"""
        resp = api_client.get(f"{BASE_URL}/api/ripen/installed")
        assert resp.status_code == 200
        data = resp.json()
        # Returns {gadgets: [...]} object
        assert isinstance(data, dict)
        assert "gadgets" in data
        assert isinstance(data["gadgets"], list)
        # Currently returns 5 gadgets (weather, podcasts, radio, photos, webvideo)
        assert len(data["gadgets"]) >= 5


# ── User/Cache/DB/Filesystem Tests ──────────────────────────────────────────────

class TestSystemUtilityEndpoints:
    """User preferences, cache, db, filesystem"""

    def test_user_preferences(self, api_client):
        """GET /api/user/preferences returns prefs"""
        resp = api_client.get(f"{BASE_URL}/api/user/preferences")
        assert resp.status_code == 200

    def test_cache_stats(self, api_client):
        """GET /api/cache/stats returns cache info"""
        resp = api_client.get(f"{BASE_URL}/api/cache/stats")
        assert resp.status_code == 200

    def test_db_stats(self, api_client):
        """GET /api/db/stats returns db info"""
        resp = api_client.get(f"{BASE_URL}/api/db/stats")
        assert resp.status_code == 200

    def test_filesystem_browse(self, api_client):
        """GET /api/filesystem/browse returns dir listing"""
        resp = api_client.get(f"{BASE_URL}/api/filesystem/browse")
        assert resp.status_code == 200
        data = resp.json()
        assert "current_path" in data or "items" in data or "path" in data


# ── NEW: Matrix Controller Tests ──────────────────────────────────────────────

class TestMatrixController:
    """Matrix Client-Server API gadget tests"""

    def test_matrix_config_returns_status(self, api_client):
        """GET /api/gadgets/matrix/config returns config status"""
        resp = api_client.get(f"{BASE_URL}/api/gadgets/matrix/config")
        assert resp.status_code == 200
        data = resp.json()
        assert "configured" in data
        # Expected: configured=false when not set up
        assert isinstance(data["configured"], bool)


# ── NEW: Jellyfin Controller Tests ──────────────────────────────────────────────

class TestJellyfinController:
    """Jellyfin Media Server gadget tests"""

    def test_jellyfin_config_returns_status(self, api_client):
        """GET /api/gadgets/jellyfin/config returns config status"""
        resp = api_client.get(f"{BASE_URL}/api/gadgets/jellyfin/config")
        assert resp.status_code == 200
        data = resp.json()
        assert "configured" in data
        assert isinstance(data["configured"], bool)


# ── NEW: Synapse Admin Controller Tests ──────────────────────────────────────────────

class TestSynapseAdminController:
    """Synapse Admin API gadget tests"""

    def test_synapse_admin_config_returns_status(self, api_client):
        """GET /api/gadgets/synapse-admin/config returns config status"""
        resp = api_client.get(f"{BASE_URL}/api/gadgets/synapse-admin/config")
        assert resp.status_code == 200
        data = resp.json()
        assert "configured" in data
        assert isinstance(data["configured"], bool)


# ── NEW: Bot Controller Tests (BotBackgroundService status) ──────────────────────────────────────────────

class TestBotController:
    """Bot status and background service endpoints"""

    def test_bot_status_returns_features(self, api_client):
        """GET /api/gadgets/bot/status returns background service features"""
        resp = api_client.get(f"{BASE_URL}/api/gadgets/bot/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "service" in data
        assert data["service"] == "BotBackgroundService"
        assert "status" in data
        assert "features" in data
        assert isinstance(data["features"], list)
        # Should have 3 features: inactivity_check, token_drip, featured_film
        assert len(data["features"]) == 3
        feature_ids = [f["id"] for f in data["features"]]
        assert "inactivity_check" in feature_ids
        assert "token_drip" in feature_ids
        assert "featured_film" in feature_ids

    def test_bot_featured_film_returns_status(self, api_client):
        """GET /api/gadgets/bot/featured-film returns featured film status"""
        resp = api_client.get(f"{BASE_URL}/api/gadgets/bot/featured-film")
        assert resp.status_code == 200
        data = resp.json()
        # Should have either film data or message about configuration
        assert "selected_at" in data or "message" in data

    def test_bot_inactive_rooms_returns_report(self, api_client):
        """GET /api/gadgets/bot/inactive-rooms returns inactive rooms report"""
        resp = api_client.get(f"{BASE_URL}/api/gadgets/bot/inactive-rooms")
        assert resp.status_code == 200
        data = resp.json()
        assert "inactive_rooms" in data or "checked_at" in data


# ── NEW: Gadgets Plugins Tests ──────────────────────────────────────────────

class TestGadgetsPlugins:
    """Gadgets/Plugins endpoint (now 10 plugins)"""

    def test_gadgets_plugins_returns_10_plugins(self, api_client):
        """GET /api/gadgets/plugins returns 10 plugins"""
        resp = api_client.get(f"{BASE_URL}/api/gadgets/plugins")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 10, f"Expected at least 10 plugins, got {len(data)}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
