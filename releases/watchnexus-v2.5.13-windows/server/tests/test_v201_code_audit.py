"""
WatchNexus v2.0.1 Code Audit Verification Tests
Tests for verifying all routes, endpoints, and bug fixes:
1) Generic playback error message fix - now shows specific errors
2) Watch history sort key issue - changed from last_watched to updated_at
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthentication:
    """Test authentication endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "test@test.com"
        print(f"Login successful for user: {data['user']['username']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("Invalid credentials correctly rejected")
    
    def test_get_current_user(self):
        """Test get current user info"""
        # First login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        token = login_response.json()["access_token"]
        
        # Get current user
        response = self.session.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@test.com"
        print(f"Current user verified: {data['username']}")


class TestDashboardData:
    """Test dashboard data endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login and get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        self.token = login_response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_trending_movies(self):
        """Test trending movies endpoint for hero banner"""
        response = self.session.get(f"{BASE_URL}/api/tmdb/trending/movie/week")
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) > 0
        print(f"Trending movies: {len(data['results'])} items")
    
    def test_trending_tv(self):
        """Test trending TV shows endpoint"""
        response = self.session.get(f"{BASE_URL}/api/tmdb/trending/tv/week")
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        print(f"Trending TV: {len(data['results'])} items")
    
    def test_now_playing_movies(self):
        """Test now playing movies"""
        response = self.session.get(f"{BASE_URL}/api/tmdb/movie/now_playing")
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        print(f"Now playing: {len(data['results'])} movies")


class TestMoviesPage:
    """Test Movies page endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        self.token = login_response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_discover_movies(self):
        """Test discover movies endpoint"""
        response = self.session.get(f"{BASE_URL}/api/tmdb/discover/movie")
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) > 0
        # Verify image URLs are enhanced
        for movie in data["results"][:3]:
            if movie.get("poster_path"):
                assert "poster_url" in movie
                print(f"Movie: {movie.get('title', 'N/A')} - {movie.get('vote_average', 0)}/10")
    
    def test_movie_genres(self):
        """Test movie genres endpoint"""
        response = self.session.get(f"{BASE_URL}/api/tmdb/genres/movie")
        assert response.status_code == 200
        data = response.json()
        assert "genres" in data
        print(f"Movie genres: {len(data['genres'])} genres available")
    
    def test_movie_details(self):
        """Test movie details endpoint"""
        # Get a movie ID first
        discover_response = self.session.get(f"{BASE_URL}/api/tmdb/discover/movie")
        movies = discover_response.json()["results"]
        if movies:
            movie_id = movies[0]["id"]
            response = self.session.get(f"{BASE_URL}/api/tmdb/movie/{movie_id}")
            assert response.status_code == 200
            data = response.json()
            assert "title" in data
            assert "poster_url" in data
            print(f"Movie details: {data['title']} ({data.get('release_date', 'N/A')[:4] if data.get('release_date') else 'N/A'})")


class TestTVShowsPage:
    """Test TV Shows page endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        self.token = login_response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_discover_tv(self):
        """Test discover TV shows endpoint"""
        response = self.session.get(f"{BASE_URL}/api/tmdb/discover/tv")
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) > 0
        print(f"TV shows: {len(data['results'])} shows discovered")
    
    def test_tv_on_the_air(self):
        """Test on the air TV shows"""
        response = self.session.get(f"{BASE_URL}/api/tmdb/tv/on_the_air")
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        print(f"On the air: {len(data['results'])} TV shows")
    
    def test_tv_details(self):
        """Test TV show details endpoint"""
        discover_response = self.session.get(f"{BASE_URL}/api/tmdb/discover/tv")
        shows = discover_response.json()["results"]
        if shows:
            tv_id = shows[0]["id"]
            response = self.session.get(f"{BASE_URL}/api/tmdb/tv/{tv_id}")
            assert response.status_code == 200
            data = response.json()
            assert "name" in data
            print(f"TV details: {data['name']}")
    
    def test_tv_genres(self):
        """Test TV genres endpoint"""
        response = self.session.get(f"{BASE_URL}/api/tmdb/genres/tv")
        assert response.status_code == 200
        data = response.json()
        assert "genres" in data
        print(f"TV genres: {len(data['genres'])} genres")


class TestAnimePage:
    """Test Anime page endpoints - filtered Japanese animation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        self.token = login_response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_discover_anime(self):
        """Test anime discovery with Japanese language filter"""
        # Anime page uses discover/tv with Japanese filter and animation genre
        params = {
            "with_original_language": "ja",
            "with_genres": "16",  # Animation genre ID
            "sort_by": "popularity.desc"
        }
        response = self.session.get(f"{BASE_URL}/api/tmdb/discover/tv", params=params)
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        print(f"Anime found: {len(data['results'])} shows")
        if data["results"]:
            print(f"First anime: {data['results'][0].get('name', 'N/A')}")


