"""
WatchNexus v2.8.4 Backend API Tests
Tests: Bastion (2FA/LDAP), Tunnel (VPN/Network), System page, CONFIGURE_ME removal, 35 modules
"""
import pytest
import requests
import os
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    def test_login_success(self):
        """Test login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local",
            "password": "admin"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        print(f"✓ Login successful, token received")
        return data["access_token"]


class TestHealthAndInfo:
    """Health and Info endpoint tests for v2.8.4"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local",
            "password": "admin"
        })
        return response.json().get("access_token")
    
    def test_health_endpoint(self):
        """Test /api/health returns v2.8.4 with runtime and OS"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        
        # Version check
        assert data.get("version") == "2.8.4", f"Expected v2.8.4, got {data.get('version')}"
        
        # Runtime check (.NET 10.x)
        runtime = data.get("runtime", "")
        assert ".NET" in runtime, f"Runtime should contain .NET, got: {runtime}"
        assert "10" in runtime, f"Runtime should be .NET 10.x, got: {runtime}"
        
        # OS check
        assert "os" in data, "Missing 'os' field"
        assert len(data["os"]) > 0, "OS field is empty"
        
        # Architecture check
        assert "architecture" in data, "Missing 'architecture' field"
        
        print(f"✓ Health: v{data['version']}, {runtime}, {data['os']}, {data['architecture']}")
    
    def test_info_endpoint(self, auth_token):
        """Test /api/info returns codename, framework, security, 35 modules"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/info", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Version and codename
        assert data.get("version") == "2.8.4", f"Expected v2.8.4, got {data.get('version')}"
        assert data.get("codename") == "WatchNexus", f"Expected codename WatchNexus"
        
        # Framework
        framework = data.get("framework", "")
        assert ".NET" in framework, f"Framework should contain .NET"
        
        # Server details
        assert "hostname" in data, "Missing hostname"
        assert "platform" in data, "Missing platform"
        assert "architecture" in data, "Missing architecture"
        assert "cpu_count" in data, "Missing cpu_count"
        assert "memory_used" in data, "Missing memory_used"
        assert "uptime" in data, "Missing uptime"
        
        # Security features (8 items)
        security = data.get("security", {})
        expected_security = ["jwt_auth", "password_hashing", "rate_limiting", "cors_policy", 
                           "two_factor", "session_management", "ip_filtering", "api_key_auth"]
        for feature in expected_security:
            assert feature in security, f"Missing security feature: {feature}"
            assert security[feature] == True, f"Security feature {feature} should be True"
        print(f"✓ All 8 security features enabled")
        
        # Modules (35 expected)
        modules = data.get("modules", [])
        assert len(modules) == 35, f"Expected 35 modules, got {len(modules)}"
        
        # Check all modules have v2.8.4 and active status
        for mod in modules:
            assert mod.get("version") == "2.8.4", f"Module {mod.get('name')} has wrong version: {mod.get('version')}"
            assert mod.get("status") == "active", f"Module {mod.get('name')} is not active"
        
        print(f"✓ Info: {len(modules)} modules, all v2.8.4 and active")


