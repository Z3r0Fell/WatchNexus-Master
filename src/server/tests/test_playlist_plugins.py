"""
Test suite for WatchNexus Playlist and Plugin features.
Tests: AddToPlaylist button, Plugin import/uninstall, Settings page sidebar.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://nexus-csharp-api.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "password"

class TestAuthentication:
    """Authentication tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=10
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access token in response"
        assert "user" in data, "No user in response"
        print("Login successful, token received")
        return data["access_token"]


class TestPlaylistAPI:
    """Playlist API tests - Drizzle module"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=10
        )
        if response.status_code != 200:
            pytest.skip("Authentication failed")
        return response.json()["access_token"]
    
    def test_get_playlists(self, auth_token):
        """GET /api/drizzle/playlists - Get user playlists"""
        response = requests.get(
            f"{BASE_URL}/api/drizzle/playlists",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        assert response.status_code == 200, f"Failed to get playlists: {response.text}"
        data = response.json()
        assert "playlists" in data, "No playlists key in response"
        assert isinstance(data["playlists"], list), "Playlists is not a list"
        print(f"Got {len(data['playlists'])} playlists")
    
    def test_create_playlist(self, auth_token):
        """POST /api/drizzle/playlists - Create a new playlist"""
        playlist_name = "Test_Playlist_API"
        response = requests.post(
            f"{BASE_URL}/api/drizzle/playlists",
            params={"name": playlist_name, "description": "Test playlist for testing"},
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        assert response.status_code == 200, f"Failed to create playlist: {response.text}"
        data = response.json()
        assert "id" in data, "No id in created playlist"
        assert data["name"] == playlist_name, f"Playlist name mismatch: {data['name']} != {playlist_name}"
        print(f"Created playlist: {data['id']} - {data['name']}")
        return data["id"]
    
    def test_add_item_to_playlist(self, auth_token):
        """POST /api/drizzle/playlists/{id}/items - Add item to playlist"""
        # First create a playlist
        create_response = requests.post(
            f"{BASE_URL}/api/drizzle/playlists",
            params={"name": "Test_AddItem_Playlist"},
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        assert create_response.status_code == 200
        playlist_id = create_response.json()["id"]
        
        # Add item to playlist
        item_data = {
            "media_type": "movie",
            "tmdb_id": 550,  # Fight Club
            "title": "Fight Club",
            "poster_path": "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
            "duration": 7920  # 132 min
        }
        response = requests.post(
            f"{BASE_URL}/api/drizzle/playlists/{playlist_id}/items",
            json=item_data,
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        assert response.status_code == 200, f"Failed to add item to playlist: {response.text}"
        data = response.json()
        assert "id" in data, "No id in added item"
        assert data["title"] == item_data["title"], "Item title mismatch"
        print(f"Added item '{data['title']}' to playlist {playlist_id}")
        
        # Clean up - delete playlist
        requests.delete(
            f"{BASE_URL}/api/drizzle/playlists/{playlist_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )


class TestPluginAPI:
    """Plugin API tests - Gadgets module"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=10
        )
        if response.status_code != 200:
            pytest.skip("Authentication failed")
        return response.json()["access_token"]
    
    def test_get_plugins(self, auth_token):
        """GET /api/gadgets/plugins - Get installed plugins"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/plugins",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        assert response.status_code == 200, f"Failed to get plugins: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Plugins response is not a list"
        print(f"Got {len(data)} plugins")
    
    def test_import_url_endpoint_exists(self, auth_token):
        """POST /api/gadgets/import-url - Verify endpoint exists"""
        # Test with invalid URL to verify endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/gadgets/import-url",
            params={"url": "https://example.com/invalid.txt"},  # Invalid extension
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        # Should get 400 for invalid URL format (not .zip), not 404
        assert response.status_code in [400, 500], f"Unexpected status: {response.status_code}"
        if response.status_code == 400:
            assert "zip" in response.text.lower(), "Expected error about zip file"
        print("Import URL endpoint verified - returns proper validation error")
    
    def test_uninstall_endpoint_exists(self, auth_token):
        """DELETE /api/gadgets/plugins/{id}/uninstall - Verify endpoint exists"""
        # Test with non-existent plugin
        response = requests.delete(
            f"{BASE_URL}/api/gadgets/plugins/nonexistent_plugin_xyz/uninstall",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        # Should get 200 (if plugin didn't exist, it just confirms removal)
        # or 404 (if plugin not found)
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print(f"Uninstall endpoint verified - status {response.status_code}")


class TestSettingsAPI:
    """Settings API tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=10
        )
        if response.status_code != 200:
            pytest.skip("Authentication failed")
        return response.json()["access_token"]
    
    def test_get_settings(self, auth_token):
        """GET /api/settings - Get user settings"""
        response = requests.get(
            f"{BASE_URL}/api/settings",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        assert response.status_code == 200, f"Failed to get settings: {response.text}"
        data = response.json()
        assert "download_path" in data or "library_path" in data, "Expected settings fields missing"
        print("Got settings successfully")


class TestMediaEndpoints:
    """Media and TMDB endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=10
        )
        if response.status_code != 200:
            pytest.skip("Authentication failed")
        return response.json()["access_token"]
    
    def test_get_trending(self):
        """GET /api/tmdb/trending - Get trending media"""
        response = requests.get(
            f"{BASE_URL}/api/tmdb/trending/all/week",
            timeout=10
        )
        assert response.status_code == 200, f"Failed to get trending: {response.text}"
        data = response.json()
        assert "results" in data, "No results in trending response"
        assert len(data["results"]) > 0, "No trending items"
        print(f"Got {len(data['results'])} trending items")
    
    def test_get_movie_details(self):
        """GET /api/tmdb/movie/{id} - Get movie details (for AddToPlaylist context)"""
        response = requests.get(
            f"{BASE_URL}/api/tmdb/movie/550",  # Fight Club
            timeout=10
        )
        assert response.status_code == 200, f"Failed to get movie: {response.text}"
        data = response.json()
        assert "id" in data, "No id in movie response"
        assert "title" in data, "No title in movie response"
        print(f"Got movie: {data.get('title')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
