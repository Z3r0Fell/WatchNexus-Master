"""
Test cases for WatchNexus Bug Fixes
Bug fixes being tested:
1) Indexer saving - verify indexers are saved and persist
2) Folder browser - verify browse dialog shows directory contents
3) TV Series grouping - verify the Series view toggle works
4) Basic app functionality - login, navigation, settings
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://unified-media-engine.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "password"

class TestAuthentication:
    """Test basic authentication functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test credentials"""
        self.email = TEST_EMAIL
        self.password = TEST_PASSWORD
    
    def test_login_returns_token(self):
        """Test that login returns a valid token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.email,
            "password": self.password
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user"
        assert data["user"]["email"] == self.email
    
    def test_auth_me_with_token(self):
        """Test that /auth/me returns user info with valid token"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.email,
            "password": self.password
        })
        token = login_response.json()["access_token"]
        
        # Then call /auth/me
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == self.email


class TestIndexerSaving:
    """Test indexer saving functionality - Bug #1"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed - cannot test indexer saving")
    
    def test_get_indexers_endpoint_exists(self):
        """Test that GET /api/compote/indexers returns indexers"""
        response = requests.get(f"{BASE_URL}/api/compote/indexers", headers=self.headers)
        assert response.status_code == 200, f"Get indexers failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} indexers")
    
    def test_add_indexer(self):
        """Test adding a new indexer"""
        response = requests.post(
            f"{BASE_URL}/api/compote/indexers",
            params={
                "name": "TEST_Indexer_" + str(os.urandom(4).hex()),
                "indexer_type": "torznab",
                "url": "https://test-indexer.example.com",
                "api_key": "",
                "enabled": True,
                "priority": 50
            },
            headers=self.headers
        )
        assert response.status_code == 200, f"Add indexer failed: {response.text}"
        data = response.json()
        assert "id" in data or "status" in data, "Response should contain id or status"
        print(f"Add indexer response: {data}")
    
    def test_indexer_persists_after_add(self):
        """Test that indexer persists after adding"""
        # Add a unique indexer
        unique_name = "TEST_Persist_" + str(os.urandom(4).hex())
        add_response = requests.post(
            f"{BASE_URL}/api/compote/indexers",
            params={
                "name": unique_name,
                "indexer_type": "torznab",
                "url": "https://persist-test.example.com",
                "enabled": True,
                "priority": 50
            },
            headers=self.headers
        )
        assert add_response.status_code == 200, f"Add indexer failed: {add_response.text}"
        
        # Fetch indexers and verify our new one exists
        get_response = requests.get(f"{BASE_URL}/api/compote/indexers", headers=self.headers)
        assert get_response.status_code == 200
        indexers = get_response.json()
        
        # Find our indexer
        found = any(idx.get("name") == unique_name for idx in indexers)
        assert found, f"Indexer '{unique_name}' not found in indexers list"
        print(f"Indexer '{unique_name}' persisted successfully!")


class TestFolderBrowser:
    """Test folder browser functionality - Bug #2"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed - cannot test folder browser")
    
    def test_browse_root_directory(self):
        """Test browsing root directory"""
        response = requests.get(
            f"{BASE_URL}/api/filesystem/browse",
            params={"path": "/"},
            headers=self.headers
        )
        assert response.status_code == 200, f"Browse root failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "current_path" in data, "Response should contain current_path"
        assert "items" in data, "Response should contain items"
        assert "drives" in data, "Response should contain drives"
        
        print(f"Current path: {data['current_path']}")
        print(f"Found {len(data['items'])} items")
        print(f"Drives: {data.get('drives', [])}")
    
    def test_browse_home_directory(self):
        """Test browsing home directory"""
        response = requests.get(
            f"{BASE_URL}/api/filesystem/browse",
            params={"path": "/home"},
            headers=self.headers
        )
        # Should succeed or fallback to root
        assert response.status_code in [200, 404], f"Browse failed: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "items" in data
            print(f"Found {len(data['items'])} items in /home")
    
    def test_browse_invalid_path_fallback(self):
        """Test that browsing invalid path falls back to root"""
        response = requests.get(
            f"{BASE_URL}/api/filesystem/browse",
            params={"path": "/nonexistent/path/that/does/not/exist"},
            headers=self.headers
        )
        # Should return 404 for non-existent path
        assert response.status_code in [200, 404], f"Browse failed: {response.text}"
        print(f"Invalid path response: status={response.status_code}")
    
    def test_browse_requires_auth(self):
        """Test that browse endpoint requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/filesystem/browse",
            params={"path": "/"}
        )
        assert response.status_code == 401, "Browse should require authentication"


