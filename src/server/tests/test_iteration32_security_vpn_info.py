"""
Iteration 32 Tests: Security Module (Bastion), VPN Module (Tunnel), System Info, Libraries
Tests for all new endpoints added in this iteration:
- Security: /api/security/* (stats, audit, ip-rules, api-keys, sessions)
- VPN: /api/vpn/* (server, peers, wg-status, stats)
- System: /api/info
- Libraries: CRUD with background scan
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests - must pass for other tests to work"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == "test@test.com"
    
    def test_users_me(self, auth_token):
        """Test GET /api/users/me"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/users/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "email" in data


class TestSystemInfo:
    """System info endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        return response.json().get("access_token")
    
    def test_get_system_info(self, auth_token):
        """Test GET /api/info returns system info with version, CPU, memory, disk, modules"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/info", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check version
        assert "version" in data
        
        # Check CPU info
        assert "cpu_count" in data
        assert "cpu_percent" in data
        
        # Check memory info
        assert "memory_total" in data
        assert "memory_used" in data
        assert "memory_percent" in data
        
        # Check disk info
        assert "disk_total" in data
        assert "disk_used" in data
        assert "disk_percent" in data
        
        # Check modules list
        assert "modules" in data
        modules = data["modules"]
        assert "marmalade" in modules
        assert "bastion" in modules
        assert "tunnel" in modules


class TestSecurityModule:
    """Security Module (Bastion) tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        return response.json().get("access_token")
    
    def test_security_stats(self, auth_token):
        """Test GET /api/security/stats returns security statistics"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/security/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_audit_logs" in data
        assert "ip_rules_count" in data
        assert "blocked_ips" in data
        assert "active_api_keys" in data
        assert "active_sessions" in data
    
    def test_security_audit(self, auth_token):
        """Test GET /api/security/audit returns audit logs"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/security/audit", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "logs" in data
        assert "total" in data
        assert "page" in data
    
    def test_ip_rules_crud(self, auth_token):
        """Test IP rules CRUD: POST creates, GET returns list, DELETE removes"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create IP rule
        create_response = requests.post(f"{BASE_URL}/api/security/ip-rules", 
            json={"ip": "10.0.0.100", "rule_type": "block", "reason": "Test block"},
            headers=headers
        )
        assert create_response.status_code == 200
        rule = create_response.json()
        assert "id" in rule
        rule_id = rule["id"]
        
        # Get IP rules list
        list_response = requests.get(f"{BASE_URL}/api/security/ip-rules", headers=headers)
        assert list_response.status_code == 200
        rules = list_response.json()
        assert isinstance(rules, list)
        assert any(r["id"] == rule_id for r in rules)
        
        # Delete IP rule
        delete_response = requests.delete(f"{BASE_URL}/api/security/ip-rules/{rule_id}", headers=headers)
        assert delete_response.status_code == 200
    
    def test_api_keys_crud(self, auth_token):
        """Test API keys: POST creates with visible key, DELETE revokes"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create API key
        create_response = requests.post(f"{BASE_URL}/api/security/api-keys",
            json={"name": "Test API Key", "permissions": ["read", "write"]},
            headers=headers
        )
        assert create_response.status_code == 200
        key_data = create_response.json()
        assert "id" in key_data
        assert "key" in key_data  # Should show full key on creation
        assert key_data["key"].startswith("wnx_")
        key_id = key_data["id"]
        
        # Get API keys list
        list_response = requests.get(f"{BASE_URL}/api/security/api-keys", headers=headers)
        assert list_response.status_code == 200
        keys = list_response.json()
        assert isinstance(keys, list)
        
        # Revoke API key
        delete_response = requests.delete(f"{BASE_URL}/api/security/api-keys/{key_id}", headers=headers)
        assert delete_response.status_code == 200
    
    def test_security_sessions(self, auth_token):
        """Test GET /api/security/sessions returns sessions list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/security/sessions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestVpnModule:
    """VPN Module (Tunnel) tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        return response.json().get("access_token")
    
    def test_vpn_server_get(self, auth_token):
        """Test GET /api/vpn/server returns server config"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/vpn/server", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "interface" in data
        assert "listen_port" in data
        assert "address" in data
        assert "public_key" in data
        assert "is_active" in data
        assert "is_configured" in data
    
    def test_vpn_server_setup(self, auth_token):
        """Test POST /api/vpn/server/setup configures server"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/vpn/server/setup",
            json={
                "listen_port": 51820,
                "address": "10.0.0.1/24",
                "dns": "1.1.1.1",
                "endpoint": "vpn.example.com",
                "mtu": 1420
            },
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_configured"] == True
        assert data["endpoint"] == "vpn.example.com"
    
    def test_vpn_peers_crud(self, auth_token):
        """Test VPN peers: POST creates peer, GET returns list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create peer
        create_response = requests.post(f"{BASE_URL}/api/vpn/peers",
            json={"name": "Test Peer", "allowed_ips": "10.0.0.0/24"},
            headers=headers
        )
        assert create_response.status_code == 200
        peer = create_response.json()
        assert "id" in peer
        assert "public_key" in peer
        assert peer["name"] == "Test Peer"
        peer_id = peer["id"]
        
        # Get peers list
        list_response = requests.get(f"{BASE_URL}/api/vpn/peers", headers=headers)
        assert list_response.status_code == 200
        peers = list_response.json()
        assert isinstance(peers, list)
        assert any(p["id"] == peer_id for p in peers)
        
        # Delete peer
        delete_response = requests.delete(f"{BASE_URL}/api/vpn/peers/{peer_id}", headers=headers)
        assert delete_response.status_code == 200
    
    def test_vpn_wg_status(self, auth_token):
        """Test GET /api/vpn/server/wg-status returns WireGuard status"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/vpn/server/wg-status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "interface" in data
        assert "is_running" in data
        assert "listen_port" in data
        assert "public_key" in data
    
    def test_vpn_stats(self, auth_token):
        """Test GET /api/vpn/stats returns VPN statistics"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/vpn/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "server_active" in data
        assert "server_configured" in data
        assert "total_peers" in data
        assert "active_peers" in data


