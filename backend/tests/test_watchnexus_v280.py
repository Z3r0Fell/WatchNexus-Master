"""
WatchNexus v2.8.0 Backend API Tests
Tests all critical endpoints including new gadget pages (Analytics, Notifications, Requests, Parental Controls, Processing, Usenet)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://tier-unlock-4.preview.emergentagent.com')

class TestAuth:
    """Authentication endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local",
            "password": "admin"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local",
            "password": "admin"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert isinstance(data["access_token"], str)
        assert len(data["access_token"]) > 0
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code in [400, 401]


class TestSettings:
    """Settings endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local",
            "password": "admin"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_get_settings(self, auth_headers):
        """Test GET /api/settings"""
        response = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
    
    def test_put_settings_individual(self, auth_headers):
        """Test PUT /api/settings/{key} - individual setting save"""
        response = requests.put(
            f"{BASE_URL}/api/settings/test_key",
            headers=auth_headers,
            json={"value": "test_value_123"}
        )
        assert response.status_code == 200
        
        # Verify the setting was saved
        get_response = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers)
        assert get_response.status_code == 200
        settings = get_response.json()
        assert settings.get("test_key") == "test_value_123"


class TestLibraries:
    """Library management tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local",
            "password": "admin"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_get_libraries(self, auth_headers):
        """Test GET /api/libraries"""
        response = requests.get(f"{BASE_URL}/api/libraries", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_marmalade_status(self, auth_headers):
        """Test GET /api/marmalade/status"""
        response = requests.get(f"{BASE_URL}/api/marmalade/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "version" in data


class TestTruffleAnalytics:
    """Truffle (Watch Analytics) endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local",
            "password": "admin"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_get_stats(self, auth_headers):
        """Test GET /api/truffle/stats"""
        response = requests.get(f"{BASE_URL}/api/truffle/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_plays" in data or "period_days" in data


class TestPepperNotifications:
    """Pepper (Notification Hub) endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local",
            "password": "admin"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_get_channels(self, auth_headers):
        """Test GET /api/pepper/channels"""
        response = requests.get(f"{BASE_URL}/api/pepper/channels", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_channel(self, auth_headers):
        """Test POST /api/pepper/channels - create notification channel"""
        response = requests.post(
            f"{BASE_URL}/api/pepper/channels",
            headers=auth_headers,
            json={
                "name": "TEST_Webhook_Channel",
                "type": "webhook",
                "config": '{"url": "https://example.com/webhook"}'
            }
        )
        # Accept 200, 201, or 409 (already exists)
        assert response.status_code in [200, 201, 409]


class TestMeringueRequests:
    """Meringue (User Requests) endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local",
            "password": "admin"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_get_requests(self, auth_headers):
        """Test GET /api/meringue/requests"""
        response = requests.get(f"{BASE_URL}/api/meringue/requests", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_request(self, auth_headers):
        """Test POST /api/meringue/request - submit media request"""
        response = requests.post(
            f"{BASE_URL}/api/meringue/request",
            headers=auth_headers,
            json={
                "title": "TEST_Movie_Request",
                "media_type": "movie",
                "description": "Test request from pytest"
            }
        )
        assert response.status_code in [200, 201]


class TestRindParentalControls:
    """Rind (Parental Controls) endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local",
            "password": "admin"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_get_profile(self, auth_headers):
        """Test GET /api/rind/profile"""
        response = requests.get(f"{BASE_URL}/api/rind/profile", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "max_rating" in data or "configured" in data


class TestCrucibleProcessing:
    """Crucible (Media Processing) endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local",
            "password": "admin"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_get_jobs(self, auth_headers):
        """Test GET /api/crucible/jobs"""
        response = requests.get(f"{BASE_URL}/api/crucible/jobs", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestUsenetGadgets:
    """Usenet gadget (Brine/Ladle) endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local",
            "password": "admin"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_get_brine_config(self, auth_headers):
        """Test GET /api/gadgets/brine/config"""
        response = requests.get(f"{BASE_URL}/api/gadgets/brine/config", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "configured" in data or "url" in data
    
    def test_get_ladle_config(self, auth_headers):
        """Test GET /api/gadgets/ladle/config"""
        response = requests.get(f"{BASE_URL}/api/gadgets/ladle/config", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "configured" in data or "url" in data


class TestSystemInfo:
    """System info endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local",
            "password": "admin"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_get_system_info(self, auth_headers):
        """Test GET /api/system/info"""
        response = requests.get(f"{BASE_URL}/api/system/info", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "version" in data
        assert data["version"] == "2.8.0"