class TestBastion:
    """Bastion module tests - LDAP, 2FA, Sessions, Audit"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local",
            "password": "admin"
        })
        return response.json().get("access_token")
    
    def test_bastion_status(self, auth_token):
        """Test Bastion status endpoint"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/bastion/status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("module") == "bastion"
        assert data.get("version") == "2.8.4"
        assert data.get("status") == "active"
        print(f"✓ Bastion status: v{data['version']}, {data['status']}")
    
    def test_2fa_setup(self, auth_token):
        """Test 2FA setup returns TOTP secret, otpauth URI, backup codes"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/bastion/2fa/setup", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check method is TOTP
        assert data.get("method") == "totp", f"Expected method=totp, got {data.get('method')}"
        
        # Check Base32 secret
        secret = data.get("secret", "")
        assert len(secret) > 0, "Secret is empty"
        assert re.match(r'^[A-Z2-7]+$', secret), f"Secret should be Base32 encoded: {secret}"
        
        # Check otpauth URI
        qr_uri = data.get("qr_uri", "")
        assert qr_uri.startswith("otpauth://totp/"), f"Invalid otpauth URI: {qr_uri}"
        assert "secret=" in qr_uri, "otpauth URI missing secret"
        assert "issuer=" in qr_uri, "otpauth URI missing issuer"
        
        # Check backup codes (8 expected)
        backup_codes = data.get("backup_codes", [])
        assert len(backup_codes) == 8, f"Expected 8 backup codes, got {len(backup_codes)}"
        
        print(f"✓ 2FA setup: method={data['method']}, secret length={len(secret)}, {len(backup_codes)} backup codes")
    
    def test_sessions(self, auth_token):
        """Test sessions endpoint returns current session with IP, browser, device"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/bastion/sessions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Sessions should be a list"
        assert len(data) >= 1, "Should have at least 1 session"
        
        session = data[0]
        assert "ip" in session, "Session missing IP"
        assert "browser" in session, "Session missing browser"
        assert "is_current" in session, "Session missing is_current"
        assert "user_agent" in session, "Session missing user_agent"
        
        print(f"✓ Sessions: {len(data)} session(s), IP={session.get('ip')}, browser={session.get('browser')}")
    
    def test_audit_log(self, auth_token):
        """Test audit log returns entries"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/bastion/audit", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Audit log should be a list"
        assert len(data) >= 1, "Should have at least 1 audit entry"
        
        entry = data[0]
        assert "action" in entry, "Audit entry missing action"
        assert "user" in entry, "Audit entry missing user"
        assert "timestamp" in entry, "Audit entry missing timestamp"
        
        print(f"✓ Audit log: {len(data)} entries")
    
    def test_ldap_test(self, auth_token):
        """Test LDAP test endpoint with server param"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/bastion/ldap/test", headers=headers, json={
            "server": "ldap.example.com",
            "port": 389,
            "base_dn": "dc=example,dc=com"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("status") == "success", f"LDAP test failed: {data}"
        assert "server_info" in data, "Missing server_info"
        
        print(f"✓ LDAP test: {data.get('message')}")
    
    def test_ldap_test_missing_server(self, auth_token):
        """Test LDAP test returns error when server is missing"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/bastion/ldap/test", headers=headers, json={})
        assert response.status_code == 400
        data = response.json()
        assert "error" in data.get("message", "").lower() or "required" in data.get("message", "").lower()
        print(f"✓ LDAP test validation: {data.get('message')}")
    
    def test_password_validate(self, auth_token):
        """Test password validation returns strength analysis"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Test weak password
        response = requests.post(f"{BASE_URL}/api/bastion/password/validate", headers=headers, json={
            "password": "weak"
        })
        assert response.status_code == 200
        data = response.json()
        assert "valid" in data, "Missing valid field"
        assert "strength" in data, "Missing strength field"
        assert "issues" in data, "Missing issues field"
        assert data["valid"] == False, "Weak password should be invalid"
        assert data["strength"] == "weak", f"Expected strength=weak, got {data['strength']}"
        
        # Test strong password
        response = requests.post(f"{BASE_URL}/api/bastion/password/validate", headers=headers, json={
            "password": "StrongP@ssw0rd123!"
        })
        data = response.json()
        assert data["valid"] == True, "Strong password should be valid"
        assert data["strength"] in ["good", "strong"], f"Expected good/strong, got {data['strength']}"
        
        print(f"✓ Password validation working")


class TestTunnel:
    """Tunnel module tests - VPN, Network, Certificates, Bandwidth"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local",
            "password": "admin"
        })
        return response.json().get("access_token")
    
    def test_tunnel_status(self, auth_token):
        """Test Tunnel status endpoint"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/tunnel/status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("module") == "tunnel"
        assert data.get("version") == "2.8.4"
        assert data.get("status") == "active"
        print(f"✓ Tunnel status: v{data['version']}, {data['status']}")
    
    def test_network_info(self, auth_token):
        """Test network-info returns real hostname, interfaces, IPs"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/tunnel/network-info", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "hostname" in data, "Missing hostname"
        assert len(data["hostname"]) > 0, "Hostname is empty"
        
        assert "interfaces" in data, "Missing interfaces"
        assert isinstance(data["interfaces"], list), "Interfaces should be a list"
        
        assert "local_addresses" in data, "Missing local_addresses"
        
        print(f"✓ Network info: hostname={data['hostname']}, {len(data['interfaces'])} interfaces")
    
    def test_test_connectivity(self, auth_token):
        """Test connectivity returns external IP and latency"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/tunnel/test-connectivity", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "external_ip" in data, "Missing external_ip"
        assert "latency_ms" in data, "Missing latency_ms"
        assert "status" in data, "Missing status"
        
        print(f"✓ Connectivity: external_ip={data['external_ip']}, latency={data['latency_ms']}ms")
    
    def test_peer_creation(self, auth_token):
        """Test peer creation generates WireGuard keys"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/tunnel/peers", headers=headers, json={
            "name": "TEST_peer_1"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("status") == "created", f"Expected status=created, got {data.get('status')}"
        
        peer = data.get("peer", {})
        assert "public_key" in peer, "Missing public_key"
        assert "private_key" in peer, "Missing private_key"
        assert "preshared_key" in peer, "Missing preshared_key"
        assert "allowed_ips" in peer, "Missing allowed_ips"
        
        # Verify keys are Base64 encoded
        import base64
        try:
            base64.b64decode(peer["public_key"])
            base64.b64decode(peer["private_key"])
            base64.b64decode(peer["preshared_key"])
        except Exception as e:
            pytest.fail(f"Keys should be Base64 encoded: {e}")
        
        print(f"✓ Peer created with WireGuard keys")
    
    def test_bandwidth(self, auth_token):
        """Test bandwidth returns monitoring data"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/tunnel/bandwidth", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "current" in data, "Missing current"
        assert "history" in data, "Missing history"
        assert "total_today" in data, "Missing total_today"
        
        assert isinstance(data["history"], list), "History should be a list"
        
        print(f"✓ Bandwidth: {len(data['history'])} history entries")
    
    def test_certificates(self, auth_token):
        """Test certificates returns cert list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/tunnel/certificates", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Certificates should be a list"
        assert len(data) >= 1, "Should have at least 1 certificate"
        
        cert = data[0]
        assert "domain" in cert, "Certificate missing domain"
        assert "type" in cert, "Certificate missing type"
        assert "status" in cert, "Certificate missing status"
        
        print(f"✓ Certificates: {len(data)} cert(s)")


class TestConfigureMe:
    """Test CONFIGURE_ME strings are removed"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local",
            "password": "admin"
        })
        return response.json().get("access_token")
    
    def test_trakt_authorize_no_configure_me(self, auth_token):
        """Test Trakt authorize returns error about missing client ID, not hardcoded URL"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/glaze/trakt/authorize", headers=headers)
        
        # Should return 400 with error about missing client ID
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        
        # Check error message mentions client ID configuration
        message = data.get("message", "").lower()
        assert "client" in message or "configured" in message, f"Expected error about client ID, got: {data}"
        
        # Ensure no CONFIGURE_ME in response
        response_text = str(data)
        assert "CONFIGURE_ME" not in response_text, f"Found CONFIGURE_ME in response: {response_text}"
        
        print(f"✓ Trakt authorize: {data.get('message')}")


class TestModulePages:
    """Test module page endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local",
            "password": "admin"
        })
        return response.json().get("access_token")
    
    def test_roux_status(self, auth_token):
        """Test Roux (Collections) status"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/roux/status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("version") == "2.8.4"
        print(f"✓ Roux status: v{data['version']}")
    
    def test_sprout_status(self, auth_token):
        """Test Sprout (RSS) status"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/sprout/status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("version") == "2.8.4"
        print(f"✓ Sprout status: v{data['version']}")
    
    def test_saffron_status(self, auth_token):
        """Test Saffron (Tasks) status"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/saffron/status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("version") == "2.8.4"
        print(f"✓ Saffron status: v{data['version']}")
    
    def test_fondue_status(self, auth_token):
        """Test Fondue (Automation) status"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/fondue/status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("version") == "2.8.4"
        print(f"✓ Fondue status: v{data['version']}")
    
    def test_sourdough_status(self, auth_token):
        """Test Sourdough (Backups) status"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/sourdough/status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("version") == "2.8.4"
        print(f"✓ Sourdough status: v{data['version']}")
    
    def test_churro_status(self, auth_token):
        """Test Churro (Download Clients) status"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/churro/status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("version") == "2.8.4"
        print(f"✓ Churro status: v{data['version']}")
    
    def test_glaze_status(self, auth_token):
        """Test Glaze (Scrobbling) status"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/glaze/status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("version") == "2.8.4"
        print(f"✓ Glaze status: v{data['version']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
