"""
WatchNexus Full Code Audit API Test Suite
Tests all requested features for P0 Code Audit
Backend: C#/.NET 10 running on port 8001
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://ffmpeg-wizard-2.preview.emergentagent.com').rstrip('/')


# === Auth Tests ===
class TestAuth:
    """Authentication endpoint tests"""
    
    def test_login_returns_access_token(self):
        """POST /api/auth/login with email/password returns access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        assert isinstance(data["access_token"], str) and len(data["access_token"]) > 0
        assert "user" in data
        assert data["user"]["email"] == "test@test.com"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@test.com",
        "password": "password"
    })
    if response.status_code != 200:
        pytest.skip("Authentication failed")
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Create headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# === System Info Tests ===
class TestSystemInfo:
    """System information endpoints"""
    
    def test_system_info_returns_version_hostname_platform(self, auth_headers):
        """GET /api/system/info returns version, hostname, platform info"""
        response = requests.get(f"{BASE_URL}/api/system/info", headers=auth_headers)
        assert response.status_code == 200, f"System info failed: {response.text}"
        data = response.json()
        assert data["version"] == "2.6.5", f"Expected version 2.6.5, got {data.get('version')}"
        assert "hostname" in data and len(data["hostname"]) > 0
        assert "platform" in data and len(data["platform"]) > 0
        assert "architecture" in data
        assert "dotnet_version" in data
        assert "os" in data
        
    def test_system_stats_returns_memory_cpu_uptime(self, auth_headers):
        """GET /api/system/stats returns memory, cpu, uptime stats"""
        response = requests.get(f"{BASE_URL}/api/system/stats", headers=auth_headers)
        assert response.status_code == 200, f"System stats failed: {response.text}"
        data = response.json()
        assert "memory_mb" in data and data["memory_mb"] > 0
        assert "cpu_time_seconds" in data and data["cpu_time_seconds"] >= 0
        assert "uptime_seconds" in data and data["uptime_seconds"] > 0
        assert "threads" in data


# === Crumbs (API Management) Tests ===
class TestCrumbsAPIManagement:
    """Crumbs API Management Module tests"""
    
    def test_crumbs_services_returns_8_services(self, auth_headers):
        """GET /api/crumbs/services returns 8 services (tmdb, opensubtitles, addic7ed, subscene, podnapisi, yifysubtitles, qbittorrent, openweathermap)"""
        response = requests.get(f"{BASE_URL}/api/crumbs/services", headers=auth_headers)
        assert response.status_code == 200, f"Crumbs services failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of services"
        assert len(data) == 8, f"Expected 8 services, got {len(data)}"
        
        service_ids = [s["id"] for s in data]
        required_services = ["tmdb", "opensubtitles", "addic7ed", "subscene", "podnapisi", "yifysubtitles", "qbittorrent", "openweathermap"]
        for svc in required_services:
            assert svc in service_ids, f"Missing service: {svc}"
            
        # Verify service structure
        for service in data:
            assert "id" in service
            assert "name" in service
            assert "category" in service
            assert "description" in service
            assert "fields" in service
    
    def test_crumbs_configured_returns_list(self, auth_headers):
        """GET /api/crumbs/configured returns list of configured API keys"""
        response = requests.get(f"{BASE_URL}/api/crumbs/configured", headers=auth_headers)
        assert response.status_code == 200, f"Crumbs configured failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of configured services"
    
    def test_crumbs_put_tmdb_saves_api_key(self, auth_headers):
        """PUT /api/crumbs/tmdb with fields saves TMDB API key"""
        # Save TMDB config
        response = requests.put(
            f"{BASE_URL}/api/crumbs/tmdb", 
            headers=auth_headers,
            json={"enabled": True, "fields": {"api_key": "TEST_AUDIT_KEY_123"}}
        )
        assert response.status_code == 200, f"Save TMDB config failed: {response.text}"
        data = response.json()
        assert data["status"] == "saved"
        assert data["service_id"] == "tmdb"
        
        # Verify saved
        verify_resp = requests.get(f"{BASE_URL}/api/crumbs/tmdb/fields", headers=auth_headers)
        assert verify_resp.status_code == 200
        verify_data = verify_resp.json()
        assert verify_data["fields"]["api_key"] == "TEST_AUDIT_KEY_123"
        assert verify_data["enabled"] == True


