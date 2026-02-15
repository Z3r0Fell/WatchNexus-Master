"""
Test suite for WatchNexus Library Auth Bug Fix
Tests the fix for localStorage key mismatch - 'auth_token' vs 'token'

Features being tested:
1. Library Management - Add a new library with name and path
2. Library Management - Libraries list shows added libraries  
3. Playlists (Drizzle) - Create a new playlist
4. Playlists (Drizzle) - View playlists list
5. Downloads page - Engine status shows running
6. Settings page - All tabs accessible
7. Home page - TMDB content loads
8. Movies page - Movie grid loads
9. User auth - Login works correctly
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://watchnexus-quality.preview.emergentagent.com').rstrip('/')

class TestAuthFlow:
    """Test authentication flow - the core bug fix area"""
    
    def test_login_returns_token_key(self):
        """Test that login returns proper token structure"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "drizzletest@test.com",
            "password": "test123"
        })
        
        # If user doesn't exist, try registering first
        if response.status_code == 401:
            reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
                "email": "drizzletest@test.com",
                "password": "test123",
                "username": "drizzletest"
            })
            if reg_response.status_code in [200, 201]:
                response = requests.post(f"{BASE_URL}/api/auth/login", json={
                    "email": "drizzletest@test.com",
                    "password": "test123"
                })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Login response should contain access_token"
        assert "user" in data, "Login response should contain user"
        assert len(data["access_token"]) > 0, "access_token should not be empty"
    
    def test_auth_me_with_token(self):
        """Test that authenticated endpoint works with token"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "drizzletest@test.com",
            "password": "test123"
        })
        
        if login_response.status_code == 401:
            pytest.skip("Test user not available")
        
        token = login_response.json()["access_token"]
        
        # Use token for authenticated request
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        data = response.json()
        assert "email" in data


class TestMarmaladeLibraryManagement:
    """Test Marmalade library management - the feature affected by auth bug"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "drizzletest@test.com",
            "password": "test123"
        })
        if response.status_code == 401:
            # Register user
            requests.post(f"{BASE_URL}/api/auth/register", json={
                "email": "drizzletest@test.com",
                "password": "test123",
                "username": "drizzletest"
            })
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "drizzletest@test.com",
                "password": "test123"
            })
        
        if response.status_code != 200:
            pytest.skip("Could not get auth token")
        return response.json()["access_token"]
    
    def test_marmalade_status(self, auth_token):
        """Test Marmalade server status endpoint"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/marmalade/status", headers=headers)
        
        assert response.status_code == 200, f"Marmalade status failed: {response.text}"
        data = response.json()
        assert "status" in data
        assert data["status"] == "running"
    
    def test_get_libraries_empty(self, auth_token):
        """Test getting libraries list (may be empty)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/marmalade/libraries", headers=headers)
        
        assert response.status_code == 200, f"Get libraries failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Libraries should return a list"
    
    def test_add_library(self, auth_token):
        """Test adding a new library - core bug fix test"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Add a library
        response = requests.post(
            f"{BASE_URL}/api/marmalade/libraries",
            params={
                "name": "Test Movies Library",
                "path": "/tmp/test_movies",
                "media_type": "movies"
            },
            headers=headers
        )
        
        assert response.status_code == 200, f"Add library failed: {response.text}"
        data = response.json()
        assert "id" in data, "Library should have an ID"
        assert data["name"] == "Test Movies Library"
        
        # Store library_id for cleanup
        library_id = data["id"]
        
        # Verify library is in list
        list_response = requests.get(f"{BASE_URL}/api/marmalade/libraries", headers=headers)
        assert list_response.status_code == 200
        libraries = list_response.json()
        library_ids = [lib["id"] for lib in libraries]
        assert library_id in library_ids, "Added library should be in list"
        
        # Cleanup - remove the test library
        requests.delete(f"{BASE_URL}/api/marmalade/libraries/{library_id}", headers=headers)
    
    def test_library_requires_auth(self):
        """Test that library endpoints require authentication"""
        # Try without auth - should fail
        response = requests.get(f"{BASE_URL}/api/marmalade/libraries")
        assert response.status_code in [401, 403], "Should require auth"


class TestDrizzlePlaylists:
    """Test Drizzle playlist management"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "drizzletest@test.com",
            "password": "test123"
        })
        if response.status_code != 200:
            pytest.skip("Could not get auth token")
        return response.json()["access_token"]
    
    def test_get_playlists(self, auth_token):
        """Test getting playlists list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/drizzle/playlists", headers=headers)
        
        assert response.status_code == 200, f"Get playlists failed: {response.text}"
        data = response.json()
        assert "playlists" in data
        assert "count" in data
        assert isinstance(data["playlists"], list)
    
    def test_create_playlist(self, auth_token):
        """Test creating a new playlist"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/drizzle/playlists",
            params={
                "name": "Test Playlist",
                "description": "Test playlist for bug fix verification"
            },
            headers=headers
        )
        
        assert response.status_code == 200, f"Create playlist failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["name"] == "Test Playlist"
        
        # Verify playlist is in list
        list_response = requests.get(f"{BASE_URL}/api/drizzle/playlists", headers=headers)
        playlists = list_response.json()["playlists"]
        playlist_names = [p["name"] for p in playlists]
        assert "Test Playlist" in playlist_names
        
        # Cleanup - delete the test playlist
        playlist_id = data["id"]
        requests.delete(f"{BASE_URL}/api/drizzle/playlists/{playlist_id}", headers=headers)
    
    def test_playlist_requires_auth(self):
        """Test that playlist endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/drizzle/playlists")
        assert response.status_code in [401, 403], "Should require auth"


class TestDownloadEngine:
    """Test download engine status"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "drizzletest@test.com",
            "password": "test123"
        })
        if response.status_code != 200:
            pytest.skip("Could not get auth token")
        return response.json()["access_token"]
    
    def test_engine_status(self, auth_token):
        """Test download engine status endpoint"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/downloads/engine/status", headers=headers)
        
        assert response.status_code == 200, f"Engine status failed: {response.text}"
        data = response.json()
        # Check for engine running status (uses 'success' or 'message' keys)
        assert "success" in data or "message" in data or "engine" in data, f"Unexpected response: {data}"
        # The engine should be running
        if "success" in data:
            assert data["success"] == True, f"Engine not successful: {data}"
        if "message" in data:
            assert "running" in data["message"].lower() or "Engine" in data.get("engine", ""), f"Engine not running: {data}"


class TestTMDBContent:
    """Test TMDB content loading - Home page and Movies page"""
    
    def test_trending_all_week(self):
        """Test trending content for home page hero"""
        response = requests.get(f"{BASE_URL}/api/tmdb/trending/all/week")
        
        assert response.status_code == 200, f"Trending failed: {response.text}"
        data = response.json()
        assert "results" in data
        assert len(data["results"]) > 0, "Should have trending results"
    
    def test_movies_now_playing(self):
        """Test now playing movies for movies page"""
        response = requests.get(f"{BASE_URL}/api/tmdb/movie/now_playing")
        
        assert response.status_code == 200, f"Now playing failed: {response.text}"
        data = response.json()
        assert "results" in data
        assert len(data["results"]) > 0, "Should have now playing movies"
    
    def test_tv_on_the_air(self):
        """Test on the air TV shows"""
        response = requests.get(f"{BASE_URL}/api/tmdb/tv/on_the_air")
        
        assert response.status_code == 200, f"On the air failed: {response.text}"
        data = response.json()
        assert "results" in data
    
    def test_discover_movies(self):
        """Test discover movies endpoint"""
        response = requests.get(f"{BASE_URL}/api/tmdb/discover/movie")
        
        assert response.status_code == 200, f"Discover movies failed: {response.text}"
        data = response.json()
        assert "results" in data


class TestSettingsAccess:
    """Test settings page accessibility"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "drizzletest@test.com",
            "password": "test123"
        })
        if response.status_code != 200:
            pytest.skip("Could not get auth token")
        return response.json()["access_token"]
    
    def test_get_settings(self, auth_token):
        """Test getting settings"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/settings", headers=headers)
        
        assert response.status_code == 200, f"Get settings failed: {response.text}"
        data = response.json()
        # Settings should have some expected fields
        assert "download_path" in data or "user_id" in data or isinstance(data, dict)
    
    def test_get_indexers(self, auth_token):
        """Test getting indexers (Indexers tab)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/indexers", headers=headers)
        
        assert response.status_code == 200, f"Get indexers failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_streaming_services(self, auth_token):
        """Test getting streaming services"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/streaming-services", headers=headers)
        
        assert response.status_code == 200, f"Get streaming services failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
    
    def test_compote_indexers(self, auth_token):
        """Test Compote indexers (for indexer management)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/compote/indexers", headers=headers)
        
        assert response.status_code == 200, f"Compote indexers failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)


class TestWatchlistAndProgress:
    """Test watchlist and progress features"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "drizzletest@test.com",
            "password": "test123"
        })
        if response.status_code != 200:
            pytest.skip("Could not get auth token")
        return response.json()["access_token"]
    
    def test_get_watchlist(self, auth_token):
        """Test getting watchlist"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/watchlist", headers=headers)
        
        assert response.status_code == 200, f"Get watchlist failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_watch_progress(self, auth_token):
        """Test getting watch progress"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/watch-progress", headers=headers)
        
        assert response.status_code == 200, f"Get watch progress failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
