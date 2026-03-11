"""
WatchNexus v3.0.0-beta API Tests - Iteration 33
Testing the NEW C#/.NET 8 backend (replaces Python)
CLEAN DATABASE - must register user first
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials for clean DB
TEST_EMAIL = "test@test.com"
TEST_USERNAME = "testuser"
TEST_PASSWORD = "password"


class TestHealthAndInfo:
    """Health check and system info endpoints - no auth required"""
    
    def test_health_endpoint(self):
        """GET /api/health returns version 3.0.0-beta"""
        resp = requests.get(f"{BASE_URL}/api/health")
        assert resp.status_code == 200, f"Health check failed: {resp.text}"
        data = resp.json()
        assert data["status"] == "healthy"
        assert data["version"] == "3.0.0-beta"
        print(f"PASS: Health endpoint returns version {data['version']}")


class TestAuthenticationFlow:
    """Authentication: Register (clean DB) and Login"""
    
    def test_01_register_new_user(self):
        """POST /api/auth/register creates new user in clean DB"""
        resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL,
            "username": TEST_USERNAME,
            "password": TEST_PASSWORD
        })
        # May return 409 if user already exists from previous test run
        if resp.status_code == 409:
            print(f"INFO: User already exists, continuing with login")
            return
        assert resp.status_code == 200, f"Register failed: {resp.status_code} - {resp.text}"
        data = resp.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        print(f"PASS: User registered successfully with email {TEST_EMAIL}")
    
    def test_02_login_valid_credentials(self):
        """POST /api/auth/login returns access_token and user data"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert resp.status_code == 200, f"Login failed: {resp.status_code} - {resp.text}"
        data = resp.json()
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        assert data["user"]["email"] == TEST_EMAIL
        print(f"PASS: Login successful, token received")
        
    def test_03_login_invalid_credentials(self):
        """POST /api/auth/login with wrong password returns 401"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": "wrong_password"
        })
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("PASS: Invalid credentials correctly rejected")


@pytest.fixture(scope="module")
def auth_token():
    """Get auth token for authenticated tests"""
    # First try to register in case DB is clean
    requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": TEST_EMAIL,
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD
    })
    # Then login
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if resp.status_code != 200:
        pytest.skip(f"Could not get auth token: {resp.status_code} - {resp.text}")
    return resp.json()["access_token"]


class TestAuthenticatedEndpoints:
    """Tests requiring authentication"""
    
    def test_auth_me(self, auth_token):
        """GET /api/auth/me returns current user"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        resp = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert resp.status_code == 200, f"Auth/me failed: {resp.text}"
        data = resp.json()
        assert "Email" in data or "email" in data
        print("PASS: /api/auth/me returns current user")
    
    def test_users_me_bridge(self, auth_token):
        """GET /api/users/me returns current user (bridge route)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        resp = requests.get(f"{BASE_URL}/api/users/me", headers=headers)
        assert resp.status_code == 200, f"Users/me failed: {resp.text}"
        data = resp.json()
        assert "Email" in data or "email" in data
        print("PASS: /api/users/me bridge route works")
    
    def test_system_info(self, auth_token):
        """GET /api/info returns system info with .NET version and modules list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        resp = requests.get(f"{BASE_URL}/api/info", headers=headers)
        assert resp.status_code == 200, f"Info failed: {resp.text}"
        data = resp.json()
        assert data["version"] == "3.0.0-beta"
        assert "dotnet_version" in data
        assert "modules" in data
        assert len(data["modules"]) >= 5  # 5 built-in modules
        module_names = [m.get("name") or m.get("codename") for m in data["modules"]]
        print(f"PASS: System info with .NET {data['dotnet_version']}, {len(data['modules'])} modules: {module_names[:5]}")


