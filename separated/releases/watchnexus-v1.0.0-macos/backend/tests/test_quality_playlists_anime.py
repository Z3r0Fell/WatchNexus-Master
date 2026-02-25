"""
Test Quality Profiles, Playlists, and Anime Features
Tests for iteration 16 - WatchNexus Quality Features
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://gadget-lifecycle.preview.emergentagent.com')

class TestAuth:
    """Test authentication endpoints"""
    
    def test_login_valid_credentials(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "test@test.com"
        
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401


class TestQualityProfiles:
    """Test Quality Profiles CRUD operations - Sonarr/Radarr-style"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_quality_profiles(self, auth_headers):
        """Test GET /api/quality-profiles returns profiles and definitions"""
        response = requests.get(f"{BASE_URL}/api/quality-profiles", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "profiles" in data
        assert "quality_definitions" in data
        assert isinstance(data["profiles"], list)
        assert isinstance(data["quality_definitions"], list)
        
        # Verify default profiles exist
        assert len(data["profiles"]) >= 1
        
        # Verify profile structure
        profile = data["profiles"][0]
        assert "id" in profile
        assert "name" in profile
        assert "cutoff" in profile
        assert "qualities" in profile
        assert "upgrade_allowed" in profile
    
    def test_create_quality_profile(self, auth_headers):
        """Test POST /api/quality-profiles creates new profile"""
        params = {
            "name": "TEST_QualityProfile",
            "cutoff": "WEB-1080p",
            "upgrade_allowed": "true"
        }
        response = requests.post(f"{BASE_URL}/api/quality-profiles", params=params, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response
        assert data["name"] == "TEST_QualityProfile"
        assert data["cutoff"] == "WEB-1080p"
        assert "id" in data
        assert "qualities" in data
        
        # Store ID for later cleanup
        self.created_profile_id = data["id"]
        
        # Verify persistence via GET
        get_response = requests.get(f"{BASE_URL}/api/quality-profiles/{data['id']}", headers=auth_headers)
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["name"] == "TEST_QualityProfile"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/quality-profiles/{data['id']}", headers=auth_headers)
    
    def test_update_quality_profile(self, auth_headers):
        """Test PUT /api/quality-profiles/{id} updates profile"""
        # First create a profile
        create_response = requests.post(
            f"{BASE_URL}/api/quality-profiles",
            params={"name": "TEST_ToUpdate", "cutoff": "WEB-720p"},
            headers=auth_headers
        )
        assert create_response.status_code == 200
        profile_id = create_response.json()["id"]
        
        # Update the profile
        update_response = requests.put(
            f"{BASE_URL}/api/quality-profiles/{profile_id}",
            json={"name": "TEST_Updated", "cutoff": "Bluray-1080p"},
            headers=auth_headers
        )
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["name"] == "TEST_Updated"
        assert updated["cutoff"] == "Bluray-1080p"
        
        # Verify via GET
        get_response = requests.get(f"{BASE_URL}/api/quality-profiles/{profile_id}", headers=auth_headers)
        assert get_response.status_code == 200
        assert get_response.json()["name"] == "TEST_Updated"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/quality-profiles/{profile_id}", headers=auth_headers)
    
    def test_delete_quality_profile(self, auth_headers):
        """Test DELETE /api/quality-profiles/{id} deletes profile"""
        # First create a profile
        create_response = requests.post(
            f"{BASE_URL}/api/quality-profiles",
            params={"name": "TEST_ToDelete"},
            headers=auth_headers
        )
        assert create_response.status_code == 200
        profile_id = create_response.json()["id"]
        
        # Delete the profile
        delete_response = requests.delete(
            f"{BASE_URL}/api/quality-profiles/{profile_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200
        assert delete_response.json()["status"] == "deleted"
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/quality-profiles/{profile_id}", headers=auth_headers)
        assert get_response.status_code == 404
    
    def test_quality_definitions_endpoint(self, auth_headers):
        """Test GET /api/quality-definitions returns all definitions"""
        response = requests.get(f"{BASE_URL}/api/quality-definitions", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "definitions" in data
        assert len(data["definitions"]) > 0
        
        # Verify definition structure
        definition = data["definitions"][0]
        assert "name" in definition
        assert "resolution" in definition
        assert "source" in definition
        assert "rank" in definition


class TestAnimeDiscovery:
    """Test Anime page functionality via TMDB API"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_discover_anime(self, auth_headers):
        """Test TMDB discover endpoint for anime (Japanese animation)"""
        # Anime is discovered via: genre=16 (Animation), language=ja (Japanese)
        params = {
            "with_genres": "16",
            "with_original_language": "ja",
            "sort_by": "popularity.desc"
        }
        response = requests.get(f"{BASE_URL}/api/tmdb/discover/tv", params=params, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "results" in data
        assert len(data["results"]) > 0
        
        # Verify first result is Japanese animation
        first_result = data["results"][0]
        assert "id" in first_result
        assert "name" in first_result
        assert first_result.get("origin_country", []) == ["JP"] or first_result.get("original_language") == "ja"
    
    def test_discover_anime_with_genre_filter(self, auth_headers):
        """Test anime genre filtering"""
        # Filter by Animation + Action & Adventure (genre ID: 10759)
        params = {
            "with_genres": "16,10759",
            "with_original_language": "ja"
        }
        response = requests.get(f"{BASE_URL}/api/tmdb/discover/tv", params=params, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
    
    def test_search_anime(self, auth_headers):
        """Test TMDB search for anime"""
        response = requests.get(
            f"{BASE_URL}/api/tmdb/search",
            params={"query": "Naruto", "media_type": "tv"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "results" in data


class TestPlaylists:
    """Test Drizzle Playlists functionality"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_playlists(self, auth_headers):
        """Test GET /api/drizzle/playlists returns user playlists"""
        response = requests.get(f"{BASE_URL}/api/drizzle/playlists", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "playlists" in data
        assert isinstance(data["playlists"], list)
    
    def test_create_playlist(self, auth_headers):
        """Test creating a new playlist"""
        params = {
            "name": "TEST_PlaylistCreate",
            "description": "Test playlist for testing"
        }
        response = requests.post(f"{BASE_URL}/api/drizzle/playlists", params=params, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == "TEST_PlaylistCreate"
        assert data["description"] == "Test playlist for testing"
        assert "id" in data
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/drizzle/playlists/{data['id']}", headers=auth_headers)
    
    def test_delete_playlist(self, auth_headers):
        """Test deleting a playlist"""
        # Create first
        create_response = requests.post(
            f"{BASE_URL}/api/drizzle/playlists",
            params={"name": "TEST_ToDeletePlaylist"},
            headers=auth_headers
        )
        assert create_response.status_code == 200
        playlist_id = create_response.json()["id"]
        
        # Delete
        delete_response = requests.delete(
            f"{BASE_URL}/api/drizzle/playlists/{playlist_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200
        
        # Verify
        get_response = requests.get(f"{BASE_URL}/api/drizzle/playlists", headers=auth_headers)
        playlist_ids = [p["id"] for p in get_response.json()["playlists"]]
        assert playlist_id not in playlist_ids
    
    def test_add_item_to_playlist(self, auth_headers):
        """Test adding a media item to a playlist"""
        # Create playlist
        create_response = requests.post(
            f"{BASE_URL}/api/drizzle/playlists",
            params={"name": "TEST_AddItemPlaylist"},
            headers=auth_headers
        )
        assert create_response.status_code == 200
        playlist_id = create_response.json()["id"]
        
        # Add item
        item_data = {
            "media_type": "movie",
            "tmdb_id": 550,  # Fight Club
            "title": "Fight Club",
            "duration": 7200
        }
        add_response = requests.post(
            f"{BASE_URL}/api/drizzle/playlists/{playlist_id}/items",
            json=item_data,
            headers=auth_headers
        )
        assert add_response.status_code == 200
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/drizzle/playlists/{playlist_id}", headers=auth_headers)


class TestSettingsOrganization:
    """Test Settings tabs organization"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_settings_endpoint_exists(self, auth_headers):
        """Test GET /api/settings endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers)
        assert response.status_code == 200
    
    def test_health_check(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


# Run cleanup to remove TEST_ prefixed profiles
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after all tests"""
    yield
    
    # Get token
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@test.com",
        "password": "password"
    })
    if response.status_code != 200:
        return
    
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Cleanup quality profiles
    profiles_response = requests.get(f"{BASE_URL}/api/quality-profiles", headers=headers)
    if profiles_response.status_code == 200:
        profiles = profiles_response.json().get("profiles", [])
        for profile in profiles:
            if profile.get("name", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/quality-profiles/{profile['id']}", headers=headers)
    
    # Cleanup playlists
    playlists_response = requests.get(f"{BASE_URL}/api/drizzle/playlists", headers=headers)
    if playlists_response.status_code == 200:
        playlists = playlists_response.json().get("playlists", [])
        for playlist in playlists:
            if playlist.get("name", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/drizzle/playlists/{playlist['id']}", headers=headers)