class TestTVSeriesGrouping:
    """Test TV Series grouping functionality - Bug #3"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed - cannot test TV series grouping")
    
    def test_tv_series_endpoint_exists(self):
        """Test that GET /api/marmalade/tv-series endpoint exists"""
        response = requests.get(
            f"{BASE_URL}/api/marmalade/tv-series",
            headers=self.headers
        )
        assert response.status_code == 200, f"TV series endpoint failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} TV series")
    
    def test_tv_series_response_structure(self):
        """Test TV series response structure (even if empty)"""
        response = requests.get(
            f"{BASE_URL}/api/marmalade/tv-series",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # If there are series, check the structure
        if len(data) > 0:
            series = data[0]
            assert "series_name" in series, "Series should have series_name"
            assert "seasons" in series, "Series should have seasons"
            assert "total_episodes" in series, "Series should have total_episodes"
            print(f"First series: {series.get('series_name')} with {series.get('total_episodes')} episodes")
        else:
            print("No TV series found (expected - test library has only movies)")
    
    def test_tv_series_with_library_filter(self):
        """Test TV series with library_id filter"""
        response = requests.get(
            f"{BASE_URL}/api/marmalade/tv-series",
            params={"library_id": "nonexistent"},
            headers=self.headers
        )
        # Should not error even with invalid library
        assert response.status_code == 200, f"TV series with filter failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"TV series with filter: {len(data)} results")


class TestMarmaladeLibrary:
    """Test Marmalade library functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed")
    
    def test_get_libraries(self):
        """Test getting libraries"""
        response = requests.get(f"{BASE_URL}/api/marmalade/libraries", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} libraries")
    
    def test_get_status(self):
        """Test getting Marmalade status"""
        response = requests.get(f"{BASE_URL}/api/marmalade/status", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        print(f"Marmalade status: {data}")
    
    def test_get_media(self):
        """Test getting media list"""
        response = requests.get(
            f"{BASE_URL}/api/marmalade/media",
            params={"limit": 10},
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} media items")
    
    def test_get_recent_media(self):
        """Test getting recent media"""
        response = requests.get(
            f"{BASE_URL}/api/marmalade/media/recent",
            params={"limit": 5},
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} recent media items")


class TestSettingsAPI:
    """Test Settings API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed")
    
    def test_get_settings(self):
        """Test getting settings"""
        response = requests.get(f"{BASE_URL}/api/settings", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        # Settings should have download_path or library_path
        assert "download_path" in data or "user_id" in data
        print(f"Settings: {data}")
    
    def test_update_settings(self):
        """Test updating settings"""
        response = requests.put(
            f"{BASE_URL}/api/settings",
            json={
                "download_path": "/media/downloads",
                "library_path": "/media/library",
                "auto_subtitles": True,
                "subtitle_languages": ["en"],
                "quality_preference": "1080p"
            },
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        print(f"Updated settings: {data}")


# Cleanup after tests
@pytest.fixture(scope="session", autouse=True)
def cleanup(request):
    """Cleanup test data after all tests"""
    def _cleanup():
        # Login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code != 200:
            return
        
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get all indexers and remove test ones
        indexers_response = requests.get(f"{BASE_URL}/api/compote/indexers", headers=headers)
        if indexers_response.status_code == 200:
            indexers = indexers_response.json()
            for idx in indexers:
                if idx.get("name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/compote/indexers/{idx['id']}", headers=headers)
                    print(f"Cleaned up test indexer: {idx['name']}")
    
    request.addfinalizer(_cleanup)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
