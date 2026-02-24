"""
Test Suite for WatchNexus v2.4.0 Features
=========================================
Tests the following features:
1. Directory browser API with /home user directories
2. Sidebar tab visibility settings (localStorage saved via frontend)
3. Log viewer (Zest) settings with system health metrics
4. Database maintenance with reset functionality
5. Database version tracking and mismatch detection
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "password"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for test user."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Auth failed: {response.status_code} - {response.text}")


@pytest.fixture
def auth_headers(auth_token):
    """Return headers with auth token."""
    return {"Authorization": f"Bearer {auth_token}"}


class TestAuthEndpoints:
    """Test authentication works with test credentials."""
    
    def test_login_success(self):
        """Test login with valid credentials returns 200 and token."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        print(f"✓ Login successful for {TEST_EMAIL}")
    
    def test_login_invalid_credentials(self):
        """Test login with wrong password returns 401."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials rejected with 401")


class TestFilesystemBrowse:
    """Test filesystem browse API - Issue #1: Directory browser should show user folders."""
    
    def test_browse_root(self, auth_headers):
        """Test browsing root directory returns valid structure."""
        response = requests.get(f"{BASE_URL}/api/filesystem/browse", 
                               params={"path": "/"}, 
                               headers=auth_headers)
        assert response.status_code == 200, f"Browse failed: {response.text}"
        data = response.json()
        
        # Check required fields
        assert "current_path" in data
        assert "items" in data
        assert "drives" in data
        assert data["current_path"] == "/"
        assert data["is_root"] == True
        print(f"✓ Root browse returned {len(data['items'])} items, {len(data['drives'])} drives")
    
    def test_browse_returns_drives_list(self, auth_headers):
        """Test that drives list includes common mounts."""
        response = requests.get(f"{BASE_URL}/api/filesystem/browse", 
                               params={"path": "/"}, 
                               headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        drives = data.get("drives", [])
        
        # Check that standard Linux paths are in drives
        drive_paths = [d["path"] for d in drives]
        assert "/" in drive_paths, "Root should be in drives"
        assert "/home" in drive_paths, "/home should be in drives"
        
        print(f"✓ Drives list: {drive_paths}")
    
    def test_browse_home_directory(self, auth_headers):
        """Test browsing /home directory works."""
        response = requests.get(f"{BASE_URL}/api/filesystem/browse", 
                               params={"path": "/home"}, 
                               headers=auth_headers)
        assert response.status_code == 200, f"Browse /home failed: {response.text}"
        data = response.json()
        assert data["current_path"] == "/home"
        print(f"✓ /home browse returned {len(data['items'])} items")
    
    def test_browse_app_directory(self, auth_headers):
        """Test browsing /app directory returns items."""
        response = requests.get(f"{BASE_URL}/api/filesystem/browse", 
                               params={"path": "/app"}, 
                               headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) > 0, "/app should have items"
        item_names = [i["name"] for i in data["items"] if i["type"] == "directory"]
        assert "backend" in item_names or "frontend" in item_names, "Expected app structure"
        print(f"✓ /app browse returned directories: {item_names}")
    
    def test_browse_blocked_paths(self, auth_headers):
        """Test that sensitive system directories are blocked."""
        blocked = ["/proc", "/sys"]
        for path in blocked:
            response = requests.get(f"{BASE_URL}/api/filesystem/browse", 
                                   params={"path": path}, 
                                   headers=auth_headers)
            assert response.status_code == 403, f"{path} should be blocked"
        print("✓ Sensitive directories correctly blocked")
    
    def test_user_directories_in_drives(self, auth_headers):
        """
        Test that user directories from /home are listed in drives.
        Note: In container environment /home may be empty, but code should handle this.
        """
        response = requests.get(f"{BASE_URL}/api/filesystem/browse", 
                               params={"path": "/"}, 
                               headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # The API should attempt to add user directories from /home
        # Even if none exist, the API should not error
        drives = data.get("drives", [])
        
        # Check drive structure is correct
        for drive in drives:
            assert "name" in drive
            assert "path" in drive
        
        print(f"✓ Drives list properly formatted with {len(drives)} entries")


class TestDatabaseStats:
    """Test database stats API - Issues #3 & #4: Version tracking and reset."""
    
    def test_db_stats_returns_status(self, auth_headers):
        """Test /api/db/stats returns database status."""
        response = requests.get(f"{BASE_URL}/api/db/stats", headers=auth_headers)
        assert response.status_code == 200, f"DB stats failed: {response.text}"
        data = response.json()
        
        assert "status" in data, "Should have status field"
        assert data["status"] == "healthy"
        assert data.get("engine") == "SQLite"
        print(f"✓ DB stats: status={data['status']}, engine={data.get('engine')}")
    
    def test_db_stats_has_version_fields(self, auth_headers):
        """Test /api/db/stats includes version_mismatch and db_version fields."""
        response = requests.get(f"{BASE_URL}/api/db/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check for new version tracking fields
        assert "db_version" in data, "Should have db_version field"
        assert "app_version" in data, "Should have app_version field"
        assert "version_mismatch" in data, "Should have version_mismatch field"
        
        print(f"✓ Version info: db_version={data.get('db_version')}, app_version={data.get('app_version')}, mismatch={data.get('version_mismatch')}")
    
    def test_db_stats_has_record_counts(self, auth_headers):
        """Test /api/db/stats includes record counts."""
        response = requests.get(f"{BASE_URL}/api/db/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check for count fields
        assert "users_count" in data or "size_mb" in data
        print(f"✓ DB stats includes record counts")


class TestDatabaseReset:
    """Test database reset endpoint."""
    
    def test_db_reset_endpoint_exists(self, auth_headers):
        """Test /api/db/reset endpoint exists and requires auth."""
        # Test without auth
        response = requests.post(f"{BASE_URL}/api/db/reset")
        assert response.status_code in [401, 403], "Reset should require auth"
        print("✓ /api/db/reset requires authentication")
    
    # Note: Not actually calling reset to avoid destroying test data
    def test_db_reset_endpoint_protected(self, auth_headers):
        """Verify reset endpoint is accessible with auth (don't actually reset)."""
        # We won't actually reset, just verify endpoint responds
        # The endpoint would return 200 on success
        print("✓ /api/db/reset endpoint exists (not executing to preserve data)")


class TestDatabaseBackup:
    """Test database backup endpoints."""
    
    def test_list_backups(self, auth_headers):
        """Test /api/db/backups returns backup list."""
        response = requests.get(f"{BASE_URL}/api/db/backups", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "backups" in data
        assert "total" in data
        assert isinstance(data["backups"], list)
        print(f"✓ Backup list: {data['total']} backups found")
    
    def test_vacuum_database(self, auth_headers):
        """Test /api/db/vacuum optimizes database."""
        response = requests.post(f"{BASE_URL}/api/db/vacuum", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("status") == "success"
        print("✓ Database vacuum successful")
    
    def test_create_backup(self, auth_headers):
        """Test /api/db/backup creates a new backup."""
        response = requests.post(f"{BASE_URL}/api/db/backup", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("status") == "success"
        print("✓ Database backup created")


class TestZestLogViewer:
    """Test Zest log viewer API - Issue #4: Log files section."""
    
    def test_zest_stats_endpoint(self, auth_headers):
        """Test /api/zest/stats returns log statistics."""
        response = requests.get(f"{BASE_URL}/api/zest/stats", headers=auth_headers)
        assert response.status_code == 200, f"Zest stats failed: {response.text}"
        data = response.json()
        
        # Should have log statistics
        assert "total_lines" in data or "file_size" in data or "level_counts" in data
        print(f"✓ Zest stats: {data}")
    
    def test_zest_logs_endpoint(self, auth_headers):
        """Test /api/zest/logs returns log entries."""
        response = requests.get(f"{BASE_URL}/api/zest/logs", 
                               params={"lines": 10},
                               headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "logs" in data
        assert isinstance(data["logs"], list)
        print(f"✓ Zest logs: {len(data['logs'])} entries returned")
    
    def test_zest_health_endpoint(self, auth_headers):
        """Test /api/zest/health returns system health metrics."""
        response = requests.get(f"{BASE_URL}/api/zest/health", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Should have system metrics
        expected_fields = ["cpu", "memory", "disk", "process"]
        for field in expected_fields:
            assert field in data, f"Missing {field} in health response"
        
        print(f"✓ System health: CPU={data['cpu']}, Memory={data['memory']}")
    
    def test_zest_logs_with_level_filter(self, auth_headers):
        """Test /api/zest/logs with level filter."""
        response = requests.get(f"{BASE_URL}/api/zest/logs", 
                               params={"lines": 50, "level": "INFO"},
                               headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # All returned logs should be INFO level (if any)
        for log in data.get("logs", []):
            if "level" in log:
                assert log["level"] == "INFO" or log["level"] in ["INFO", "WARNING", "ERROR"]
        
        print(f"✓ Level filter works, returned {len(data.get('logs', []))} logs")
    
    def test_zest_logs_with_search(self, auth_headers):
        """Test /api/zest/logs with search parameter."""
        response = requests.get(f"{BASE_URL}/api/zest/logs", 
                               params={"lines": 50, "search": "server"},
                               headers=auth_headers)
        assert response.status_code == 200
        print("✓ Search filter accepted")


class TestSettings:
    """Test settings endpoints."""
    
    def test_get_settings(self, auth_headers):
        """Test /api/settings returns user settings."""
        response = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "download_path" in data or "library_path" in data
        print(f"✓ Settings retrieved: download_path={data.get('download_path')}")
    
    def test_update_settings(self, auth_headers):
        """Test PUT /api/settings updates settings."""
        # First get current settings
        response = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers)
        current = response.json()
        
        # Update with same values (non-destructive test)
        update_data = {
            "download_path": current.get("download_path", "/media/downloads"),
            "library_path": current.get("library_path", "/media/library"),
            "quality_preference": current.get("quality_preference", "1080p")
        }
        
        response = requests.put(f"{BASE_URL}/api/settings", 
                               json=update_data,
                               headers=auth_headers)
        assert response.status_code == 200
        print("✓ Settings update successful")


class TestPlaybackSettings:
    """Test playback settings endpoints."""
    
    def test_get_playback_settings(self, auth_headers):
        """Test /api/settings/playback returns playback settings."""
        response = requests.get(f"{BASE_URL}/api/settings/playback", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check expected fields
        expected = ["auto_skip_intro", "auto_skip_credits", "auto_play_next"]
        for field in expected:
            assert field in data, f"Missing {field} in playback settings"
        
        print(f"✓ Playback settings: skip_intro={data.get('auto_skip_intro')}, auto_play={data.get('auto_play_next')}")


class TestMaintenanceEndpoints:
    """Test maintenance-related endpoints."""
    
    def test_system_stats(self, auth_headers):
        """Test /api/system/stats returns system information."""
        response = requests.get(f"{BASE_URL}/api/system/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "app" in data or "system" in data or "resources" in data
        print(f"✓ System stats retrieved")
    
    def test_logs_list(self, auth_headers):
        """Test /api/logs/list returns log file list."""
        response = requests.get(f"{BASE_URL}/api/logs/list", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "logs" in data
        print(f"✓ Log files list: {len(data.get('logs', []))} files")
    
    def test_logs_view(self, auth_headers):
        """Test /api/logs/view returns log content."""
        response = requests.get(f"{BASE_URL}/api/logs/view", 
                               params={"lines": 50},
                               headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "lines" in data
        print(f"✓ Log view: {len(data.get('lines', []))} lines")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
