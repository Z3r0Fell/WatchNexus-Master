"""
WatchNexus Iteration 34 - Marketplace Feature Testing
Tests:
- Backend API /api/system/info
- Auth flow POST /api/auth/login
- Marketplace API: GET /api/gadgets/catalogue/categories
- Marketplace API: GET /api/gadgets/catalogue/search
- Marketplace API: GET /api/gadgets/plugins
- Kodi API: GET /api/kodi/categories
- Database reset API: POST /api/db/reset
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://media-pipeline-demo.preview.emergentagent.com').rstrip('/')

class TestSystemInfo:
    """System info endpoint tests"""
    
    def test_system_info_returns_app_info(self):
        """Test /api/system/info responds with app info"""
        response = requests.get(f"{BASE_URL}/api/system/info")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # Should have app_name and version
        assert "app_name" in data or "version" in data, f"Expected app info, got: {data}"
        print(f"✓ System info: {data}")


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_login_with_valid_credentials(self):
        """Test POST /api/auth/login with email=test@test.com password=password returns access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "access_token" in data, f"Expected access_token in response, got: {data}"
        assert "user" in data, f"Expected user in response, got: {data}"
        print(f"✓ Login successful, got access_token and user: {data.get('user', {}).get('email')}")
        return data["access_token"]
    
    def test_login_with_invalid_credentials(self):
        """Test login with wrong password returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401 for invalid credentials, got {response.status_code}"
        print("✓ Login with invalid credentials correctly returns 401")


class TestMarketplaceAPI:
    """Marketplace/Gadgets API tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code != 200:
            pytest.skip("Could not authenticate")
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_gadgets_catalogue_categories(self, auth_headers):
        """Test GET /api/gadgets/catalogue/categories returns categories with counts"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/catalogue/categories",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # Should be a dict with category keys containing count/label
        assert isinstance(data, dict), f"Expected dict, got: {type(data)}"
        print(f"✓ Gadgets catalogue categories: {len(data)} categories")
        if data:
            # Check structure of first category
            first_cat = list(data.keys())[0]
            cat_data = data[first_cat]
            print(f"  Sample category '{first_cat}': {cat_data}")
    
    def test_gadgets_catalogue_search(self, auth_headers):
        """Test GET /api/gadgets/catalogue/search returns items array"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/catalogue/search",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # Should have items array
        assert "items" in data, f"Expected 'items' in response, got: {data.keys()}"
        assert isinstance(data["items"], list), f"Expected items to be list, got: {type(data['items'])}"
        print(f"✓ Gadgets catalogue search: {len(data['items'])} items")
        if data["items"]:
            print(f"  Sample item: {data['items'][0].get('name', data['items'][0])}")
    
    def test_gadgets_catalogue_search_with_query(self, auth_headers):
        """Test gadgets catalogue search with a query parameter"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/catalogue/search?q=weather",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "items" in data, f"Expected 'items' in response"
        print(f"✓ Gadgets search for 'weather': {len(data['items'])} results")
    
    def test_gadgets_plugins_list(self, auth_headers):
        """Test GET /api/gadgets/plugins returns installed plugins array"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/plugins",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # Should be a list of installed plugins
        assert isinstance(data, list), f"Expected list, got: {type(data)}"
        print(f"✓ Installed plugins: {len(data)} plugins")
        for plugin in data[:3]:  # Show first 3
            print(f"  - {plugin.get('name', plugin.get('id', plugin))}")


class TestKodiAPI:
    """Kodi Repository API tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code != 200:
            pytest.skip("Could not authenticate")
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_kodi_categories(self, auth_headers):
        """Test GET /api/kodi/categories returns categories object"""
        response = requests.get(
            f"{BASE_URL}/api/kodi/categories",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # Should have categories
        assert "categories" in data, f"Expected 'categories' in response, got: {data.keys()}"
        print(f"✓ Kodi categories: {len(data['categories'])} categories")
        if data["categories"]:
            # Show a few categories
            cats = list(data["categories"].items())[:5]
            for cat, count in cats:
                print(f"  - {cat}: {count} addons")


class TestDatabaseReset:
    """Database reset API tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code != 200:
            pytest.skip("Could not authenticate")
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_db_reset_endpoint_exists(self, auth_headers):
        """Test POST /api/db/reset endpoint exists and is authenticated"""
        response = requests.post(
            f"{BASE_URL}/api/db/reset",
            headers=auth_headers
        )
        # Should return 200 or some valid response (not 404)
        assert response.status_code != 404, f"Endpoint /api/db/reset not found"
        print(f"✓ DB reset endpoint exists, status: {response.status_code}")
        if response.status_code == 200:
            print(f"  Response: {response.json()}")


class TestHealthCheck:
    """Health check tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("status") == "healthy", f"Expected healthy status, got: {data}"
        print(f"✓ Health check: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
