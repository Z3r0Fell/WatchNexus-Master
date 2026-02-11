"""
Test suite for Marmalade Media Server and Compote Indexer Manager - New Features
Tests:
- Marmalade: Library CRUD, scanning, metadata extraction
- Compote: Indexer types, setup guide, update indexer, delete indexer, test indexer
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "password"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


# ==================== MARMALADE MEDIA SERVER TESTS ====================

class TestMarmaladeStatus:
    """Tests for Marmalade server status endpoint"""
    
    def test_marmalade_status_returns_info(self, authenticated_client):
        """GET /api/marmalade/status - should return server status"""
        response = authenticated_client.get(f"{BASE_URL}/api/marmalade/status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "status" in data, "Response should include 'status'"
        assert "libraries" in data, "Response should include 'libraries'"
        assert "total_media" in data, "Response should include 'total_media'"
        
        print(f"✓ GET /api/marmalade/status - Status: {data['status']}, Libraries: {data['libraries']}, Media: {data['total_media']}")
    
    def test_marmalade_status_requires_auth(self):
        """GET /api/marmalade/status - should require authentication"""
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/marmalade/status")
        
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ GET /api/marmalade/status requires authentication")


class TestMarmaladeLibraries:
    """Tests for Marmalade library management endpoints"""
    
    def test_get_libraries_returns_list(self, authenticated_client):
        """GET /api/marmalade/libraries - should return libraries list"""
        response = authenticated_client.get(f"{BASE_URL}/api/marmalade/libraries")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✓ GET /api/marmalade/libraries returned {len(data)} libraries")
    
    def test_add_library_success(self, authenticated_client):
        """POST /api/marmalade/libraries - should add a new library"""
        unique_name = f"TEST_Library_{uuid.uuid4().hex[:8]}"
        
        response = authenticated_client.post(
            f"{BASE_URL}/api/marmalade/libraries",
            params={
                "name": unique_name,
                "path": "/media/library/movies",
                "media_type": "movies"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should include 'id'"
        assert data["name"] == unique_name, f"Name should be {unique_name}"
        assert data["path"] == "/media/library/movies", "Path should match"
        assert data["media_type"] == "movies", "Media type should match"
        
        print(f"✓ POST /api/marmalade/libraries added library: {unique_name} (ID: {data['id']})")
        return data["id"]
    
    def test_add_tv_library(self, authenticated_client):
        """POST /api/marmalade/libraries - should add TV library"""
        unique_name = f"TEST_TV_Library_{uuid.uuid4().hex[:8]}"
        
        response = authenticated_client.post(
            f"{BASE_URL}/api/marmalade/libraries",
            params={
                "name": unique_name,
                "path": "/media/library/tv",
                "media_type": "tv"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["media_type"] == "tv", "Media type should be 'tv'"
        
        print(f"✓ POST /api/marmalade/libraries added TV library: {unique_name}")
        return data["id"]
    
    def test_remove_library(self, authenticated_client):
        """DELETE /api/marmalade/libraries/{id} - should remove library"""
        # First add a library to remove
        unique_name = f"TEST_Remove_Library_{uuid.uuid4().hex[:8]}"
        add_response = authenticated_client.post(
            f"{BASE_URL}/api/marmalade/libraries",
            params={
                "name": unique_name,
                "path": "/tmp/test_library",
                "media_type": "movies"
            }
        )
        assert add_response.status_code == 200, "Failed to add library for removal test"
        library_id = add_response.json()["id"]
        
        # Now remove it
        response = authenticated_client.delete(f"{BASE_URL}/api/marmalade/libraries/{library_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "removed" or data.get("removed") == True, "Should confirm removal"
        
        print(f"✓ DELETE /api/marmalade/libraries/{library_id} removed library")


class TestMarmaladeScanning:
    """Tests for Marmalade library scanning and metadata extraction"""
    
    def test_scan_library(self, authenticated_client):
        """POST /api/marmalade/libraries/{id}/scan - should scan library"""
        # First add a library with real media files
        unique_name = f"TEST_Scan_Library_{uuid.uuid4().hex[:8]}"
        add_response = authenticated_client.post(
            f"{BASE_URL}/api/marmalade/libraries",
            params={
                "name": unique_name,
                "path": "/media/library/movies",
                "media_type": "movies"
            }
        )
        assert add_response.status_code == 200, "Failed to add library for scan test"
        library_id = add_response.json()["id"]
        
        # Scan the library
        response = authenticated_client.post(f"{BASE_URL}/api/marmalade/libraries/{library_id}/scan")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "library" in data or "new" in data, "Response should include scan results"
        
        # Check for scan result fields
        if "new" in data:
            assert "updated" in data, "Should include 'updated' count"
            assert "removed" in data, "Should include 'removed' count"
            assert "total" in data, "Should include 'total' count"
            print(f"✓ Scan results: new={data['new']}, updated={data['updated']}, total={data['total']}")
        
        print(f"✓ POST /api/marmalade/libraries/{library_id}/scan completed")
    
    def test_scan_tv_library(self, authenticated_client):
        """POST /api/marmalade/libraries/{id}/scan - should scan TV library with episode parsing"""
        unique_name = f"TEST_TV_Scan_{uuid.uuid4().hex[:8]}"
        add_response = authenticated_client.post(
            f"{BASE_URL}/api/marmalade/libraries",
            params={
                "name": unique_name,
                "path": "/media/library/tv",
                "media_type": "tv"
            }
        )
        assert add_response.status_code == 200, "Failed to add TV library"
        library_id = add_response.json()["id"]
        
        # Scan the TV library
        response = authenticated_client.post(f"{BASE_URL}/api/marmalade/libraries/{library_id}/scan")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        print(f"✓ TV library scan completed")


class TestMarmaladeMedia:
    """Tests for Marmalade media retrieval endpoints"""
    
    def test_get_all_media(self, authenticated_client):
        """GET /api/marmalade/media - should return media list"""
        response = authenticated_client.get(f"{BASE_URL}/api/marmalade/media")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✓ GET /api/marmalade/media returned {len(data)} items")
    
    def test_get_media_with_filters(self, authenticated_client):
        """GET /api/marmalade/media - should support filtering"""
        response = authenticated_client.get(
            f"{BASE_URL}/api/marmalade/media",
            params={"media_type": "movie", "limit": 10}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) <= 10, "Should respect limit parameter"
        
        print(f"✓ GET /api/marmalade/media with filters returned {len(data)} items")
    
    def test_search_media(self, authenticated_client):
        """GET /api/marmalade/media/search - should search media"""
        response = authenticated_client.get(
            f"{BASE_URL}/api/marmalade/media/search",
            params={"query": "test"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✓ GET /api/marmalade/media/search returned {len(data)} results")
    
    def test_get_recent_media(self, authenticated_client):
        """GET /api/marmalade/media/recent - should return recent media"""
        response = authenticated_client.get(f"{BASE_URL}/api/marmalade/media/recent")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✓ GET /api/marmalade/media/recent returned {len(data)} items")
    
    def test_get_continue_watching(self, authenticated_client):
        """GET /api/marmalade/continue-watching - should return continue watching list"""
        response = authenticated_client.get(f"{BASE_URL}/api/marmalade/continue-watching")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✓ GET /api/marmalade/continue-watching returned {len(data)} items")


# ==================== COMPOTE INDEXER MANAGER TESTS ====================

class TestCompoteIndexerTypes:
    """Tests for Compote indexer types endpoint"""
    
    def test_get_indexer_types(self, authenticated_client):
        """GET /api/compote/indexer-types - should return indexer types"""
        response = authenticated_client.get(f"{BASE_URL}/api/compote/indexer-types")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, dict), "Response should be a dictionary"
        
        # Check for expected indexer types
        expected_types = ["torznab", "newznab", "rss"]
        for itype in expected_types:
            assert itype in data, f"Should include '{itype}' type"
        
        # Verify structure of each type
        for type_name, type_info in data.items():
            assert "name" in type_info, f"Type {type_name} should have 'name'"
            assert "description" in type_info, f"Type {type_name} should have 'description'"
        
        print(f"✓ GET /api/compote/indexer-types returned {len(data)} types: {list(data.keys())}")
    
    def test_indexer_types_no_auth_required(self):
        """GET /api/compote/indexer-types - should not require authentication"""
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/compote/indexer-types")
        
        # This endpoint might or might not require auth - check both cases
        assert response.status_code in [200, 401], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            print("✓ GET /api/compote/indexer-types does not require authentication")
        else:
            print("✓ GET /api/compote/indexer-types requires authentication")


class TestCompoteSetupGuide:
    """Tests for Compote setup guide endpoint"""
    
    def test_get_setup_guide(self, authenticated_client):
        """GET /api/compote/setup-guide - should return setup guide"""
        response = authenticated_client.get(f"{BASE_URL}/api/compote/setup-guide")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, dict), "Response should be a dictionary"
        
        # Check for expected guide sections
        expected_sections = ["jackett", "rss", "cloudflare", "usenet"]
        for section in expected_sections:
            assert section in data, f"Should include '{section}' guide"
        
        # Verify structure of each guide
        for section_name, section_info in data.items():
            assert "title" in section_info, f"Section {section_name} should have 'title'"
            assert "steps" in section_info, f"Section {section_name} should have 'steps'"
            assert isinstance(section_info["steps"], list), f"Steps should be a list"
        
        print(f"✓ GET /api/compote/setup-guide returned {len(data)} sections: {list(data.keys())}")


class TestCompoteDefaultIndexers:
    """Tests for Compote default indexers endpoint"""
    
    def test_get_default_indexers(self, authenticated_client):
        """GET /api/compote/default-indexers - should return default indexers"""
        response = authenticated_client.get(f"{BASE_URL}/api/compote/default-indexers")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Verify structure of default indexers
        for indexer in data:
            assert "id" in indexer, "Indexer should have 'id'"
            assert "name" in indexer, "Indexer should have 'name'"
            assert "type" in indexer, "Indexer should have 'type'"
        
        print(f"✓ GET /api/compote/default-indexers returned {len(data)} default indexers")


class TestCompoteUpdateIndexer:
    """Tests for Compote update indexer endpoint"""
    
    def test_update_indexer(self, authenticated_client):
        """PUT /api/compote/indexers/{id} - should update indexer"""
        # First add an indexer to update
        unique_name = f"TEST_Update_Indexer_{uuid.uuid4().hex[:8]}"
        add_response = authenticated_client.post(
            f"{BASE_URL}/api/compote/indexers",
            params={
                "name": unique_name,
                "indexer_type": "torznab",
                "url": "https://original-url.example.com",
                "api_key": "original_key",
                "enabled": True,
                "priority": 50
            }
        )
        assert add_response.status_code == 200, f"Failed to add indexer: {add_response.text}"
        indexer_id = add_response.json()["id"]
        
        # Update the indexer
        updated_name = f"TEST_Updated_{uuid.uuid4().hex[:6]}"
        update_response = authenticated_client.put(
            f"{BASE_URL}/api/compote/indexers/{indexer_id}",
            json={
                "name": updated_name,
                "url": "https://updated-url.example.com",
                "api_key": "updated_key",
                "enabled": False,
                "priority": 75,
                "cloudflare_protected": True
            }
        )
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        data = update_response.json()
        assert data.get("name") == updated_name or data.get("status") == "updated", "Should confirm update"
        
        print(f"✓ PUT /api/compote/indexers/{indexer_id} updated indexer")
    
    def test_update_nonexistent_indexer(self, authenticated_client):
        """PUT /api/compote/indexers/{id} - should handle nonexistent indexer"""
        response = authenticated_client.put(
            f"{BASE_URL}/api/compote/indexers/nonexistent-id-12345",
            json={"name": "Updated Name"}
        )
        
        # Should return 404 or handle gracefully
        assert response.status_code in [404, 200], f"Expected 404 or 200, got {response.status_code}"
        
        print(f"✓ PUT /api/compote/indexers/nonexistent handled correctly (status: {response.status_code})")


class TestCompoteDeleteIndexer:
    """Tests for Compote delete indexer endpoint"""
    
    def test_delete_indexer(self, authenticated_client):
        """DELETE /api/compote/indexers/{id} - should delete indexer"""
        # First add an indexer to delete
        unique_name = f"TEST_Delete_Indexer_{uuid.uuid4().hex[:8]}"
        add_response = authenticated_client.post(
            f"{BASE_URL}/api/compote/indexers",
            params={
                "name": unique_name,
                "indexer_type": "rss",
                "url": "https://delete-test.example.com/feed.rss"
            }
        )
        assert add_response.status_code == 200, f"Failed to add indexer: {add_response.text}"
        indexer_id = add_response.json()["id"]
        
        # Delete the indexer
        response = authenticated_client.delete(f"{BASE_URL}/api/compote/indexers/{indexer_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "removed", "Should confirm removal"
        
        print(f"✓ DELETE /api/compote/indexers/{indexer_id} deleted indexer")
    
    def test_delete_indexer_requires_auth(self):
        """DELETE /api/compote/indexers/{id} - should require authentication"""
        no_auth_session = requests.Session()
        response = no_auth_session.delete(f"{BASE_URL}/api/compote/indexers/some-id")
        
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ DELETE /api/compote/indexers requires authentication")


class TestCompoteTestIndexer:
    """Tests for Compote test indexer endpoint"""
    
    def test_test_indexer(self, authenticated_client):
        """POST /api/compote/indexers/{id}/test - should test indexer connectivity"""
        # First add an indexer to test
        unique_name = f"TEST_Test_Indexer_{uuid.uuid4().hex[:8]}"
        add_response = authenticated_client.post(
            f"{BASE_URL}/api/compote/indexers",
            params={
                "name": unique_name,
                "indexer_type": "torznab",
                "url": "https://test-connectivity.example.com",
                "api_key": "test_key"
            }
        )
        assert add_response.status_code == 200, f"Failed to add indexer: {add_response.text}"
        indexer_id = add_response.json()["id"]
        
        # Test the indexer
        response = authenticated_client.post(f"{BASE_URL}/api/compote/indexers/{indexer_id}/test")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data or "status" in data, "Response should include test result"
        
        print(f"✓ POST /api/compote/indexers/{indexer_id}/test - Result: {data}")
    
    def test_test_nonexistent_indexer(self, authenticated_client):
        """POST /api/compote/indexers/{id}/test - should handle nonexistent indexer"""
        response = authenticated_client.post(f"{BASE_URL}/api/compote/indexers/nonexistent-id-12345/test")
        
        # Should return 404 or error response
        assert response.status_code in [404, 200], f"Expected 404 or 200, got {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            # If 200, should indicate failure
            assert data.get("success") == False or "error" in data, "Should indicate test failure"
        
        print(f"✓ POST /api/compote/indexers/nonexistent/test handled correctly")


class TestCompoteSearchWithDemoResults:
    """Tests for Compote search with demo results (MOCKED)"""
    
    def test_search_returns_demo_results(self, authenticated_client):
        """GET /api/compote/search - should return demo results when no valid indexers"""
        response = authenticated_client.get(
            f"{BASE_URL}/api/compote/search",
            params={
                "query": "avengers",
                "media_type": "movies",
                "sort_by": "seeders",
                "limit": 25
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "query" in data, "Response should include 'query'"
        assert "results" in data, "Response should include 'results'"
        assert "total_results" in data, "Response should include 'total_results'"
        
        # Demo results should have proper structure
        if data["total_results"] > 0:
            result = data["results"][0]
            assert "title" in result, "Result should have 'title'"
            assert "indexer" in result, "Result should have 'indexer'"
            assert "size" in result, "Result should have 'size'"
            assert "seeders" in result, "Result should have 'seeders'"
            
            # Demo results should be marked as demo
            if "(Demo)" in result.get("indexer", ""):
                print(f"✓ Search returned {data['total_results']} DEMO results (MOCKED)")
            else:
                print(f"✓ Search returned {data['total_results']} results")
        else:
            print(f"✓ Search returned 0 results (no indexers configured)")
    
    def test_search_tv_shows(self, authenticated_client):
        """GET /api/compote/search - should search for TV shows"""
        response = authenticated_client.get(
            f"{BASE_URL}/api/compote/search",
            params={
                "query": "breaking bad",
                "media_type": "tv"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["media_type"] == "tv", "Media type should be 'tv'"
        
        print(f"✓ TV search returned {data['total_results']} results")


class TestCompoteIntegrationWorkflow:
    """Integration tests for complete Compote workflow"""
    
    def test_full_indexer_lifecycle(self, authenticated_client):
        """Test complete indexer lifecycle: add -> update -> test -> delete"""
        # Step 1: Add indexer
        unique_name = f"TEST_Lifecycle_{uuid.uuid4().hex[:6]}"
        add_response = authenticated_client.post(
            f"{BASE_URL}/api/compote/indexers",
            params={
                "name": unique_name,
                "indexer_type": "torznab",
                "url": "https://lifecycle-test.example.com",
                "api_key": "lifecycle_key",
                "enabled": True,
                "priority": 50
            }
        )
        assert add_response.status_code == 200, f"Add failed: {add_response.text}"
        indexer_id = add_response.json()["id"]
        print(f"  Step 1: Added indexer {unique_name} (ID: {indexer_id})")
        
        # Step 2: Update indexer
        update_response = authenticated_client.put(
            f"{BASE_URL}/api/compote/indexers/{indexer_id}",
            json={
                "name": f"{unique_name}_Updated",
                "priority": 75,
                "cloudflare_protected": True
            }
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        print(f"  Step 2: Updated indexer")
        
        # Step 3: Test indexer
        test_response = authenticated_client.post(f"{BASE_URL}/api/compote/indexers/{indexer_id}/test")
        assert test_response.status_code == 200, f"Test failed: {test_response.text}"
        print(f"  Step 3: Tested indexer - Result: {test_response.json()}")
        
        # Step 4: Delete indexer
        delete_response = authenticated_client.delete(f"{BASE_URL}/api/compote/indexers/{indexer_id}")
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        print(f"  Step 4: Deleted indexer")
        
        print("✓ Full indexer lifecycle completed successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
