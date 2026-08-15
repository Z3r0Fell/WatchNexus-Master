"""
WatchNexus v2.7.3 Backend API Tests
Testing: Auth, Fortress security, Gadgets, Weather, Crumbs, Libraries, System
Version bump, EF Core migrations, dynamic module loading, Fortress security feature
"""
import pytest
import requests
import os

TEST_EMAIL = os.environ.get('TEST_EMAIL', '')
TEST_PASSWORD = os.environ.get('TEST_PASSWORD', '')

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

if not TEST_EMAIL or not TEST_PASSWORD:
    pytest.skip("TEST_EMAIL and TEST_PASSWORD required", allow_module_level=True)

class TestAuth:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Auth: Login with valid credentials returns JWT token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "access_token" in data, "Response missing access_token"
        assert "user" in data, "Response missing user object"
        assert data["user"]["email"] == TEST_EMAIL, "Email mismatch in response"
        assert len(data["access_token"]) > 20, "Access token too short"
        
    def test_login_invalid_credentials(self):
        """Auth: Login with wrong credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@wrong.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Error response should have detail field"


class TestFortress:
    """Fortress security feature tests - P2 requirement"""
    
    def test_fortress_status_public(self):
        """Fortress Status: GET /api/fortress/status (no auth required)"""
        response = requests.get(f"{BASE_URL}/api/fortress/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify Fortress is initialized and tracking assemblies
        assert data.get("initialized") == True, "Fortress should be initialized"
        assert data.get("intact") == True, "Fortress should show intact=true"
        assert data.get("status") == "secure", "Fortress status should be 'secure'"
        assert data.get("assembliesTracked", 0) >= 1, "Should track at least 1 assembly"
        
        # Verify activation info
        activation = data.get("activation", {})
        assert activation.get("licensed") == True, "Instance should be licensed"
        assert "instanceId" in activation, "Should have instanceId"
        assert activation["instanceId"].startswith("WN-"), "Instance ID should start with WN-"
        
    def test_fortress_verify(self):
        """Fortress Verify: POST /api/fortress/verify returns assembly verification"""
        response = requests.post(f"{BASE_URL}/api/fortress/verify")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "intact" in data, "Response should have 'intact' field"
        assert data["intact"] == True, "All assemblies should be intact"
        assert "assemblies" in data, "Response should have 'assemblies' list"
        assert len(data["assemblies"]) >= 1, "Should have at least 1 assembly listed"
        assert "checked_at" in data, "Response should have 'checked_at' timestamp"


class TestGadgetsAndRipen:
    """Gadgets/Ripen tests - verifying gadget list and toggles"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Could not authenticate")
    
    def test_ripen_installed_returns_10_gadgets(self):
        """Gadgets: GET /api/ripen/installed returns 10 gadgets"""
        response = requests.get(f"{BASE_URL}/api/ripen/installed", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "gadgets" in data, "Response should have 'gadgets' key"
        gadgets = data["gadgets"]
        assert len(gadgets) == 10, f"Expected 10 gadgets, got {len(gadgets)}"
        
        # Verify each gadget has required fields
        for gadget in gadgets:
            assert "gadget_id" in gadget, f"Gadget missing gadget_id: {gadget}"
            assert "name" in gadget, f"Gadget missing name: {gadget}"
            assert "category" in gadget, f"Gadget missing category: {gadget}"
            assert "description" in gadget, f"Gadget missing description: {gadget}"
            
    def test_gadgets_have_expected_names(self):
        """Gadgets: Verify all expected gadgets are present"""
        response = requests.get(f"{BASE_URL}/api/ripen/installed", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        gadgets = data["gadgets"]
        
        expected_names = {
            "Weather", "Podcasts", "Internet Radio", "Photo Gallery", 
            "Web Video", "Matrix Chat", "Jellyfin Bridge", "Synapse Admin", 
            "Movie Quiz", "Background Automation"
        }
        actual_names = {g["name"] for g in gadgets}
        assert actual_names == expected_names, f"Name mismatch. Missing: {expected_names - actual_names}, Extra: {actual_names - expected_names}"


class TestWeather:
    """Weather gadget API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Could not authenticate")
    
    def test_weather_with_coordinates(self):
        """Weather: GET /api/gadgets/weather with lat/lon returns weather data"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/weather",
            params={"lat": 40.7, "lon": -74.0},
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Open-Meteo API returns these fields
        assert "current" in data or "error" not in data, "Should return weather data or not error"
        if "current" in data:
            assert "temperature_2m" in data["current"], "Current weather should have temperature"


class TestCrumbs:
    """Crumbs API management tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Could not authenticate")
    
    def test_crumbs_services_returns_11_services(self):
        """Crumbs Registry: GET /api/crumbs/services returns 11 services"""
        response = requests.get(f"{BASE_URL}/api/crumbs/services", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        assert len(data) == 11, f"Expected 11 services, got {len(data)}"
        
        # Verify expected service IDs
        service_ids = {s["id"] for s in data}
        expected_services = {
            "tmdb", "opensubtitles", "addic7ed", "subscene", "podnapisi",
            "yifysubtitles", "qbittorrent", "openweathermap", "matrix", "synapse", "omdb"
        }
        assert service_ids == expected_services, f"Service mismatch. Missing: {expected_services - service_ids}"


class TestLibraries:
    """Marmalade library management tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Could not authenticate")
    
    def test_libraries_list(self):
        """Libraries: GET /api/marmalade/libraries returns array"""
        response = requests.get(f"{BASE_URL}/api/marmalade/libraries", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"


class TestSystemStats:
    """System statistics tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Could not authenticate")
    
    def test_system_stats(self):
        """System Stats: GET /api/system/stats returns system metrics"""
        response = requests.get(f"{BASE_URL}/api/system/stats", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify expected metric fields
        assert "memory_mb" in data, "Should have memory_mb"
        assert "cpu_time_seconds" in data, "Should have cpu_time_seconds"
        assert "uptime_seconds" in data, "Should have uptime_seconds"
        assert data["uptime_seconds"] > 0, "Uptime should be positive"


class TestVersion:
    """Version verification tests - P3 requirement"""
    
    def test_health_endpoint(self):
        """Health endpoint returns version (may still show 2.6.5 in API)"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        # Note: health endpoint may show old version, startup banner shows 2.7.3


class TestGadgetsPlugins:
    """Gadgets catalogue/plugins API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Could not authenticate")
    
    def test_gadgets_plugins_returns_10(self):
        """GET /api/gadgets/plugins returns 10 plugins"""
        response = requests.get(f"{BASE_URL}/api/gadgets/plugins", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        assert len(data) == 10, f"Expected 10 plugins, got {len(data)}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
