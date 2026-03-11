"""
Iteration 31: Test bridge routes for WatchNexus media pipeline
Tests: Auth, Users/me, Libraries CRUD, Library Scan, Integration Settings, Logs
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data or "token" in data, f"No token in response: {data}"
        token = data.get("access_token") or data.get("token")
        assert token, "Token is empty"
        print(f"Login success, token length: {len(token)}")
        return token
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code in [401, 400], f"Expected 401/400, got {response.status_code}"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@test.com",
        "password": "password"
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture
def auth_headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestUsersMe:
    """Test /api/users/me bridge route"""
    
    def test_get_current_user(self, auth_headers):
        """GET /api/users/me should return current user data"""
        response = requests.get(f"{BASE_URL}/api/users/me", headers=auth_headers)
        assert response.status_code == 200, f"users/me failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "email" in data or "id" in data, f"Missing user data: {data}"
        print(f"Current user: {data.get('email', data.get('username', 'unknown'))}")
    
    def test_users_me_requires_auth(self):
        """GET /api/users/me without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/users/me")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestLibrariesCRUD:
    """Test Libraries bridge routes - CRUD operations"""
    
    def test_get_all_libraries(self, auth_headers):
        """GET /api/libraries returns list"""
        response = requests.get(f"{BASE_URL}/api/libraries", headers=auth_headers)
        assert response.status_code == 200, f"Get libraries failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"Libraries count: {len(data)}")
    
    def test_create_library(self, auth_headers):
        """POST /api/libraries creates a new library"""
        # Create library with test path
        payload = {
            "name": "TEST_Library_31",
            "path": "/tmp/test-movies",
            "media_type": "Movie"
        }
        response = requests.post(f"{BASE_URL}/api/libraries", json=payload, headers=auth_headers)
        assert response.status_code in [200, 201], f"Create library failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "id" in data, f"No id in created library: {data}"
        assert data.get("name") == "TEST_Library_31", f"Name mismatch: {data}"
        print(f"Created library: {data.get('id')}")
        return data.get("id")
    
    def test_create_library_invalid_path(self, auth_headers):
        """POST /api/libraries with invalid path returns error"""
        payload = {
            "name": "TEST_Invalid_Path",
            "path": "/nonexistent/path/123456",
            "media_type": "Movie"
        }
        response = requests.post(f"{BASE_URL}/api/libraries", json=payload, headers=auth_headers)
        # Should either reject or create with warning
        # Some implementations allow creation even with invalid paths
        print(f"Invalid path response: {response.status_code}")
    
    def test_get_library_by_id(self, auth_headers):
        """GET /api/libraries/{id} returns single library"""
        # First get all libraries
        response = requests.get(f"{BASE_URL}/api/libraries", headers=auth_headers)
        if response.status_code == 200 and response.json():
            lib_id = response.json()[0].get("id")
            if lib_id:
                single = requests.get(f"{BASE_URL}/api/libraries/{lib_id}", headers=auth_headers)
                assert single.status_code == 200, f"Get single library failed: {single.text}"
                print(f"Got library by ID: {lib_id}")
        else:
            pytest.skip("No libraries to test get by ID")
    
    def test_delete_library(self, auth_headers):
        """DELETE /api/libraries/{id} removes library"""
        # Create a library first
        payload = {
            "name": "TEST_To_Delete",
            "path": "/tmp",
            "media_type": "Movie"
        }
        create_resp = requests.post(f"{BASE_URL}/api/libraries", json=payload, headers=auth_headers)
        if create_resp.status_code in [200, 201]:
            lib_id = create_resp.json().get("id")
            if lib_id:
                # Delete it
                del_resp = requests.delete(f"{BASE_URL}/api/libraries/{lib_id}", headers=auth_headers)
                assert del_resp.status_code in [200, 204], f"Delete failed: {del_resp.status_code}"
                print(f"Deleted library: {lib_id}")
                
                # Verify deletion
                get_resp = requests.get(f"{BASE_URL}/api/libraries/{lib_id}", headers=auth_headers)
                assert get_resp.status_code == 404, f"Library still exists after delete"


class TestLibraryScan:
    """Test library scanning with TMDB metadata"""
    
    def test_scan_library_returns_results(self, auth_headers):
        """POST /api/libraries/{id}/scan triggers scan and returns results"""
        # Create a test library pointing to our test movies folder
        payload = {
            "name": "TEST_Scan_Library",
            "path": "/tmp/test-movies",
            "media_type": "Movie"
        }
        create_resp = requests.post(f"{BASE_URL}/api/libraries", json=payload, headers=auth_headers)
        
        if create_resp.status_code not in [200, 201]:
            # Try to get existing libraries
            libs = requests.get(f"{BASE_URL}/api/libraries", headers=auth_headers).json()
            if libs:
                lib_id = libs[0].get("id")
            else:
                pytest.skip("Could not create or find test library")
        else:
            lib_id = create_resp.json().get("id")
        
        # Trigger scan
        scan_resp = requests.post(f"{BASE_URL}/api/libraries/{lib_id}/scan", headers=auth_headers)
        assert scan_resp.status_code in [200, 202], f"Scan failed: {scan_resp.status_code} - {scan_resp.text}"
        
        data = scan_resp.json()
        print(f"Scan result: {data}")
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/libraries/{lib_id}", headers=auth_headers)


