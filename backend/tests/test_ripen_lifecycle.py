"""
Test suite for Ripen - Gadget Lifecycle Engine
Tests: install, uninstall, activate, deactivate, installed list, hooks
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "password"

# Pre-installed gadgets from previous curl test
PREINSTALLED_GADGETS = ["wn-arcade-retroarch", "wn-gallery-viewer", "wn-cadence-radio"]

# New gadget to test install
NEW_GADGET = "wn-rhythm-podcast"


class TestRipenAuth:
    """Auth fixture for Ripen tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Auth headers"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestRipenInstalled(TestRipenAuth):
    """Test GET /api/ripen/installed - Returns installed gadgets list"""
    
    def test_get_installed_requires_auth(self):
        """Unauthenticated request should return 401/403"""
        response = requests.get(f"{BASE_URL}/api/ripen/installed")
        assert response.status_code in [401, 403]
    
    def test_get_installed_returns_list(self, headers):
        """Should return list of installed gadgets with hooks"""
        response = requests.get(f"{BASE_URL}/api/ripen/installed", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "gadgets" in data
        gadgets = data["gadgets"]
        assert isinstance(gadgets, list)
        # Verify pre-installed gadgets are present
        gadget_ids = [g["gadget_id"] for g in gadgets]
        for preinstalled in PREINSTALLED_GADGETS:
            assert preinstalled in gadget_ids, f"Pre-installed gadget {preinstalled} should be in list"
    
    def test_installed_gadget_has_hooks(self, headers):
        """Each installed gadget should have hooks data"""
        response = requests.get(f"{BASE_URL}/api/ripen/installed", headers=headers)
        assert response.status_code == 200
        gadgets = response.json()["gadgets"]
        
        for gadget in gadgets:
            # Required fields
            assert "gadget_id" in gadget
            assert "name" in gadget
            assert "status" in gadget
            assert "hooks" in gadget
            # hooks should be a dict
            assert isinstance(gadget["hooks"], dict)


class TestRipenHooks(TestRipenAuth):
    """Test GET /api/ripen/hooks - Returns aggregated UI hooks"""
    
    def test_get_hooks_requires_auth(self):
        """Unauthenticated request should return 401/403"""
        response = requests.get(f"{BASE_URL}/api/ripen/hooks")
        assert response.status_code in [401, 403]
    
    def test_get_hooks_returns_aggregated_structure(self, headers):
        """Should return aggregated hooks from all active gadgets"""
        response = requests.get(f"{BASE_URL}/api/ripen/hooks", headers=headers)
        assert response.status_code == 200
        hooks = response.json()
        
        # Verify structure
        assert "sidebar_entries" in hooks
        assert "routes" in hooks
        assert "settings_panels" in hooks
        assert "dashboard_widgets" in hooks
        assert "theme_presets" in hooks
        assert "providers" in hooks
        
        # sidebar_entries should be a list
        assert isinstance(hooks["sidebar_entries"], list)
        assert isinstance(hooks["routes"], list)
    
    def test_hooks_contain_preinstalled_gadget_data(self, headers):
        """Pre-installed gadgets should contribute sidebar entries"""
        response = requests.get(f"{BASE_URL}/api/ripen/hooks", headers=headers)
        assert response.status_code == 200
        hooks = response.json()
        
        sidebar_entries = hooks["sidebar_entries"]
        sidebar_labels = [e["label"] for e in sidebar_entries]
        
        # wn-arcade-retroarch -> Games
        # wn-gallery-viewer -> Photos
        # wn-cadence-radio -> Radio
        expected_labels = ["Games", "Photos", "Radio"]
        for label in expected_labels:
            assert label in sidebar_labels, f"Sidebar should have '{label}' entry"
    
    def test_hooks_routes_match_sidebar(self, headers):
        """Routes should match sidebar paths"""
        response = requests.get(f"{BASE_URL}/api/ripen/hooks", headers=headers)
        assert response.status_code == 200
        hooks = response.json()
        
        routes = hooks["routes"]
        route_paths = [r["path"] for r in routes]
        
        # Expected routes from pre-installed gadgets
        expected_routes = ["/games", "/photos", "/radio"]
        for route in expected_routes:
            assert route in route_paths, f"Route '{route}' should be in hooks routes"


class TestRipenInstall(TestRipenAuth):
    """Test POST /api/ripen/install/{gadget_id}"""
    
    def test_install_requires_auth(self):
        """Unauthenticated install should fail"""
        response = requests.post(f"{BASE_URL}/api/ripen/install/{NEW_GADGET}")
        assert response.status_code in [401, 403]
    
    def test_install_nonexistent_gadget_fails(self, headers):
        """Installing non-existent gadget should return 400/404"""
        response = requests.post(
            f"{BASE_URL}/api/ripen/install/nonexistent-gadget",
            headers=headers
        )
        assert response.status_code in [400, 404]
    
    def test_install_already_installed_fails(self, headers):
        """Installing already installed gadget should return 400"""
        # Try to install pre-installed gadget
        response = requests.post(
            f"{BASE_URL}/api/ripen/install/wn-arcade-retroarch",
            headers=headers
        )
        assert response.status_code == 400
        assert "already installed" in response.text.lower()
    
    def test_install_new_gadget_success(self, headers):
        """Installing a new gadget should succeed and return hooks"""
        # First check if already installed and uninstall
        installed_res = requests.get(f"{BASE_URL}/api/ripen/installed", headers=headers)
        gadget_ids = [g["gadget_id"] for g in installed_res.json()["gadgets"]]
        
        if NEW_GADGET in gadget_ids:
            # Uninstall first
            requests.delete(f"{BASE_URL}/api/ripen/uninstall/{NEW_GADGET}", headers=headers)
        
        # Now install
        response = requests.post(
            f"{BASE_URL}/api/ripen/install/{NEW_GADGET}",
            headers=headers
        )
        assert response.status_code == 200, f"Install failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data["gadget_id"] == NEW_GADGET
        assert data["status"] == "active"
        assert "hooks" in data
        
        # Verify it appears in installed list
        installed_res = requests.get(f"{BASE_URL}/api/ripen/installed", headers=headers)
        gadget_ids = [g["gadget_id"] for g in installed_res.json()["gadgets"]]
        assert NEW_GADGET in gadget_ids, f"Newly installed gadget should be in installed list"


class TestRipenUninstall(TestRipenAuth):
    """Test DELETE /api/ripen/uninstall/{gadget_id}"""
    
    def test_uninstall_requires_auth(self):
        """Unauthenticated uninstall should fail"""
        response = requests.delete(f"{BASE_URL}/api/ripen/uninstall/{NEW_GADGET}")
        assert response.status_code in [401, 403]
    
    def test_uninstall_nonexistent_returns_false(self, headers):
        """Uninstalling non-installed gadget returns success=false"""
        response = requests.delete(
            f"{BASE_URL}/api/ripen/uninstall/nonexistent-gadget",
            headers=headers
        )
        # Endpoint returns success: false for not found
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == False or data.get("removed") == False
    
    def test_uninstall_installed_gadget(self, headers):
        """Uninstalling an installed gadget should remove it"""
        # Install first
        install_res = requests.post(
            f"{BASE_URL}/api/ripen/install/{NEW_GADGET}",
            headers=headers
        )
        # May already be installed from previous test
        if install_res.status_code not in [200, 400]:
            pytest.fail(f"Install failed unexpectedly: {install_res.text}")
        
        # Now uninstall
        response = requests.delete(
            f"{BASE_URL}/api/ripen/uninstall/{NEW_GADGET}",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True or data.get("removed") == True
        
        # Verify removed from installed list
        installed_res = requests.get(f"{BASE_URL}/api/ripen/installed", headers=headers)
        gadget_ids = [g["gadget_id"] for g in installed_res.json()["gadgets"]]
        assert NEW_GADGET not in gadget_ids, "Uninstalled gadget should not be in list"


class TestRipenActivateDeactivate(TestRipenAuth):
    """Test POST /api/ripen/activate and /api/ripen/deactivate"""
    
    def test_deactivate_gadget(self, headers):
        """Deactivating a gadget should set status to inactive"""
        # Use a pre-installed gadget
        gadget_id = "wn-arcade-retroarch"
        
        response = requests.post(
            f"{BASE_URL}/api/ripen/deactivate/{gadget_id}",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        # Verify status in installed list
        installed_res = requests.get(f"{BASE_URL}/api/ripen/installed", headers=headers)
        gadgets = installed_res.json()["gadgets"]
        gadget = next((g for g in gadgets if g["gadget_id"] == gadget_id), None)
        assert gadget is not None
        assert gadget["status"] == "inactive"
    
    def test_deactivated_gadget_not_in_hooks(self, headers):
        """Deactivated gadget should not appear in active hooks"""
        # wn-arcade-retroarch should now be inactive
        response = requests.get(f"{BASE_URL}/api/ripen/hooks", headers=headers)
        assert response.status_code == 200
        hooks = response.json()
        
        sidebar_labels = [e["label"] for e in hooks["sidebar_entries"]]
        # Games should not be in sidebar when deactivated
        assert "Games" not in sidebar_labels, "Deactivated gadget should not have sidebar entry"
    
    def test_activate_gadget(self, headers):
        """Activating a gadget should set status to active"""
        gadget_id = "wn-arcade-retroarch"
        
        response = requests.post(
            f"{BASE_URL}/api/ripen/activate/{gadget_id}",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        # Verify status in installed list
        installed_res = requests.get(f"{BASE_URL}/api/ripen/installed", headers=headers)
        gadgets = installed_res.json()["gadgets"]
        gadget = next((g for g in gadgets if g["gadget_id"] == gadget_id), None)
        assert gadget is not None
        assert gadget["status"] == "active"
    
    def test_activated_gadget_in_hooks(self, headers):
        """Activated gadget should appear in active hooks"""
        response = requests.get(f"{BASE_URL}/api/ripen/hooks", headers=headers)
        assert response.status_code == 200
        hooks = response.json()
        
        sidebar_labels = [e["label"] for e in hooks["sidebar_entries"]]
        # Games should be back in sidebar
        assert "Games" in sidebar_labels, "Re-activated gadget should have sidebar entry"


class TestRipenIntegration(TestRipenAuth):
    """Integration tests for full Ripen workflow"""
    
    def test_full_gadget_lifecycle(self, headers):
        """Test complete install -> deactivate -> activate -> uninstall cycle"""
        gadget_id = "wn-mosaic-youtube"  # Web Video gadget
        
        # 1. Install
        res = requests.post(f"{BASE_URL}/api/ripen/install/{gadget_id}", headers=headers)
        if res.status_code == 400 and "already installed" in res.text.lower():
            # Already installed, uninstall first
            requests.delete(f"{BASE_URL}/api/ripen/uninstall/{gadget_id}", headers=headers)
            res = requests.post(f"{BASE_URL}/api/ripen/install/{gadget_id}", headers=headers)
        
        assert res.status_code == 200, f"Install failed: {res.text}"
        assert res.json()["status"] == "active"
        
        # 2. Verify in hooks
        hooks_res = requests.get(f"{BASE_URL}/api/ripen/hooks", headers=headers)
        sidebar_labels = [e["label"] for e in hooks_res.json()["sidebar_entries"]]
        assert "Web Video" in sidebar_labels
        
        # 3. Deactivate
        res = requests.post(f"{BASE_URL}/api/ripen/deactivate/{gadget_id}", headers=headers)
        assert res.status_code == 200
        
        # 4. Verify not in hooks
        hooks_res = requests.get(f"{BASE_URL}/api/ripen/hooks", headers=headers)
        sidebar_labels = [e["label"] for e in hooks_res.json()["sidebar_entries"]]
        assert "Web Video" not in sidebar_labels
        
        # 5. Activate
        res = requests.post(f"{BASE_URL}/api/ripen/activate/{gadget_id}", headers=headers)
        assert res.status_code == 200
        
        # 6. Uninstall
        res = requests.delete(f"{BASE_URL}/api/ripen/uninstall/{gadget_id}", headers=headers)
        assert res.status_code == 200
        
        # 7. Verify not in installed list
        installed_res = requests.get(f"{BASE_URL}/api/ripen/installed", headers=headers)
        gadget_ids = [g["gadget_id"] for g in installed_res.json()["gadgets"]]
        assert gadget_id not in gadget_ids


class TestRipenWithNewPodcastGadget(TestRipenAuth):
    """Specific test for installing wn-rhythm-podcast"""
    
    def test_install_podcast_gadget_and_verify_sidebar(self, headers):
        """Install podcast gadget and verify Podcasts appears in sidebar"""
        gadget_id = "wn-rhythm-podcast"
        
        # Uninstall if present
        requests.delete(f"{BASE_URL}/api/ripen/uninstall/{gadget_id}", headers=headers)
        
        # Install
        res = requests.post(f"{BASE_URL}/api/ripen/install/{gadget_id}", headers=headers)
        assert res.status_code == 200, f"Failed to install podcast gadget: {res.text}"
        
        data = res.json()
        assert data["gadget_id"] == gadget_id
        assert data["status"] == "active"
        assert "sidebar" in data["hooks"]
        assert data["hooks"]["sidebar"]["label"] == "Podcasts"
        assert data["hooks"]["sidebar"]["path"] == "/podcasts"
        
        # Verify in aggregated hooks
        hooks_res = requests.get(f"{BASE_URL}/api/ripen/hooks", headers=headers)
        sidebar_entries = hooks_res.json()["sidebar_entries"]
        sidebar_labels = [e["label"] for e in sidebar_entries]
        assert "Podcasts" in sidebar_labels, "Podcasts should appear in sidebar after install"
        
        # Find the entry and verify path
        podcasts_entry = next((e for e in sidebar_entries if e["label"] == "Podcasts"), None)
        assert podcasts_entry is not None
        assert podcasts_entry["path"] == "/podcasts"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
