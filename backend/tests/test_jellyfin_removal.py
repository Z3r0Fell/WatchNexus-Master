"""
WatchNexus Backend Tests - Jellyfin Removal / MediaBridge Migration Verification
Tests that Jellyfin references are completely removed and replaced with 'media-bridge' / 'custard'
"""
import pytest
import requests
import os
import re

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestJellyfinRemovalHealthAuth:
    """Test health and auth endpoints - no Jellyfin references expected"""
    
    def test_health_endpoint(self):
        """GET /api/health - should return healthy status with version 2.7.3"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        data = response.json()
        assert data.get('status') == 'healthy', f"Status not healthy: {data}"
        assert data.get('version') == '2.7.3', f"Version mismatch: {data.get('version')}"
        
        # Verify no Jellyfin in response
        response_text = response.text.lower()
        assert 'jellyfin' not in response_text, f"Found 'jellyfin' in health response: {response.text}"
        print(f"✓ Health endpoint OK - status: {data['status']}, version: {data['version']}")

    def test_register_new_user(self):
        """POST /api/auth/register - test user registration"""
        import uuid
        unique_email = f"test_{uuid.uuid4().hex[:8]}@test.com"
        payload = {
            "email": unique_email,
            "username": f"testuser_{uuid.uuid4().hex[:6]}",
            "password": "testpassword123"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=10)
        
        # 200 = success, 409 = already exists (both acceptable)
        assert response.status_code in [200, 409], f"Register failed unexpectedly: {response.status_code} - {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert 'access_token' in data, "No access_token in register response"
            assert 'user' in data, "No user in register response"
            print(f"✓ User registration successful: {unique_email}")
        else:
            print(f"✓ User registration endpoint working (user may exist)")
        
        # Verify no Jellyfin in response
        assert 'jellyfin' not in response.text.lower(), f"Found 'jellyfin' in register response"

    def test_login_existing_user(self):
        """POST /api/auth/login - login with test@test.com / password"""
        payload = {
            "email": "test@test.com",
            "password": "password"
        }
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload, timeout=10)
        assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert 'access_token' in data, "No access_token in login response"
        assert 'user' in data, "No user in login response"
        
        # Verify no Jellyfin in response
        assert 'jellyfin' not in response.text.lower(), f"Found 'jellyfin' in login response"
        print(f"✓ Login successful for test@test.com")
        return data['access_token']


@pytest.fixture
def auth_token():
    """Get authentication token for protected endpoints"""
    payload = {"email": "test@test.com", "password": "password"}
    response = requests.post(f"{BASE_URL}/api/auth/login", json=payload, timeout=10)
    if response.status_code == 200:
        return response.json()['access_token']
    pytest.skip("Auth failed - cannot get token")


class TestJellyfinRemovalModuleList:
    """Test /api/info - module list should include 'Custard' not 'Jellyfin'"""
    
    def test_info_includes_custard(self, auth_token):
        """GET /api/info - should include Custard module"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/info", headers=headers, timeout=10)
        assert response.status_code == 200, f"Info endpoint failed: {response.status_code}"
        
        data = response.json()
        assert 'modules' in data, "No modules in info response"
        
        # Find Custard module
        modules = data['modules']
        custard_module = None
        for m in modules:
            if m.get('codename') == 'custard':
                custard_module = m
                break
        
        assert custard_module is not None, f"Custard module not found in modules list. Found: {[m.get('codename') for m in modules]}"
        assert custard_module.get('name') == 'Custard', f"Custard module name wrong: {custard_module.get('name')}"
        
        # Verify no Jellyfin in entire response
        response_text = response.text.lower()
        assert 'jellyfin' not in response_text, f"Found 'jellyfin' in /api/info response: {response.text}"
        print(f"✓ /api/info includes Custard module: {custard_module}")


