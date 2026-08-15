"""
WatchNexus v2.8.4 - Compote Search & Grab Tests
Tests the real indexer search functionality (Nyaa.si RSS, YTS JSON API, etc.)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    pytest.skip("REACT_APP_BACKEND_URL not set", allow_module_level=True)

TEST_EMAIL = os.environ.get('TEST_EMAIL', '')
TEST_PASSWORD = os.environ.get('TEST_PASSWORD', '')
if not TEST_EMAIL or not TEST_PASSWORD:
    pytest.skip("TEST_EMAIL and TEST_PASSWORD environment variables required", allow_module_level=True)

class TestCompoteSearch:
    """Compote Search endpoint tests - Real indexer queries"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for all tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_compote_search_returns_results(self):
        """Test that Compote search returns real results from Nyaa.si"""
        response = requests.get(
            f"{BASE_URL}/api/compote/search",
            params={"query": "Jobless Reincarnation"},
            headers=self.headers,
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should return results
        assert "results" in data
        assert "total" in data
        assert len(data["results"]) >= 50, f"Expected 50+ results, got {len(data['results'])}"
    
    def test_compote_search_result_fields(self):
        """Test that search results have all required fields"""
        response = requests.get(
            f"{BASE_URL}/api/compote/search",
            params={"query": "Jobless Reincarnation", "limit": 5},
            headers=self.headers,
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["results"]) > 0, "No results returned"
        
        # Check first result has all required fields
        result = data["results"][0]
        required_fields = ["title", "seeders", "leechers", "size", "magnet_url", "quality", "codec", "indexer"]
        for field in required_fields:
            assert field in result, f"Missing field: {field}"
        
        # Verify field types
        assert isinstance(result["title"], str) and len(result["title"]) > 0
        assert isinstance(result["seeders"], int)
        assert isinstance(result["leechers"], int)
        assert isinstance(result["size"], int)
        assert result["indexer"] == "Nyaa.si"
    
    def test_compote_search_sorted_by_seeders(self):
        """Test that results are sorted by seeders (highest first) by default"""
        response = requests.get(
            f"{BASE_URL}/api/compote/search",
            params={"query": "Jobless Reincarnation", "limit": 20},
            headers=self.headers,
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        results = data["results"]
        assert len(results) >= 2, "Need at least 2 results to verify sorting"
        
        # Verify descending order by seeders
        for i in range(len(results) - 1):
            assert results[i]["seeders"] >= results[i+1]["seeders"], \
                f"Results not sorted by seeders: {results[i]['seeders']} < {results[i+1]['seeders']}"
    
    def test_compote_search_magnet_url_format(self):
        """Test that magnet URLs are properly formatted"""
        response = requests.get(
            f"{BASE_URL}/api/compote/search",
            params={"query": "Jobless Reincarnation", "limit": 5},
            headers=self.headers,
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        for result in data["results"]:
            if result.get("magnet_url"):
                assert result["magnet_url"].startswith("magnet:?xt=urn:btih:"), \
                    f"Invalid magnet URL format: {result['magnet_url'][:50]}"
    
    def test_compote_search_empty_query(self):
        """Test search with empty query returns appropriate message"""
        response = requests.get(
            f"{BASE_URL}/api/compote/search",
            params={"query": ""},
            headers=self.headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert data["results"] == []
        assert "message" in data


class TestCompoteGrab:
    """Compote Grab endpoint tests - Download queue functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for all tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_compote_grab_with_magnet(self):
        """Test grabbing a torrent with magnet URL"""
        response = requests.post(
            f"{BASE_URL}/api/compote/grab",
            params={
                "title": "Test Download",
                "magnet_url": "magnet:?xt=urn:btih:abc123test"
            },
            headers=self.headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "download_id" in data
        assert len(data["download_id"]) > 0
        assert data["magnet"] == True
    
    def test_compote_grab_returns_download_id(self):
        """Test that grab returns a unique download_id"""
        response = requests.post(
            f"{BASE_URL}/api/compote/grab",
            params={
                "title": "Test Download 2",
                "magnet_url": "magnet:?xt=urn:btih:def456test"
            },
            headers=self.headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "download_id" in data
        assert isinstance(data["download_id"], str)
        assert len(data["download_id"]) >= 6  # Should be a hex ID


class TestCompoteIndexers:
    """Compote Indexer configuration tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for all tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_default_indexers_list(self):
        """Test that default indexers endpoint returns expected indexers"""
        response = requests.get(
            f"{BASE_URL}/api/compote/default-indexers",
            headers=self.headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should have 5 default indexers
        assert len(data) >= 5
        
        # Check for expected indexers
        indexer_names = [idx["name"] for idx in data]
        assert "Nyaa.si" in indexer_names
        assert "YTS Movies" in indexer_names
        assert "EZTV" in indexer_names
        assert "1337x" in indexer_names
        assert "ShowRSS" in indexer_names
    
    def test_default_indexers_have_urls(self):
        """Test that default indexers have correct URLs"""
        response = requests.get(
            f"{BASE_URL}/api/compote/default-indexers",
            headers=self.headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        for indexer in data:
            assert "url" in indexer
            assert indexer["url"].startswith("https://")
            assert "type" in indexer
            assert "name" in indexer
    
    def test_configured_indexers_list(self):
        """Test that configured indexers endpoint returns indexers"""
        response = requests.get(
            f"{BASE_URL}/api/compote/indexers",
            headers=self.headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should have at least Nyaa.si configured
        assert len(data) >= 1
        
        # Check for Nyaa.si
        nyaa_found = any(idx.get("name") == "Nyaa.si" for idx in data)
        assert nyaa_found, "Nyaa.si should be in configured indexers"


class TestSystemEndpoints:
    """System and module status tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for all tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_health_endpoint(self):
        """Test health endpoint returns v2.8.4"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        
        assert data["version"] == "2.8.4"
        assert data["status"] == "healthy"
    
    def test_info_endpoint(self):
        """Test info endpoint returns 35 modules"""
        response = requests.get(
            f"{BASE_URL}/api/info",
            headers=self.headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        # modules is an array of module objects
        assert len(data["modules"]) == 35, f"Expected 35 modules, got {len(data['modules'])}"
        # security is an object with boolean features
        security_features = [k for k, v in data["security"].items() if v == True]
        assert len(security_features) == 8, f"Expected 8 security features, got {len(security_features)}"


class TestModulePages:
    """Test that all module pages are accessible"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for all tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_collections_roux_status(self):
        """Test Roux (Collections) module status"""
        response = requests.get(
            f"{BASE_URL}/api/roux/status",
            headers=self.headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert data["version"] == "2.8.4"
    
    def test_rss_sprout_status(self):
        """Test Sprout (RSS) module status"""
        response = requests.get(
            f"{BASE_URL}/api/sprout/status",
            headers=self.headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert data["version"] == "2.8.4"
    
    def test_tasks_saffron_status(self):
        """Test Saffron (Tasks) module status"""
        response = requests.get(
            f"{BASE_URL}/api/saffron/status",
            headers=self.headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert data["version"] == "2.8.4"
    
    def test_automation_fondue_status(self):
        """Test Fondue (Automation) module status"""
        response = requests.get(
            f"{BASE_URL}/api/fondue/status",
            headers=self.headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert data["version"] == "2.8.4"
    
    def test_backups_sourdough_status(self):
        """Test Sourdough (Backups) module status"""
        response = requests.get(
            f"{BASE_URL}/api/sourdough/status",
            headers=self.headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert data["version"] == "2.8.4"
    
    def test_download_clients_churro_status(self):
        """Test Churro (Download Clients) module status"""
        response = requests.get(
            f"{BASE_URL}/api/churro/status",
            headers=self.headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert data["version"] == "2.8.4"
    
    def test_scrobbling_glaze_status(self):
        """Test Glaze (Scrobbling) module status"""
        response = requests.get(
            f"{BASE_URL}/api/glaze/status",
            headers=self.headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert data["version"] == "2.8.4"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