class TestLibraries:
    """Libraries CRUD and scan tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        return response.json().get("access_token")
    
    def test_libraries_crud(self, auth_token):
        """Test libraries: POST creates, GET returns, DELETE removes"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create library
        create_response = requests.post(f"{BASE_URL}/api/libraries",
            json={
                "name": "Test Library Iteration32",
                "path": "/tmp/test-movies",
                "media_type": "Movie"
            },
            headers=headers
        )
        assert create_response.status_code in [200, 201]
        lib = create_response.json()
        assert "id" in lib
        lib_id = lib["id"]
        
        # Get libraries
        list_response = requests.get(f"{BASE_URL}/api/libraries", headers=headers)
        assert list_response.status_code == 200
        libs = list_response.json()
        assert isinstance(libs, list)
        
        # Delete library
        delete_response = requests.delete(f"{BASE_URL}/api/libraries/{lib_id}", headers=headers)
        assert delete_response.status_code == 200
        
        # Verify deleted
        get_response = requests.get(f"{BASE_URL}/api/libraries/{lib_id}", headers=headers)
        assert get_response.status_code == 404
    
    def test_library_scan_with_background_job(self, auth_token):
        """Test library scan returns immediately with status 'scanning' and can be polled"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create library first
        create_response = requests.post(f"{BASE_URL}/api/libraries",
            json={
                "name": "Scan Test Library",
                "path": "/tmp/test-movies",
                "media_type": "Movie"
            },
            headers=headers
        )
        lib = create_response.json()
        lib_id = lib["id"]
        
        # Start scan
        scan_response = requests.post(f"{BASE_URL}/api/libraries/{lib_id}/scan", headers=headers)
        assert scan_response.status_code == 200
        scan_data = scan_response.json()
        # May return 'scanning' or 'completed' depending on timing
        assert "status" in scan_data or "new" in scan_data or "total" in scan_data
        
        # Wait a bit and check status
        time.sleep(2)
        status_response = requests.get(f"{BASE_URL}/api/libraries/{lib_id}/scan/status", headers=headers)
        assert status_response.status_code == 200
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/libraries/{lib_id}", headers=headers)


class TestIntegrationSettings:
    """Integration settings (TMDB, qBittorrent) tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        return response.json().get("access_token")
    
    def test_get_integration_settings(self, auth_token):
        """Test GET /api/settings/integrations"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/settings/integrations", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "tmdb" in data
        assert "qbittorrent" in data
    
    def test_qbittorrent_test_connection(self, auth_token):
        """Test qBittorrent connection test (expected to return success: false)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/settings/integrations/qbittorrent/test",
            json={"host": "localhost", "port": 8080},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        # Expected to fail since no qBittorrent is running
        assert "success" in data


class TestLogs:
    """Logs (Zest) module tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        return response.json().get("access_token")
    
    def test_get_log_files(self, auth_token):
        """Test GET /api/logs returns log files list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/logs", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_latest_logs(self, auth_token):
        """Test GET /api/logs/latest returns recent log entries"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/logs/latest", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Response has file info and lines or entries
        assert "exists" in data or "entries" in data or "lines" in data
    
    def test_get_system_logs(self, auth_token):
        """Test GET /api/logs/system returns system diagnostics"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/logs/system", headers=headers)
        assert response.status_code == 200


class TestGadgets:
    """Gadgets module tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        return response.json().get("access_token")
    
    def test_weather_gadget(self, auth_token):
        """Test GET /api/gadgets/weather"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/gadgets/weather", headers=headers)
        # May require location, so accept 200 or 400
        assert response.status_code in [200, 400]
    
    def test_radio_stations(self, auth_token):
        """Test GET /api/gadgets/radio/stations"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/gadgets/radio/stations", headers=headers)
        assert response.status_code == 200


class TestDrizzle:
    """Drizzle (Playlist) module tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        return response.json().get("access_token")
    
    def test_get_playlists(self, auth_token):
        """Test GET /api/drizzle/playlists"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/drizzle/playlists", headers=headers)
        assert response.status_code == 200
    
    def test_get_queue(self, auth_token):
        """Test GET /api/drizzle/queue"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/drizzle/queue", headers=headers)
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