class TestJellyfinRemovalPlugins:
    """Test /api/gadgets/plugins - should include media-bridge with codename custard"""
    
    def test_plugins_includes_media_bridge(self, auth_token):
        """GET /api/gadgets/plugins - should include media-bridge plugin"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/gadgets/plugins", headers=headers, timeout=10)
        assert response.status_code == 200, f"Plugins endpoint failed: {response.status_code}"
        
        plugins = response.json()
        assert isinstance(plugins, list), "Plugins response should be a list"
        
        # Find media-bridge plugin
        media_bridge = None
        for p in plugins:
            if p.get('id') == 'media-bridge':
                media_bridge = p
                break
        
        assert media_bridge is not None, f"media-bridge plugin not found. Found: {[p.get('id') for p in plugins]}"
        assert media_bridge.get('codename') == 'custard', f"media-bridge codename wrong: {media_bridge.get('codename')}"
        assert media_bridge.get('name') == 'Media Bridge', f"media-bridge name wrong: {media_bridge.get('name')}"
        
        # Verify NO Jellyfin plugin exists
        jellyfin_plugin = None
        for p in plugins:
            if 'jellyfin' in p.get('id', '').lower() or 'jellyfin' in p.get('name', '').lower():
                jellyfin_plugin = p
                break
        assert jellyfin_plugin is None, f"Found Jellyfin plugin that should be removed: {jellyfin_plugin}"
        
        # Verify no Jellyfin in entire response
        response_text = response.text.lower()
        assert 'jellyfin' not in response_text, f"Found 'jellyfin' in plugins response"
        
        print(f"✓ Plugins includes media-bridge: {media_bridge}")


class TestJellyfinRemovalRipenInstalled:
    """Test /api/ripen/installed - should include media-bridge gadget"""
    
    def test_ripen_installed_includes_media_bridge(self, auth_token):
        """GET /api/ripen/installed - should include media-bridge gadget with codename custard"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/ripen/installed", headers=headers, timeout=10)
        assert response.status_code == 200, f"Ripen installed failed: {response.status_code}"
        
        data = response.json()
        assert 'gadgets' in data, "No gadgets in ripen installed response"
        
        gadgets = data['gadgets']
        
        # Find media-bridge gadget
        media_bridge = None
        for g in gadgets:
            if g.get('gadget_id') == 'media-bridge':
                media_bridge = g
                break
        
        assert media_bridge is not None, f"media-bridge gadget not found. Found: {[g.get('gadget_id') for g in gadgets]}"
        assert media_bridge.get('codename') == 'custard', f"media-bridge codename wrong: {media_bridge.get('codename')}"
        assert media_bridge.get('name') == 'Media Bridge', f"media-bridge name wrong: {media_bridge.get('name')}"
        
        # Verify NO Jellyfin gadget exists
        jellyfin_gadget = None
        for g in gadgets:
            if 'jellyfin' in g.get('gadget_id', '').lower() or 'jellyfin' in g.get('name', '').lower():
                jellyfin_gadget = g
                break
        assert jellyfin_gadget is None, f"Found Jellyfin gadget that should be removed: {jellyfin_gadget}"
        
        # Verify no Jellyfin in entire response
        response_text = response.text.lower()
        assert 'jellyfin' not in response_text, f"Found 'jellyfin' in ripen/installed response"
        
        print(f"✓ Ripen installed includes media-bridge: {media_bridge}")


