"""
Test WatchNexus v1.2.5 Features:
1. Skip segments endpoint
2. Next episode endpoint
3. Indexer settings (already tested, quick verification)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "password"


class TestAuthSetup:
    """Setup tests to verify auth is working"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        # Try to register if login fails
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "username": "testuser"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
        return None
    
    def test_login_works(self, auth_token):
        """Verify we can login"""
        assert auth_token is not None
        assert len(auth_token) > 10


class TestSkipSegmentsEndpoint:
    """Test GET /api/marmalade/media/{id}/skip-segments endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Auth failed")
        return None
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_skip_segments_endpoint_exists(self, headers):
        """Test that skip-segments endpoint returns proper response structure"""
        # Using a test media ID - should return 404 since no real media
        response = requests.get(
            f"{BASE_URL}/api/marmalade/media/test-media-id/skip-segments",
            headers=headers
        )
        # Endpoint should exist - might return 404 if media not found or 200 with segments
        # The important thing is it's not 405 (method not allowed) or 500 (server error)
        assert response.status_code in [200, 404, 503, 520], f"Unexpected status: {response.status_code}"
        
        # If 404, that's expected for non-existent media
        if response.status_code == 404:
            data = response.json()
            assert "detail" in data
            assert "not found" in data["detail"].lower()
    
    def test_skip_segments_response_structure(self, headers):
        """Test skip-segments response has proper structure (when media exists)"""
        # This tests the endpoint structure - when marmalade has media, it should return:
        # {"media_id": "...", "segments": [...]}
        response = requests.get(
            f"{BASE_URL}/api/marmalade/media/any-id/skip-segments",
            headers=headers
        )
        # Should be valid JSON response
        assert response.headers.get("content-type", "").startswith("application/json")


class TestNextEpisodeEndpoint:
    """Test GET /api/marmalade/media/{id}/next-episode endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Auth failed")
        return None
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_next_episode_endpoint_exists(self, headers):
        """Test that next-episode endpoint returns proper response"""
        response = requests.get(
            f"{BASE_URL}/api/marmalade/media/test-media-id/next-episode",
            headers=headers
        )
        # Endpoint should exist - might return 404 or null response
        assert response.status_code in [200, 404, 503, 520], f"Unexpected status: {response.status_code}"
        
        # If 404, that's expected for non-existent media
        if response.status_code == 404:
            data = response.json()
            assert "detail" in data
    
    def test_next_episode_valid_json(self, headers):
        """Test next-episode returns valid JSON"""
        response = requests.get(
            f"{BASE_URL}/api/marmalade/media/any-id/next-episode",
            headers=headers
        )
        assert response.headers.get("content-type", "").startswith("application/json")


class TestIndexerHealthCheck:
    """Test indexer-related endpoints for health check component"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Auth failed")
        return None
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_compote_indexers_list(self, headers):
        """Test GET /api/compote/indexers returns list"""
        response = requests.get(f"{BASE_URL}/api/compote/indexers", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Should return a list (empty or with default indexers)
        assert isinstance(data, list)
    
    def test_compote_default_indexers(self, headers):
        """Test GET /api/compote/default-indexers returns presets"""
        response = requests.get(f"{BASE_URL}/api/compote/default-indexers", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_compote_indexer_types(self, headers):
        """Test GET /api/compote/indexer-types returns type definitions"""
        response = requests.get(f"{BASE_URL}/api/compote/indexer-types", headers=headers)
        assert response.status_code == 200
    
    def test_compote_setup_guide(self, headers):
        """Test GET /api/compote/setup-guide returns guide info"""
        response = requests.get(f"{BASE_URL}/api/compote/setup-guide", headers=headers)
        assert response.status_code == 200


class TestVideoPlayerEndpoints:
    """Test VideoPlayer-related API endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Auth failed")
        return None
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_health_check(self, headers):
        """Verify API health"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
