"""
Test suite for WatchNexus Functional Gadgets APIs
Tests Weather, Podcasts, Radio, Photos, and Web Video gadgets
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://nexus-fortress-audit.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "password"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for API calls."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture
def auth_headers(auth_token):
    """Return headers with auth token."""
    return {"Authorization": f"Bearer {auth_token}"}


# === WEATHER GADGET TESTS ===
class TestWeatherGadget:
    """Tests for Weather Gadget - Open-Meteo API"""
    
    def test_get_weather_default_location(self, auth_headers):
        """Test GET /api/gadgets/weather returns weather for default location (NYC)"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/weather",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify structure
        assert "current" in data
        assert "forecast" in data
        assert "location" in data
        
        # Verify current weather structure
        current = data["current"]
        assert "temperature" in current
        assert "feels_like" in current
        assert "humidity" in current
        assert "wind_speed" in current
        assert "description" in current
        assert "icon" in current
        
        # Verify forecast is 7 days
        assert len(data["forecast"]) == 7
        for day in data["forecast"]:
            assert "date" in day
            assert "temp_max" in day
            assert "temp_min" in day
            assert "description" in day
            assert "icon" in day
    
    def test_get_weather_with_coords(self, auth_headers):
        """Test GET /api/gadgets/weather with custom lat/lon (London)"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/weather",
            params={"lat": 51.5074, "lon": -0.1278},
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "current" in data
        assert data["location"]["lat"] == 51.5074
        assert data["location"]["lon"] == -0.1278
    
    def test_weather_search_location(self, auth_headers):
        """Test GET /api/gadgets/weather/search for location search"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/weather/search",
            params={"q": "Tokyo"},
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "results" in data
        assert len(data["results"]) > 0
        
        # Check Tokyo in results
        found_tokyo = any(r["name"] == "Tokyo" for r in data["results"])
        assert found_tokyo, "Tokyo should be in search results"
        
        # Verify result structure
        for result in data["results"]:
            assert "name" in result
            assert "country" in result
            assert "lat" in result
            assert "lon" in result
    
    def test_weather_get_settings(self, auth_headers):
        """Test GET /api/gadgets/weather/settings returns saved or default location"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/weather/settings",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "lat" in data
        assert "lon" in data
    
    def test_weather_save_settings(self, auth_headers):
        """Test POST /api/gadgets/weather/settings saves location preference"""
        # Save new location (Paris)
        response = requests.post(
            f"{BASE_URL}/api/gadgets/weather/settings",
            json={"lat": 48.8566, "lon": 2.3522, "name": "Paris", "country": "France"},
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["success"] == True
        
        # Verify it was saved
        verify_response = requests.get(
            f"{BASE_URL}/api/gadgets/weather/settings",
            headers=auth_headers
        )
        assert verify_response.status_code == 200
        data = verify_response.json()
        assert data["name"] == "Paris"
        assert data["lat"] == 48.8566


# === PODCASTS GADGET TESTS ===
class TestPodcastsGadget:
    """Tests for Podcasts Gadget - RSS Feed Parser"""
    
    def test_get_podcasts_subscriptions(self, auth_headers):
        """Test GET /api/gadgets/podcasts returns subscription list"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/podcasts",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "subscriptions" in data
        assert isinstance(data["subscriptions"], list)
    
    def test_subscribe_to_podcast(self, auth_headers):
        """Test POST /api/gadgets/podcasts subscribes to an RSS feed"""
        # Use a known valid podcast RSS feed (NPR Technology)
        feed_url = "https://feeds.npr.org/510051/podcast.xml"
        
        response = requests.post(
            f"{BASE_URL}/api/gadgets/podcasts",
            json={"feed_url": feed_url},
            headers=auth_headers
        )
        
        # Should succeed or return 400 if already subscribed
        assert response.status_code in [200, 400]
        
        if response.status_code == 200:
            data = response.json()
            assert data["success"] == True
            assert "subscription" in data
            assert "id" in data["subscription"]
            assert "title" in data["subscription"]
    
    def test_subscribe_invalid_feed(self, auth_headers):
        """Test POST /api/gadgets/podcasts with invalid feed URL"""
        response = requests.post(
            f"{BASE_URL}/api/gadgets/podcasts",
            json={"feed_url": "https://example.com/not-a-feed.xml"},
            headers=auth_headers
        )
        # Should fail with 400
        assert response.status_code == 400
    
    def test_get_podcast_episodes(self, auth_headers):
        """Test GET /api/gadgets/podcasts/{sub_id}/episodes returns episodes"""
        # First get subscriptions to find a valid sub_id
        subs_response = requests.get(
            f"{BASE_URL}/api/gadgets/podcasts",
            headers=auth_headers
        )
        
        if subs_response.status_code == 200:
            subs = subs_response.json().get("subscriptions", [])
            if subs:
                sub_id = subs[0]["id"]
                response = requests.get(
                    f"{BASE_URL}/api/gadgets/podcasts/{sub_id}/episodes",
                    headers=auth_headers
                )
                assert response.status_code == 200
                
                data = response.json()
                assert "episodes" in data
                assert isinstance(data["episodes"], list)
                
                # Verify episode structure if any exist
                if data["episodes"]:
                    ep = data["episodes"][0]
                    assert "title" in ep
                    assert "audio_url" in ep
    
    def test_podcast_queue_endpoints(self, auth_headers):
        """Test podcast queue GET endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/podcasts/queue",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "queue" in data
        assert isinstance(data["queue"], list)


# === RADIO GADGET TESTS ===
class TestRadioGadget:
    """Tests for Internet Radio Gadget - Radio Browser API"""
    
    def test_get_radio_stations_popular(self, auth_headers):
        """Test GET /api/gadgets/radio/stations returns popular stations"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/radio/stations",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "stations" in data
        assert len(data["stations"]) > 0
        
        # Verify station structure
        station = data["stations"][0]
        assert "id" in station
        assert "name" in station
        assert "url" in station
    
    def test_search_radio_stations(self, auth_headers):
        """Test GET /api/gadgets/radio/stations with search query"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/radio/stations",
            params={"q": "jazz"},
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "stations" in data
        # Should find some jazz stations
        assert len(data["stations"]) > 0
    
    def test_filter_radio_by_country(self, auth_headers):
        """Test GET /api/gadgets/radio/stations filtering by country"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/radio/stations",
            params={"country": "United States"},
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "stations" in data
    
    def test_filter_radio_by_tag(self, auth_headers):
        """Test GET /api/gadgets/radio/stations filtering by tag/genre"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/radio/stations",
            params={"tag": "rock"},
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "stations" in data
    
    def test_get_radio_countries(self, auth_headers):
        """Test GET /api/gadgets/radio/countries returns country list"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/radio/countries",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "countries" in data
        assert len(data["countries"]) > 0
        
        # Verify country structure
        country = data["countries"][0]
        assert "name" in country
        assert "count" in country
    
    def test_get_radio_tags(self, auth_headers):
        """Test GET /api/gadgets/radio/tags returns genre/tag list"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/radio/tags",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "tags" in data
        assert len(data["tags"]) > 0
        
        # Verify tag structure
        tag = data["tags"][0]
        assert "name" in tag
        assert "count" in tag
    
    def test_get_radio_favorites(self, auth_headers):
        """Test GET /api/gadgets/radio/favorites returns user favorites"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/radio/favorites",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "favorites" in data
        assert isinstance(data["favorites"], list)
    
    def test_add_radio_favorite(self, auth_headers):
        """Test POST /api/gadgets/radio/favorites adds a station to favorites"""
        station_data = {
            "station_id": "test-station-123",
            "name": "Test Radio Station",
            "url": "https://stream.example.com/test",
            "favicon": None,
            "country": "Test Country",
            "tags": ["test", "radio"]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/gadgets/radio/favorites",
            json=station_data,
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["success"] == True
    
    def test_remove_radio_favorite(self, auth_headers):
        """Test DELETE /api/gadgets/radio/favorites/{station_id} removes favorite"""
        response = requests.delete(
            f"{BASE_URL}/api/gadgets/radio/favorites/test-station-123",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["success"] == True


# === PHOTOS GADGET TESTS ===
class TestPhotosGadget:
    """Tests for Photos Gadget - Local Photo Library"""
    
    def test_get_photo_libraries(self, auth_headers):
        """Test GET /api/gadgets/photos/libraries returns library list"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/photos/libraries",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "libraries" in data
        assert isinstance(data["libraries"], list)
    
    def test_add_photo_library_missing_fields(self, auth_headers):
        """Test POST /api/gadgets/photos/libraries with missing fields"""
        response = requests.post(
            f"{BASE_URL}/api/gadgets/photos/libraries",
            json={"name": "Test Library"},  # Missing path
            headers=auth_headers
        )
        assert response.status_code == 400
        assert "required" in response.json().get("detail", "").lower()
    
    def test_add_photo_library_invalid_path(self, auth_headers):
        """Test POST /api/gadgets/photos/libraries with non-existent path"""
        response = requests.post(
            f"{BASE_URL}/api/gadgets/photos/libraries",
            json={"name": "Test Library", "path": "/nonexistent/path/12345"},
            headers=auth_headers
        )
        assert response.status_code == 400
        assert "exist" in response.json().get("detail", "").lower()
    
    def test_add_photo_library_valid_path(self, auth_headers):
        """Test POST /api/gadgets/photos/libraries with valid path (/tmp)"""
        response = requests.post(
            f"{BASE_URL}/api/gadgets/photos/libraries",
            json={"name": "TEST_Photo_Library", "path": "/tmp"},
            headers=auth_headers
        )
        
        # Should succeed (or library already exists)
        if response.status_code == 200:
            data = response.json()
            assert data["success"] == True
            assert "library" in data
            assert data["library"]["name"] == "TEST_Photo_Library"


# === WEB VIDEO GADGET TESTS ===
class TestWebVideoGadget:
    """Tests for Web Video Gadget - yt-dlp based extraction"""
    
    def test_webvideo_info_missing_url(self, auth_headers):
        """Test GET /api/gadgets/webvideo/info without URL parameter"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/webvideo/info",
            headers=auth_headers
        )
        # Should return 422 (validation error) or 400
        assert response.status_code in [400, 422]
    
    def test_webvideo_history(self, auth_headers):
        """Test GET /api/gadgets/webvideo/history returns watch history"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/webvideo/history",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "history" in data
        assert isinstance(data["history"], list)
    
    def test_webvideo_bookmarks(self, auth_headers):
        """Test GET /api/gadgets/webvideo/bookmarks returns bookmarks"""
        response = requests.get(
            f"{BASE_URL}/api/gadgets/webvideo/bookmarks",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "bookmarks" in data
        assert isinstance(data["bookmarks"], list)
    
    def test_webvideo_add_history(self, auth_headers):
        """Test POST /api/gadgets/webvideo/history adds to watch history"""
        response = requests.post(
            f"{BASE_URL}/api/gadgets/webvideo/history",
            json={
                "video_id": "test-video-123",
                "url": "https://www.youtube.com/watch?v=test123",
                "title": "Test Video",
                "thumbnail": None,
                "duration": 300
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["success"] == True
    
    def test_webvideo_add_bookmark(self, auth_headers):
        """Test POST /api/gadgets/webvideo/bookmarks adds a bookmark"""
        response = requests.post(
            f"{BASE_URL}/api/gadgets/webvideo/bookmarks",
            json={
                "video_id": "test-bookmark-123",
                "url": "https://www.youtube.com/watch?v=bookmark123",
                "title": "Bookmarked Video",
                "thumbnail": None,
                "duration": 600
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["success"] == True
    
    def test_webvideo_remove_bookmark(self, auth_headers):
        """Test DELETE /api/gadgets/webvideo/bookmarks/{video_id} removes bookmark"""
        response = requests.delete(
            f"{BASE_URL}/api/gadgets/webvideo/bookmarks/test-bookmark-123",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["success"] == True


# === AUTHENTICATION TESTS ===
class TestGadgetsAuthentication:
    """Test that all gadget endpoints require authentication"""
    
    def test_weather_requires_auth(self):
        """Test weather endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/gadgets/weather")
        assert response.status_code == 401
        
        response = requests.get(f"{BASE_URL}/api/gadgets/weather/search", params={"q": "NYC"})
        assert response.status_code == 401
    
    def test_podcasts_requires_auth(self):
        """Test podcast endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/gadgets/podcasts")
        assert response.status_code == 401
        
        response = requests.post(f"{BASE_URL}/api/gadgets/podcasts", json={"feed_url": "test"})
        assert response.status_code == 401
    
    def test_radio_requires_auth(self):
        """Test radio endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/gadgets/radio/stations")
        assert response.status_code == 401
        
        response = requests.get(f"{BASE_URL}/api/gadgets/radio/countries")
        assert response.status_code == 401
    
    def test_photos_requires_auth(self):
        """Test photos endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/gadgets/photos/libraries")
        assert response.status_code == 401
    
    def test_webvideo_requires_auth(self):
        """Test webvideo endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/gadgets/webvideo/history")
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
