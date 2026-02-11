"""
Test suite for WatchNexus new modules:
- Gelatin (External Access)
- Watch Party
- Streaming Logins
- Subtitles
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestGelatin:
    """Gelatin - External Access module tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self, auth_token):
        self.headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_gelatin_status(self, auth_token):
        """GET /api/gelatin/status - Server status API"""
        response = requests.get(
            f"{BASE_URL}/api/gelatin/status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "server_id" in data
        assert "server_name" in data
        assert "local_ip" in data
        assert "local_port" in data
        assert "lan_url" in data
        assert "tunnel_active" in data
        assert "version" in data
        assert "features" in data
        
        # Verify features list
        assert isinstance(data["features"], list)
        assert "streaming" in data["features"]
        assert "watch_party" in data["features"]
    
    def test_gelatin_tunnel_create(self, auth_token):
        """POST /api/gelatin/tunnel/create - Create tunnel"""
        response = requests.post(
            f"{BASE_URL}/api/gelatin/tunnel/create",
            params={"provider": "built_in"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "tunnel_id" in data
        assert "public_url" in data
        assert "created_at" in data
        
        # Verify tunnel_id format
        assert len(data["tunnel_id"]) > 0
    
    def test_gelatin_access_token(self, auth_token):
        """POST /api/gelatin/access-token - Generate access token"""
        response = requests.post(
            f"{BASE_URL}/api/gelatin/access-token",
            params={"permissions": "view,watch_party", "expires_hours": 24},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "token" in data
        assert "permissions" in data
        assert "expires_hours" in data
        
        # Verify token is generated
        assert len(data["token"]) > 0
        assert isinstance(data["permissions"], list)
        assert "view" in data["permissions"]
        assert "watch_party" in data["permissions"]
        assert data["expires_hours"] == 24
    
    def test_gelatin_lan_url(self, auth_token):
        """GET /api/gelatin/lan-url - Get LAN URL"""
        response = requests.get(
            f"{BASE_URL}/api/gelatin/lan-url",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "lan_url" in data
        # local_ip is optional in this endpoint
    
    def test_gelatin_list_tunnels(self, auth_token):
        """GET /api/gelatin/tunnels - List tunnels"""
        response = requests.get(
            f"{BASE_URL}/api/gelatin/tunnels",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Response is a list of tunnels directly
        assert isinstance(data, list)


class TestWatchParty:
    """Watch Party module tests"""
    
    def test_watch_party_create(self, auth_token):
        """POST /api/watch-party/create - Create watch party"""
        response = requests.post(
            f"{BASE_URL}/api/watch-party/create",
            params={
                "media_id": 12345,
                "media_title": "TEST_Movie",
                "media_type": "movie"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "party_code" in data
        assert "share_url" in data
        assert "message" in data
        
        # Verify party code format (6 characters)
        assert len(data["party_code"]) == 6
        assert data["party_code"].isalnum()
        
        # Store party code for next test
        TestWatchParty.party_code = data["party_code"]
    
    def test_watch_party_get(self, auth_token):
        """GET /api/watch-party/{party_code} - Get party info"""
        # First create a party
        create_response = requests.post(
            f"{BASE_URL}/api/watch-party/create",
            params={
                "media_id": 67890,
                "media_title": "TEST_Another_Movie",
                "media_type": "movie"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        party_code = create_response.json()["party_code"]
        
        # Get party info
        response = requests.get(
            f"{BASE_URL}/api/watch-party/{party_code}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "party_code" in data
        assert "status" in data
        assert "media_title" in data
        assert "host" in data
        
        # Verify data
        assert data["party_code"] == party_code
        assert data["media_title"] == "TEST_Another_Movie"
    
    def test_watch_party_list(self, auth_token):
        """GET /api/watch-party/list - List watch parties"""
        response = requests.get(
            f"{BASE_URL}/api/watch-party/list",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Response is a list of parties directly
        assert isinstance(data, list)


class TestStreamingLogins:
    """Streaming Logins module tests"""
    
    def test_streaming_logins_services(self):
        """GET /api/streaming-logins/services - List available services"""
        response = requests.get(f"{BASE_URL}/api/streaming-logins/services")
        assert response.status_code == 200
        data = response.json()
        
        # Verify it's a list
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify service structure
        service = data[0]
        assert "name" in service
        assert "icon" in service
        assert "color" in service
        assert "deep_link" in service
        assert "login_url" in service
        
        # Verify priority services are present
        service_names = [s["name"] for s in data]
        assert "Netflix" in service_names
        assert "Disney+" in service_names
        assert "Amazon Prime Video" in service_names
        assert "Crunchyroll" in service_names
        assert "YouTube Premium" in service_names
    
    def test_streaming_logins_add(self, auth_token):
        """POST /api/streaming-logins - Add streaming login"""
        response = requests.post(
            f"{BASE_URL}/api/streaming-logins",
            params={
                "service_id": "disney",
                "email": "TEST_disney@test.com",
                "password": "testpass123"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "status" in data
        assert "login" in data
        assert data["status"] == "added"
        
        # Verify login data
        login = data["login"]
        assert login["service_id"] == "disney"
        assert login["email"] == "TEST_disney@test.com"
        assert "service_name" in login
    
    def test_streaming_logins_get(self, auth_token):
        """GET /api/streaming-logins - Get user's logins"""
        response = requests.get(
            f"{BASE_URL}/api/streaming-logins",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify it's a list
        assert isinstance(data, list)
        
        # Verify login structure if any exist
        if len(data) > 0:
            login = data[0]
            assert "service_id" in login
            assert "email" in login
            assert "service_name" in login
    
    def test_streaming_logins_delete(self, auth_token):
        """DELETE /api/streaming-logins/{service_id} - Delete streaming login"""
        # First add a login to delete
        requests.post(
            f"{BASE_URL}/api/streaming-logins",
            params={
                "service_id": "hulu",
                "email": "TEST_hulu@test.com",
                "password": "testpass123"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Delete the login
        response = requests.delete(
            f"{BASE_URL}/api/streaming-logins/hulu",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "deleted"
        
        # Verify it's deleted
        get_response = requests.get(
            f"{BASE_URL}/api/streaming-logins",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        logins = get_response.json()
        hulu_logins = [l for l in logins if l["service_id"] == "hulu"]
        assert len(hulu_logins) == 0


class TestSubtitles:
    """Subtitles module tests"""
    
    def test_subtitles_search_tv(self, auth_token):
        """GET /api/subtitles/search/tv - Search TV subtitles"""
        response = requests.get(
            f"{BASE_URL}/api/subtitles/search/tv",
            params={
                "show_name": "Breaking Bad",
                "season": 1,
                "episode": 1,
                "languages": "en"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "results" in data
        assert "count" in data
        assert isinstance(data["results"], list)
        # Note: May return 0 results due to network restrictions
    
    def test_subtitles_search_movie(self, auth_token):
        """GET /api/subtitles/search/movie - Search movie subtitles"""
        response = requests.get(
            f"{BASE_URL}/api/subtitles/search/movie",
            params={
                "movie_name": "Inception",
                "year": 2010,
                "languages": "en"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "results" in data
        assert "count" in data
        assert isinstance(data["results"], list)
    
    def test_subtitles_settings_get(self, auth_token):
        """GET /api/subtitles/settings - Get subtitle settings"""
        response = requests.get(
            f"{BASE_URL}/api/subtitles/settings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "auto_download" in data
        assert "preferred_languages" in data
        # Sources are individual flags like addic7ed_enabled, opensubtitles_enabled
        assert "addic7ed_enabled" in data or "opensubtitles_enabled" in data


# Fixtures
@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    # Try to login
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "test@test.com", "password": "password"}
    )
    
    if response.status_code == 200:
        return response.json()["access_token"]
    
    # If login fails, try to register
    response = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={
            "email": "test@test.com",
            "password": "password",
            "username": "testuser"
        }
    )
    
    if response.status_code == 200:
        return response.json()["access_token"]
    
    # If registration also fails (user exists), try login again
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "test@test.com", "password": "password"}
    )
    
    if response.status_code == 200:
        return response.json()["access_token"]
    
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data(auth_token):
    """Cleanup TEST_ prefixed data after tests"""
    yield
    # Cleanup streaming logins
    try:
        response = requests.get(
            f"{BASE_URL}/api/streaming-logins",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        if response.status_code == 200:
            for login in response.json():
                if login.get("email", "").startswith("TEST_"):
                    requests.delete(
                        f"{BASE_URL}/api/streaming-logins/{login['service_id']}",
                        headers={"Authorization": f"Bearer {auth_token}"}
                    )
    except:
        pass
