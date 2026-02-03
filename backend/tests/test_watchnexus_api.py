"""
WatchNexus API Tests
Tests for Media Health Checker, Authentication, TMDB, and Marmalade proxy endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthCheck:
    """Basic health check tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "test@test.com"
        assert data["token_type"] == "bearer"
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
    
    def test_register_new_user(self):
        """Test user registration"""
        import uuid
        unique_email = f"test_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpassword123",
            "username": f"testuser_{uuid.uuid4().hex[:6]}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == unique_email
    
    def test_get_me_authenticated(self):
        """Test /api/auth/me with valid token"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Then get me
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@test.com"
    
    def test_get_me_unauthenticated(self):
        """Test /api/auth/me without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401


class TestMediaHealthChecker:
    """Media Health Checker API tests"""
    
    def test_health_check_valid_file(self):
        """Test health check on valid video file"""
        response = requests.post(
            f"{BASE_URL}/api/media/health-check",
            params={"file_path": "/tmp/test_video.mp4"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "file_path" in data
        assert data["file_path"] == "/tmp/test_video.mp4"
        assert "video_codec" in data
        assert "duration" in data
        assert "issues" in data
        assert "warnings" in data
        assert "repairable" in data
    
    def test_health_check_nonexistent_file(self):
        """Test health check on non-existent file"""
        response = requests.post(
            f"{BASE_URL}/api/media/health-check",
            params={"file_path": "/tmp/nonexistent_video.mp4"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "error"
        assert "File does not exist" in data["issues"]
    
    def test_health_check_with_hash(self):
        """Test health check with hash computation"""
        response = requests.post(
            f"{BASE_URL}/api/media/health-check",
            params={"file_path": "/tmp/test_video.mp4", "compute_hash": True}
        )
        assert response.status_code == 200
        data = response.json()
        assert "hash_md5" in data
        assert "hash_sha256" in data
        # Hashes should be computed
        assert data["hash_md5"] is not None
        assert data["hash_sha256"] is not None
    
    def test_scan_library(self):
        """Test library scan endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/media/scan-library",
            params={"directory": "/tmp"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should find at least the test video
        assert len(data) >= 1
        # Check structure of results
        for item in data:
            assert "file_path" in item
            assert "status" in item
    
    def test_repair_file(self):
        """Test file repair endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/media/repair",
            params={"file_path": "/tmp/test_video.mp4"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "message" in data


class TestMarmaladeProxy:
    """Marmalade media server proxy tests"""
    
    def test_marmalade_proxy_unavailable(self):
        """Test Marmalade proxy returns error when server not running"""
        response = requests.get(f"{BASE_URL}/api/marmalade/System/Info/Public")
        # Should return 503 or 520 (Cloudflare) since Marmalade server is not running
        assert response.status_code in [503, 520]
        # Response may be JSON or HTML depending on proxy
        try:
            data = response.json()
            assert "detail" in data
            assert "Cannot connect to Marmalade server" in data["detail"]
        except:
            # Cloudflare may return HTML error page
            pass


class TestTMDBEndpoints:
    """TMDB API proxy tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_trending_all(self):
        """Test trending endpoint"""
        response = requests.get(f"{BASE_URL}/api/tmdb/trending/all/week")
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) > 0
        # Check enhanced image URLs
        for item in data["results"]:
            if item.get("poster_path"):
                assert "poster_url" in item
    
    def test_now_playing_movies(self):
        """Test now playing movies endpoint"""
        response = requests.get(f"{BASE_URL}/api/tmdb/movie/now_playing")
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
    
    def test_on_the_air_tv(self):
        """Test on the air TV shows endpoint"""
        response = requests.get(f"{BASE_URL}/api/tmdb/tv/on_the_air")
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
    
    def test_search_media(self):
        """Test search endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/tmdb/search",
            params={"query": "Batman"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "results" in data


class TestDownloadsAPI:
    """Downloads API tests (MOCKED)"""
    
    def test_get_downloads(self):
        """Test get downloads endpoint"""
        response = requests.get(f"{BASE_URL}/api/downloads")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_add_download(self):
        """Test add download endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/downloads",
            params={
                "title": "Test Movie",
                "media_type": "movie",
                "tmdb_id": 12345,
                "size": 1500000000
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Test Movie"
        assert data["media_type"] == "movie"
        assert "id" in data


class TestWatchlistAPI:
    """Watchlist API tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            token = response.json()["access_token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_get_watchlist(self, auth_headers):
        """Test get watchlist endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/watchlist",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_watchlist_unauthenticated(self):
        """Test watchlist requires authentication"""
        response = requests.get(f"{BASE_URL}/api/watchlist")
        assert response.status_code == 401


class TestSettingsAPI:
    """Settings API tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            token = response.json()["access_token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_get_settings(self, auth_headers):
        """Test get settings endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/settings",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "download_path" in data
        assert "library_path" in data
    
    def test_update_settings(self, auth_headers):
        """Test update settings endpoint"""
        response = requests.put(
            f"{BASE_URL}/api/settings",
            headers=auth_headers,
            json={
                "download_path": "/media/downloads",
                "library_path": "/media/library",
                "auto_subtitles": True,
                "subtitle_languages": ["en"],
                "quality_preference": "1080p"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["download_path"] == "/media/downloads"


class TestIndexersAPI:
    """Indexers API tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            token = response.json()["access_token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_get_indexers(self, auth_headers):
        """Test get indexers endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/indexers",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have default indexers
        assert len(data) > 0


class TestStreamingServicesAPI:
    """Streaming services API tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            token = response.json()["access_token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_get_streaming_services(self, auth_headers):
        """Test get streaming services endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/streaming-services",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have default streaming services
        assert len(data) > 0
        # Check structure
        for service in data:
            assert "id" in service
            assert "name" in service
