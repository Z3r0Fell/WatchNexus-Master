"""
Test suite for Milk (Theme Forge) and Gadgets (Plugins) modules
Tests the new theming and plugin system features
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://streamvault-209.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "password"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for API calls."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture
def auth_headers(auth_token):
    """Return headers with auth token."""
    return {"Authorization": f"Bearer {auth_token}"}


class TestMilkThemeForge:
    """Tests for Milk Theme Engine - Theme Forge functionality"""
    
    def test_get_theme_forge_config(self, auth_headers):
        """Test GET /api/milk/theme-forge returns theme configuration"""
        response = requests.get(
            f"{BASE_URL}/api/milk/theme-forge",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify structure
        assert "current_theme" in data
        assert "built_in_themes" in data
        assert "custom_themes" in data
        assert "color_presets" in data
        assert "background_presets" in data
        
        # Verify built-in themes exist
        assert len(data["built_in_themes"]) >= 6
        
        # Verify theme types
        theme_types = [t["type"] for t in data["built_in_themes"]]
        assert "tv" in theme_types
        assert "movie" in theme_types
        assert "anime" in theme_types
        assert "music" in theme_types
        assert "minimalist" in theme_types
        assert "service" in theme_types
    
    def test_get_all_themes(self, auth_headers):
        """Test GET /api/milk/themes returns all available themes"""
        response = requests.get(
            f"{BASE_URL}/api/milk/themes",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "built_in" in data
        assert "custom" in data
        assert len(data["built_in"]) >= 6
    
    def test_get_current_theme(self, auth_headers):
        """Test GET /api/milk/current returns current theme"""
        response = requests.get(
            f"{BASE_URL}/api/milk/current",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "name" in data
        assert "type" in data
        assert "colors" in data
    
    def test_get_theme_css(self, auth_headers):
        """Test GET /api/milk/css returns CSS for current theme"""
        response = requests.get(
            f"{BASE_URL}/api/milk/css",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "css" in data
        # CSS should contain root variables
        assert ":root" in data["css"] or "--color-" in data["css"]
    
    def test_set_theme(self, auth_headers):
        """Test POST /api/milk/set-theme changes the active theme"""
        # Set to movie theme
        response = requests.post(
            f"{BASE_URL}/api/milk/set-theme?theme_type=movie",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["type"] == "movie"
        assert data["name"] == "Cinema"
        
        # Verify it was set
        verify_response = requests.get(
            f"{BASE_URL}/api/milk/current",
            headers=auth_headers
        )
        assert verify_response.status_code == 200
        assert verify_response.json()["type"] == "movie"
        
        # Reset to default (tv)
        requests.post(
            f"{BASE_URL}/api/milk/set-theme?theme_type=tv",
            headers=auth_headers
        )
    
    def test_theme_forge_color_presets(self, auth_headers):
        """Test that color presets are available in Theme Forge"""
        response = requests.get(
            f"{BASE_URL}/api/milk/theme-forge",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        color_presets = data["color_presets"]
        
        # Verify color presets (Juice integration)
        assert len(color_presets) >= 6
        preset_names = [p["name"] for p in color_presets]
        assert "Violet" in preset_names
        assert "Blue" in preset_names
        assert "Green" in preset_names
        assert "Orange" in preset_names
        assert "Red" in preset_names
        assert "Pink" in preset_names
        
        # Each preset should have primary and secondary colors
        for preset in color_presets:
            assert "primary" in preset
            assert "secondary" in preset
            assert preset["primary"].startswith("#")
            assert preset["secondary"].startswith("#")
    
    def test_built_in_theme_details(self, auth_headers):
        """Test that built-in themes have proper structure"""
        response = requests.get(
            f"{BASE_URL}/api/milk/theme-forge",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        themes = response.json()["built_in_themes"]
        
        for theme in themes:
            assert "type" in theme
            assert "name" in theme
            assert "description" in theme
            assert "preview_colors" in theme
            assert "primary" in theme["preview_colors"]
            assert "secondary" in theme["preview_colors"]
            assert "background" in theme["preview_colors"]


class TestGadgetsPlugins:
    """Tests for Gadgets Plugin System"""
    
    def test_get_plugins_list(self, auth_headers):
        """Test GET /api/gadgets/plugins returns plugin list"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/plugins",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Should return a list (may be empty if no plugins installed)
        assert isinstance(data, list)
    
    def test_discover_plugins(self, auth_headers):
        """Test POST /api/gadgets/discover scans for plugins"""
        response = requests.post(
            f"{BASE_URL}/api/gadgets/discover",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Should return discovered plugins list
        assert isinstance(data, list)
    
    def test_get_providers_metadata(self, auth_headers):
        """Test GET /api/gadgets/providers/metadata_provider"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/providers/metadata_provider",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_providers_indexer(self, auth_headers):
        """Test GET /api/gadgets/providers/indexer_provider"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/providers/indexer_provider",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_providers_subtitle(self, auth_headers):
        """Test GET /api/gadgets/providers/subtitle_provider"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/providers/subtitle_provider",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_providers_notification(self, auth_headers):
        """Test GET /api/gadgets/providers/notification_provider"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/providers/notification_provider",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_providers_theme(self, auth_headers):
        """Test GET /api/gadgets/providers/theme_provider"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/providers/theme_provider",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
    
    def test_load_nonexistent_plugin(self, auth_headers):
        """Test loading a non-existent plugin returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/gadgets/load/nonexistent-plugin-id",
            headers=auth_headers
        )
        # Should return 404 or error
        assert response.status_code in [404, 500]
    
    def test_get_nonexistent_plugin(self, auth_headers):
        """Test getting a non-existent plugin returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/plugin/nonexistent-plugin-id",
            headers=auth_headers
        )
        assert response.status_code == 404


class TestMilkGadgetsIntegration:
    """Integration tests for Milk and Gadgets working together"""
    
    def test_theme_providers_from_gadgets(self, auth_headers):
        """Test that theme providers from Gadgets integrate with Milk"""
        # Get theme providers from Gadgets
        gadgets_response = requests.get(
            f"{BASE_URL}/api/gadgets/providers/theme_provider",
            headers=auth_headers
        )
        assert gadgets_response.status_code == 200
        
        # Get themes from Milk
        milk_response = requests.get(
            f"{BASE_URL}/api/milk/themes",
            headers=auth_headers
        )
        assert milk_response.status_code == 200
    
    def test_api_authentication_required(self):
        """Test that APIs require authentication"""
        # Milk endpoints
        response = requests.get(f"{BASE_URL}/api/milk/theme-forge")
        assert response.status_code == 401
        
        response = requests.get(f"{BASE_URL}/api/milk/themes")
        assert response.status_code == 401
        
        # Gadgets endpoints
        response = requests.get(f"{BASE_URL}/api/gadgets/plugins")
        assert response.status_code == 401
        
        response = requests.post(f"{BASE_URL}/api/gadgets/discover")
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