class TestLibraryCRUD:
    """Library management CRUD operations"""
    
    def test_01_create_library(self, auth_token):
        """POST /api/libraries creates a library"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        resp = requests.post(f"{BASE_URL}/api/libraries", headers=headers, json={
            "name": "Test Movies Library",
            "path": "/tmp/test-movies",
            "mediaType": "Movie"
        })
        assert resp.status_code == 200, f"Create library failed: {resp.text}"
        data = resp.json()
        assert "Id" in data or "id" in data
        assert data.get("Name") == "Test Movies Library" or data.get("name") == "Test Movies Library"
        print(f"PASS: Library created with ID {data.get('Id') or data.get('id')}")
        return data.get("Id") or data.get("id")
    
    def test_02_get_libraries(self, auth_token):
        """GET /api/libraries returns libraries list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        resp = requests.get(f"{BASE_URL}/api/libraries", headers=headers)
        assert resp.status_code == 200, f"Get libraries failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"PASS: Retrieved {len(data)} libraries")
        return data
    
    def test_03_scan_library(self, auth_token):
        """POST /api/libraries/{id}/scan starts background scan"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        # Get libraries first
        libs_resp = requests.get(f"{BASE_URL}/api/libraries", headers=headers)
        libs = libs_resp.json()
        if not libs:
            pytest.skip("No libraries to scan")
        
        lib_id = libs[0].get("Id") or libs[0].get("id")
        resp = requests.post(f"{BASE_URL}/api/libraries/{lib_id}/scan", headers=headers)
        assert resp.status_code == 200, f"Scan failed: {resp.text}"
        data = resp.json()
        assert "status" in data or "job_id" in data
        print(f"PASS: Library scan started, status: {data.get('status')}")
    
    def test_04_scan_status(self, auth_token):
        """GET /api/libraries/{id}/scan/status returns scan progress"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        libs_resp = requests.get(f"{BASE_URL}/api/libraries", headers=headers)
        libs = libs_resp.json()
        if not libs:
            pytest.skip("No libraries")
        
        lib_id = libs[0].get("Id") or libs[0].get("id")
        resp = requests.get(f"{BASE_URL}/api/libraries/{lib_id}/scan/status", headers=headers)
        assert resp.status_code == 200, f"Scan status failed: {resp.text}"
        data = resp.json()
        print(f"PASS: Scan status: {data.get('status', 'idle')}, progress: {data.get('progress', 0)}%")
    
    def test_05_get_library_media(self, auth_token):
        """GET /api/libraries/{id}/media returns media items"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        libs_resp = requests.get(f"{BASE_URL}/api/libraries", headers=headers)
        libs = libs_resp.json()
        if not libs:
            pytest.skip("No libraries")
        
        lib_id = libs[0].get("Id") or libs[0].get("id")
        resp = requests.get(f"{BASE_URL}/api/libraries/{lib_id}/media", headers=headers)
        assert resp.status_code == 200, f"Get media failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"PASS: Retrieved {len(data)} media items")
        if data:
            item = data[0]
            print(f"  Sample item: {item.get('Title') or item.get('title')}, TMDB: {item.get('tmdb_id')}, Poster: {bool(item.get('poster_url'))}")


class TestSecurityModule:
    """Security (Bastion) module endpoints"""
    
    def test_security_stats(self, auth_token):
        """GET /api/security/stats returns security statistics"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        resp = requests.get(f"{BASE_URL}/api/security/stats", headers=headers)
        assert resp.status_code == 200, f"Security stats failed: {resp.text}"
        data = resp.json()
        assert "total_audit_logs" in data or "ip_rules_count" in data
        print(f"PASS: Security stats retrieved")
    
    def test_ip_rules_crud(self, auth_token):
        """IP Rules: POST, GET, DELETE"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create IP rule
        resp = requests.post(f"{BASE_URL}/api/security/ip-rules", headers=headers, json={
            "ip": "192.168.1.100",
            "ruleType": "block",
            "reason": "Test block"
        })
        assert resp.status_code == 200, f"Create IP rule failed: {resp.text}"
        rule = resp.json()
        rule_id = rule.get("Id") or rule.get("id")
        print(f"PASS: IP rule created with ID {rule_id}")
        
        # Get IP rules
        resp = requests.get(f"{BASE_URL}/api/security/ip-rules", headers=headers)
        assert resp.status_code == 200
        rules = resp.json()
        assert len(rules) >= 1
        print(f"PASS: Retrieved {len(rules)} IP rules")
        
        # Delete IP rule
        resp = requests.delete(f"{BASE_URL}/api/security/ip-rules/{rule_id}", headers=headers)
        assert resp.status_code == 200
        print(f"PASS: IP rule deleted")
    
    def test_api_keys_crud(self, auth_token):
        """API Keys: POST, GET, DELETE"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create API key
        resp = requests.post(f"{BASE_URL}/api/security/api-keys", headers=headers, json={
            "name": "Test API Key",
            "permissions": "read"
        })
        assert resp.status_code == 200, f"Create API key failed: {resp.text}"
        key_data = resp.json()
        key_id = key_data.get("Id") or key_data.get("id")
        raw_key = key_data.get("key")
        assert raw_key and raw_key.startswith("wnx_"), f"Invalid key format: {raw_key}"
        print(f"PASS: API key created: {raw_key[:12]}...")
        
        # Get API keys
        resp = requests.get(f"{BASE_URL}/api/security/api-keys", headers=headers)
        assert resp.status_code == 200
        keys = resp.json()
        print(f"PASS: Retrieved {len(keys)} API keys")
        
        # Delete (revoke) API key
        resp = requests.delete(f"{BASE_URL}/api/security/api-keys/{key_id}", headers=headers)
        assert resp.status_code == 200
        print(f"PASS: API key revoked")


