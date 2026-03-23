"""
WatchNexus v2.8.3 - New Module API Tests
Tests for: Roux (Collections), Sprout (RSS), Glaze (Scrobbling), 
Saffron (Tasks), Fondue (Automation), Sourdough (Backups), Churro (DL Clients)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
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
        assert "user" in data


class TestRouxCollections:
    """Roux - Collections & Smart Playlists module tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local", "password": "admin"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_roux_status(self, auth_headers):
        """Test Roux module status endpoint"""
        response = requests.get(f"{BASE_URL}/api/roux/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["module"] == "roux"
        assert data["status"] == "active"
        assert "smart_collections" in data["features"]
    
    def test_roux_get_collections(self, auth_headers):
        """Test getting collections list - should return 5 default smart collections"""
        response = requests.get(f"{BASE_URL}/api/roux/collections", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 5, f"Expected at least 5 default collections, got {len(data)}"
        # Check first collection structure
        if len(data) > 0:
            col = data[0]
            assert "id" in col
            assert "name" in col
            assert "type" in col
    
    def test_roux_get_presets(self, auth_headers):
        """Test getting smart playlist presets - should return 5 presets"""
        response = requests.get(f"{BASE_URL}/api/roux/presets", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 5, f"Expected at least 5 presets, got {len(data)}"
        # Check preset structure
        if len(data) > 0:
            preset = data[0]
            assert "id" in preset
            assert "name" in preset
            assert "description" in preset
    
    def test_roux_get_collection_detail(self, auth_headers):
        """Test getting a specific collection"""
        response = requests.get(f"{BASE_URL}/api/roux/collections/top-rated", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "items" in data
    
    def test_roux_create_collection(self, auth_headers):
        """Test creating a new collection"""
        response = requests.post(f"{BASE_URL}/api/roux/collections", 
            headers={**auth_headers, "Content-Type": "application/json"},
            json={"name": "TEST_My Collection", "type": "manual"})
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "created"
    
    def test_roux_filter(self, auth_headers):
        """Test filter endpoint"""
        response = requests.post(f"{BASE_URL}/api/roux/filter",
            headers={**auth_headers, "Content-Type": "application/json"},
            json={"media_type": "movies", "min_rating": 7.0, "limit": 10})
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data


class TestSproutRSS:
    """Sprout - RSS Feed Generator module tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local", "password": "admin"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_sprout_status(self, auth_headers):
        """Test Sprout module status"""
        response = requests.get(f"{BASE_URL}/api/sprout/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["module"] == "sprout"
        assert data["status"] == "active"
        assert "rss_2.0" in data["features"]
    
    def test_sprout_get_config(self, auth_headers):
        """Test getting RSS config"""
        response = requests.get(f"{BASE_URL}/api/sprout/config", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "enabled" in data
        assert "site_title" in data
        assert "items_per_feed" in data
    
    def test_sprout_get_feeds(self, auth_headers):
        """Test getting feeds list"""
        response = requests.get(f"{BASE_URL}/api/sprout/feeds", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have at least recent, movies, tv feeds
        assert len(data) >= 3, f"Expected at least 3 feeds, got {len(data)}"
        if len(data) > 0:
            feed = data[0]
            assert "id" in feed
            assert "name" in feed
            assert "url" in feed
    
    def test_sprout_generate_api_key(self, auth_headers):
        """Test API key generation"""
        response = requests.post(f"{BASE_URL}/api/sprout/generate-key", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "generated"
        assert "api_key" in data
        assert len(data["api_key"]) >= 20
    
    def test_sprout_save_config(self, auth_headers):
        """Test saving RSS config"""
        response = requests.put(f"{BASE_URL}/api/sprout/config",
            headers={**auth_headers, "Content-Type": "application/json"},
            json={"enabled": True, "site_title": "Test WatchNexus", "items_per_feed": 50})
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "saved"


class TestGlazeScrobbling:
    """Glaze - Scrobbling module tests (Trakt.tv & Last.fm)"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local", "password": "admin"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_glaze_status(self, auth_headers):
        """Test Glaze module status"""
        response = requests.get(f"{BASE_URL}/api/glaze/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["module"] == "glaze"
        assert data["status"] == "active"
    
    def test_glaze_get_config(self, auth_headers):
        """Test getting scrobbling config"""
        response = requests.get(f"{BASE_URL}/api/glaze/config", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "trakt" in data
        assert "lastfm" in data
    
    def test_glaze_trakt_history(self, auth_headers):
        """Test getting Trakt history"""
        response = requests.get(f"{BASE_URL}/api/glaze/trakt/history?limit=20", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_glaze_save_config(self, auth_headers):
        """Test saving scrobbling config"""
        response = requests.put(f"{BASE_URL}/api/glaze/config",
            headers={**auth_headers, "Content-Type": "application/json"},
            json={"trakt": {"enabled": False}, "lastfm": {"enabled": False}})
        assert response.status_code == 200


class TestSaffronTasks:
    """Saffron - Scheduled Tasks module tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local", "password": "admin"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_saffron_status(self, auth_headers):
        """Test Saffron module status"""
        response = requests.get(f"{BASE_URL}/api/saffron/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["module"] == "saffron"
        assert data["status"] == "active"
    
    def test_saffron_get_tasks(self, auth_headers):
        """Test getting scheduled tasks - should return 8 tasks"""
        response = requests.get(f"{BASE_URL}/api/saffron/tasks", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 8, f"Expected at least 8 tasks, got {len(data)}"
        # Check task structure
        if len(data) > 0:
            task = data[0]
            assert "id" in task
            assert "name" in task
            assert "category" in task
            assert "state" in task
    
    def test_saffron_run_task(self, auth_headers):
        """Test running a task"""
        response = requests.post(f"{BASE_URL}/api/saffron/tasks/scan-libraries/run", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "started"
    
    def test_saffron_history(self, auth_headers):
        """Test getting task history"""
        response = requests.get(f"{BASE_URL}/api/saffron/history?limit=20", headers=auth_headers)
        assert response.status_code == 200


class TestFondueAutomation:
    """Fondue - Movie Automation module tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local", "password": "admin"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_fondue_status(self, auth_headers):
        """Test Fondue module status"""
        response = requests.get(f"{BASE_URL}/api/fondue/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["module"] == "fondue"
        assert data["status"] == "active"
    
    def test_fondue_get_movies(self, auth_headers):
        """Test getting movies list"""
        response = requests.get(f"{BASE_URL}/api/fondue/movies?pageSize=100", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "movies" in data
        assert "total" in data
    
    def test_fondue_get_queue(self, auth_headers):
        """Test getting download queue"""
        response = requests.get(f"{BASE_URL}/api/fondue/queue", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
    
    def test_fondue_get_config(self, auth_headers):
        """Test getting Fondue config"""
        response = requests.get(f"{BASE_URL}/api/fondue/config", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "quality_profile" in data
        assert "root_folder" in data


class TestSourdoughBackups:
    """Sourdough - Backup & Restore module tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local", "password": "admin"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_sourdough_status(self, auth_headers):
        """Test Sourdough module status"""
        response = requests.get(f"{BASE_URL}/api/sourdough/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["module"] == "sourdough"
        assert data["status"] == "active"
    
    def test_sourdough_get_backups(self, auth_headers):
        """Test getting backups list"""
        response = requests.get(f"{BASE_URL}/api/sourdough/backups", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_sourdough_create_backup(self, auth_headers):
        """Test creating a backup"""
        response = requests.post(f"{BASE_URL}/api/sourdough/backup", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "initiated"
        assert "backup_name" in data
    
    def test_sourdough_export_config(self, auth_headers):
        """Test exporting config"""
        response = requests.get(f"{BASE_URL}/api/sourdough/config/export", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "exported" in data
        assert "settings" in data
    
    def test_sourdough_get_schedule(self, auth_headers):
        """Test getting backup schedule"""
        response = requests.get(f"{BASE_URL}/api/sourdough/schedule", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "enabled" in data
        assert "frequency" in data


class TestChurroDownloadClients:
    """Churro - Download Clients module tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local", "password": "admin"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_churro_status(self, auth_headers):
        """Test Churro module status"""
        response = requests.get(f"{BASE_URL}/api/churro/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["module"] == "churro"
        assert data["status"] == "active"
    
    def test_churro_get_clients(self, auth_headers):
        """Test getting download clients list"""
        response = requests.get(f"{BASE_URL}/api/churro/clients", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have at least 1 default client
        if len(data) > 0:
            client = data[0]
            assert "id" in client
            assert "name" in client
            assert "type" in client
    
    def test_churro_get_categories(self, auth_headers):
        """Test getting download categories"""
        response = requests.get(f"{BASE_URL}/api/churro/categories", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_churro_test_client(self, auth_headers):
        """Test testing a download client connection"""
        response = requests.post(f"{BASE_URL}/api/churro/clients/qbit-default/test", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"


class TestExistingModules:
    """Test existing modules still work"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local", "password": "admin"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_bastion_status(self, auth_headers):
        """Test Bastion (Auth) module"""
        response = requests.get(f"{BASE_URL}/api/bastion/status", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["module"] == "bastion"
    
    def test_tunnel_status(self, auth_headers):
        """Test Tunnel (Network) module"""
        response = requests.get(f"{BASE_URL}/api/tunnel/status", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["module"] == "tunnel"
    
    def test_taffy_providers(self, auth_headers):
        """Test Taffy (Metadata) module"""
        response = requests.get(f"{BASE_URL}/api/taffy/providers", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_pantry_drives(self, auth_headers):
        """Test Pantry (Storage) module"""
        response = requests.get(f"{BASE_URL}/api/pantry/drives", headers=auth_headers)
        assert response.status_code == 200
    
    def test_nutmeg_recommendations(self, auth_headers):
        """Test Nutmeg (Recommendations) module"""
        response = requests.get(f"{BASE_URL}/api/nutmeg/recommendations?limit=5", headers=auth_headers)
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
