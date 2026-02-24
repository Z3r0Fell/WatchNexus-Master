"""
Test v2.5.6 Features: Gadgets Catalogue and Downloads Engine
Tests the new Gadgets Catalogue API and verifies Downloads engine status endpoint.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://marmalade-preview.preview.emergentagent.com').rstrip('/')


class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for subsequent tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]

    def test_login_success(self):
        """Test login returns valid token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "test@test.com"


class TestGadgetsCatalogue:
    """Tests for the Gadgets Catalogue feature"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_get_full_catalogue(self, auth_token):
        """Test /api/gadgets/catalogue returns full catalogue with 45 items"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/catalogue",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "items" in data, "Missing 'items' in response"
        assert "categories" in data, "Missing 'categories' in response"
        assert "total" in data, "Missing 'total' in response"
        
        # Verify counts
        assert data["total"] == 45, f"Expected 45 gadgets, got {data['total']}"
        assert len(data["items"]) == 45, f"Expected 45 items, got {len(data['items'])}"
        assert len(data["categories"]) == 16, f"Expected 16 categories, got {len(data['categories'])}"
    
    def test_get_catalogue_categories(self, auth_token):
        """Test /api/gadgets/catalogue/categories returns all 16 categories"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/catalogue/categories",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Expected categories
        expected_categories = {
            "metadata", "subtitle", "notification", "theme",
            "video", "audio", "indexer", "system",
            "image", "game", "screensaver", "weather",
            "program", "service", "context", "resource"
        }
        
        assert len(data) == 16, f"Expected 16 categories, got {len(data)}"
        assert set(data.keys()) == expected_categories, f"Category mismatch"
        
        # Verify each category has label, description, count
        for cat_key, cat_data in data.items():
            assert "label" in cat_data, f"Missing 'label' in category {cat_key}"
            assert "count" in cat_data, f"Missing 'count' in category {cat_key}"
            assert cat_data["count"] > 0, f"Category {cat_key} has 0 items"
    
    def test_search_catalogue_by_category_subtitle(self, auth_token):
        """Test searching catalogue by subtitle category returns 4 items"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/catalogue/search?category=subtitle",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
        assert "total" in data
        assert data["total"] == 4, f"Expected 4 subtitle gadgets, got {data['total']}"
        
        # Verify all items are subtitle category
        for item in data["items"]:
            assert item["category"] == "subtitle", f"Item {item['id']} not in subtitle category"
    
    def test_search_catalogue_by_category_metadata(self, auth_token):
        """Test searching catalogue by metadata category returns 6 items"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/catalogue/search?category=metadata",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 6, f"Expected 6 metadata gadgets, got {data['total']}"
    
    def test_search_catalogue_by_query(self, auth_token):
        """Test text search in catalogue"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/catalogue/search?q=discord",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] >= 1, "Should find at least 1 Discord gadget"
        
        # Verify found item is the Discord notifier
        found_discord = any("discord" in item["name"].lower() or "discord" in item["description"].lower() 
                           for item in data["items"])
        assert found_discord, "Discord gadget should be in search results"
    
    def test_catalogue_item_structure(self, auth_token):
        """Test gadget items have required fields"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/catalogue",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ["id", "name", "description", "version", "author", 
                          "plugin_type", "category", "tags", "source", "status"]
        
        for item in data["items"][:5]:  # Check first 5 items
            for field in required_fields:
                assert field in item, f"Missing field '{field}' in gadget {item.get('id', 'unknown')}"


class TestDownloadsEngine:
    """Tests for the Downloads/Torrent Engine"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_engine_status_endpoint(self, auth_token):
        """Test /api/downloads/engine/status returns success"""
        response = requests.get(
            f"{BASE_URL}/api/downloads/engine/status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "success" in data, "Missing 'success' field"
        assert data["success"] == True, "Engine status should be success=true"
        assert "engine" in data, "Missing 'engine' field"
        assert "version" in data, "Missing 'version' field"
        assert "transfer" in data, "Missing 'transfer' field"
    
    def test_engine_transfer_info(self, auth_token):
        """Test engine transfer info structure"""
        response = requests.get(
            f"{BASE_URL}/api/downloads/engine/status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        transfer = data.get("transfer", {})
        required_transfer_fields = ["download_rate", "upload_rate", "num_torrents", 
                                    "downloading", "seeding", "completed"]
        
        for field in required_transfer_fields:
            assert field in transfer, f"Missing transfer field: {field}"


class TestMediaPages:
    """Test backend endpoints used by Movies/TV/Anime pages"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_tmdb_discover_movies(self, auth_token):
        """Test TMDB discover endpoint for movies"""
        response = requests.get(
            f"{BASE_URL}/api/tmdb/discover/movie?page=1",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "results" in data, "Missing 'results' in TMDB response"
        assert len(data["results"]) > 0, "No movies returned"
    
    def test_tmdb_discover_tv(self, auth_token):
        """Test TMDB discover endpoint for TV shows"""
        response = requests.get(
            f"{BASE_URL}/api/tmdb/discover/tv?page=1",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "results" in data, "Missing 'results' in TMDB response"
        assert len(data["results"]) > 0, "No TV shows returned"
    
    def test_movie_genres(self, auth_token):
        """Test movie genres endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/tmdb/genres/movie",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "genres" in data, "Missing 'genres' in response"
        assert len(data["genres"]) > 0, "No genres returned"
    
    def test_tv_genres(self, auth_token):
        """Test TV genres endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/tmdb/genres/tv",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "genres" in data, "Missing 'genres' in response"
        assert len(data["genres"]) > 0, "No genres returned"
    
    def test_marmalade_libraries(self, auth_token):
        """Test Marmalade library endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/marmalade/libraries",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should return a list (may be empty in preview environment)
        assert isinstance(data, list), "Libraries should be a list"
    
    def test_marmalade_media(self, auth_token):
        """Test Marmalade media endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/marmalade/media?limit=10",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should return a list (may be empty in preview environment)
        assert isinstance(data, list), "Media should be a list"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
