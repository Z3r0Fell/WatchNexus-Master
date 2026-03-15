"""
WatchNexus Full API Test Suite
Tests all major features with REAL APIs - no stubs
Backend: C#/.NET 10 running on port 8001
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://watchnexus-core.preview.emergentagent.com').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Missing access_token"
        assert "user" in data, "Missing user data"
        assert data["user"]["email"] == "test@test.com"
        
    def test_login_invalid(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@wrong.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401

@pytest.fixture(scope="class")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@test.com",
        "password": "password"
    })
    if response.status_code != 200:
        pytest.skip("Authentication failed")
    return response.json()["access_token"]

@pytest.fixture(scope="class")
def auth_headers(auth_token):
    """Create headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestWeatherGadget:
    """Weather gadget tests - Open-Meteo geocoding"""
    
    def test_weather_search_london(self, auth_headers):
        """Test weather location search returns real geocoding results"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/weather/search",
            params={"q": "London"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Weather search failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of results"
        assert len(data) > 0, "Expected at least one result"
        # Verify real data - London should have UK entry
        london_uk = next((r for r in data if r.get("country_code") == "GB"), None)
        assert london_uk is not None, "London UK not found"
        assert "latitude" in london_uk
        assert "longitude" in london_uk
        assert london_uk["population"] > 1000000, "London should have >1M population"

    def test_weather_search_empty(self, auth_headers):
        """Test empty search returns empty array"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/weather/search",
            params={"q": ""},
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json() == []


class TestRadioGadget:
    """Radio gadget tests - Radio Browser API"""
    
    def test_radio_stations_bbc(self, auth_headers):
        """Test radio stations search returns real BBC stations"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/radio/stations",
            params={"name": "BBC", "limit": 3},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Radio search failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of stations"
        assert len(data) > 0, "Expected at least one BBC station"
        # Verify real station data structure
        station = data[0]
        assert "stationuuid" in station or "name" in station
        assert "url" in station or "url_resolved" in station

    def test_radio_countries(self, auth_headers):
        """Test radio countries returns real country list"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/radio/countries",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Countries failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of countries"
        assert len(data) > 50, "Expected many countries"
        # Verify USA exists with many stations
        usa = next((c for c in data if c.get("iso_3166_1") == "US" or "America" in c.get("name", "")), None)
        assert usa is not None, "USA not found"
        assert usa.get("stationcount", 0) > 1000, "USA should have many stations"


class TestPodcastsGadget:
    """Podcasts gadget tests - iTunes Search"""
    
    def test_podcasts_search_technology(self, auth_headers):
        """Test podcast search returns real iTunes results"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/podcasts/search",
            params={"q": "technology"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Podcast search failed: {response.text}"
        data = response.json()
        assert "results" in data or isinstance(data, list), "Expected results"
        results = data.get("results", data) if isinstance(data, dict) else data
        assert len(results) > 0, "Expected podcast results"
        # Verify real podcast structure
        podcast = results[0]
        assert "collectionName" in podcast or "trackName" in podcast or "title" in podcast


class TestIPTV:
    """IPTV tests - M3U parsing"""
    
    def test_iptv_stats(self, auth_headers):
        """Test IPTV stats returns real counts"""
        response = requests.get(
            f"{BASE_URL}/api/iptv/stats",
            headers=auth_headers
        )
        assert response.status_code == 200, f"IPTV stats failed: {response.text}"
        data = response.json()
        assert "sources" in data
        assert "channels" in data
        assert "groups" in data
        assert isinstance(data["sources"], int)
        
    def test_iptv_sources(self, auth_headers):
        """Test IPTV sources returns array"""
        response = requests.get(
            f"{BASE_URL}/api/iptv/sources",
            headers=auth_headers
        )
        assert response.status_code == 200, f"IPTV sources failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)


class TestSubtitles:
    """Subtitles tests - Provider configurations"""
    
    def test_subtitles_settings_providers(self, auth_headers):
        """Test subtitle settings returns all provider configs"""
        response = requests.get(
            f"{BASE_URL}/api/subtitles/settings",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Subtitle settings failed: {response.text}"
        data = response.json()
        # All 5 providers must be present
        required_providers = ["opensubtitles", "addic7ed", "subscene", "podnapisi", "yifysubtitles"]
        for provider in required_providers:
            assert provider in data, f"Missing provider: {provider}"
        assert "languages" in data
        assert "auto_download" in data


class TestFilesystem:
    """Filesystem tests - Real directory browsing"""
    
    def test_filesystem_browse(self, auth_headers):
        """Test filesystem browse returns real directory listing"""
        response = requests.get(
            f"{BASE_URL}/api/filesystem/browse",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Filesystem browse failed: {response.text}"
        data = response.json()
        assert "current_path" in data
        assert "items" in data
        assert "drives" in data
        assert "os_type" in data
        assert data["os_type"] == "linux"
        assert isinstance(data["items"], list)
        assert isinstance(data["drives"], list)


class TestSystem:
    """System tests - Real stats"""
    
    def test_system_info(self, auth_headers):
        """Test system info returns real version, hostname, OS, memory"""
        response = requests.get(
            f"{BASE_URL}/api/system/info",
            headers=auth_headers
        )
        assert response.status_code == 200, f"System info failed: {response.text}"
        data = response.json()
        assert data["version"] == "2.6.5"
        assert "hostname" in data
        assert "os" in data
        assert "memory_mb" in data
        assert data["memory_mb"] > 0
        assert "dotnet_version" in data
        
    def test_db_stats(self, auth_headers):
        """Test DB stats returns real size and path"""
        response = requests.get(
            f"{BASE_URL}/api/db/stats",
            headers=auth_headers
        )
        assert response.status_code == 200, f"DB stats failed: {response.text}"
        data = response.json()
        assert "size_bytes" in data
        assert "path" in data
        assert "watchnexus.db" in data["path"]


class TestThemes:
    """Theme tests"""
    
    def test_theme_forge_6_themes(self, auth_headers):
        """Test theme forge returns 6 themes"""
        response = requests.get(
            f"{BASE_URL}/api/milk/theme-forge",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Theme forge failed: {response.text}"
        data = response.json()
        assert "themes" in data
        assert len(data["themes"]) == 6, f"Expected 6 themes, got {len(data['themes'])}"
        theme_names = [t["name"] for t in data["themes"]]
        assert "Default Dark" in theme_names
        assert "Ocean Blue" in theme_names


class TestPhotoLibraries:
    """Photo library tests"""
    
    def test_photo_libraries_returns_array(self, auth_headers):
        """Test photo libraries returns array"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/photos/libraries",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Photo libraries failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)


