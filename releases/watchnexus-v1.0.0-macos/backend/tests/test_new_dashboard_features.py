"""
Test suite for WatchNexus new dashboard features:
- Continue Watching section (watch-progress API)
- Next Up section (next-up API)
- Library Settings with Media Management sub-tabs
- Documentation files existence
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
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


class TestWatchProgress:
    """Watch Progress API tests - for Continue Watching section"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    def test_get_watch_progress_requires_auth(self):
        """Test that watch-progress endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/watch-progress")
        assert response.status_code in [401, 403]
    
    def test_get_watch_progress_authenticated(self, auth_headers):
        """Test getting watch progress for authenticated user"""
        response = requests.get(f"{BASE_URL}/api/watch-progress", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_watch_progress(self, auth_headers):
        """Test creating watch progress entry"""
        progress_data = {
            "tmdb_id": 550,  # Fight Club
            "media_type": "movie",
            "title": "Fight Club",
            "poster_path": "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
            "backdrop_path": "/hZkgoQYus5vegHoetLkCJzb17zJ.jpg",
            "progress": 45.5,
            "current_time": 2730,  # 45.5 minutes
            "duration": 6000  # 100 minutes
        }
        response = requests.post(f"{BASE_URL}/api/watch-progress", json=progress_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["tmdb_id"] == 550
        assert data["progress"] == 45.5
        assert data["title"] == "Fight Club"
    
    def test_create_tv_watch_progress(self, auth_headers):
        """Test creating TV show watch progress with season/episode"""
        progress_data = {
            "tmdb_id": 1396,  # Breaking Bad
            "media_type": "tv",
            "title": "Breaking Bad",
            "poster_path": "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
            "backdrop_path": "/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
            "progress": 75.0,
            "current_time": 2700,  # 45 minutes
            "duration": 3600,  # 60 minutes
            "season": 1,
            "episode": 3
        }
        response = requests.post(f"{BASE_URL}/api/watch-progress", json=progress_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["tmdb_id"] == 1396
        assert data["season"] == 1
        assert data["episode"] == 3
    
    def test_verify_watch_progress_persisted(self, auth_headers):
        """Verify watch progress was persisted"""
        response = requests.get(f"{BASE_URL}/api/watch-progress", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have at least the entries we created
        tmdb_ids = [item["tmdb_id"] for item in data]
        assert 550 in tmdb_ids or 1396 in tmdb_ids


class TestNextUp:
    """Next Up API tests - for Next Up section on dashboard"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    def test_get_next_up_requires_auth(self):
        """Test that next-up endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/next-up")
        assert response.status_code in [401, 403]
    
    def test_get_next_up_authenticated(self, auth_headers):
        """Test getting next up for authenticated user"""
        response = requests.get(f"{BASE_URL}/api/next-up", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_next_up_returns_tv_shows_only(self, auth_headers):
        """Test that next-up only returns TV shows (not movies)"""
        # First create a TV show progress
        tv_progress = {
            "tmdb_id": 94997,  # House of the Dragon
            "media_type": "tv",
            "title": "House of the Dragon",
            "progress": 90.0,  # Almost finished - should suggest next episode
            "current_time": 3240,
            "duration": 3600,
            "season": 1,
            "episode": 5
        }
        requests.post(f"{BASE_URL}/api/watch-progress", json=tv_progress, headers=auth_headers)
        
        # Get next up
        response = requests.get(f"{BASE_URL}/api/next-up", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # All items should be TV shows
        for item in data:
            # Next up should have season and episode info
            assert "season" in item
            assert "episode" in item


class TestTMDBEndpoints:
    """TMDB API endpoints tests - for dashboard content"""
    
    def test_get_trending(self):
        """Test trending endpoint for hero banner"""
        response = requests.get(f"{BASE_URL}/api/tmdb/trending/all/week")
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) > 0
    
    def test_get_now_playing(self):
        """Test now playing movies"""
        response = requests.get(f"{BASE_URL}/api/tmdb/movie/now_playing")
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
    
    def test_get_on_the_air(self):
        """Test on the air TV shows"""
        response = requests.get(f"{BASE_URL}/api/tmdb/tv/on_the_air")
        assert response.status_code == 200
        data = response.json()
        assert "results" in data


class TestWatchlist:
    """Watchlist API tests - for My Watchlist section"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    def test_get_watchlist_requires_auth(self):
        """Test that watchlist endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/watchlist")
        assert response.status_code in [401, 403]
    
    def test_get_watchlist_authenticated(self, auth_headers):
        """Test getting watchlist for authenticated user"""
        response = requests.get(f"{BASE_URL}/api/watchlist", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestLibrarySettings:
    """Library Settings API tests - for Sonarr-like Media Management"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    def test_get_libraries(self, auth_headers):
        """Test getting libraries list"""
        response = requests.get(f"{BASE_URL}/api/marmalade/libraries", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_filesystem_browse_requires_auth(self):
        """Test that filesystem browse requires authentication"""
        response = requests.get(f"{BASE_URL}/api/filesystem/browse")
        assert response.status_code in [401, 403]
    
    def test_filesystem_browse_authenticated(self, auth_headers):
        """Test browsing filesystem for library folder selection"""
        response = requests.get(f"{BASE_URL}/api/filesystem/browse", params={"path": "/"}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "current_path" in data
        assert "items" in data
        assert "drives" in data


class TestDocumentation:
    """Documentation files existence tests"""
    
    def test_theme_development_guide_exists(self):
        """Test that THEME-DEVELOPMENT-GUIDE.md exists"""
        import os
        doc_path = "/app/docs/THEME-DEVELOPMENT-GUIDE.md"
        assert os.path.exists(doc_path), f"Documentation file not found: {doc_path}"
        
        # Check file has content
        with open(doc_path, 'r') as f:
            content = f.read()
        assert len(content) > 1000, "Theme development guide seems too short"
        assert "Theme" in content
        assert "CSS" in content or "color" in content.lower()
    
    def test_gadgets_guide_exists(self):
        """Test that GADGETS-GUIDE.md exists"""
        import os
        doc_path = "/app/docs/GADGETS-GUIDE.md"
        assert os.path.exists(doc_path), f"Documentation file not found: {doc_path}"
        
        # Check file has content
        with open(doc_path, 'r') as f:
            content = f.read()
        assert len(content) > 500, "Gadgets guide seems too short"
        assert "Gadget" in content or "Plugin" in content
    
    def test_user_guide_exists(self):
        """Test that USER-GUIDE.md exists"""
        import os
        doc_path = "/app/docs/USER-GUIDE.md"
        assert os.path.exists(doc_path), f"Documentation file not found: {doc_path}"
        
        # Check file has content
        with open(doc_path, 'r') as f:
            content = f.read()
        assert len(content) > 1000, "User guide seems too short"
        assert "WatchNexus" in content


class TestSettings:
    """Settings API tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    def test_get_settings(self, auth_headers):
        """Test getting user settings"""
        response = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "download_path" in data or "library_path" in data or "quality_preference" in data
    
    def test_update_settings(self, auth_headers):
        """Test updating user settings"""
        settings_data = {
            "download_path": "/media/downloads",
            "library_path": "/media/library",
            "quality_preference": "1080p"
        }
        response = requests.put(f"{BASE_URL}/api/settings", json=settings_data, headers=auth_headers)
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