class TestPlaylistsPage:
    """Test Playlists page CRUD functionality - uses Drizzle API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        self.token = login_response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_get_playlists(self):
        """Test get playlists endpoint (Drizzle API)"""
        response = self.session.get(f"{BASE_URL}/api/drizzle/playlists")
        assert response.status_code == 200
        data = response.json()
        assert "playlists" in data
        print(f"Playlists: {data['count']} playlists found")
    
    def test_create_and_delete_playlist(self):
        """Test playlist CRUD operations (Drizzle API) - uses query params"""
        # Create playlist - endpoint uses query params
        create_response = self.session.post(
            f"{BASE_URL}/api/drizzle/playlists",
            params={"name": "TEST_Audit_Playlist", "description": "Test playlist for code audit"}
        )
        assert create_response.status_code in [200, 201], f"Create failed: {create_response.text}"
        playlist = create_response.json()
        playlist_id = playlist.get("id")
        print(f"Created playlist: {playlist['name']}")
        
        # Verify playlist exists
        get_response = self.session.get(f"{BASE_URL}/api/drizzle/playlists")
        playlists = get_response.json()["playlists"]
        found = any(p.get("id") == playlist_id for p in playlists)
        assert found, "Created playlist not found"
        
        # Delete playlist
        if playlist_id:
            delete_response = self.session.delete(f"{BASE_URL}/api/drizzle/playlists/{playlist_id}")
            assert delete_response.status_code in [200, 204]
            print(f"Deleted playlist: {playlist_id}")


class TestWatchlistPage:
    """Test Watchlist page add/remove functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        self.token = login_response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_get_watchlist(self):
        """Test get watchlist endpoint"""
        response = self.session.get(f"{BASE_URL}/api/watchlist")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Watchlist: {len(data)} items")
    
    def test_add_remove_watchlist_item(self):
        """Test add and remove watchlist item"""
        # Add to watchlist
        add_response = self.session.post(f"{BASE_URL}/api/watchlist", json={
            "tmdb_id": 99999,  # Test ID
            "media_type": "movie",
            "title": "TEST_Audit_Movie",
            "poster_path": None
        })
        # May fail if already exists
        if add_response.status_code in [200, 201]:
            print("Added to watchlist")
            
            # Remove from watchlist
            remove_response = self.session.delete(f"{BASE_URL}/api/watchlist/99999")
            assert remove_response.status_code in [200, 204]
            print("Removed from watchlist")
        else:
            print(f"Add response: {add_response.status_code} - may already exist")


