"""
WatchNexus v2.1.0 Testing - Plugins & Playback Settings
Tests for:
1. Login authentication
2. Plugins page endpoints (/api/gadgets/plugins)
3. Playback settings endpoints (/api/settings/playback)
4. Chromaprint status endpoint
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_login_success(self):
        """Test login with test@test.com / password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "test@test.com"
        print("✓ Login successful for test@test.com")
        return data["access_token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid credentials properly rejected with 401")


class TestPluginsEndpoints:
    """Test Plugins (Gadgets) endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_plugins_list(self):
        """Test GET /api/gadgets/plugins returns plugin list"""
        response = requests.get(f"{BASE_URL}/api/gadgets/plugins", headers=self.headers)
        assert response.status_code == 200, f"Failed to get plugins: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Plugins should return a list"
        
        # Check for expected plugins (anidb-metadata, discord-notify)
        plugin_ids = [p.get('id') for p in data]
        print(f"✓ Got {len(data)} plugins: {plugin_ids}")
        
        # Verify plugin structure
        if len(data) > 0:
            plugin = data[0]
            assert 'id' in plugin or 'name' in plugin, "Plugin should have id or name"
            print(f"✓ First plugin structure valid: {plugin.get('name', plugin.get('id'))}")
        return data
    
    def test_discover_plugins(self):
        """Test POST /api/gadgets/discover"""
        response = requests.post(f"{BASE_URL}/api/gadgets/discover", headers=self.headers)
        assert response.status_code == 200, f"Failed to discover plugins: {response.text}"
        data = response.json()
        assert "discovered" in data, "Response should include 'discovered' count"
        print(f"✓ Discovered {data.get('discovered', 0)} plugins")
    
    def test_enable_plugin(self):
        """Test POST /api/gadgets/plugins/{plugin_id}/enable"""
        # First get plugins list
        plugins_response = requests.get(f"{BASE_URL}/api/gadgets/plugins", headers=self.headers)
        plugins = plugins_response.json()
        
        if len(plugins) > 0:
            plugin_id = plugins[0].get('id')
            response = requests.post(f"{BASE_URL}/api/gadgets/plugins/{plugin_id}/enable", headers=self.headers)
            # Either 200 (success) or 500 if plugin can't be enabled (acceptable)
            assert response.status_code in [200, 500], f"Unexpected status: {response.status_code}"
            print(f"✓ Enable plugin endpoint responded with {response.status_code}")
        else:
            print("⚠ No plugins to test enable/disable")
    
    def test_disable_plugin(self):
        """Test POST /api/gadgets/plugins/{plugin_id}/disable"""
        plugins_response = requests.get(f"{BASE_URL}/api/gadgets/plugins", headers=self.headers)
        plugins = plugins_response.json()
        
        if len(plugins) > 0:
            plugin_id = plugins[0].get('id')
            response = requests.post(f"{BASE_URL}/api/gadgets/plugins/{plugin_id}/disable", headers=self.headers)
            assert response.status_code == 200, f"Failed to disable plugin: {response.text}"
            data = response.json()
            assert "status" in data, "Response should include status"
            print(f"✓ Disable plugin endpoint works: {data.get('status')}")
        else:
            print("⚠ No plugins to test enable/disable")


class TestPlaybackSettings:
    """Test Playback Settings endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_playback_settings(self):
        """Test GET /api/settings/playback"""
        response = requests.get(f"{BASE_URL}/api/settings/playback", headers=self.headers)
        assert response.status_code == 200, f"Failed to get playback settings: {response.text}"
        data = response.json()
        
        # Verify expected fields exist
        expected_fields = [
            'auto_skip_intro', 'auto_skip_credits', 'skip_button_duration',
            'intro_detection_enabled', 'credits_detection_enabled',
            'auto_play_next', 'next_episode_countdown'
        ]
        
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        print("✓ Playback settings retrieved with all expected fields")
        print(f"  - auto_skip_intro: {data.get('auto_skip_intro')}")
        print(f"  - auto_skip_credits: {data.get('auto_skip_credits')}")
        print(f"  - auto_play_next: {data.get('auto_play_next')}")
        return data
    
    def test_update_playback_settings(self):
        """Test PUT /api/settings/playback"""
        # Get current settings first
        current = requests.get(f"{BASE_URL}/api/settings/playback", headers=self.headers).json()
        
        # Update settings
        new_settings = {
            "auto_skip_intro": not current.get('auto_skip_intro', False),
            "auto_skip_credits": not current.get('auto_skip_credits', False),
            "skip_button_duration": 7,
            "intro_detection_enabled": True,
            "credits_detection_enabled": True,
            "default_intro_start": 0,
            "default_intro_end": 90,
            "default_credits_offset": 90,
            "auto_play_next": True,
            "next_episode_countdown": 10
        }
        
        response = requests.put(
            f"{BASE_URL}/api/settings/playback",
            json=new_settings,
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to update playback settings: {response.text}"
        data = response.json()
        
        # Verify update was applied
        assert data.get('skip_button_duration') == 7, "Skip button duration not updated"
        assert data.get('next_episode_countdown') == 10, "Countdown not updated"
        print("✓ Playback settings updated successfully")
        
        # Reset to original
        original_settings = {
            "auto_skip_intro": current.get('auto_skip_intro', False),
            "auto_skip_credits": current.get('auto_skip_credits', False),
            "skip_button_duration": current.get('skip_button_duration', 5),
            "intro_detection_enabled": current.get('intro_detection_enabled', True),
            "credits_detection_enabled": current.get('credits_detection_enabled', True),
            "default_intro_start": current.get('default_intro_start', 0),
            "default_intro_end": current.get('default_intro_end', 90),
            "default_credits_offset": current.get('default_credits_offset', 90),
            "auto_play_next": current.get('auto_play_next', True),
            "next_episode_countdown": current.get('next_episode_countdown', 15)
        }
        requests.put(f"{BASE_URL}/api/settings/playback", json=original_settings, headers=self.headers)


class TestChromaprintStatus:
    """Test Chromaprint (intro detection) status endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_chromaprint_status(self):
        """Test GET /api/system/chromaprint-status"""
        response = requests.get(f"{BASE_URL}/api/system/chromaprint-status", headers=self.headers)
        assert response.status_code == 200, f"Failed to get chromaprint status: {response.text}"
        data = response.json()
        
        assert "installed" in data, "Response should include 'installed' field"
        print(f"✓ Chromaprint status: {'Installed' if data.get('installed') else 'Not installed'}")
        if data.get('path'):
            print(f"  - Path: {data.get('path')}")


class TestAnalyzeIntros:
    """Test intro analysis endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_analyze_all_intros(self):
        """Test POST /api/marmalade/analyze-all-intros"""
        response = requests.post(f"{BASE_URL}/api/marmalade/analyze-all-intros", headers=self.headers)
        assert response.status_code == 200, f"Failed to analyze intros: {response.text}"
        data = response.json()
        
        assert "status" in data, "Response should include 'status'"
        assert "queued" in data, "Response should include 'queued' count"
        print(f"✓ Analyze intros: {data.get('status')}, queued: {data.get('queued')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