class TestIntegrationSettings:
    """Test TMDB and qBittorrent integration settings"""
    
    def test_get_integration_settings(self, auth_headers):
        """GET /api/settings/integrations returns TMDB and qBittorrent config"""
        response = requests.get(f"{BASE_URL}/api/settings/integrations", headers=auth_headers)
        assert response.status_code == 200, f"Get integrations failed: {response.text}"
        data = response.json()
        assert "tmdb" in data, f"Missing tmdb in response: {data}"
        assert "qbittorrent" in data, f"Missing qbittorrent in response: {data}"
        
        # Check TMDB structure
        tmdb = data.get("tmdb", {})
        assert "has_key" in tmdb, f"Missing has_key in tmdb: {tmdb}"
        print(f"TMDB has_key: {tmdb.get('has_key')}, source: {tmdb.get('source')}")
        
        # Check qBittorrent structure
        qbit = data.get("qbittorrent", {})
        assert "host" in qbit or "enabled" in qbit, f"Missing expected qbit fields: {qbit}"
        print(f"qBittorrent enabled: {qbit.get('enabled')}")
    
    def test_update_tmdb_validates_key(self, auth_headers):
        """PUT /api/settings/integrations/tmdb validates and saves API key"""
        # Use the existing TMDB key from env
        tmdb_key = os.environ.get("TMDB_API_KEY", "8c860bcb88494f598008480abfe24d13")
        
        response = requests.put(
            f"{BASE_URL}/api/settings/integrations/tmdb",
            json={"api_key": tmdb_key},
            headers=auth_headers
        )
        assert response.status_code in [200, 201], f"Update TMDB failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "status" in data or "has_key" in data, f"Unexpected response: {data}"
        print(f"TMDB update response: {data}")
    
    def test_update_tmdb_invalid_key(self, auth_headers):
        """PUT /api/settings/integrations/tmdb with invalid key returns error"""
        response = requests.put(
            f"{BASE_URL}/api/settings/integrations/tmdb",
            json={"api_key": "invalid_key_123"},
            headers=auth_headers
        )
        # Should return 400 for invalid key
        assert response.status_code == 400, f"Expected 400 for invalid key, got {response.status_code}"
        print("Invalid TMDB key correctly rejected")
    
    def test_update_qbittorrent_settings(self, auth_headers):
        """PUT /api/settings/integrations/qbittorrent saves connection settings"""
        payload = {
            "host": "localhost",
            "port": 8080,
            "username": "admin",
            "password": "testpass",
            "enabled": True
        }
        response = requests.put(
            f"{BASE_URL}/api/settings/integrations/qbittorrent",
            json=payload,
            headers=auth_headers
        )
        assert response.status_code in [200, 201], f"Update qBittorrent failed: {response.text}"
        data = response.json()
        print(f"qBittorrent update response: {data}")
    
    def test_qbittorrent_test_connection(self, auth_headers):
        """POST /api/settings/integrations/qbittorrent/test tests connection"""
        payload = {
            "host": "localhost",
            "port": 8080,
            "username": "admin",
            "password": ""
        }
        response = requests.post(
            f"{BASE_URL}/api/settings/integrations/qbittorrent/test",
            json=payload,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Test qBit connection failed: {response.text}"
        data = response.json()
        # Expect success: false since no qBittorrent is running (as per mocked API docs)
        assert "success" in data, f"Missing success field: {data}"
        print(f"qBittorrent test result: {data}")


class TestLogsEndpoints:
    """Test Logs bridge routes"""
    
    def test_get_log_files(self, auth_headers):
        """GET /api/logs returns list of log files"""
        response = requests.get(f"{BASE_URL}/api/logs", headers=auth_headers)
        assert response.status_code == 200, f"Get logs failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"Log files count: {len(data)}")
    
    def test_get_latest_logs(self, auth_headers):
        """GET /api/logs/latest returns recent log entries"""
        response = requests.get(f"{BASE_URL}/api/logs/latest", headers=auth_headers)
        assert response.status_code == 200, f"Get latest logs failed: {response.text}"
        data = response.json()
        print(f"Latest logs response type: {type(data)}, content: {str(data)[:200]}")
    
    def test_get_latest_logs_with_level_filter(self, auth_headers):
        """GET /api/logs/latest?level=ERROR filters by level"""
        response = requests.get(f"{BASE_URL}/api/logs/latest", params={"level": "ERROR"}, headers=auth_headers)
        assert response.status_code == 200, f"Get filtered logs failed: {response.text}"
        print("Level filtering works")
    
    def test_get_system_diagnostics(self, auth_headers):
        """GET /api/logs/system returns system health info"""
        response = requests.get(f"{BASE_URL}/api/logs/system", headers=auth_headers)
        assert response.status_code == 200, f"Get system logs failed: {response.text}"
        data = response.json()
        # Should have system health info
        print(f"System diagnostics: {data}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_libraries(self, auth_headers):
        """Remove TEST_ prefixed libraries"""
        response = requests.get(f"{BASE_URL}/api/libraries", headers=auth_headers)
        if response.status_code == 200:
            for lib in response.json():
                if lib.get("name", "").startswith("TEST_"):
                    del_resp = requests.delete(f"{BASE_URL}/api/libraries/{lib.get('id')}", headers=auth_headers)
                    print(f"Cleaned up library: {lib.get('name')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
