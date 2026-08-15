"""
WatchNexus Backend API Tests
Tests core authentication, libraries, filesystem browsing, health, and settings endpoints
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    pytest.skip("REACT_APP_BACKEND_URL not set", allow_module_level=True)

TEST_EMAIL = os.environ.get('TEST_EMAIL', '')
TEST_PASSWORD = os.environ.get('TEST_PASSWORD', '')
if not TEST_EMAIL or not TEST_PASSWORD:
    pytest.skip("TEST_EMAIL and TEST_PASSWORD required", allow_module_level=True)

class TestHealth:
    """Health endpoint tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        assert "version" in data
        print(f"Health check passed - version: {data.get('version')}")


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user data in response"
        print(f"Login successful for user: {data['user'].get('Email', data['user'].get('email'))}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("Invalid credentials correctly rejected")
    
    def test_auth_me_requires_token(self):
        """Test /api/auth/me requires authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("/api/auth/me correctly requires authentication")


@pytest.fixture
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Could not authenticate: {response.text}")
    return response.json()["access_token"]


@pytest.fixture
def auth_headers(auth_token):
    """Get auth headers for authenticated requests"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestLibraries:
    """Library CRUD endpoint tests"""
    
    def test_get_libraries_empty(self, auth_headers):
        """Test /api/libraries returns list (may be empty)"""
        response = requests.get(f"{BASE_URL}/api/libraries", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Libraries endpoint returned {len(data)} libraries")
    
    def test_create_library_and_verify(self, auth_headers):
        """Test creating a library and verifying persistence"""
        # Create library
        create_payload = {
            "Name": "TEST_TestLibrary",
            "Path": "/tmp/test_media",
            "MediaType": "movies"
        }
        response = requests.post(f"{BASE_URL}/api/libraries", json=create_payload, headers=auth_headers)
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data.get("name") == "TEST_TestLibrary"
        lib_id = data["id"]
        print(f"Created library with id: {lib_id}")
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/libraries/{lib_id}", headers=auth_headers)
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched.get("name") == "TEST_TestLibrary"
        print(f"Verified library persistence: {fetched.get('name')}")
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/libraries/{lib_id}", headers=auth_headers)
        assert delete_response.status_code == 200
        print(f"Cleaned up test library: {lib_id}")


class TestFilesystemBrowse:
    """Filesystem browsing endpoint tests - critical for folder browsing feature"""
    
    def test_filesystem_browse_default(self, auth_headers):
        """Test /api/filesystem/browse returns directory listing"""
        response = requests.get(f"{BASE_URL}/api/filesystem/browse", headers=auth_headers)
        assert response.status_code == 200, f"Filesystem browse failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "current_path" in data, "Missing current_path in response"
        assert "items" in data, "Missing items in response"
        assert "drives" in data, "Missing drives in response"
        assert "os_type" in data, "Missing os_type in response"
        assert isinstance(data["items"], list), "items should be a list"
        
        print(f"Filesystem browse successful - current_path: {data.get('current_path')}")
        print(f"OS type: {data.get('os_type')}, Items: {len(data.get('items', []))}, Drives: {len(data.get('drives', []))}")
    
    def test_filesystem_browse_with_path(self, auth_headers):
        """Test /api/filesystem/browse with specific path"""
        response = requests.get(f"{BASE_URL}/api/filesystem/browse", 
                                params={"path": "/tmp"}, 
                                headers=auth_headers)
        assert response.status_code == 200, f"Browse /tmp failed: {response.text}"
        data = response.json()
        assert data.get("current_path") == "/tmp" or "/tmp" in data.get("current_path", "")
        print(f"Browse /tmp successful - items: {len(data.get('items', []))}")
    
    def test_filesystem_browse_invalid_path(self, auth_headers):
        """Test /api/filesystem/browse with invalid path returns error"""
        response = requests.get(f"{BASE_URL}/api/filesystem/browse", 
                                params={"path": "/nonexistent_path_12345"}, 
                                headers=auth_headers)
        assert response.status_code == 400, f"Expected 400 for invalid path, got {response.status_code}"
        print("Invalid path correctly returns 400 error")


class TestSettings:
    """Settings endpoint tests"""
    
    def test_get_settings(self, auth_headers):
        """Test /api/settings returns settings dict"""
        response = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"Settings endpoint returned {len(data)} settings")
    
    def test_user_preferences_get(self, auth_headers):
        """Test /api/user/preferences returns user prefs"""
        response = requests.get(f"{BASE_URL}/api/user/preferences", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "visible_tabs" in data
        print(f"User preferences returned - visible_tabs count: {len(data.get('visible_tabs', []))}")


class TestDashboard:
    """Dashboard endpoint tests"""
    
    def test_dashboard_data(self, auth_headers):
        """Test /api/dashboard returns stats"""
        response = requests.get(f"{BASE_URL}/api/dashboard", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_libraries" in data
        assert "total_media" in data
        print(f"Dashboard - Libraries: {data.get('total_libraries')}, Media: {data.get('total_media')}")


class TestSecurityEndpoints:
    """Security endpoint tests"""
    
    def test_security_stats(self, auth_headers):
        """Test /api/security/stats returns security stats"""
        response = requests.get(f"{BASE_URL}/api/security/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_audit_logs" in data
        assert "ip_rules_count" in data
        print(f"Security stats - Audit logs: {data.get('total_audit_logs')}, IP rules: {data.get('ip_rules_count')}")


class TestVpnEndpoints:
    """VPN endpoint tests (mock responses expected)"""
    
    def test_vpn_server_config(self, auth_headers):
        """Test /api/vpn/server returns VPN config"""
        response = requests.get(f"{BASE_URL}/api/vpn/server", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "listenPort" in data or "listen_port" in data or "ListenPort" in data
        print(f"VPN server config retrieved - port: {data.get('listenPort', data.get('listen_port', data.get('ListenPort')))}")


class TestMarmalade:
    """Marmalade (library bridge) endpoint tests"""
    
    def test_marmalade_libraries(self, auth_headers):
        """Test /api/marmalade/libraries returns libraries"""
        response = requests.get(f"{BASE_URL}/api/marmalade/libraries", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Marmalade libraries: {len(data)}")
    
    def test_marmalade_stats(self, auth_headers):
        """Test /api/marmalade/stats returns stats"""
        response = requests.get(f"{BASE_URL}/api/marmalade/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_libraries" in data
        print(f"Marmalade stats - total_libraries: {data.get('total_libraries')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
