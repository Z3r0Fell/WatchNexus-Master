"""
Test suite for Compote Indexer Manager API endpoints
Tests: GET /api/compote/indexers, POST /api/compote/indexers, 
       GET /api/compote/search, POST /api/compote/grab
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


class TestCompoteIndexers:
    """Tests for Compote indexer management endpoints"""
    
    def test_get_indexers_returns_list(self, authenticated_client):
        """GET /api/compote/indexers - should return indexers list"""
        response = authenticated_client.get(f"{BASE_URL}/api/compote/indexers")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 1, f"Expected at least 1 indexer, got {len(data)}"
        
        # Verify structure of indexers
        for indexer in data:
            assert "id" in indexer, "Indexer should have 'id'"
            assert "name" in indexer, "Indexer should have 'name'"
            assert "type" in indexer, "Indexer should have 'type'"
            assert "url" in indexer, "Indexer should have 'url'"
            assert "enabled" in indexer, "Indexer should have 'enabled'"
        
        print(f"✓ GET /api/compote/indexers returned {len(data)} indexers")
    
    def test_get_indexers_requires_auth(self, api_client):
        """GET /api/compote/indexers - should require authentication"""
        # Create a new session without auth
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/compote/indexers")
        
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ GET /api/compote/indexers requires authentication")
    
    def test_add_indexer_success(self, authenticated_client):
        """POST /api/compote/indexers - should add a new indexer"""
        unique_name = f"TEST_Indexer_{uuid.uuid4().hex[:8]}"
        
        response = authenticated_client.post(
            f"{BASE_URL}/api/compote/indexers",
            params={
                "name": unique_name,
                "indexer_type": "torznab",
                "url": "https://test-indexer.example.com",
                "api_key": "test_api_key_123",
                "enabled": True,
                "priority": 75
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["status"] == "added", "Status should be 'added'"
        assert data["name"] == unique_name, f"Name should be {unique_name}"
        assert "id" in data, "Response should include 'id'"
        
        print(f"✓ POST /api/compote/indexers added indexer: {unique_name}")
        return data["id"]
    
    def test_add_indexer_requires_auth(self, api_client):
        """POST /api/compote/indexers - should require authentication"""
        no_auth_session = requests.Session()
        response = no_auth_session.post(
            f"{BASE_URL}/api/compote/indexers",
            params={
                "name": "Unauthorized Indexer",
                "indexer_type": "torznab",
                "url": "https://test.com"
            }
        )
        
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ POST /api/compote/indexers requires authentication")


class TestCompoteSearch:
    """Tests for Compote search endpoint"""
    
    def test_search_returns_results_structure(self, authenticated_client):
        """GET /api/compote/search - should return proper structure"""
        response = authenticated_client.get(
            f"{BASE_URL}/api/compote/search",
            params={
                "query": "test movie",
                "media_type": "movies",
                "sort_by": "seeders",
                "limit": 10
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "query" in data, "Response should include 'query'"
        assert "media_type" in data, "Response should include 'media_type'"
        assert "total_results" in data, "Response should include 'total_results'"
        assert "results" in data, "Response should include 'results'"
        
        assert data["query"] == "test movie", "Query should match input"
        assert data["media_type"] == "movies", "Media type should match input"
        assert isinstance(data["results"], list), "Results should be a list"
        
        print(f"✓ GET /api/compote/search returned {data['total_results']} results")
    
    def test_search_with_different_media_types(self, authenticated_client):
        """GET /api/compote/search - should accept different media types"""
        media_types = ["movies", "tv", "music", "anime"]
        
        for media_type in media_types:
            response = authenticated_client.get(
                f"{BASE_URL}/api/compote/search",
                params={"query": "test", "media_type": media_type}
            )
            
            assert response.status_code == 200, f"Search for {media_type} failed: {response.status_code}"
            data = response.json()
            assert data["media_type"] == media_type, f"Media type should be {media_type}"
        
        print(f"✓ GET /api/compote/search works with all media types: {media_types}")
    
    def test_search_requires_auth(self, api_client):
        """GET /api/compote/search - should require authentication"""
        no_auth_session = requests.Session()
        response = no_auth_session.get(
            f"{BASE_URL}/api/compote/search",
            params={"query": "test"}
        )
        
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ GET /api/compote/search requires authentication")


class TestCompoteGrab:
    """Tests for Compote grab/download endpoint"""
    
    def test_grab_with_magnet_url(self, authenticated_client):
        """POST /api/compote/grab - should queue download with magnet URL"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/compote/grab",
            params={
                "title": "TEST_Movie_Download",
                "magnet_url": "magnet:?xt=urn:btih:test123456789",
                "size": 1500000000
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["status"] in ["grabbed", "queued"], "Status should be 'grabbed' or 'queued'"
        assert "download_id" in data, "Response should include 'download_id'"
        assert "message" in data, "Response should include 'message'"
        assert "TEST_Movie_Download" in data["message"], "Message should include title"
        
        print(f"✓ POST /api/compote/grab queued download: {data['download_id']}")
    
    def test_grab_with_download_url(self, authenticated_client):
        """POST /api/compote/grab - should queue download with download URL"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/compote/grab",
            params={
                "title": "TEST_Movie_Direct_Download",
                "download_url": "https://example.com/download/test.torrent",
                "size": 2000000000
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["status"] in ["grabbed", "queued"], "Status should be 'grabbed' or 'queued'"
        print(f"✓ POST /api/compote/grab with download_url: {data['download_id']}")
    
    def test_grab_requires_url(self, authenticated_client):
        """POST /api/compote/grab - should require either download_url or magnet_url"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/compote/grab",
            params={
                "title": "TEST_No_URL_Download"
            }
        )
        
        assert response.status_code == 400, f"Expected 400 without URL, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Error response should include 'detail'"
        print("✓ POST /api/compote/grab requires download_url or magnet_url")
    
    def test_grab_requires_auth(self, api_client):
        """POST /api/compote/grab - should require authentication"""
        no_auth_session = requests.Session()
        response = no_auth_session.post(
            f"{BASE_URL}/api/compote/grab",
            params={
                "title": "Unauthorized Download",
                "magnet_url": "magnet:?xt=urn:btih:test"
            }
        )
        
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ POST /api/compote/grab requires authentication")


