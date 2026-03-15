"""
WatchNexus v2.6.5 User-Requested Fixes Test Suite
Tests for 4 specific fixes:
1) Settings sidebar: "Users & Access" renamed to "Users"
2) Library CRUD: add/delete/scan via /api/marmalade/libraries
3) Gadgets: proper icons/names/descriptions with plugin_type and category fields
4) Crumbs API Management: Jellyfin removed from services (now 11 services)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture(scope='module')
def auth_token():
    """Authenticate and get token for all tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@test.com",
        "password": "password"
    })
    assert response.status_code == 200, f"Auth failed: {response.text}"
    data = response.json()
    assert "access_token" in data, "No access_token in response"
    return data["access_token"]


@pytest.fixture(scope='module')
def auth_headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestCrumbsServicesJellyfinRemoved:
    """Fix #4: Jellyfin removed from Crumbs services - should be exactly 11 services"""
    
    def test_crumbs_services_count_is_11(self, auth_headers):
        """GET /api/crumbs/services should return exactly 11 services (Jellyfin removed)"""
        response = requests.get(f"{BASE_URL}/api/crumbs/services", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        services = response.json()
        assert len(services) == 11, f"Expected 11 services, got {len(services)}"
    
    def test_crumbs_services_no_jellyfin(self, auth_headers):
        """Jellyfin should NOT be in the Crumbs services list"""
        response = requests.get(f"{BASE_URL}/api/crumbs/services", headers=auth_headers)
        assert response.status_code == 200
        services = response.json()
        service_ids = [s['id'] for s in services]
        assert 'jellyfin' not in service_ids, f"Jellyfin should be removed from Crumbs services. Found IDs: {service_ids}"
    
    def test_crumbs_services_expected_list(self, auth_headers):
        """Verify the expected 11 services are present"""
        response = requests.get(f"{BASE_URL}/api/crumbs/services", headers=auth_headers)
        assert response.status_code == 200
        services = response.json()
        service_ids = set(s['id'] for s in services)
        expected_ids = {
            'tmdb', 'opensubtitles', 'addic7ed', 'subscene', 'podnapisi',
            'yifysubtitles', 'qbittorrent', 'openweathermap', 'matrix', 'synapse', 'omdb'
        }
        assert service_ids == expected_ids, f"Service mismatch. Got: {service_ids}, Expected: {expected_ids}"


class TestGadgetsPluginsWithCategoryAndType:
    """Fix #3: Gadgets need proper icons/names/descriptions with plugin_type and category"""
    
    def test_gadgets_plugins_returns_10(self, auth_headers):
        """GET /api/gadgets/plugins should return 10 gadgets"""
        response = requests.get(f"{BASE_URL}/api/gadgets/plugins", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        plugins = response.json()
        assert len(plugins) == 10, f"Expected 10 plugins, got {len(plugins)}"
    
    def test_gadgets_have_plugin_type_field(self, auth_headers):
        """Each gadget should have a plugin_type field"""
        response = requests.get(f"{BASE_URL}/api/gadgets/plugins", headers=auth_headers)
        assert response.status_code == 200
        plugins = response.json()
        for plugin in plugins:
            assert 'plugin_type' in plugin, f"Plugin {plugin.get('id', 'unknown')} missing plugin_type"
            assert plugin['plugin_type'], f"Plugin {plugin.get('id', 'unknown')} has empty plugin_type"
    
    def test_gadgets_have_category_field(self, auth_headers):
        """Each gadget should have a category field"""
        response = requests.get(f"{BASE_URL}/api/gadgets/plugins", headers=auth_headers)
        assert response.status_code == 200
        plugins = response.json()
        for plugin in plugins:
            assert 'category' in plugin, f"Plugin {plugin.get('id', 'unknown')} missing category"
            assert plugin['category'], f"Plugin {plugin.get('id', 'unknown')} has empty category"
    
    def test_gadgets_have_meaningful_names(self, auth_headers):
        """Each gadget should have a meaningful human-readable name"""
        response = requests.get(f"{BASE_URL}/api/gadgets/plugins", headers=auth_headers)
        assert response.status_code == 200
        plugins = response.json()
        expected_names = {
            'weather': 'Weather',
            'podcasts': 'Podcasts',
            'radio': 'Internet Radio',
            'photos': 'Photo Gallery',
            'webvideo': 'Web Video',
            'matrix': 'Matrix Chat',
            'jellyfin': 'Jellyfin Bridge',
            'synapse-admin': 'Synapse Admin',
            'gamebot': 'Movie Quiz',
            'bot': 'Background Automation'
        }
        for plugin in plugins:
            plugin_id = plugin.get('id')
            plugin_name = plugin.get('name')
            if plugin_id in expected_names:
                assert plugin_name == expected_names[plugin_id], \
                    f"Plugin {plugin_id} has wrong name: '{plugin_name}', expected: '{expected_names[plugin_id]}'"
    
    def test_gadgets_have_descriptions(self, auth_headers):
        """Each gadget should have a description"""
        response = requests.get(f"{BASE_URL}/api/gadgets/plugins", headers=auth_headers)
        assert response.status_code == 200
        plugins = response.json()
        for plugin in plugins:
            assert 'description' in plugin, f"Plugin {plugin.get('id', 'unknown')} missing description"
            assert len(plugin['description']) > 10, f"Plugin {plugin.get('id', 'unknown')} has too short description"


class TestLibraryCRUD:
    """Fix #2: Library add/delete/scan via /api/marmalade/libraries"""
    
    created_library_id = None
    
    def test_01_create_library(self, auth_headers):
        """POST /api/marmalade/libraries?name=TestLib&path=/tmp&media_type=movies"""
        response = requests.post(
            f"{BASE_URL}/api/marmalade/libraries",
            params={"name": "TestLib", "path": "/tmp", "media_type": "movies"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        # Verify returned object has required fields
        assert 'Id' in data or 'id' in data, f"Response missing id: {data}"
        TestLibraryCRUD.created_library_id = data.get('Id') or data.get('id')
        
        assert 'Name' in data or 'name' in data, f"Response missing name: {data}"
        name = data.get('Name') or data.get('name')
        assert name == 'TestLib', f"Name mismatch: {name}"
        
        assert 'Path' in data or 'path' in data, f"Response missing path: {data}"
        path = data.get('Path') or data.get('path')
        assert path == '/tmp', f"Path mismatch: {path}"
        
        media_type = data.get('MediaType') or data.get('media_type')
        assert media_type == 'movies', f"MediaType mismatch: {media_type}"
    
    def test_02_get_libraries_includes_created(self, auth_headers):
        """GET /api/marmalade/libraries should include the created library"""
        response = requests.get(f"{BASE_URL}/api/marmalade/libraries", headers=auth_headers)
        assert response.status_code == 200, f"Get failed: {response.text}"
        libraries = response.json()
        
        library_ids = [lib.get('Id') or lib.get('id') for lib in libraries]
        assert TestLibraryCRUD.created_library_id in library_ids, \
            f"Created library {TestLibraryCRUD.created_library_id} not found in {library_ids}"
    
    def test_03_scan_library(self, auth_headers):
        """POST /api/marmalade/libraries/{id}/scan"""
        if not TestLibraryCRUD.created_library_id:
            pytest.skip("No library created")
        
        response = requests.post(
            f"{BASE_URL}/api/marmalade/libraries/{TestLibraryCRUD.created_library_id}/scan",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Scan failed: {response.text}"
        data = response.json()
        
        # Response should have new/updated/total counts
        assert 'new' in data, f"Response missing 'new' count: {data}"
        assert 'updated' in data, f"Response missing 'updated' count: {data}"
        assert 'total' in data, f"Response missing 'total' count: {data}"
    
    def test_04_delete_library(self, auth_headers):
        """DELETE /api/marmalade/libraries/{id}"""
        if not TestLibraryCRUD.created_library_id:
            pytest.skip("No library created")
        
        response = requests.delete(
            f"{BASE_URL}/api/marmalade/libraries/{TestLibraryCRUD.created_library_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Delete failed: {response.text}"
        data = response.json()
        assert data.get('status') == 'deleted', f"Delete status not 'deleted': {data}"
    
    def test_05_verify_library_deleted(self, auth_headers):
        """Verify library is no longer in the list after deletion"""
        if not TestLibraryCRUD.created_library_id:
            pytest.skip("No library created")
        
        response = requests.get(f"{BASE_URL}/api/marmalade/libraries", headers=auth_headers)
        assert response.status_code == 200
        libraries = response.json()
        
        library_ids = [lib.get('Id') or lib.get('id') for lib in libraries]
        assert TestLibraryCRUD.created_library_id not in library_ids, \
            f"Deleted library still in list: {library_ids}"


class TestFullLibraryCRUDCycle:
    """Complete CRUD cycle test for libraries"""
    
    def test_full_crud_cycle(self, auth_headers):
        """POST → GET → SCAN → DELETE full cycle"""
        # CREATE
        create_response = requests.post(
            f"{BASE_URL}/api/marmalade/libraries",
            params={"name": "CycleTest", "path": "/tmp", "media_type": "tv"},
            headers=auth_headers
        )
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        lib_id = create_response.json().get('Id') or create_response.json().get('id')
        assert lib_id, "No library ID returned"
        
        try:
            # READ
            get_response = requests.get(f"{BASE_URL}/api/marmalade/libraries", headers=auth_headers)
            assert get_response.status_code == 200
            lib_ids = [l.get('Id') or l.get('id') for l in get_response.json()]
            assert lib_id in lib_ids, "Created library not found in list"
            
            # SCAN
            scan_response = requests.post(
                f"{BASE_URL}/api/marmalade/libraries/{lib_id}/scan",
                headers=auth_headers
            )
            assert scan_response.status_code == 200
            scan_data = scan_response.json()
            assert 'new' in scan_data and 'updated' in scan_data
            
        finally:
            # DELETE (cleanup)
            delete_response = requests.delete(
                f"{BASE_URL}/api/marmalade/libraries/{lib_id}",
                headers=auth_headers
            )
            assert delete_response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
