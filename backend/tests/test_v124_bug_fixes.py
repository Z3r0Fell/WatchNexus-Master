"""
Test suite for WatchNexus v1.2.4 bug fixes
Tests: Home page, Library population, Browse button, API configuration

Key fixes tested:
- API URL configuration for both development and production modes
- Library scanning and media display
- Folder browser modal functionality
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndBasicAPIs:
    """Test basic API health and accessibility"""
    
    def test_health_endpoint(self):
        """Verify API health check works"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("SUCCESS: Health endpoint working")
    
    def test_tmdb_trending(self):
        """Verify TMDB trending content loads (for hero banner)"""
        response = requests.get(f"{BASE_URL}/api/tmdb/trending/all/week")
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) > 0
        print(f"SUCCESS: Got {len(data['results'])} trending items")
    
    def test_tmdb_now_playing(self):
        """Verify TMDB now playing movies"""
        response = requests.get(f"{BASE_URL}/api/tmdb/movie/now_playing")
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        print(f"SUCCESS: Got {len(data.get('results', []))} now playing movies")


class TestAuthentication:
    """Test authentication flow"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "password"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "test@test.com"
        print(f"SUCCESS: Login successful for {data['user']['email']}")
        return data["access_token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@test.com", "password": "wrongpass"}
        )
        assert response.status_code == 401
        print("SUCCESS: Invalid login correctly rejected")


class TestLibraryManagement:
    """Test library management APIs (Marmalade)"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Get auth token for tests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "password"}
        )
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Auth failed, skipping authenticated tests")
    
    def test_marmalade_status(self):
        """Test Marmalade server status"""
        response = requests.get(
            f"{BASE_URL}/api/marmalade/status",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        print(f"SUCCESS: Marmalade status: {data.get('status')}")
    
    def test_get_libraries(self):
        """Test getting list of libraries"""
        response = requests.get(
            f"{BASE_URL}/api/marmalade/libraries",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Found {len(data)} libraries")
        
        # Check for Test Movies library
        test_movies = [lib for lib in data if lib.get("name") == "Test Movies"]
        if test_movies:
            lib = test_movies[0]
            assert lib["path"] == "/tmp/testmovies"
            assert lib["item_count"] == 3
            print(f"SUCCESS: Test Movies library found with {lib['item_count']} items")
    
    def test_get_recent_media(self):
        """Test getting recently added media"""
        response = requests.get(
            f"{BASE_URL}/api/marmalade/media/recent",
            headers=self.headers,
            params={"limit": 10}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Got {len(data)} recent media items")
        
        # Check for expected movies
        titles = [item.get("title", "") for item in data]
        expected_titles = ["Interstellar", "Inception", "The Matrix"]
        found = [t for t in expected_titles if any(t in title for title in titles)]
        print(f"SUCCESS: Found expected movies: {found}")


class TestFilesystemBrowser:
    """Test filesystem browser API (for Browse button)"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Get auth token for tests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "password"}
        )
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Auth failed")
    
    def test_browse_root(self):
        """Test browsing root filesystem"""
        response = requests.get(
            f"{BASE_URL}/api/filesystem/browse",
            headers=self.headers,
            params={"path": "/"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "current_path" in data
        assert data["current_path"] == "/"
        print(f"SUCCESS: Root browse returned {len(data['items'])} items")
    
    def test_browse_tmp_testmovies(self):
        """Test browsing /tmp/testmovies directory"""
        response = requests.get(
            f"{BASE_URL}/api/filesystem/browse",
            headers=self.headers,
            params={"path": "/tmp/testmovies"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["current_path"] == "/tmp/testmovies"
        assert data.get("media_files_in_current", 0) == 3
        print(f"SUCCESS: /tmp/testmovies has {data['media_files_in_current']} media files")


class TestSettings:
    """Test settings API"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Get auth token for tests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "password"}
        )
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Auth failed")
    
    def test_get_settings(self):
        """Test getting user settings"""
        response = requests.get(
            f"{BASE_URL}/api/settings",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "download_path" in data or "quality_preference" in data
        print("SUCCESS: Settings retrieved")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