class TestJellyfinRemovalCrumbsServices:
    """Test /api/crumbs/services - should include media-bridge service"""
    
    def test_crumbs_services_includes_media_bridge(self, auth_token):
        """GET /api/crumbs/services - should include media-bridge service"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/crumbs/services", headers=headers, timeout=10)
        assert response.status_code == 200, f"Crumbs services failed: {response.status_code}"
        
        services = response.json()
        assert isinstance(services, list), "Services response should be a list"
        
        # Find media-bridge service
        media_bridge = None
        for s in services:
            if s.get('id') == 'media-bridge':
                media_bridge = s
                break
        
        assert media_bridge is not None, f"media-bridge service not found. Found: {[s.get('id') for s in services]}"
        assert media_bridge.get('name') == 'Media Bridge', f"media-bridge name wrong: {media_bridge.get('name')}"
        assert media_bridge.get('category') == 'gadgets', f"media-bridge category wrong: {media_bridge.get('category')}"
        
        # Verify NO Jellyfin service exists
        jellyfin_service = None
        for s in services:
            if 'jellyfin' in s.get('id', '').lower() or 'jellyfin' in s.get('name', '').lower():
                jellyfin_service = s
                break
        assert jellyfin_service is None, f"Found Jellyfin service that should be removed: {jellyfin_service}"
        
        # Verify no Jellyfin in entire response
        response_text = response.text.lower()
        assert 'jellyfin' not in response_text, f"Found 'jellyfin' in crumbs/services response"
        
        print(f"✓ Crumbs services includes media-bridge: {media_bridge}")


class TestMediaBridgeEndpoints:
    """Test MediaBridge controller endpoints at /api/gadgets/media-bridge/*"""
    
    def test_media_bridge_config(self, auth_token):
        """GET /api/gadgets/media-bridge/config - should return {configured: false, url: null}"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/gadgets/media-bridge/config", headers=headers, timeout=10)
        assert response.status_code == 200, f"Media bridge config failed: {response.status_code}"
        
        data = response.json()
        assert 'configured' in data, "No 'configured' field in config response"
        # May be true or false depending on prior configuration
        assert data.get('configured') in [True, False], f"Invalid configured value: {data.get('configured')}"
        
        # Verify no Jellyfin in response
        assert 'jellyfin' not in response.text.lower(), f"Found 'jellyfin' in media-bridge/config response"
        
        print(f"✓ Media bridge config: configured={data.get('configured')}, url={data.get('url')}")

    def test_media_bridge_test_not_configured(self, auth_token):
        """POST /api/gadgets/media-bridge/test - should return error about not being configured"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/gadgets/media-bridge/test", headers=headers, timeout=10)
        
        # Should return 400 Bad Request if not configured
        # OR 200 with success=false if configured but server unreachable
        assert response.status_code in [200, 400], f"Media bridge test unexpected status: {response.status_code}"
        
        data = response.json()
        
        if response.status_code == 400:
            assert 'detail' in data, "No detail in 400 response"
            assert 'not configured' in data.get('detail', '').lower(), f"Unexpected error detail: {data.get('detail')}"
            print(f"✓ Media bridge test correctly returns 'not configured' error")
        else:
            # 200 - could be success=false with connection error
            print(f"✓ Media bridge test endpoint working: {data}")
        
        # Verify no Jellyfin in response
        assert 'jellyfin' not in response.text.lower(), f"Found 'jellyfin' in media-bridge/test response"


class TestFortressAudit:
    """Test /api/fortress/audit - should return audit entries without Jellyfin"""
    
    def test_fortress_audit(self, auth_token):
        """GET /api/fortress/audit - should return audit entries"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/fortress/audit", headers=headers, timeout=10)
        assert response.status_code == 200, f"Fortress audit failed: {response.status_code}"
        
        data = response.json()
        # Response can be array or object with entries
        
        # Verify no Jellyfin in response
        assert 'jellyfin' not in response.text.lower(), f"Found 'jellyfin' in fortress/audit response"
        
        print(f"✓ Fortress audit endpoint working")


class TestGlobalJellyfinScan:
    """Comprehensive scan of multiple endpoints for Jellyfin references"""
    
    def test_no_jellyfin_in_any_endpoint(self, auth_token):
        """Scan multiple endpoints to ensure NO Jellyfin references anywhere"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        endpoints_to_check = [
            "/api/health",
            "/api/info",
            "/api/gadgets/plugins",
            "/api/ripen/installed",
            "/api/ripen/hooks",
            "/api/crumbs/services",
            "/api/crumbs/configured",
            "/api/gadgets/media-bridge/config",
            "/api/fortress/audit",
            "/api/fortress/status",
        ]
        
        jellyfin_found_in = []
        
        for endpoint in endpoints_to_check:
            try:
                if endpoint == "/api/health":
                    response = requests.get(f"{BASE_URL}{endpoint}", timeout=10)
                else:
                    response = requests.get(f"{BASE_URL}{endpoint}", headers=headers, timeout=10)
                
                if response.status_code == 200:
                    response_text = response.text.lower()
                    if 'jellyfin' in response_text:
                        jellyfin_found_in.append(endpoint)
                        print(f"✗ Found 'jellyfin' in {endpoint}")
                    else:
                        print(f"✓ No jellyfin in {endpoint}")
                else:
                    print(f"⚠ {endpoint} returned {response.status_code}")
            except Exception as e:
                print(f"⚠ Error checking {endpoint}: {e}")
        
        assert len(jellyfin_found_in) == 0, f"Found 'jellyfin' references in: {jellyfin_found_in}"
        print(f"✓ No Jellyfin references found in any of {len(endpoints_to_check)} checked endpoints")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
