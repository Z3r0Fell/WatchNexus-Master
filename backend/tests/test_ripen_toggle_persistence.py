"""
WatchNexus v2.6.5 - Ripen Gadget Toggle Persistence Tests
Tests for the 3 user-reported fixes:
1. Gadgets show proper names/icons (gadget_id, name, version, category, description)
2. Toggle persistence via activate/deactivate endpoints
3. Jellyfin removed from Crumbs services
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRipenGadgets:
    """Tests for /api/ripen endpoints - gadget listing and toggle persistence"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, f"No access_token in response: {data}"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Auth headers for API calls"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    # ==================== Fix 1: Gadgets show proper names/icons ====================
    
    def test_ripen_installed_returns_10_gadgets(self, auth_headers):
        """GET /api/ripen/installed returns exactly 10 gadgets"""
        response = requests.get(f"{BASE_URL}/api/ripen/installed", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "gadgets" in data, "Response should have 'gadgets' key"
        gadgets = data["gadgets"]
        assert len(gadgets) == 10, f"Expected 10 gadgets, got {len(gadgets)}"
    
    def test_gadgets_have_required_fields(self, auth_headers):
        """Each gadget has gadget_id, name, version, status, category, description"""
        response = requests.get(f"{BASE_URL}/api/ripen/installed", headers=auth_headers)
        assert response.status_code == 200
        gadgets = response.json()["gadgets"]
        
        required_fields = ["gadget_id", "name", "version", "status", "category", "description"]
        for gadget in gadgets:
            for field in required_fields:
                assert field in gadget, f"Gadget missing '{field}': {gadget}"
    
    def test_gadgets_have_proper_categories(self, auth_headers):
        """Each gadget has a valid category from expected set"""
        response = requests.get(f"{BASE_URL}/api/ripen/installed", headers=auth_headers)
        assert response.status_code == 200
        gadgets = response.json()["gadgets"]
        
        valid_categories = {"weather", "audio", "image", "video", "notification", 
                          "metadata", "system", "game", "service"}
        for gadget in gadgets:
            assert gadget["category"] in valid_categories, f"Invalid category '{gadget['category']}' for {gadget['name']}"
    
    def test_gadgets_have_expected_names(self, auth_headers):
        """Gadgets have meaningful names (Weather, Podcasts, etc.)"""
        response = requests.get(f"{BASE_URL}/api/ripen/installed", headers=auth_headers)
        assert response.status_code == 200
        gadgets = response.json()["gadgets"]
        
        expected_names = {"Weather", "Podcasts", "Internet Radio", "Photo Gallery", 
                        "Web Video", "Matrix Chat", "Jellyfin Bridge", "Synapse Admin",
                        "Movie Quiz", "Background Automation"}
        actual_names = {g["name"] for g in gadgets}
        assert actual_names == expected_names, f"Unexpected gadget names: {actual_names}"
    
    # ==================== Fix 2: Toggle persistence ====================
    
    def test_deactivate_weather_persists(self, auth_headers):
        """POST /api/ripen/deactivate/weather persists deactivation"""
        # Deactivate weather gadget
        response = requests.post(f"{BASE_URL}/api/ripen/deactivate/weather", headers=auth_headers)
        assert response.status_code == 200, f"Deactivate failed: {response.text}"
        data = response.json()
        assert data.get("status") == "deactivated", f"Expected status='deactivated': {data}"
        assert data.get("gadget_id") == "weather", f"Expected gadget_id='weather': {data}"
        
        # Verify it persisted - get installed list
        response = requests.get(f"{BASE_URL}/api/ripen/installed", headers=auth_headers)
        assert response.status_code == 200
        gadgets = response.json()["gadgets"]
        weather = next((g for g in gadgets if g["gadget_id"] == "weather"), None)
        assert weather is not None, "Weather gadget not found"
        assert weather["status"] == "inactive", f"Weather should be inactive, got: {weather['status']}"
    
    def test_activate_weather_persists(self, auth_headers):
        """POST /api/ripen/activate/weather re-activates the gadget"""
        # First ensure it's deactivated
        requests.post(f"{BASE_URL}/api/ripen/deactivate/weather", headers=auth_headers)
        
        # Now activate it
        response = requests.post(f"{BASE_URL}/api/ripen/activate/weather", headers=auth_headers)
        assert response.status_code == 200, f"Activate failed: {response.text}"
        data = response.json()
        assert data.get("status") == "activated", f"Expected status='activated': {data}"
        
        # Verify it persisted
        response = requests.get(f"{BASE_URL}/api/ripen/installed", headers=auth_headers)
        assert response.status_code == 200
        gadgets = response.json()["gadgets"]
        weather = next((g for g in gadgets if g["gadget_id"] == "weather"), None)
        assert weather is not None, "Weather gadget not found"
        assert weather["status"] == "active", f"Weather should be active, got: {weather['status']}"
    
    def test_toggle_roundtrip(self, auth_headers):
        """Full toggle cycle: active -> inactive -> active"""
        # Ensure active state first
        requests.post(f"{BASE_URL}/api/ripen/activate/weather", headers=auth_headers)
        
        response = requests.get(f"{BASE_URL}/api/ripen/installed", headers=auth_headers)
        gadgets = response.json()["gadgets"]
        weather = next(g for g in gadgets if g["gadget_id"] == "weather")
        assert weather["status"] == "active", "Initial state should be active"
        
        # Deactivate
        response = requests.post(f"{BASE_URL}/api/ripen/deactivate/weather", headers=auth_headers)
        assert response.status_code == 200
        
        response = requests.get(f"{BASE_URL}/api/ripen/installed", headers=auth_headers)
        gadgets = response.json()["gadgets"]
        weather = next(g for g in gadgets if g["gadget_id"] == "weather")
        assert weather["status"] == "inactive", "After deactivate should be inactive"
        
        # Activate again
        response = requests.post(f"{BASE_URL}/api/ripen/activate/weather", headers=auth_headers)
        assert response.status_code == 200
        
        response = requests.get(f"{BASE_URL}/api/ripen/installed", headers=auth_headers)
        gadgets = response.json()["gadgets"]
        weather = next(g for g in gadgets if g["gadget_id"] == "weather")
        assert weather["status"] == "active", "After activate should be active again"


class TestCrumbsServices:
    """Tests for /api/crumbs/services - Jellyfin removal verification"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_crumbs_services_count(self, auth_headers):
        """GET /api/crumbs/services returns exactly 11 services"""
        response = requests.get(f"{BASE_URL}/api/crumbs/services", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        services = response.json()
        assert len(services) == 11, f"Expected 11 services, got {len(services)}"
    
    def test_no_jellyfin_in_services(self, auth_headers):
        """Jellyfin should NOT be in Crumbs services"""
        response = requests.get(f"{BASE_URL}/api/crumbs/services", headers=auth_headers)
        assert response.status_code == 200
        services = response.json()
        service_ids = [s["id"] for s in services]
        assert "jellyfin" not in service_ids, f"Jellyfin should not be in services: {service_ids}"
    
    def test_gadgets_category_has_correct_services(self, auth_headers):
        """Gadgets category should only have: openweathermap, matrix, synapse"""
        response = requests.get(f"{BASE_URL}/api/crumbs/services", headers=auth_headers)
        assert response.status_code == 200
        services = response.json()
        
        gadget_services = [s["id"] for s in services if s.get("category") == "gadgets"]
        expected_gadgets = {"openweathermap", "matrix", "synapse"}
        actual_gadgets = set(gadget_services)
        
        assert actual_gadgets == expected_gadgets, \
            f"Gadgets category should be {expected_gadgets}, got {actual_gadgets}"
    
    def test_expected_services_present(self, auth_headers):
        """All 11 expected services are present"""
        response = requests.get(f"{BASE_URL}/api/crumbs/services", headers=auth_headers)
        assert response.status_code == 200
        services = response.json()
        
        expected_ids = {"tmdb", "opensubtitles", "addic7ed", "subscene", "podnapisi",
                       "yifysubtitles", "qbittorrent", "openweathermap", "matrix", 
                       "synapse", "omdb"}
        actual_ids = {s["id"] for s in services}
        
        assert actual_ids == expected_ids, \
            f"Missing or extra services. Expected: {expected_ids}, Got: {actual_ids}"
