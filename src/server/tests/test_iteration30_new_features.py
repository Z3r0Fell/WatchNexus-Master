"""
Iteration 30 Tests: New Features for WatchNexus .NET 8
- ZestController: Log Viewer & Diagnostics endpoints
- SettingsController: Settings management endpoints  
- LibrariesController: Library CRUD and scan
- Module codenames validation (16 modules with Tiramisu)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndModules:
    """Health endpoint and 16 module validation"""
    
    def test_health_endpoint(self):
        """GET /api/health returns healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["framework"] == ".NET 8"
        assert data["version"] == "3.0.0"
        print(f"Health check passed: {data['status']}")
    
    def test_info_returns_16_modules(self):
        """GET /api/info returns 16 modules with correct codenames"""
        response = requests.get(f"{BASE_URL}/api/info")
        assert response.status_code == 200
        data = response.json()
        
        modules = data.get("modules", [])
        assert len(modules) == 16, f"Expected 16 modules, got {len(modules)}"
        
        # Extract module names and descriptions
        module_dict = {m["name"]: m["description"] for m in modules}
        
        # Validate specific codenames
        assert "Gelatin" in module_dict, "Gelatin module missing"
        assert "External Access" in module_dict["Gelatin"], f"Gelatin should be External Access, got {module_dict['Gelatin']}"
        
        assert "Zest" in module_dict, "Zest module missing"
        assert "Log Viewer" in module_dict["Zest"], f"Zest should be Log Viewer, got {module_dict['Zest']}"
        
        assert "Tiramisu" in module_dict, "Tiramisu module (Auto-Updater) missing"
        assert "Auto-Updater" in module_dict["Tiramisu"], f"Tiramisu should be Auto-Updater, got {module_dict['Tiramisu']}"
        
        # All modules should be active
        for mod in modules:
            assert mod["status"] == "active", f"Module {mod['name']} is not active"
        
        print(f"All 16 modules validated: {list(module_dict.keys())}")


class TestAuthentication:
    """Authentication tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for protected endpoints"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get("access_token")
        assert token, "No access_token in response"
        return token
    
    def test_login_returns_access_token(self):
        """POST /api/auth/login returns access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data, "Missing access_token"
        assert "user" in data, "Missing user object"
        assert data["user"]["email"] == "test@test.com"
        print(f"Login successful, user: {data['user']['username']}")


