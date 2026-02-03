"""
WatchNexus New Features Tests - Iteration 2
Tests for:
- Google OAuth endpoints
- Scheduled health scans
- Scan notifications
- Re-download functionality
- Logout endpoint
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestGoogleOAuthEndpoints:
    """Google OAuth API tests"""
    
    def test_google_session_invalid_session_id(self):
        """Test /api/auth/google/session with invalid session_id returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google/session",
            params={"session_id": "invalid_session_id_12345"}
        )
        # Should return 401 for invalid session
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
    
    def test_google_session_missing_session_id(self):
        """Test /api/auth/google/session without session_id returns 422"""
        response = requests.post(f"{BASE_URL}/api/auth/google/session")
        # Should return 422 for missing required parameter
        assert response.status_code == 422


class TestLogoutEndpoint:
    """Logout API tests"""
    
    def test_logout_success(self):
        """Test /api/auth/logout clears session"""
        response = requests.post(f"{BASE_URL}/api/auth/logout")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "logged out"
    
    def test_logout_with_session(self):
        """Test logout with existing session"""
        # First login to get a session
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert login_response.status_code == 200
        
        # Then logout
        response = requests.post(f"{BASE_URL}/api/auth/logout")
        assert response.status_code == 200
        assert response.json()["status"] == "logged out"


