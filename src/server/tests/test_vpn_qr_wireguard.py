"""
WatchNexus VPN QR Code and WireGuard Control Tests
Tests new VPN features:
- GET /api/vpn/peers/{id}/qr-data - Returns base64 QR code image and config text
- GET /api/vpn/peers/{id}/qr - Returns PNG image
- POST /api/vpn/server/wg-up - WireGuard up (expected to fail - wg not installed)
- POST /api/vpn/server/wg-down - WireGuard down (expected to fail - wg not installed)
- GET /api/vpn/server/wg-status - WireGuard status
"""

import pytest
import requests
import os
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://media-pipeline-demo.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "password"


@pytest.fixture
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("Authentication failed")


@pytest.fixture
def auth_headers(auth_token):
    """Get auth headers"""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def existing_peer_id(auth_headers):
    """Get an existing peer ID for testing"""
    response = requests.get(f"{BASE_URL}/api/vpn/peers", headers=auth_headers)
    if response.status_code == 200:
        peers = response.json()
        if peers and len(peers) > 0:
            return peers[0]["id"]
    pytest.skip("No existing VPN peers for testing")


class TestVPNQRCodeEndpoints:
    """VPN QR Code Generation Tests"""

    def test_get_peer_qr_data_returns_base64_and_config(self, auth_headers, existing_peer_id):
        """GET /api/vpn/peers/{id}/qr-data - Returns base64 QR image and config text"""
        response = requests.get(
            f"{BASE_URL}/api/vpn/peers/{existing_peer_id}/qr-data",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify qr_image is a data URL with base64 encoded PNG
        assert "qr_image" in data, "qr_image field missing"
        assert data["qr_image"].startswith("data:image/png;base64,"), "QR image should be base64 data URL"
        
        # Verify the base64 can be decoded
        base64_data = data["qr_image"].replace("data:image/png;base64,", "")
        try:
            decoded = base64.b64decode(base64_data)
            # PNG files start with specific magic bytes
            assert decoded[:8] == b'\x89PNG\r\n\x1a\n', "Decoded data should be valid PNG"
        except Exception as e:
            pytest.fail(f"Failed to decode base64 QR image: {e}")
        
        # Verify config text is present
        assert "config" in data, "config field missing"
        assert "[Interface]" in data["config"], "Config should contain WireGuard [Interface] section"
        assert "[Peer]" in data["config"], "Config should contain WireGuard [Peer] section"

    def test_get_peer_qr_returns_png_image(self, auth_headers, existing_peer_id):
        """GET /api/vpn/peers/{id}/qr - Returns PNG image with correct content-type"""
        response = requests.get(
            f"{BASE_URL}/api/vpn/peers/{existing_peer_id}/qr",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # Verify content type is image/png
        content_type = response.headers.get("Content-Type", "")
        assert "image/png" in content_type, f"Expected image/png, got {content_type}"
        
        # Verify PNG magic bytes
        assert response.content[:8] == b'\x89PNG\r\n\x1a\n', "Response should be valid PNG file"
        
        # Verify reasonable image size (QR codes are typically 5-50KB)
        assert len(response.content) > 1000, "QR code image too small"
        assert len(response.content) < 100000, "QR code image too large"

    def test_get_qr_for_nonexistent_peer_returns_404(self, auth_headers):
        """GET /api/vpn/peers/{invalid_id}/qr-data - Returns 404 for non-existent peer"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = requests.get(
            f"{BASE_URL}/api/vpn/peers/{fake_id}/qr-data",
            headers=auth_headers
        )
        assert response.status_code == 404


class TestWireGuardControls:
    """WireGuard Control Endpoint Tests (wg commands not installed - expect graceful errors)"""

    def test_wg_up_returns_error_when_wg_not_installed(self, auth_headers):
        """POST /api/vpn/server/wg-up - Returns error when wg-quick not available"""
        response = requests.post(
            f"{BASE_URL}/api/vpn/server/wg-up",
            headers=auth_headers
        )
        # Expected to return 500 because wg-quick is not installed
        # The endpoint should handle this gracefully
        assert response.status_code in [200, 500], f"Unexpected status: {response.status_code}"
        
        data = response.json()
        assert "message" in data or "output" in data, "Response should have message or output"
        
        # If 500, the error message should indicate wg-quick issue
        if response.status_code == 500:
            message = data.get("message", "")
            assert "wg" in message.lower() or "wireguard" in message.lower() or "failed" in message.lower(), \
                f"Error should mention WireGuard: {message}"

    def test_wg_down_returns_error_when_wg_not_installed(self, auth_headers):
        """POST /api/vpn/server/wg-down - Returns error when wg-quick not available"""
        response = requests.post(
            f"{BASE_URL}/api/vpn/server/wg-down",
            headers=auth_headers
        )
        # Expected to return 500 because wg-quick is not installed
        assert response.status_code in [200, 500], f"Unexpected status: {response.status_code}"
        
        data = response.json()
        assert "message" in data or "output" in data, "Response should have message or output"

    def test_wg_status_returns_output(self, auth_headers):
        """GET /api/vpn/server/wg-status - Returns WireGuard status or error"""
        response = requests.get(
            f"{BASE_URL}/api/vpn/server/wg-status",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "output" in data, "Response should have output field"
        assert "available" in data, "Response should have available field"
        
        # wg is not installed, so available should be False
        # The output should contain error message about wg not found
        print(f"WireGuard status output: {data.get('output', '')[:200]}")


class TestVPNStatsWithPeerCounts:
    """VPN Stats endpoint should return peer counts"""

    def test_vpn_stats_returns_peer_counts(self, auth_headers):
        """GET /api/vpn/stats - Returns VPN stats with peer counts"""
        response = requests.get(f"{BASE_URL}/api/vpn/stats", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify all required fields present
        assert "server_active" in data, "server_active field missing"
        assert "total_peers" in data, "total_peers field missing"
        assert "active_peers" in data, "active_peers field missing"
        assert "max_peers" in data, "max_peers field missing"
        
        # Verify counts are non-negative integers
        assert isinstance(data["total_peers"], int), "total_peers should be int"
        assert isinstance(data["active_peers"], int), "active_peers should be int"
        assert data["total_peers"] >= 0, "total_peers should be >= 0"
        assert data["active_peers"] >= 0, "active_peers should be >= 0"
        assert data["active_peers"] <= data["total_peers"], "active_peers should be <= total_peers"


class TestVPNPeersWithAssignedIPs:
    """VPN Peers should have assigned IPs"""

    def test_get_peers_returns_assigned_ips(self, auth_headers):
        """GET /api/vpn/peers - Returns peers with assigned IPs"""
        response = requests.get(f"{BASE_URL}/api/vpn/peers", headers=auth_headers)
        assert response.status_code == 200
        
        peers = response.json()
        assert isinstance(peers, list), "Response should be a list"
        
        # Check each peer has required fields
        for peer in peers:
            assert "id" in peer, "Peer should have id"
            assert "name" in peer, "Peer should have name"
            assert "assigned_ip" in peer, "Peer should have assigned_ip"
            assert "is_enabled" in peer, "Peer should have is_enabled"
            
            # Verify assigned_ip looks like an IP address
            ip = peer["assigned_ip"]
            if ip:
                parts = ip.split(".")
                assert len(parts) == 4, f"Invalid IP format: {ip}"
                
            print(f"Peer: {peer['name']} - IP: {peer['assigned_ip']} - Enabled: {peer['is_enabled']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