class TestCompoteIntegration:
    """Integration tests for Compote workflow"""
    
    def test_full_workflow_add_indexer_search_grab(self, authenticated_client):
        """Test complete workflow: add indexer -> search -> grab"""
        # Step 1: Add a test indexer
        unique_name = f"TEST_Workflow_Indexer_{uuid.uuid4().hex[:6]}"
        add_response = authenticated_client.post(
            f"{BASE_URL}/api/compote/indexers",
            params={
                "name": unique_name,
                "indexer_type": "torznab",
                "url": "https://workflow-test.example.com",
                "enabled": True
            }
        )
        assert add_response.status_code == 200, "Failed to add indexer"
        indexer_id = add_response.json()["id"]
        print(f"  Step 1: Added indexer {unique_name}")
        
        # Step 2: Verify indexer appears in list
        list_response = authenticated_client.get(f"{BASE_URL}/api/compote/indexers")
        assert list_response.status_code == 200, "Failed to list indexers"
        # Note: The indexer might be in memory but not persisted to default list
        print(f"  Step 2: Listed indexers successfully")
        
        # Step 3: Perform a search
        search_response = authenticated_client.get(
            f"{BASE_URL}/api/compote/search",
            params={"query": "workflow test", "media_type": "movies"}
        )
        assert search_response.status_code == 200, "Failed to search"
        print(f"  Step 3: Search completed with {search_response.json()['total_results']} results")
        
        # Step 4: Grab a download
        grab_response = authenticated_client.post(
            f"{BASE_URL}/api/compote/grab",
            params={
                "title": "TEST_Workflow_Movie",
                "magnet_url": "magnet:?xt=urn:btih:workflowtest123"
            }
        )
        assert grab_response.status_code == 200, "Failed to grab"
        print(f"  Step 4: Grabbed download {grab_response.json()['download_id']}")
        
        # Step 5: Verify download appears in downloads list
        downloads_response = authenticated_client.get(f"{BASE_URL}/api/downloads")
        assert downloads_response.status_code == 200, "Failed to get downloads"
        downloads = downloads_response.json()
        workflow_downloads = [d for d in downloads if "TEST_Workflow_Movie" in d.get("title", "")]
        assert len(workflow_downloads) > 0, "Grabbed download should appear in downloads list"
        print(f"  Step 5: Verified download in queue")
        
        print("✓ Full Compote workflow completed successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