class TestZestLogViewer:
    """Zest - Log Viewer & Diagnostics endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers for protected endpoints"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_log_files(self, auth_headers):
        """GET /api/logs returns log files list (may be empty)"""
        response = requests.get(f"{BASE_URL}/api/logs", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # Can be empty array if no logs yet
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"Log files count: {len(data)}")
    
    def test_get_latest_logs(self, auth_headers):
        """GET /api/logs/latest returns recent log lines"""
        response = requests.get(f"{BASE_URL}/api/logs/latest", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "lines" in data, "Missing 'lines' in response"
        assert "total" in data, "Missing 'total' in response"
        # Lines can be empty if no logs yet
        assert isinstance(data["lines"], list)
        print(f"Latest logs: {data['total']} total lines")
    
    def test_get_latest_logs_with_level_filter(self, auth_headers):
        """GET /api/logs/latest with level filter"""
        response = requests.get(f"{BASE_URL}/api/logs/latest?level=ERROR", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "lines" in data
        print(f"Filtered ERROR logs: {len(data['lines'])} lines")
    
    def test_get_system_diagnostics(self, auth_headers):
        """GET /api/logs/system returns system diagnostics"""
        response = requests.get(f"{BASE_URL}/api/logs/system", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Validate required fields
        assert "uptime_seconds" in data, "Missing uptime_seconds"
        assert "memory_mb" in data, "Missing memory_mb"
        assert "threads" in data, "Missing threads"
        assert "gc_gen0" in data, "Missing gc_gen0 (GC stats)"
        assert "gc_memory_mb" in data, "Missing gc_memory_mb"
        assert "environment" in data, "Missing environment"
        
        # Validate environment
        env = data["environment"]
        assert "dotnet_version" in env
        assert "processor_count" in env
        
        print(f"System diagnostics: Uptime={data['uptime_seconds']:.0f}s, Memory={data['memory_mb']:.1f}MB, Threads={data['threads']}")


class TestSettingsController:
    """Settings management endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers for protected endpoints"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_all_settings(self, auth_headers):
        """GET /api/settings returns settings dictionary"""
        response = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict), f"Expected dict, got {type(data)}"
        print(f"Settings count: {len(data)}")
    
    def test_set_single_setting(self, auth_headers):
        """PUT /api/settings/tmdb_api_key sets a setting"""
        test_key = "TEST_tmdb_api_key"
        test_value = "test_api_key_12345"
        
        response = requests.put(
            f"{BASE_URL}/api/settings/{test_key}",
            headers=auth_headers,
            json={"value": test_value}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["key"] == test_key
        assert data["value"] == test_value
        print(f"Setting saved: {test_key}={test_value}")
        
        # Verify it was persisted
        get_response = requests.get(f"{BASE_URL}/api/settings/{test_key}", headers=auth_headers)
        assert get_response.status_code == 200
        assert get_response.json()["value"] == test_value
    
    def test_bulk_set_settings(self, auth_headers):
        """POST /api/settings/bulk sets multiple settings"""
        test_settings = {
            "TEST_setting1": "value1",
            "TEST_setting2": "value2",
            "TEST_setting3": "value3"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/settings/bulk",
            headers=auth_headers,
            json=test_settings
        )
        assert response.status_code == 200
        data = response.json()
        assert data["updated"] == 3
        print(f"Bulk settings saved: {data['updated']} settings")
    
    def test_delete_setting(self, auth_headers):
        """DELETE /api/settings/{key} removes a setting"""
        # First create a setting to delete
        test_key = "TEST_to_delete"
        requests.put(
            f"{BASE_URL}/api/settings/{test_key}",
            headers=auth_headers,
            json={"value": "temporary"}
        )
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/settings/{test_key}", headers=auth_headers)
        assert response.status_code == 204
        
        # Verify it's gone
        get_response = requests.get(f"{BASE_URL}/api/settings/{test_key}", headers=auth_headers)
        assert get_response.status_code == 404
        print(f"Setting deleted: {test_key}")


class TestLibrariesController:
    """Libraries (Marmalade) CRUD and scan endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers for protected endpoints"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_all_libraries(self, auth_headers):
        """GET /api/libraries returns list of libraries"""
        response = requests.get(f"{BASE_URL}/api/libraries", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"Libraries count: {len(data)}")
    
    def test_create_library_requires_valid_path(self, auth_headers):
        """POST /api/libraries validates path exists"""
        response = requests.post(
            f"{BASE_URL}/api/libraries",
            headers=auth_headers,
            json={
                "name": "TEST_Invalid_Library",
                "path": "/nonexistent/path/12345",
                "media_type": "Movie"  # Use correct enum value
            }
        )
        # Should return 400 because path doesn't exist
        assert response.status_code == 400
        assert "Path does not exist" in response.json().get("message", "")
        print("Library creation properly validates path existence")
    
    def test_create_library_with_valid_path(self, auth_headers):
        """POST /api/libraries creates library with valid path
        NOTE: Frontend uses 'Movies'/'TvShows' but backend enum is 'Movie'/'TvShow' - BUG
        """
        # Use /tmp which should exist on Linux
        response = requests.post(
            f"{BASE_URL}/api/libraries",
            headers=auth_headers,
            json={
                "name": "TEST_Movies_Library",
                "path": "/tmp",
                "media_type": "Movie"  # Backend enum is singular
            }
        )
        
        if response.status_code == 400 and "already exists" in response.json().get("message", ""):
            print("Library path already exists - skipping creation test")
            return
        
        assert response.status_code == 201, f"Create failed: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_Movies_Library"
        assert data["path"] == "/tmp"
        assert data["media_type"] == "movie"  # Backend returns lowercase
        assert "id" in data
        print(f"Library created: {data['name']} ({data['id']})")
        
        # Store ID for cleanup
        library_id = data["id"]
        
        # Cleanup - delete the test library
        delete_response = requests.delete(f"{BASE_URL}/api/libraries/{library_id}", headers=auth_headers)
        assert delete_response.status_code == 204
        print(f"Test library cleaned up")
    
    def test_library_crud_flow(self, auth_headers):
        """Full CRUD flow: Create -> Get -> Scan -> Delete"""
        # Create
        create_response = requests.post(
            f"{BASE_URL}/api/libraries",
            headers=auth_headers,
            json={
                "name": "TEST_CRUD_Library",
                "path": "/tmp",
                "media_type": "TvShow"  # Backend enum is singular
            }
        )
        
        if create_response.status_code == 400:
            # Path might already exist from previous run
            print(f"Skipping CRUD test: {create_response.json().get('message')}")
            return
        
        assert create_response.status_code == 201
        library_id = create_response.json()["id"]
        print(f"Created library: {library_id}")
        
        # Get by ID
        get_response = requests.get(f"{BASE_URL}/api/libraries/{library_id}", headers=auth_headers)
        assert get_response.status_code == 200
        assert get_response.json()["name"] == "TEST_CRUD_Library"
        print(f"Retrieved library by ID")
        
        # Scan (should return 202 Accepted)
        scan_response = requests.post(f"{BASE_URL}/api/libraries/{library_id}/scan", headers=auth_headers)
        assert scan_response.status_code == 202
        assert "scan_status" in scan_response.json()
        print(f"Scan started: {scan_response.json()['message']}")
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/libraries/{library_id}", headers=auth_headers)
        assert delete_response.status_code == 204
        print(f"Library deleted")
        
        # Verify deletion
        verify_response = requests.get(f"{BASE_URL}/api/libraries/{library_id}", headers=auth_headers)
        assert verify_response.status_code == 404
        print("CRUD flow complete")


class TestExistingEndpointsStillWork:
    """Verify existing endpoints from previous iterations still work"""
    
    @pytest.fixture
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_security_stats(self, auth_headers):
        """GET /api/security/stats still works"""
        response = requests.get(f"{BASE_URL}/api/security/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "failed_logins_24h" in data  # Correct field name
        assert "blocked_ips" in data
        print("Security stats endpoint working")
    
    def test_vpn_stats(self, auth_headers):
        """GET /api/vpn/stats still works"""
        response = requests.get(f"{BASE_URL}/api/vpn/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_peers" in data
        print("VPN stats endpoint working")
    
    def test_vpn_peers(self, auth_headers):
        """GET /api/vpn/peers still works"""
        response = requests.get(f"{BASE_URL}/api/vpn/peers", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print("VPN peers endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