class TestWebVideo:
    """Web video tests"""
    
    def test_webvideo_bookmarks_returns_array(self, auth_headers):
        """Test web video bookmarks returns array"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/webvideo/bookmarks",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Bookmarks failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)


class TestPlaylists:
    """Playlist tests - DB-backed CRUD"""
    
    def test_playlists_list(self, auth_headers):
        """Test playlist list returns array"""
        response = requests.get(
            f"{BASE_URL}/api/drizzle/playlists",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Playlists list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        
    def test_playlist_create_and_verify(self, auth_headers):
        """Test playlist create and verify persistence"""
        # Create
        create_resp = requests.post(
            f"{BASE_URL}/api/drizzle/playlists",
            headers=auth_headers,
            json={
                "name": "TEST_APITestPlaylist",
                "description": "Created by pytest",
                "media_type": "movie"
            }
        )
        assert create_resp.status_code == 200, f"Create failed: {create_resp.text}"
        created = create_resp.json()
        assert "id" in created or "Id" in created
        playlist_id = created.get("id") or created.get("Id")
        assert created.get("name") or created.get("Name") == "TEST_APITestPlaylist"
        
        # Verify by fetching
        get_resp = requests.get(
            f"{BASE_URL}/api/drizzle/playlists/{playlist_id}",
            headers=auth_headers
        )
        assert get_resp.status_code == 200, f"Get failed: {get_resp.text}"


class TestTMDB:
    """TMDB integration tests - Real API"""
    
    def test_tmdb_trending_movies(self, auth_headers):
        """Test TMDB trending movies returns real content"""
        response = requests.get(
            f"{BASE_URL}/api/tmdb/trending/movie/week",
            headers=auth_headers
        )
        assert response.status_code == 200, f"TMDB movies failed: {response.text}"
        data = response.json()
        assert "results" in data
        assert len(data["results"]) > 0, "Expected trending movies"
        movie = data["results"][0]
        assert "title" in movie
        assert "release_date" in movie or "id" in movie
        
    def test_tmdb_trending_tv(self, auth_headers):
        """Test TMDB trending TV returns real content"""
        response = requests.get(
            f"{BASE_URL}/api/tmdb/trending/tv/week",
            headers=auth_headers
        )
        assert response.status_code == 200, f"TMDB TV failed: {response.text}"
        data = response.json()
        assert "results" in data
        assert len(data["results"]) > 0, "Expected trending TV shows"
        show = data["results"][0]
        assert "name" in show
        
    def test_tmdb_key_stored(self, auth_headers):
        """Verify TMDB API key is stored"""
        response = requests.get(
            f"{BASE_URL}/api/settings/integrations",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["tmdb"]["has_key"] is True
        assert data["tmdb"]["api_key"].startswith("8c860bcb")


class TestHealth:
    """Health check tests"""
    
    def test_health_endpoint(self):
        """Test health endpoint (no auth required)"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["version"] == "2.6.5"
