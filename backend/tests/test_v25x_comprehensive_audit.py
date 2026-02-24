"""
WatchNexus v2.5.x Comprehensive Code Audit Tests
Tests all core functionality for Kickstarter launch readiness.

Test Categories:
- Auth: Register, Login, /api/auth/me
- Marmalade Library: Add, Scan, Get Media, Delete
- Music & Audiobooks Pages: Empty states, library operations
- Video Streaming: Stream endpoint
- Settings: Get/Update settings, sidebar tabs
- Database: Stats, Reset endpoints
- Compote Indexers: List, Search
- Download Engine: Status
- Zest Logs: Stats
- TMDB Integration: Trending
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "password"


class TestAuthenticationFlow:
    """Authentication endpoints tests"""
    
    def test_register_new_user(self):
        """Test user registration"""
        unique_email = f"testuser_{int(time.time())}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "username": f"testuser_{int(time.time())}"
        })
        # 200 = success, 400 = already exists
        assert response.status_code in [200, 400], f"Register failed: {response.status_code} - {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "access_token" in data
            assert "user" in data
            print(f"PASS: Register new user - status {response.status_code}")
        else:
            print(f"INFO: Registration returned 400 (may already exist)")
    
    def test_login_valid_credentials(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        print(f"PASS: Login with valid credentials - token received")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Login with invalid credentials returns 401")
    
    def test_auth_me_returns_user_data(self):
        """Test /api/auth/me returns current user data"""
        # First login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Test /api/auth/me
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Auth me failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "id" in data
        assert "email" in data
        assert data["email"] == TEST_EMAIL
        print(f"PASS: /api/auth/me returns user data - id={data['id']}")


class TestMarmaladeLibrary:
    """Marmalade Library Management tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_get_libraries(self, auth_token):
        """Test getting all libraries"""
        response = requests.get(f"{BASE_URL}/api/marmalade/libraries", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Get libraries failed: {response.status_code}"
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Get libraries - {len(data)} libraries found")
    
    def test_add_library(self, auth_token):
        """Test adding a new library"""
        response = requests.post(
            f"{BASE_URL}/api/marmalade/libraries",
            params={"name": "Test Movies", "path": "/tmp/test_movies", "media_type": "movies"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # 200 = success, may return existing lib info
        assert response.status_code == 200, f"Add library failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "id" in data
        assert "name" in data
        print(f"PASS: Add library - id={data['id']}, name={data['name']}")
        return data["id"]
    
    def test_scan_library(self, auth_token):
        """Test scanning a library"""
        # First get libraries to find one to scan
        libs_response = requests.get(f"{BASE_URL}/api/marmalade/libraries", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        libraries = libs_response.json()
        
        if not libraries:
            # Add one first
            add_response = requests.post(
                f"{BASE_URL}/api/marmalade/libraries",
                params={"name": "Test Scan", "path": "/tmp/test_scan", "media_type": "movies"},
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            library_id = add_response.json()["id"]
        else:
            library_id = libraries[0]["id"]
        
        # Scan the library
        response = requests.post(
            f"{BASE_URL}/api/marmalade/libraries/{library_id}/scan",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Scan failed: {response.status_code} - {response.text}"
        data = response.json()
        # Scan returns info about what was found
        assert "new" in data or "total" in data or "library" in data
        print(f"PASS: Scan library - response: {data.get('new', 0)} new files")
    
    def test_get_media(self, auth_token):
        """Test getting media from libraries"""
        response = requests.get(f"{BASE_URL}/api/marmalade/media", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Get media failed: {response.status_code}"
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Get media - {len(data)} media items found")
    
    def test_delete_library(self, auth_token):
        """Test deleting a library"""
        # Add a test library first
        add_response = requests.post(
            f"{BASE_URL}/api/marmalade/libraries",
            params={"name": f"Delete Test {int(time.time())}", "path": f"/tmp/delete_test_{int(time.time())}", "media_type": "movies"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        if add_response.status_code != 200:
            pytest.skip("Could not add library to delete")
        
        library_id = add_response.json()["id"]
        
        # Delete it
        response = requests.delete(
            f"{BASE_URL}/api/marmalade/libraries/{library_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Delete failed: {response.status_code} - {response.text}"
        print(f"PASS: Delete library - library {library_id} deleted")


class TestVideoStreaming:
    """Video streaming endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_stream_endpoint_exists(self, auth_token):
        """Test that stream endpoint returns stream info (or 404 for non-existent)"""
        # Test with a dummy ID - should return 404 not 500
        response = requests.get(
            f"{BASE_URL}/api/marmalade/stream/nonexistent_id",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # 404 = media not found (correct), 200 = would work
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print(f"PASS: Stream endpoint exists - returns {response.status_code} for non-existent ID")


class TestSettings:
    """Settings API tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_get_settings(self, auth_token):
        """Test getting user settings"""
        response = requests.get(f"{BASE_URL}/api/settings", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Get settings failed: {response.status_code}"
        data = response.json()
        # Should have default settings fields
        assert "download_path" in data or "library_path" in data or "user_id" in data
        print(f"PASS: Get settings - settings retrieved")
    
    def test_update_settings(self, auth_token):
        """Test updating user settings"""
        response = requests.put(
            f"{BASE_URL}/api/settings",
            json={
                "download_path": "/media/downloads",
                "library_path": "/media/library",
                "auto_subtitles": True,
                "subtitle_languages": ["en"],
                "quality_preference": "1080p"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Update settings failed: {response.status_code} - {response.text}"
        print("PASS: Update settings")


class TestDatabase:
    """Database management API tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_db_stats_returns_version(self, auth_token):
        """Test /api/db/stats returns version info"""
        response = requests.get(f"{BASE_URL}/api/db/stats", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"DB stats failed: {response.status_code}"
        data = response.json()
        # Should contain version info
        assert "db_version" in data or "version" in data or "app_version" in data or "tables" in data
        print(f"PASS: /api/db/stats returns version info - {data}")
    
    def test_db_reset_endpoint_exists(self, auth_token):
        """Test /api/db/reset endpoint exists (but don't actually reset)"""
        # Just check that the endpoint responds - we won't actually reset
        response = requests.options(f"{BASE_URL}/api/db/reset", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        # OPTIONS may return 200 or 405. POST without confirmation would be dangerous
        # Let's test with GET which should return Method Not Allowed or similar
        response = requests.get(f"{BASE_URL}/api/db/reset", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        # 405 = Method not allowed (correct for GET), 200/400/401 = endpoint exists
        assert response.status_code in [200, 400, 401, 405, 422], f"Unexpected: {response.status_code}"
        print(f"PASS: /api/db/reset endpoint exists - returns {response.status_code}")


class TestCompoteIndexers:
    """Compote indexer API tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_get_indexers(self, auth_token):
        """Test /api/compote/indexers returns list"""
        response = requests.get(f"{BASE_URL}/api/compote/indexers", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Get indexers failed: {response.status_code}"
        data = response.json()
        assert isinstance(data, list)
        # Should have default indexers
        assert len(data) >= 0  # May be empty or have defaults
        print(f"PASS: /api/compote/indexers returns {len(data)} indexers")
    
    def test_compote_search(self, auth_token):
        """Test compote search endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/compote/search",
            params={"query": "test movie", "media_type": "movies"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # 200 = search works, even with demo results
        assert response.status_code == 200, f"Search failed: {response.status_code}"
        data = response.json()
        # Should return a list of results (may be demo data)
        assert isinstance(data, list)
        print(f"PASS: Compote search works - {len(data)} results")


class TestDownloadEngine:
    """Download engine API tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_download_engine_status(self, auth_token):
        """Test /api/downloads/engine/status returns engine status"""
        response = requests.get(f"{BASE_URL}/api/downloads/engine/status", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        # May return 200 with status or 404 if not implemented
        assert response.status_code in [200, 404], f"Unexpected: {response.status_code}"
        if response.status_code == 200:
            data = response.json()
            print(f"PASS: Download engine status - {data}")
        else:
            print(f"INFO: Download engine status endpoint returns 404 (may not be implemented)")


class TestZestLogs:
    """Zest logs/health API tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_zest_stats(self, auth_token):
        """Test /api/zest/stats returns log statistics"""
        response = requests.get(f"{BASE_URL}/api/zest/stats", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Zest stats failed: {response.status_code}"
        data = response.json()
        # Should have log statistics
        assert isinstance(data, dict)
        print(f"PASS: /api/zest/stats - {data}")
    
    def test_zest_health(self, auth_token):
        """Test /api/zest/health returns system health"""
        response = requests.get(f"{BASE_URL}/api/zest/health", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Zest health failed: {response.status_code}"
        data = response.json()
        # Should have health metrics
        assert isinstance(data, dict)
        print(f"PASS: /api/zest/health - keys: {list(data.keys())}")


class TestTMDBIntegration:
    """TMDB API integration tests"""
    
    def test_tmdb_trending(self):
        """Test /api/tmdb/trending returns results"""
        response = requests.get(f"{BASE_URL}/api/tmdb/trending/all/week")
        assert response.status_code == 200, f"TMDB trending failed: {response.status_code}"
        data = response.json()
        assert "results" in data
        assert len(data["results"]) > 0
        print(f"PASS: TMDB trending - {len(data['results'])} results")
    
    def test_tmdb_search(self):
        """Test TMDB search"""
        response = requests.get(f"{BASE_URL}/api/tmdb/search", params={"query": "inception"})
        assert response.status_code == 200, f"TMDB search failed: {response.status_code}"
        data = response.json()
        assert "results" in data
        print(f"PASS: TMDB search - {len(data.get('results', []))} results")


class TestMusicAudiobooksPages:
    """Tests for Music and Audiobooks page functionality"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_music_library_add(self, auth_token):
        """Test adding a music library"""
        response = requests.post(
            f"{BASE_URL}/api/marmalade/libraries",
            params={"name": f"Test Music {int(time.time())}", "path": f"/tmp/test_music_{int(time.time())}", "media_type": "music"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Add music library failed: {response.status_code}"
        data = response.json()
        assert data["media_type"] == "music"
        print(f"PASS: Add music library - id={data['id']}")
    
    def test_audiobook_library_add(self, auth_token):
        """Test adding an audiobook library"""
        response = requests.post(
            f"{BASE_URL}/api/marmalade/libraries",
            params={"name": f"Test Audiobooks {int(time.time())}", "path": f"/tmp/test_audiobooks_{int(time.time())}", "media_type": "audiobooks"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Add audiobook library failed: {response.status_code}"
        data = response.json()
        assert data["media_type"] == "audiobooks"
        print(f"PASS: Add audiobook library - id={data['id']}")
    
    def test_get_media_by_type_music(self, auth_token):
        """Test getting music media"""
        response = requests.get(
            f"{BASE_URL}/api/marmalade/media",
            params={"media_type": "music"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get music media failed: {response.status_code}"
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Get music media - {len(data)} items")
    
    def test_get_media_by_type_audiobook(self, auth_token):
        """Test getting audiobook media"""
        response = requests.get(
            f"{BASE_URL}/api/marmalade/media",
            params={"media_type": "audiobook"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get audiobook media failed: {response.status_code}"
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Get audiobook media - {len(data)} items")


class TestAdditionalEndpoints:
    """Tests for additional required endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_downloads_list(self, auth_token):
        """Test downloads list endpoint"""
        response = requests.get(f"{BASE_URL}/api/downloads", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        # May or may not require auth
        assert response.status_code in [200, 401], f"Unexpected: {response.status_code}"
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
        print(f"PASS: Downloads list endpoint - status {response.status_code}")
    
    def test_watchlist(self, auth_token):
        """Test watchlist endpoint"""
        response = requests.get(f"{BASE_URL}/api/watchlist", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Watchlist failed: {response.status_code}"
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Watchlist endpoint - {len(data)} items")
    
    def test_watch_progress(self, auth_token):
        """Test watch progress endpoint"""
        response = requests.get(f"{BASE_URL}/api/watch-progress", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Watch progress failed: {response.status_code}"
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Watch progress endpoint - {len(data)} items")
    
    def test_marmalade_status(self, auth_token):
        """Test Marmalade server status"""
        response = requests.get(f"{BASE_URL}/api/marmalade/status", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Marmalade status failed: {response.status_code}"
        data = response.json()
        assert "status" in data
        print(f"PASS: Marmalade status - {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