class TestVpnModule:
    """VPN (Tunnel) module endpoints - MOCKED WireGuard"""
    
    def test_vpn_server_config(self, auth_token):
        """GET /api/vpn/server returns server config"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        resp = requests.get(f"{BASE_URL}/api/vpn/server", headers=headers)
        assert resp.status_code == 200, f"VPN server failed: {resp.text}"
        data = resp.json()
        assert "ListenPort" in data or "listen_port" in data or "is_configured" in data
        print(f"PASS: VPN server config retrieved, configured: {data.get('is_configured', False)}")
    
    def test_vpn_server_setup(self, auth_token):
        """POST /api/vpn/server/setup configures server"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        resp = requests.post(f"{BASE_URL}/api/vpn/server/setup", headers=headers, json={
            "listenPort": 51820,
            "address": "10.0.0.1/24",
            "dns": "1.1.1.1",
            "endpoint": "vpn.example.com",
            "mtu": 1420
        })
        assert resp.status_code == 200, f"VPN setup failed: {resp.text}"
        data = resp.json()
        assert data.get("is_configured") == True
        print(f"PASS: VPN server configured")
    
    def test_vpn_peers_crud(self, auth_token):
        """VPN Peers: POST, GET, DELETE"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create peer
        resp = requests.post(f"{BASE_URL}/api/vpn/peers", headers=headers, json={
            "name": "Test Peer",
            "allowedIps": "10.0.0.0/24"
        })
        assert resp.status_code == 200, f"Create peer failed: {resp.text}"
        peer = resp.json()
        peer_id = peer.get("Id") or peer.get("id")
        assert "publicKey" in peer or "PublicKey" in peer or "public_key" in peer
        print(f"PASS: VPN peer created with ID {peer_id}")
        
        # Get peers
        resp = requests.get(f"{BASE_URL}/api/vpn/peers", headers=headers)
        assert resp.status_code == 200
        peers = resp.json()
        print(f"PASS: Retrieved {len(peers)} peers")
        
        # Delete peer
        resp = requests.delete(f"{BASE_URL}/api/vpn/peers/{peer_id}", headers=headers)
        assert resp.status_code == 200
        print(f"PASS: VPN peer deleted")


class TestSettingsAndIntegrations:
    """Settings and Integration endpoints"""
    
    def test_get_integrations(self, auth_token):
        """GET /api/settings/integrations returns tmdb and qbittorrent config"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        resp = requests.get(f"{BASE_URL}/api/settings/integrations", headers=headers)
        assert resp.status_code == 200, f"Get integrations failed: {resp.text}"
        data = resp.json()
        assert "tmdb" in data
        assert "qbittorrent" in data
        print(f"PASS: Integrations - TMDB has_key: {data['tmdb'].get('has_key')}, qBit enabled: {data['qbittorrent'].get('enabled', False)}")
    
    def test_update_tmdb_key(self, auth_token):
        """PUT /api/settings/integrations/tmdb updates TMDB API key"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        # Use the existing key from env
        resp = requests.put(f"{BASE_URL}/api/settings/integrations/tmdb", headers=headers, json={
            "api_key": "8c860bcb88494f598008480abfe24d13"  # Valid key
        })
        assert resp.status_code == 200, f"Update TMDB failed: {resp.text}"
        print(f"PASS: TMDB key updated")


class TestLogsModule:
    """Logs (Zest) module endpoints"""
    
    def test_get_log_files(self, auth_token):
        """GET /api/logs returns log files list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        resp = requests.get(f"{BASE_URL}/api/logs", headers=headers)
        assert resp.status_code == 200, f"Get logs failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"PASS: Retrieved {len(data)} log files")
    
    def test_get_latest_logs(self, auth_token):
        """GET /api/logs/latest returns latest log entries"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        resp = requests.get(f"{BASE_URL}/api/logs/latest", headers=headers)
        assert resp.status_code == 200, f"Get latest logs failed: {resp.text}"
        data = resp.json()
        print(f"PASS: Latest logs retrieved")
    
    def test_system_health(self, auth_token):
        """GET /api/logs/system returns system diagnostics"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        resp = requests.get(f"{BASE_URL}/api/logs/system", headers=headers)
        assert resp.status_code == 200, f"System health failed: {resp.text}"
        data = resp.json()
        assert "uptime_seconds" in data or "memory_mb" in data
        print(f"PASS: System health - uptime: {data.get('uptime_seconds', 0):.0f}s, memory: {data.get('memory_mb', 0):.1f}MB")


class TestDownloadsModule:
    """Downloads (Fondue) module endpoints"""
    
    def test_get_downloads(self, auth_token):
        """GET /api/downloads returns downloads list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        resp = requests.get(f"{BASE_URL}/api/downloads", headers=headers)
        assert resp.status_code == 200, f"Get downloads failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"PASS: Retrieved {len(data)} downloads")


class TestLibraryCleanup:
    """Cleanup test libraries"""
    
    def test_delete_test_libraries(self, auth_token):
        """DELETE test libraries"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        resp = requests.get(f"{BASE_URL}/api/libraries", headers=headers)
        if resp.status_code != 200:
            return
        
        libs = resp.json()
        for lib in libs:
            lib_name = lib.get("Name") or lib.get("name") or ""
            if "Test" in lib_name:
                lib_id = lib.get("Id") or lib.get("id")
                del_resp = requests.delete(f"{BASE_URL}/api/libraries/{lib_id}", headers=headers)
                print(f"  Deleted test library: {lib_name} - {del_resp.status_code}")
        
        # Verify deletion
        resp = requests.get(f"{BASE_URL}/api/libraries", headers=headers)
        remaining = [l for l in resp.json() if "Test" in (l.get("Name") or l.get("name") or "")]
        assert len(remaining) == 0, f"Some test libraries remain: {remaining}"
        print(f"PASS: Test libraries cleaned up")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
