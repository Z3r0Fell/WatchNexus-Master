"""
Test WatchNexus Settings Page and Plugin Adapter APIs
Testing: 
- Auth flow with test@test.com / password
- Settings page related endpoints
- Plugin Adapter endpoints (/api/adapter/*)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthFlow:
    """Test authentication flow"""
    
    def test_login_success(self):
        """Test login with test credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        print(f"Login response status: {response.status_code}")
        print(f"Login response: {response.json()}")
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "test@test.com"
        return data["access_token"]

    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@test.com",
            "password": "wrongpassword"
        })
        print(f"Invalid login response status: {response.status_code}")
        assert response.status_code == 401


class TestAdapterEndpoints:
    """Test Plugin Adapter API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Setup authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_adapter_supported_ecosystems(self):
        """GET /api/adapter/supported - returns list of supported ecosystems"""
        response = requests.get(f"{BASE_URL}/api/adapter/supported")
        print(f"Adapter supported response status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        assert response.status_code == 200
        data = response.json()
        assert "ecosystems" in data
        assert len(data["ecosystems"]) >= 3
        
        ecosystem_ids = [eco["id"] for eco in data["ecosystems"]]
        assert "kodi" in ecosystem_ids
        assert "jellyfin" in ecosystem_ids
        assert "plex" in ecosystem_ids
        
        # Check ecosystem details
        for eco in data["ecosystems"]:
            assert "id" in eco
            assert "name" in eco
            assert "description" in eco
            print(f"  - {eco['name']}: {eco['description']}")
    
    def test_adapter_convert_no_file(self):
        """POST /api/adapter/convert - requires file"""
        response = requests.post(
            f"{BASE_URL}/api/adapter/convert",
            headers=self.headers
        )
        print(f"Adapter convert (no file) response status: {response.status_code}")
        # Should fail with 422 (validation error) or 400 (bad request)
        assert response.status_code in [400, 422]
    
    def test_adapter_convert_requires_auth(self):
        """POST /api/adapter/convert - requires authentication"""
        # Create a dummy file
        files = {'file': ('test.txt', b'not a zip file', 'text/plain')}
        response = requests.post(
            f"{BASE_URL}/api/adapter/convert",
            files=files
            # No auth header
        )
        print(f"Adapter convert (no auth) response status: {response.status_code}")
        assert response.status_code in [401, 403]
    
    def test_adapter_convert_invalid_file_type(self):
        """POST /api/adapter/convert - rejects non-ZIP files"""
        files = {'file': ('test.txt', b'not a zip file', 'text/plain')}
        response = requests.post(
            f"{BASE_URL}/api/adapter/convert",
            files=files,
            headers=self.headers
        )
        print(f"Adapter convert (invalid file) response status: {response.status_code}")
        print(f"Response: {response.text}")
        assert response.status_code == 400
        assert "ZIP" in response.text or "zip" in response.text


class TestSettingsRelatedEndpoints:
    """Test settings page related endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Setup authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_get_settings(self):
        """GET /api/settings - returns user settings"""
        response = requests.get(
            f"{BASE_URL}/api/settings",
            headers=self.headers
        )
        print(f"Get settings response status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        # Should have standard settings fields
        assert "download_path" in data or "quality_preference" in data
    
    def test_get_users(self):
        """GET /api/users - returns users list"""
        response = requests.get(
            f"{BASE_URL}/api/users",
            headers=self.headers
        )
        print(f"Get users response status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_indexers(self):
        """GET /api/indexers - returns indexers config"""
        response = requests.get(
            f"{BASE_URL}/api/indexers",
            headers=self.headers
        )
        print(f"Get indexers response status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_streaming_services(self):
        """GET /api/streaming-services - returns streaming services"""
        response = requests.get(
            f"{BASE_URL}/api/streaming-services",
            headers=self.headers
        )
        print(f"Get streaming services response status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_theme_forge_api(self):
        """GET /api/milk/themes - returns theme settings (Theme Forge tab)"""
        response = requests.get(
            f"{BASE_URL}/api/milk/themes",
            headers=self.headers
        )
        print(f"Theme forge response status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert "built_in" in data or "custom" in data
    
    def test_plugins_api(self):
        """GET /api/gadgets/plugins - returns plugins (Plugins tab)"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/plugins",
            headers=self.headers
        )
        print(f"Plugins response status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_iptv_stats(self):
        """GET /api/iptv/stats - returns IPTV stats (IPTV tab)"""
        response = requests.get(
            f"{BASE_URL}/api/iptv/stats",
            headers=self.headers
        )
        print(f"IPTV stats response status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        # Should return stats object
        assert "total_sources" in data or "total_channels" in data


class TestMeEndpoint:
    """Test authentication me endpoint"""
    
    def test_me_requires_auth(self):
        """GET /api/auth/me - requires authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403]
    
    def test_me_with_auth(self):
        """GET /api/auth/me - returns user info"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        
        token = login_response.json().get("access_token")
        
        # Then get me
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        print(f"Me response status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert data["email"] == "test@test.com"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
