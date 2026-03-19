"""
WatchNexus v2.7.3 - New Features Test Suite
Tests for the 5 new native features:
1. Truffle (Watch Analytics & Year Wrapped)
2. Pepper (Notification Hub)
3. Meringue (User Request System)
4. Rind (Parental Controls)
5. Crucible (Media Processing Pipeline)
"""

import pytest
import requests
import os
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')


class TestHealthAndAuth:
    """Basic health check and authentication tests"""

    def test_health_endpoint(self):
        """GET /api/health - should return healthy with version 2.7.3"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'healthy'
        assert data['version'] == '2.7.3'
        # Verify no Jellyfin reference
        assert 'jellyfin' not in response.text.lower()
        print(f"✓ Health endpoint OK: {data}")

    def test_auth_login(self):
        """POST /api/auth/login - login with test credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 200
        data = response.json()
        assert 'access_token' in data
        assert 'user' in data
        assert data['user']['email'] == 'test@test.com'
        print(f"✓ Login OK for user: {data['user']['email']}")
        return data['access_token']


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for protected endpoints"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@test.com",
        "password": "password"
    })
    if response.status_code != 200:
        pytest.skip("Authentication failed - cannot test protected endpoints")
    return response.json()['access_token']


@pytest.fixture
def auth_headers(auth_token):
    """Headers with authorization token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestModulesAndPlugins:
    """Test that new modules are registered correctly"""

    def test_info_includes_new_modules(self, auth_headers):
        """GET /api/info - should show 29 modules including truffle, pepper, meringue, rind, crucible"""
        response = requests.get(f"{BASE_URL}/api/info", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        modules = data.get('modules', [])
        codenames = [m['codename'] for m in modules]
        
        # Check all 5 new features are present
        assert 'truffle' in codenames, "Missing truffle module"
        assert 'pepper' in codenames, "Missing pepper module"
        assert 'meringue' in codenames, "Missing meringue module"
        assert 'rind' in codenames, "Missing rind module"
        assert 'crucible' in codenames, "Missing crucible module"
        
        # Should have 29 total modules
        assert len(modules) >= 29, f"Expected 29+ modules, got {len(modules)}"
        print(f"✓ Info shows {len(modules)} modules including all 5 new features")

    def test_gadgets_plugins_includes_new_features(self, auth_headers):
        """GET /api/gadgets/plugins - should include all 5 new features with correct codenames"""
        response = requests.get(f"{BASE_URL}/api/gadgets/plugins", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Create dict of plugins by codename
        plugins_by_codename = {p.get('codename'): p for p in data if 'codename' in p}
        
        # Verify new features are in plugins
        expected_codenames = ['truffle', 'pepper', 'meringue', 'rind', 'crucible']
        for codename in expected_codenames:
            assert codename in plugins_by_codename, f"Missing plugin with codename: {codename}"
        
        print(f"✓ Gadgets plugins includes all 5 new features")

    def test_ripen_installed_includes_new_gadgets(self, auth_headers):
        """GET /api/ripen/installed - should show 15+ gadgets including the 5 new ones"""
        response = requests.get(f"{BASE_URL}/api/ripen/installed", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        gadgets = data if isinstance(data, list) else data.get('gadgets', [])
        assert len(gadgets) >= 15, f"Expected 15+ gadgets, got {len(gadgets)}"
        
        codenames = [g.get('codename', '') for g in gadgets]
        expected = ['truffle', 'pepper', 'meringue', 'rind', 'crucible']
        for codename in expected:
            assert codename in codenames, f"Missing gadget with codename: {codename}"
        
        print(f"✓ Ripen shows {len(gadgets)} installed gadgets with all 5 new features")


class TestTruffle:
    """Truffle — Watch Analytics & Year Wrapped tests"""

    def test_record_play_event(self, auth_headers):
        """POST /api/truffle/play - record a play event"""
        response = requests.post(f"{BASE_URL}/api/truffle/play", headers=auth_headers, json={
            "title": "TEST_Movie_v273",
            "tmdb_id": 12345,
            "media_type": "movie",
            "duration_seconds": 7200,
            "device_type": "desktop",
            "quality": "1080p"
        })
        assert response.status_code == 200
        data = response.json()
        assert 'id' in data
        assert data['status'] == 'recorded'
        print(f"✓ Play event recorded: {data['id']}")
        return data['id']

    def test_get_stats(self, auth_headers):
        """GET /api/truffle/stats - return play statistics for last 30 days"""
        response = requests.get(f"{BASE_URL}/api/truffle/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert 'period_days' in data
        assert 'total_plays' in data
        assert 'total_watch_hours' in data
        assert 'unique_titles' in data
        assert 'by_media_type' in data
        print(f"✓ Stats retrieved: {data['total_plays']} plays, {data['total_watch_hours']} hours")

    def test_get_wrapped(self, auth_headers):
        """GET /api/truffle/wrapped - return year-in-review data"""
        response = requests.get(f"{BASE_URL}/api/truffle/wrapped", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert 'year' in data
        # May have 'message' if no activity, or full wrapped data
        print(f"✓ Wrapped data retrieved for year {data.get('year')}")

    def test_get_recent(self, auth_headers):
        """GET /api/truffle/recent - return recent play events"""
        response = requests.get(f"{BASE_URL}/api/truffle/recent", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ Recent events retrieved: {len(data)} events")

    def test_admin_overview(self, auth_headers):
        """GET /api/truffle/admin/overview - return all-users overview"""
        response = requests.get(f"{BASE_URL}/api/truffle/admin/overview", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert 'period_days' in data
        assert 'total_plays' in data
        assert 'active_users' in data
        print(f"✓ Admin overview: {data['total_plays']} plays across {data['active_users']} users")


class TestPepper:
    """Pepper — Notification Hub tests"""

    def test_get_events(self, auth_headers):
        """GET /api/pepper/events - return list of supported notification event types"""
        response = requests.get(f"{BASE_URL}/api/pepper/events", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 5  # Should have multiple event types
        
        event_ids = [e['id'] for e in data]
        assert 'new_media' in event_ids
        assert 'download_complete' in event_ids
        print(f"✓ Supported events: {len(data)} event types")

    def test_save_channel(self, auth_headers):
        """PUT /api/pepper/channels/test1 - save a Discord notification channel"""
        response = requests.put(f"{BASE_URL}/api/pepper/channels/test1", headers=auth_headers, json={
            "type": "discord",
            "name": "Test Discord Channel",
            "webhook_url": "https://discord.com/api/webhooks/TEST/test",
            "enabled": True
        })
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'saved'
        assert data['channel_id'] == 'test1'
        print(f"✓ Channel saved: {data['channel_id']}")

    def test_get_channels(self, auth_headers):
        """GET /api/pepper/channels - return configured channels"""
        response = requests.get(f"{BASE_URL}/api/pepper/channels", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        # Should have at least the test1 channel we just created
        channel_ids = [c['id'] for c in data]
        assert 'test1' in channel_ids, "test1 channel not found"
        print(f"✓ Channels retrieved: {len(data)} channels")

    def test_delete_channel(self, auth_headers):
        """DELETE /api/pepper/channels/test1 - delete channel"""
        response = requests.delete(f"{BASE_URL}/api/pepper/channels/test1", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'deleted'
        print(f"✓ Channel deleted")

    def test_get_history(self, auth_headers):
        """GET /api/pepper/history - return notification history"""
        response = requests.get(f"{BASE_URL}/api/pepper/history", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ Notification history retrieved: {len(data)} entries")


class TestMeringue:
    """Meringue — User Request System tests"""
    request_id = None

    def test_submit_request(self, auth_headers):
        """POST /api/meringue/request - submit a media request with tmdb_id"""
        response = requests.post(f"{BASE_URL}/api/meringue/request", headers=auth_headers, json={
            "tmdb_id": 99999,
            "media_type": "movie",
            "title": "TEST_Requested_Movie_v273",
            "poster_url": "https://example.com/poster.jpg",
            "overview": "A test movie request"
        })
        assert response.status_code == 200
        data = response.json()
        assert 'id' in data
        assert data['status'] in ['requested', 'already_requested']
        TestMeringue.request_id = data['id']
        print(f"✓ Request submitted: {data['id']} - status: {data['status']}")

    def test_my_requests(self, auth_headers):
        """GET /api/meringue/my-requests - return user's requests"""
        response = requests.get(f"{BASE_URL}/api/meringue/my-requests", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ My requests: {len(data)} requests")

    def test_all_requests_admin(self, auth_headers):
        """GET /api/meringue/requests - return all requests (admin)"""
        response = requests.get(f"{BASE_URL}/api/meringue/requests", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ All requests (admin): {len(data)} requests")

    def test_approve_request(self, auth_headers):
        """PUT /api/meringue/requests/{id}/approve - approve a request"""
        if TestMeringue.request_id is None:
            pytest.skip("No request ID to approve")
        
        response = requests.put(
            f"{BASE_URL}/api/meringue/requests/{TestMeringue.request_id}/approve", 
            headers=auth_headers,
            json={"notes": "Approved by test"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'approved'
        print(f"✓ Request approved: {TestMeringue.request_id}")

    def test_get_stats(self, auth_headers):
        """GET /api/meringue/stats - return request statistics"""
        response = requests.get(f"{BASE_URL}/api/meringue/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert 'total' in data
        assert 'pending' in data
        assert 'approved' in data
        print(f"✓ Request stats: {data['total']} total, {data['pending']} pending, {data['approved']} approved")


class TestRind:
    """Rind — Parental Controls tests"""

    def test_get_profile_default(self, auth_headers):
        """GET /api/rind/profile - return parental control profile (default or configured)"""
        response = requests.get(f"{BASE_URL}/api/rind/profile", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Should have profile structure even if not configured
        print(f"✓ Profile retrieved: configured={data.get('configured', False)}")

    def test_save_profile(self, auth_headers):
        """PUT /api/rind/profile - save parental control profile with max_rating PG-13"""
        response = requests.put(f"{BASE_URL}/api/rind/profile", headers=auth_headers, json={
            "configured": True,
            "max_rating": "PG-13",
            "restricted_genres": ["horror", "adult"],
            "allowed_libraries": [],
            "hide_unrated": False
        })
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'saved'
        print(f"✓ Profile saved with max_rating=PG-13")

    def test_set_pin(self, auth_headers):
        """POST /api/rind/pin/set - set a PIN (min 4 chars)"""
        response = requests.post(f"{BASE_URL}/api/rind/pin/set", headers=auth_headers, json={
            "pin": "1234"
        })
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'pin_set'
        print(f"✓ PIN set successfully")

    def test_verify_correct_pin(self, auth_headers):
        """POST /api/rind/pin/verify - verify correct PIN"""
        response = requests.post(f"{BASE_URL}/api/rind/pin/verify", headers=auth_headers, json={
            "pin": "1234"
        })
        assert response.status_code == 200
        data = response.json()
        assert data['valid'] == True
        print(f"✓ Correct PIN verified")

    def test_verify_incorrect_pin(self, auth_headers):
        """POST /api/rind/pin/verify - verify incorrect PIN returns false"""
        response = requests.post(f"{BASE_URL}/api/rind/pin/verify", headers=auth_headers, json={
            "pin": "9999"
        })
        assert response.status_code == 200
        data = response.json()
        assert data['valid'] == False
        print(f"✓ Incorrect PIN correctly rejected")

    def test_check_rating_blocked(self, auth_headers):
        """GET /api/rind/check?rating=R - should be blocked if max_rating is PG-13"""
        response = requests.get(f"{BASE_URL}/api/rind/check?rating=R", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data['allowed'] == False, f"R-rated content should be blocked (max_rating=PG-13)"
        assert 'reason' in data
        print(f"✓ R-rated content blocked: {data['reason']}")

    def test_check_genre_restriction(self, auth_headers):
        """GET /api/rind/check?genre=horror - check genre restriction"""
        response = requests.get(f"{BASE_URL}/api/rind/check?genre=horror", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data['allowed'] == False, "Horror genre should be restricted"
        print(f"✓ Horror genre blocked: {data.get('reason')}")

    def test_get_ratings(self, auth_headers):
        """GET /api/rind/ratings - return content ratings reference"""
        response = requests.get(f"{BASE_URL}/api/rind/ratings", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 5  # G, PG, PG-13, R, NC-17, NR
        
        codes = [r['code'] for r in data]
        assert 'G' in codes
        assert 'PG' in codes
        assert 'PG-13' in codes
        assert 'R' in codes
        print(f"✓ Ratings reference: {len(data)} ratings")


class TestCrucible:
    """Crucible — Media Processing Pipeline tests"""
    job_id = None

    def test_get_profiles(self, auth_headers):
        """GET /api/crucible/profiles - return 7 transcode profiles"""
        response = requests.get(f"{BASE_URL}/api/crucible/profiles", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) == 7, f"Expected 7 profiles, got {len(data)}"
        
        profile_ids = [p['id'] for p in data]
        assert 'h265-default' in profile_ids
        assert 'h265-quality' in profile_ids
        assert 'h265-compact' in profile_ids
        print(f"✓ Transcode profiles: {len(data)} profiles")

    def test_ffmpeg_status(self, auth_headers):
        """GET /api/crucible/ffmpeg-status - return FFmpeg installation status"""
        response = requests.get(f"{BASE_URL}/api/crucible/ffmpeg-status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert 'ffmpeg_installed' in data
        assert 'ffprobe_installed' in data
        # FFmpeg may or may not be installed - just verify structure
        print(f"✓ FFmpeg status: installed={data['ffmpeg_installed']}")

    def test_submit_job(self, auth_headers):
        """POST /api/crucible/jobs - submit a transcode job"""
        response = requests.post(f"{BASE_URL}/api/crucible/jobs", headers=auth_headers, json={
            "source_path": "/tmp/test_video.mp4",
            "output_path": "/tmp/test_video_h265.mp4",
            "profile": "h265-default"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert 'id' in data
        assert data['status'] == 'queued'
        TestCrucible.job_id = data['id']
        print(f"✓ Job submitted: {data['id']}")

    def test_get_jobs(self, auth_headers):
        """GET /api/crucible/jobs - return job queue"""
        response = requests.get(f"{BASE_URL}/api/crucible/jobs", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ Jobs retrieved: {len(data)} jobs")

    def test_get_stats(self, auth_headers):
        """GET /api/crucible/stats - return processing statistics"""
        response = requests.get(f"{BASE_URL}/api/crucible/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert 'total_jobs' in data
        assert 'queued' in data
        assert 'completed' in data
        print(f"✓ Processing stats: {data['total_jobs']} total, {data['completed']} completed")


class TestNoJellyfinReferences:
    """Verify NO response from any endpoint contains 'Jellyfin' or 'jellyfin'"""

    def test_no_jellyfin_in_responses(self, auth_headers):
        """Scan all new feature endpoints for Jellyfin references"""
        endpoints = [
            "/api/health",
            "/api/info",
            "/api/truffle/stats",
            "/api/truffle/recent",
            "/api/pepper/events",
            "/api/pepper/channels",
            "/api/meringue/stats",
            "/api/rind/profile",
            "/api/rind/ratings",
            "/api/crucible/profiles",
            "/api/crucible/ffmpeg-status",
            "/api/crucible/stats"
        ]
        
        jellyfin_found = []
        for endpoint in endpoints:
            try:
                if 'health' in endpoint:
                    response = requests.get(f"{BASE_URL}{endpoint}")
                else:
                    response = requests.get(f"{BASE_URL}{endpoint}", headers=auth_headers)
                
                if 'jellyfin' in response.text.lower():
                    jellyfin_found.append(endpoint)
            except Exception as e:
                print(f"Warning: Could not check {endpoint}: {e}")
        
        assert len(jellyfin_found) == 0, f"Jellyfin references found in: {jellyfin_found}"
        print(f"✓ No Jellyfin references found in {len(endpoints)} endpoints")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