class TestWatchHistoryPage:
    """Test Watch History page - Bug fix verification for updated_at sorting"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        self.token = login_response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_get_watch_progress(self):
        """Test get watch progress endpoint"""
        response = self.session.get(f"{BASE_URL}/api/watch-progress")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Watch history: {len(data)} items")
        
        # Verify sorting by updated_at (Bug fix #2)
        if len(data) >= 2:
            for i in range(len(data) - 1):
                current = data[i].get("updated_at", "")
                next_item = data[i + 1].get("updated_at", "")
                if current and next_item:
                    assert current >= next_item, "Watch history not sorted by updated_at descending"
            print("Watch history correctly sorted by updated_at")
    
    def test_update_watch_progress(self):
        """Test update watch progress"""
        response = self.session.post(f"{BASE_URL}/api/watch-progress", json={
            "tmdb_id": 88888,  # Test ID
            "media_type": "movie",
            "title": "TEST_Progress_Movie",
            "progress": 50.0,
            "current_time": 3600,
            "duration": 7200
        })
        assert response.status_code == 200
        data = response.json()
        assert "updated_at" in data, "Response should include updated_at field"
        print(f"Progress updated with updated_at: {data['updated_at']}")


class TestDiscoverPage:
    """Test Discover page - genre filters and sorting"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        self.token = login_response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_discover_with_genre_filter(self):
        """Test discover with genre filter"""
        # Action genre = 28
        params = {"with_genres": "28", "sort_by": "popularity.desc"}
        response = self.session.get(f"{BASE_URL}/api/tmdb/discover/movie", params=params)
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        print(f"Action movies: {len(data['results'])} movies")
    
    def test_discover_sorting(self):
        """Test discover with different sorting options"""
        sort_options = ["popularity.desc", "vote_average.desc", "release_date.desc"]
        for sort_by in sort_options:
            params = {"sort_by": sort_by}
            response = self.session.get(f"{BASE_URL}/api/tmdb/discover/movie", params=params)
            assert response.status_code == 200
            print(f"Sort by {sort_by}: OK")


class TestSettingsPage:
    """Test Settings page endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        self.token = login_response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_get_settings(self):
        """Test get settings endpoint"""
        response = self.session.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        print(f"Settings retrieved: {list(data.keys())}")
    
    def test_get_users(self):
        """Test get users endpoint"""
        response = self.session.get(f"{BASE_URL}/api/users")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Users: {len(data)} users")
    
    def test_get_indexers(self):
        """Test get indexers endpoint"""
        response = self.session.get(f"{BASE_URL}/api/compote/indexers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Indexers: {len(data)} indexers")
    
    def test_get_streaming_services(self):
        """Test get streaming services endpoint"""
        response = self.session.get(f"{BASE_URL}/api/streaming-services")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Streaming services: {len(data)} services")


class TestQualityProfiles:
    """Test Quality Profiles in Settings"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        self.token = login_response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_get_quality_profiles(self):
        """Test get quality profiles endpoint - returns object with profiles array"""
        response = self.session.get(f"{BASE_URL}/api/quality-profiles")
        assert response.status_code == 200
        data = response.json()
        # API returns {"profiles": [...], "quality_definitions": [...]}
        assert "profiles" in data or isinstance(data, list)
        profiles = data.get("profiles", data) if isinstance(data, dict) else data
        print(f"Quality profiles: {len(profiles)} profiles")
        if profiles:
            profile = profiles[0]
            print(f"First profile: {profile.get('name', 'N/A')}")
    
    def test_get_quality_definitions(self):
        """Test get quality definitions endpoint - returns object with definitions array"""
        response = self.session.get(f"{BASE_URL}/api/quality-definitions")
        assert response.status_code == 200
        data = response.json()
        # API returns {"definitions": [...]}
        assert "definitions" in data or isinstance(data, list)
        definitions = data.get("definitions", data) if isinstance(data, dict) else data
        print(f"Quality definitions: {len(definitions)} definitions")


class TestSearch:
    """Test Search functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        self.token = login_response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_search_multi(self):
        """Test multi search endpoint"""
        response = self.session.get(f"{BASE_URL}/api/tmdb/search", params={"query": "The Matrix"})
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        print(f"Search results: {len(data['results'])} items for 'The Matrix'")


class TestDownloads:
    """Test Downloads page endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        self.token = login_response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_get_downloads(self):
        """Test get downloads endpoint"""
        response = self.session.get(f"{BASE_URL}/api/downloads")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Downloads: {len(data)} items in queue")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