class TestScheduledScansAPI:
    """Scheduled scans API tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            token = response.json()["access_token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_get_scheduled_scans(self, auth_headers):
        """Test GET /api/media/scheduled-scans returns list"""
        response = requests.get(
            f"{BASE_URL}/api/media/scheduled-scans",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_scheduled_scans_unauthenticated(self):
        """Test scheduled scans requires authentication"""
        response = requests.get(f"{BASE_URL}/api/media/scheduled-scans")
        assert response.status_code == 401
    
    def test_create_scheduled_scan(self, auth_headers):
        """Test POST /api/media/scheduled-scans creates new scan"""
        scan_data = {
            "directory": f"/media/test_{uuid.uuid4().hex[:8]}",
            "schedule_type": "daily",
            "schedule_time": "03:00",
            "enabled": True,
            "notify_on_issues": True,
            "auto_repair": False
        }
        response = requests.post(
            f"{BASE_URL}/api/media/scheduled-scans",
            headers=auth_headers,
            json=scan_data
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert data["directory"] == scan_data["directory"]
        assert data["schedule_type"] == "daily"
        assert data["schedule_time"] == "03:00"
        assert data["enabled"] == True
        assert data["notify_on_issues"] == True
        assert "next_scan" in data
        
        # Store scan_id for cleanup
        return data["id"]
    
    def test_create_scheduled_scan_weekly(self, auth_headers):
        """Test creating weekly scheduled scan"""
        scan_data = {
            "directory": f"/media/weekly_{uuid.uuid4().hex[:8]}",
            "schedule_type": "weekly",
            "schedule_time": "02:30",
            "enabled": True,
            "notify_on_issues": False,
            "auto_repair": True
        }
        response = requests.post(
            f"{BASE_URL}/api/media/scheduled-scans",
            headers=auth_headers,
            json=scan_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["schedule_type"] == "weekly"
        assert data["auto_repair"] == True
    
    def test_run_scheduled_scan_now(self, auth_headers):
        """Test POST /api/media/scheduled-scans/{id}/run executes scan immediately"""
        # First create a scan
        scan_data = {
            "directory": "/tmp",
            "schedule_type": "daily",
            "schedule_time": "04:00",
            "enabled": True,
            "notify_on_issues": True
        }
        create_response = requests.post(
            f"{BASE_URL}/api/media/scheduled-scans",
            headers=auth_headers,
            json=scan_data
        )
        assert create_response.status_code == 200
        scan_id = create_response.json()["id"]
        
        # Run the scan immediately
        run_response = requests.post(
            f"{BASE_URL}/api/media/scheduled-scans/{scan_id}/run",
            headers=auth_headers
        )
        assert run_response.status_code == 200
        data = run_response.json()
        
        # Verify response structure
        assert "total_files" in data
        assert "healthy_files" in data
        assert "warning_files" in data
        assert "error_files" in data
        assert "results" in data
        assert isinstance(data["results"], list)
    
    def test_run_nonexistent_scan(self, auth_headers):
        """Test running non-existent scan returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/media/scheduled-scans/nonexistent-id-12345/run",
            headers=auth_headers
        )
        assert response.status_code == 404
    
    def test_delete_scheduled_scan(self, auth_headers):
        """Test DELETE /api/media/scheduled-scans/{id} removes scan"""
        # First create a scan
        scan_data = {
            "directory": f"/media/delete_test_{uuid.uuid4().hex[:8]}",
            "schedule_type": "monthly",
            "schedule_time": "05:00"
        }
        create_response = requests.post(
            f"{BASE_URL}/api/media/scheduled-scans",
            headers=auth_headers,
            json=scan_data
        )
        assert create_response.status_code == 200
        scan_id = create_response.json()["id"]
        
        # Delete the scan
        delete_response = requests.delete(
            f"{BASE_URL}/api/media/scheduled-scans/{scan_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200
        assert delete_response.json()["status"] == "deleted"
        
        # Verify it's deleted by trying to run it
        run_response = requests.post(
            f"{BASE_URL}/api/media/scheduled-scans/{scan_id}/run",
            headers=auth_headers
        )
        assert run_response.status_code == 404
    
    def test_delete_nonexistent_scan(self, auth_headers):
        """Test deleting non-existent scan returns 404"""
        response = requests.delete(
            f"{BASE_URL}/api/media/scheduled-scans/nonexistent-id-12345",
            headers=auth_headers
        )
        assert response.status_code == 404


class TestNotificationsAPI:
    """Scan notifications API tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            token = response.json()["access_token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_get_notifications(self, auth_headers):
        """Test GET /api/media/notifications returns list"""
        response = requests.get(
            f"{BASE_URL}/api/media/notifications",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_notifications_unread_only(self, auth_headers):
        """Test GET /api/media/notifications with unread_only filter"""
        response = requests.get(
            f"{BASE_URL}/api/media/notifications",
            headers=auth_headers,
            params={"unread_only": True}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned notifications should be unread
        for notification in data:
            assert notification.get("read") == False
    
    def test_get_notifications_unauthenticated(self):
        """Test notifications requires authentication"""
        response = requests.get(f"{BASE_URL}/api/media/notifications")
        assert response.status_code == 401


class TestRedownloadAPI:
    """Re-download API tests (MOCKED - queues but doesn't actually download)"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            token = response.json()["access_token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_request_redownload(self, auth_headers):
        """Test POST /api/media/redownload queues re-download"""
        response = requests.post(
            f"{BASE_URL}/api/media/redownload",
            headers=auth_headers,
            params={
                "file_path": "/media/movies/corrupted_movie.mkv",
                "title": "Test Movie",
                "media_type": "movie",
                "tmdb_id": 12345
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "status" in data
        assert data["status"] in ["queued", "pending_indexers"]
        assert "download_id" in data
        assert "message" in data
        assert "indexers" in data
        assert isinstance(data["indexers"], list)
    
    def test_request_redownload_tv_show(self, auth_headers):
        """Test re-download for TV show"""
        response = requests.post(
            f"{BASE_URL}/api/media/redownload",
            headers=auth_headers,
            params={
                "file_path": "/media/tv/show_s01e01.mkv",
                "title": "Test TV Show S01E01",
                "media_type": "tv",
                "tmdb_id": 67890
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "download_id" in data
    
    def test_request_redownload_unauthenticated(self):
        """Test re-download requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/media/redownload",
            params={
                "file_path": "/media/test.mkv",
                "title": "Test"
            }
        )
        assert response.status_code == 401
    
    def test_request_redownload_without_tmdb_id(self, auth_headers):
        """Test re-download without tmdb_id (optional parameter)"""
        response = requests.post(
            f"{BASE_URL}/api/media/redownload",
            headers=auth_headers,
            params={
                "file_path": "/media/unknown_movie.mkv",
                "title": "Unknown Movie"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "download_id" in data


class TestExistingScheduledScan:
    """Test with the existing scheduled scan mentioned in the request"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            token = response.json()["access_token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_existing_scan_in_list(self, auth_headers):
        """Test that scheduled scans list can be retrieved"""
        response = requests.get(
            f"{BASE_URL}/api/media/scheduled-scans",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Note: The specific scan ID e41f4261-2e3f-4a62-8bc0-2a054be898fb may or may not exist
        # depending on which user created it


class TestUpdateScheduledScan:
    """Test updating scheduled scans"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            token = response.json()["access_token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_update_scheduled_scan(self, auth_headers):
        """Test PUT /api/media/scheduled-scans/{id} updates scan"""
        # First create a scan
        scan_data = {
            "directory": f"/media/update_test_{uuid.uuid4().hex[:8]}",
            "schedule_type": "daily",
            "schedule_time": "06:00",
            "enabled": True
        }
        create_response = requests.post(
            f"{BASE_URL}/api/media/scheduled-scans",
            headers=auth_headers,
            json=scan_data
        )
        assert create_response.status_code == 200
        scan_id = create_response.json()["id"]
        
        # Update the scan
        updated_data = {
            "directory": scan_data["directory"],
            "schedule_type": "weekly",
            "schedule_time": "07:00",
            "enabled": False,
            "notify_on_issues": False,
            "auto_repair": True
        }
        update_response = requests.put(
            f"{BASE_URL}/api/media/scheduled-scans/{scan_id}",
            headers=auth_headers,
            json=updated_data
        )
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["schedule_type"] == "weekly"
        assert data["schedule_time"] == "07:00"
        assert data["enabled"] == False
