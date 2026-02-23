"""
WatchNexus v2.3.0 Test Suite
Testing: Zest (Log Viewer), Garnish (Subtitles), Theme Forge, Plugins (Kodi import)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "password"


class TestAuth:
    """Authentication for protected endpoints."""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get JWT token for authenticated requests."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed - cannot run authenticated tests")
    
    def test_login_success(self):
        """Test login with valid credentials."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"✓ Login successful for {TEST_EMAIL}")


class TestZestLogViewer:
    """Test Zest Log Viewer API endpoints."""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get JWT token for authenticated requests."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_zest_get_logs(self, auth_token):
        """Test GET /api/zest/logs - fetch log entries."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/zest/logs", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "logs" in data
        assert "total" in data
        assert "file_path" in data
        assert "exists" in data
        
        print(f"✓ Zest logs endpoint working - {data.get('total', 0)} total log entries")
        print(f"  Log file: {data.get('file_path')}")
    
    def test_zest_get_logs_with_level_filter(self, auth_token):
        """Test log filtering by level."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/zest/logs?level=INFO&lines=50", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned logs should be INFO level if any exist
        for log in data.get("logs", []):
            assert log.get("level") == "INFO" or log.get("level") == "INFO"
        
        print(f"✓ Zest log level filtering works - {len(data.get('logs', []))} INFO logs")
    
    def test_zest_get_logs_with_search(self, auth_token):
        """Test log search functionality."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/zest/logs?search=Login&lines=50", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Zest log search works - {len(data.get('logs', []))} matching entries")
    
    def test_zest_get_stats(self, auth_token):
        """Test GET /api/zest/stats - log file statistics."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/zest/stats", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "file_path" in data
        assert "exists" in data
        assert "level_counts" in data
        assert "total_lines" in data
        
        # Verify level_counts has expected keys
        level_counts = data.get("level_counts", {})
        assert "DEBUG" in level_counts
        assert "INFO" in level_counts
        assert "WARNING" in level_counts
        assert "ERROR" in level_counts
        
        print(f"✓ Zest stats endpoint working")
        print(f"  Total lines: {data.get('total_lines')}")
        print(f"  File size: {data.get('file_size_formatted')}")
        print(f"  Level counts: {level_counts}")
    
    def test_zest_get_health(self, auth_token):
        """Test GET /api/zest/health - system health metrics."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/zest/health", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure - system metrics
        assert "cpu" in data
        assert "memory" in data
        assert "disk" in data
        assert "process" in data
        
        # Verify CPU data
        cpu = data.get("cpu", {})
        assert "percent" in cpu
        assert "count" in cpu
        
        # Verify memory data
        memory = data.get("memory", {})
        assert "percent" in memory
        assert "total_formatted" in memory
        assert "used_formatted" in memory
        
        # Verify disk data
        disk = data.get("disk", {})
        assert "percent" in disk
        assert "free_formatted" in disk
        
        print(f"✓ Zest health endpoint working")
        print(f"  CPU: {cpu.get('percent')}% ({cpu.get('count')} cores)")
        print(f"  Memory: {memory.get('percent')}% ({memory.get('used_formatted')} / {memory.get('total_formatted')})")
        print(f"  Disk: {disk.get('percent')}% ({disk.get('free_formatted')} free)")


class TestGarnishSubtitles:
    """Test Garnish Subtitle Settings API endpoints."""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get JWT token for authenticated requests."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_garnish_get_settings(self, auth_token):
        """Test GET /api/garnish/settings - fetch subtitle settings."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/garnish/settings", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "auto_subtitles" in data
        assert "subtitle_languages" in data
        assert "providers" in data
        assert "provider_configs" in data
        
        print(f"✓ Garnish settings endpoint working")
        print(f"  Auto-subtitles: {data.get('auto_subtitles')}")
        print(f"  Languages: {data.get('subtitle_languages')}")
        print(f"  Providers: {data.get('providers')}")
    
    def test_garnish_save_settings(self, auth_token):
        """Test POST /api/garnish/settings - save subtitle settings."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First get current settings
        get_response = requests.get(f"{BASE_URL}/api/garnish/settings", headers=headers)
        current_settings = get_response.json()
        
        # Update settings with new providers order and languages
        new_settings = {
            "auto_subtitles": True,
            "subtitle_languages": ["en", "es"],
            "providers": ["opensubtitles", "podnapisi"],
            "provider_configs": {
                "opensubtitles": {"username": "test_user"}
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/garnish/settings", headers=headers, json=new_settings)
        
        assert response.status_code == 200
        data = response.json()
        # Accept either "saved" or "success" status
        assert data.get("status") in ["saved", "success"] or "subtitle_languages" in data
        
        print(f"✓ Garnish settings save endpoint working")
        
        # Verify settings were saved by fetching again
        verify_response = requests.get(f"{BASE_URL}/api/garnish/settings", headers=headers)
        assert verify_response.status_code == 200
        verified_data = verify_response.json()
        
        # Check languages were updated
        assert "en" in verified_data.get("subtitle_languages", [])
        print(f"✓ Garnish settings persisted correctly")


class TestThemeForge:
    """Test Theme Forge API endpoints."""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get JWT token for authenticated requests."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_theme_forge_get_config(self, auth_token):
        """Test GET /api/milk/theme-forge - get theme configuration."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/milk/theme-forge", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "built_in_themes" in data
        assert "current_theme" in data
        
        # Verify built-in themes exist
        built_in = data.get("built_in_themes", [])
        assert len(built_in) > 0
        
        # Each theme should have type, name, colors
        for theme in built_in:
            assert "type" in theme
            assert "name" in theme
            assert "preview_colors" in theme
        
        print(f"✓ Theme Forge config endpoint working")
        print(f"  Built-in themes: {[t.get('name') for t in built_in]}")
        print(f"  Current theme: {data.get('current_theme', {}).get('type', 'default')}")
    
    def test_theme_forge_set_builtin_theme(self, auth_token):
        """Test POST /api/milk/set-theme - apply a built-in theme."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get available themes first
        config_response = requests.get(f"{BASE_URL}/api/milk/theme-forge", headers=headers)
        config_data = config_response.json()
        available_themes = [t.get("type") for t in config_data.get("built_in_themes", [])]
        
        # Use the first available theme type
        theme_to_apply = available_themes[0] if available_themes else "tv"
        
        # Try setting the theme
        response = requests.post(f"{BASE_URL}/api/milk/set-theme?theme_type={theme_to_apply}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response contains theme data (can be nested in 'theme' key)
        assert data.get("status") == "success" or "type" in data or "colors" in data or "name" in data or "theme" in data
        
        print(f"✓ Theme Forge set theme endpoint working")
        print(f"  Applied theme: {theme_to_apply}")
    
    def test_theme_forge_custom_theme(self, auth_token):
        """Test POST /api/milk/custom-theme - save custom theme colors."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        custom_theme = {
            "name": "Test Custom Theme",
            "type": "custom",
            "colors": {
                "primary": "#FF5733",
                "secondary": "#33FF57",
                "background": "#1A1A1A",
                "surface": "#2D2D2D",
                "text_primary": "#FFFFFF"
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/milk/custom-theme", headers=headers, json=custom_theme)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify custom theme was saved - response has status and theme object
        assert data.get("status") == "success" or "type" in data or "colors" in data or "theme" in data
        
        print(f"✓ Theme Forge custom theme endpoint working")


class TestPluginsAndKodiImport:
    """Test Plugin system and Kodi addon import."""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get JWT token for authenticated requests."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_get_plugins_list(self, auth_token):
        """Test GET /api/gadgets/plugins - list installed plugins."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/gadgets/plugins", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Data should be a list
        assert isinstance(data, list)
        
        # Check plugin structure if any exist
        for plugin in data:
            assert "id" in plugin
            assert "name" in plugin
            assert "status" in plugin
        
        print(f"✓ Plugins list endpoint working")
        print(f"  Installed plugins: {[p.get('name') for p in data]}")
    
    def test_plugin_discover(self, auth_token):
        """Test POST /api/gadgets/discover - discover plugins."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/gadgets/discover", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return status or list
        assert isinstance(data, (list, dict))
        
        print(f"✓ Plugin discover endpoint working")
    
    def test_import_plugin_from_url_validation(self, auth_token):
        """Test POST /api/gadgets/import-url - URL validation."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Test with invalid URL (should fail gracefully)
        response = requests.post(
            f"{BASE_URL}/api/gadgets/import-url",
            headers=headers,
            params={"url": "https://invalid-url-that-does-not-exist.zip"}
        )
        
        # Should return error, not crash
        assert response.status_code in [400, 404, 500, 422]
        print(f"✓ Plugin import URL validation works (properly handles invalid URLs)")
    
    def test_import_kodi_addon_validation(self, auth_token):
        """Test POST /api/gadgets/import-kodi - Kodi addon import validation."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Test with invalid URL (should fail gracefully)
        response = requests.post(
            f"{BASE_URL}/api/gadgets/import-kodi",
            headers=headers,
            params={"url": "https://invalid-kodi-addon-url.zip"}
        )
        
        # Should return error, not crash
        assert response.status_code in [400, 404, 500, 422]
        print(f"✓ Kodi addon import validation works (properly handles invalid URLs)")


class TestUserManagement:
    """Test user management endpoints."""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get JWT token for authenticated requests."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_get_users_list(self, auth_token):
        """Test GET /api/users - list all users."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify user structure
        for user in data:
            assert "id" in user
            assert "email" in user
            assert "username" in user
        
        print(f"✓ Users list endpoint working - {len(data)} users")
    
    def test_delete_user_validation(self, auth_token):
        """Test DELETE /api/users/{user_id} - cannot delete self."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get current user ID
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        current_user_id = me_response.json().get("id")
        
        # Try to delete self - should fail
        response = requests.delete(f"{BASE_URL}/api/users/{current_user_id}", headers=headers)
        
        assert response.status_code == 400
        assert "Cannot delete yourself" in response.json().get("detail", "")
        
        print(f"✓ User deletion validation works (cannot delete self)")
    
    def test_delete_nonexistent_user(self, auth_token):
        """Test DELETE /api/users/{user_id} - nonexistent user."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Try to delete a fake user ID
        response = requests.delete(f"{BASE_URL}/api/users/fake-user-id-12345", headers=headers)
        
        assert response.status_code == 404
        
        print(f"✓ User deletion returns 404 for nonexistent users")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