# === Weather Gadget Tests ===
class TestWeatherGadget:
    """Weather gadget endpoints - Open-Meteo"""
    
    def test_weather_with_lat_lon_returns_data(self, auth_headers):
        """GET /api/gadgets/weather?lat=51&lon=0 returns weather data from Open-Meteo"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/weather",
            params={"lat": 51, "lon": 0},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Weather failed: {response.text}"
        data = response.json()
        # Should return Open-Meteo format
        assert "current" in data or "timezone" in data or "elevation" in data
        if "current" in data:
            assert "temperature_2m" in data["current"]
    
    def test_weather_search_returns_locations(self, auth_headers):
        """GET /api/gadgets/weather/search?q=London returns location results"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/weather/search",
            params={"q": "London"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Weather search failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of locations"
        assert len(data) > 0, "Expected at least one location result"
        # Verify location structure
        location = data[0]
        assert "latitude" in location
        assert "longitude" in location
        assert "name" in location


# === Podcasts Gadget Tests ===
class TestPodcastsGadget:
    """Podcasts gadget endpoints - iTunes Search"""
    
    def test_podcasts_search_returns_itunes_results(self, auth_headers):
        """GET /api/gadgets/podcasts/search?q=tech returns iTunes search results"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/podcasts/search",
            params={"q": "tech"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Podcast search failed: {response.text}"
        data = response.json()
        assert "resultCount" in data or "results" in data
        if "resultCount" in data:
            assert data["resultCount"] > 0
        if "results" in data:
            assert len(data["results"]) > 0
    
    def test_podcasts_list_returns_array(self, auth_headers):
        """GET /api/gadgets/podcasts returns subscribed podcasts"""
        response = requests.get(f"{BASE_URL}/api/gadgets/podcasts", headers=auth_headers)
        assert response.status_code == 200, f"Podcasts list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected array of subscribed podcasts"


# === Radio Gadget Tests ===
class TestRadioGadget:
    """Radio gadget endpoints - Radio Browser API"""
    
    def test_radio_stations_returns_list(self, auth_headers):
        """GET /api/gadgets/radio/stations?limit=5 returns radio stations from Radio Browser API"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/radio/stations",
            params={"limit": 5},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Radio stations failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of stations"
        assert len(data) == 5, f"Expected 5 stations, got {len(data)}"
        # Verify station structure
        if len(data) > 0:
            station = data[0]
            assert "name" in station or "stationuuid" in station
    
    def test_radio_countries_returns_list(self, auth_headers):
        """GET /api/gadgets/radio/countries returns list of countries"""
        response = requests.get(f"{BASE_URL}/api/gadgets/radio/countries", headers=auth_headers)
        assert response.status_code == 200, f"Radio countries failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of countries"
        assert len(data) > 50, f"Expected many countries, got {len(data)}"
    
    def test_radio_tags_returns_list(self, auth_headers):
        """GET /api/gadgets/radio/tags?limit=10 returns radio tags"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/radio/tags",
            params={"limit": 10},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Radio tags failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of tags"
        assert len(data) == 10, f"Expected 10 tags, got {len(data)}"


# === IPTV Tests ===
class TestIPTV:
    """IPTV endpoints"""
    
    def test_iptv_sources_returns_list(self, auth_headers):
        """GET /api/iptv/sources returns IPTV sources list"""
        response = requests.get(f"{BASE_URL}/api/iptv/sources", headers=auth_headers)
        assert response.status_code == 200, f"IPTV sources failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of IPTV sources"


# === Subtitles Tests ===
class TestSubtitles:
    """Subtitles endpoints"""
    
    def test_subtitles_settings_returns_providers(self, auth_headers):
        """GET /api/subtitles/settings returns subtitle provider settings"""
        response = requests.get(f"{BASE_URL}/api/subtitles/settings", headers=auth_headers)
        assert response.status_code == 200, f"Subtitle settings failed: {response.text}"
        data = response.json()
        # Should include provider configs
        required_providers = ["opensubtitles", "addic7ed", "subscene", "podnapisi", "yifysubtitles"]
        for provider in required_providers:
            assert provider in data, f"Missing provider: {provider}"
        assert "languages" in data
        assert "auto_download" in data


# === Drizzle Playlists Tests ===
class TestDrizzlePlaylists:
    """Drizzle playlist endpoints"""
    
    def test_drizzle_playlists_returns_list(self, auth_headers):
        """GET /api/drizzle/playlists returns playlists list"""
        response = requests.get(f"{BASE_URL}/api/drizzle/playlists", headers=auth_headers)
        assert response.status_code == 200, f"Playlists failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of playlists"
    
    def test_drizzle_create_playlist(self, auth_headers):
        """POST /api/drizzle/playlists creates a new playlist"""
        response = requests.post(
            f"{BASE_URL}/api/drizzle/playlists",
            headers=auth_headers,
            json={"name": "TEST_AuditPlaylist", "description": "Code audit test", "media_type": "movie"}
        )
        assert response.status_code == 200, f"Create playlist failed: {response.text}"
        data = response.json()
        assert "id" in data, "Missing playlist ID"
        assert data["name"] == "TEST_AuditPlaylist" or data.get("Name") == "TEST_AuditPlaylist"
        assert data["status"] == "created"


# === qBittorrent Tests ===
class TestQBittorrent:
    """qBittorrent endpoints"""
    
    def test_qbittorrent_status_returns_connection_status(self, auth_headers):
        """GET /api/qbittorrent/status returns qBittorrent connection status"""
        response = requests.get(f"{BASE_URL}/api/qbittorrent/status", headers=auth_headers)
        assert response.status_code == 200, f"qBittorrent status failed: {response.text}"
        data = response.json()
        assert "connected" in data
        assert "status" in data
        # Not configured is expected since no qBittorrent WebUI available
        assert data["status"] in ["connected", "not_configured", "unreachable", "error"]


# === Theme Tests ===
class TestThemes:
    """Theme endpoints"""
    
    def test_milk_themes_returns_list(self, auth_headers):
        """GET /api/milk/themes returns theme list"""
        # Try /api/milk/themes first, fallback to /api/milk/theme-forge
        response = requests.get(f"{BASE_URL}/api/milk/themes", headers=auth_headers)
        if response.status_code != 200:
            response = requests.get(f"{BASE_URL}/api/milk/theme-forge", headers=auth_headers)
        assert response.status_code == 200, f"Themes failed: {response.text}"
        data = response.json()
        # Should return themes list or themes object
        assert isinstance(data, (list, dict)), "Expected themes data"


# === Ripen Gadgets Tests ===
class TestRipenGadgets:
    """Ripen installed gadgets endpoints"""
    
    def test_ripen_installed_returns_gadgets(self, auth_headers):
        """GET /api/ripen/installed returns installed gadgets"""
        response = requests.get(f"{BASE_URL}/api/ripen/installed", headers=auth_headers)
        assert response.status_code == 200, f"Ripen installed failed: {response.text}"
        data = response.json()
        assert "gadgets" in data, "Missing gadgets key"
        assert isinstance(data["gadgets"], list), "Expected list of gadgets"
        # Verify gadget structure
        for gadget in data["gadgets"]:
            assert "id" in gadget
            assert "name" in gadget
            assert "status" in gadget


# === User Preferences Tests ===
class TestUserPreferences:
    """User preferences endpoints"""
    
    def test_user_preferences_returns_data(self, auth_headers):
        """GET /api/user/preferences returns user preferences"""
        response = requests.get(f"{BASE_URL}/api/user/preferences", headers=auth_headers)
        assert response.status_code == 200, f"User preferences failed: {response.text}"
        data = response.json()
        assert isinstance(data, dict), "Expected preferences object"


# === Cache Stats Tests ===
class TestCacheStats:
    """Cache statistics endpoints"""
    
    def test_cache_stats_returns_data(self, auth_headers):
        """GET /api/cache/stats returns cache statistics"""
        response = requests.get(f"{BASE_URL}/api/cache/stats", headers=auth_headers)
        assert response.status_code == 200, f"Cache stats failed: {response.text}"
        data = response.json()
        assert "entries" in data
        assert "size_bytes" in data


# === DB Stats Tests ===
class TestDBStats:
    """Database statistics endpoints"""
    
    def test_db_stats_returns_data(self, auth_headers):
        """GET /api/db/stats returns database statistics"""
        response = requests.get(f"{BASE_URL}/api/db/stats", headers=auth_headers)
        assert response.status_code == 200, f"DB stats failed: {response.text}"
        data = response.json()
        assert "size_bytes" in data
        assert "path" in data
        assert "watchnexus.db" in data["path"]


# === Filesystem Browse Tests ===
class TestFilesystemBrowse:
    """Filesystem browsing endpoints"""
    
    def test_filesystem_browse_returns_listing(self, auth_headers):
        """GET /api/filesystem/browse returns directory listing"""
        response = requests.get(f"{BASE_URL}/api/filesystem/browse", headers=auth_headers)
        assert response.status_code == 200, f"Filesystem browse failed: {response.text}"
        data = response.json()
        assert "current_path" in data
        assert "items" in data
        assert "os_type" in data
        assert data["os_type"] == "linux"
        assert isinstance(data["items"], list)
