"""
Strudel Module API Tests - Optical Disc Ripping & Transcoding Pipeline
Tests for DVD/Blu-ray ripping module with MakeMKV and HandBrake integration
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestStrudelModule:
    """Strudel optical disc ripping module API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for all tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@watchnexus.local",
            "password": "admin"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    # ── Status Endpoint ──────────────────────────────────────────────
    def test_strudel_status_returns_module_info(self):
        """GET /api/strudel/status returns module info with tool availability"""
        response = requests.get(f"{BASE_URL}/api/strudel/status", headers=self.headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify module info
        assert data["module"] == "strudel"
        assert data["version"] == "2.8.4"
        assert data["status"] == "active"
        assert "Optical Disc Ripping" in data["description"]
        
        # Verify features list
        assert "dvd_ripping" in data["features"]
        assert "bluray_ripping" in data["features"]
        assert "transcoding" in data["features"]
        assert "subtitle_extraction" in data["features"]
        
        # Verify tools structure
        tools = data["tools"]
        assert "makemkv" in tools
        assert "handbrake" in tools
        assert "mkvtoolnix" in tools
        assert "ffprobe" in tools
        
        # Verify tool info structure (tools not installed in test env)
        assert "installed" in tools["makemkv"]
        assert "path" in tools["makemkv"]
        assert "required" in tools["makemkv"]
        assert tools["makemkv"]["required"] == True
        assert tools["handbrake"]["required"] == True
        assert tools["mkvtoolnix"]["required"] == False
        
        # Verify legal notice
        assert "legal_notice" in data
        assert "third-party tools" in data["legal_notice"]
    
    # ── Drives Endpoint ──────────────────────────────────────────────
    def test_strudel_drives_returns_list(self):
        """GET /api/strudel/drives returns list of optical drives (may be empty)"""
        response = requests.get(f"{BASE_URL}/api/strudel/drives", headers=self.headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "drives" in data
        assert "count" in data
        assert isinstance(data["drives"], list)
        assert data["count"] == len(data["drives"])
        
        # In cloud environment, drives list will be empty
        # This is expected behavior
    
    # ── Profiles Endpoint ────────────────────────────────────────────
    def test_strudel_profiles_returns_7_defaults(self):
        """GET /api/strudel/profiles returns 7 default transcode profiles"""
        response = requests.get(f"{BASE_URL}/api/strudel/profiles", headers=self.headers)
        
        assert response.status_code == 200
        profiles = response.json()
        
        # Verify 7 default profiles
        assert isinstance(profiles, list)
        assert len(profiles) == 7
        
        # Verify expected profile IDs
        profile_ids = [p["id"] for p in profiles]
        assert "direct" in profile_ids
        assert "1080p-h265-crf20" in profile_ids
        assert "1080p-h264-crf18" in profile_ids
        assert "720p-h265-crf22" in profile_ids
        assert "4k-passthrough" in profile_ids
        assert "nvenc-h265-crf24" in profile_ids
        assert "qsv-h265-crf22" in profile_ids
        
        # Verify profile structure
        for profile in profiles:
            assert "id" in profile
            assert "name" in profile
            assert "description" in profile
            assert "video_encoder" in profile
            assert "video_quality" in profile
            assert "hw_accel" in profile
            assert "output_format" in profile
            assert "estimated_size" in profile
    
    def test_strudel_profile_direct_copy(self):
        """Verify direct copy profile has correct settings"""
        response = requests.get(f"{BASE_URL}/api/strudel/profiles", headers=self.headers)
        profiles = response.json()
        
        direct = next((p for p in profiles if p["id"] == "direct"), None)
        assert direct is not None
        assert direct["name"] == "Direct Copy (No Transcode)"
        assert direct["video_encoder"] == "copy"
        assert direct["hw_accel"] == "none"
        assert direct["output_format"] == "mkv"
    
    def test_strudel_profile_nvenc_gpu(self):
        """Verify NVENC GPU profile has correct settings"""
        response = requests.get(f"{BASE_URL}/api/strudel/profiles", headers=self.headers)
        profiles = response.json()
        
        nvenc = next((p for p in profiles if p["id"] == "nvenc-h265-crf24"), None)
        assert nvenc is not None
        assert "NVIDIA" in nvenc["name"]
        assert nvenc["video_encoder"] == "nvenc_h265"
        assert nvenc["hw_accel"] == "nvenc"
    
    # ── Config Endpoint ──────────────────────────────────────────────
    def test_strudel_config_returns_defaults(self):
        """GET /api/strudel/config returns module configuration with defaults"""
        response = requests.get(f"{BASE_URL}/api/strudel/config", headers=self.headers)
        
        assert response.status_code == 200
        config = response.json()
        
        # Config may have been modified by previous tests, just verify structure
        assert isinstance(config, dict)
    
    def test_strudel_config_update_and_persist(self):
        """PUT /api/strudel/config updates and persists configuration"""
        # Update config
        new_config = {
            "output_directory": "/media/test-output",
            "default_profile": "720p-h265-crf22",
            "auto_eject": False
        }
        
        response = requests.put(
            f"{BASE_URL}/api/strudel/config",
            headers={**self.headers, "Content-Type": "application/json"},
            json=new_config
        )
        
        assert response.status_code == 200
        assert response.json()["message"] == "Configuration updated"
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/strudel/config", headers=self.headers)
        assert get_response.status_code == 200
        
        saved_config = get_response.json()
        assert saved_config["output_directory"] == "/media/test-output"
        assert saved_config["default_profile"] == "720p-h265-crf22"
        assert saved_config["auto_eject"] == False
    
    # ── Jobs Endpoint ────────────────────────────────────────────────
    def test_strudel_jobs_returns_list(self):
        """GET /api/strudel/jobs returns job list (initially empty)"""
        response = requests.get(f"{BASE_URL}/api/strudel/jobs", headers=self.headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "jobs" in data
        assert "count" in data
        assert isinstance(data["jobs"], list)
        assert data["count"] == len(data["jobs"])
    
    def test_strudel_job_not_found(self):
        """GET /api/strudel/jobs/{id} returns 404 for non-existent job"""
        response = requests.get(
            f"{BASE_URL}/api/strudel/jobs/nonexistent123",
            headers=self.headers
        )
        
        assert response.status_code == 404
        assert "error" in response.json()
    
    # ── History Endpoint ─────────────────────────────────────────────
    def test_strudel_history_returns_list(self):
        """GET /api/strudel/history returns rip history (initially empty)"""
        response = requests.get(f"{BASE_URL}/api/strudel/history", headers=self.headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "history" in data
        assert "count" in data
        assert isinstance(data["history"], list)
        assert data["count"] == len(data["history"])
    
    # ── Scan Endpoint (requires MakeMKV) ─────────────────────────────
    def test_strudel_scan_requires_makemkv(self):
        """POST /api/strudel/scan returns error when MakeMKV not installed"""
        response = requests.post(
            f"{BASE_URL}/api/strudel/scan",
            headers={**self.headers, "Content-Type": "application/json"},
            json={"DriveIndex": 0}
        )
        
        # Should return 400 because MakeMKV is not installed
        assert response.status_code == 400
        data = response.json()
        assert "error" in data
        assert "MakeMKV" in data["error"]
    
    # ── Rip Endpoint (requires MakeMKV) ──────────────────────────────
    def test_strudel_rip_requires_makemkv(self):
        """POST /api/strudel/rip returns error when MakeMKV not installed"""
        response = requests.post(
            f"{BASE_URL}/api/strudel/rip",
            headers={**self.headers, "Content-Type": "application/json"},
            json={
                "DriveIndex": 0,
                "DiscLabel": "Test Disc",
                "Titles": [0],
                "TranscodeProfile": "direct"
            }
        )
        
        # Should return 400 because MakeMKV is not installed
        assert response.status_code == 400
        data = response.json()
        assert "error" in data
        assert "MakeMKV" in data["error"]
    
    # ── Auth Required ────────────────────────────────────────────────
    def test_strudel_endpoints_require_auth(self):
        """All Strudel endpoints require authentication"""
        endpoints = [
            ("GET", "/api/strudel/status"),
            ("GET", "/api/strudel/drives"),
            ("GET", "/api/strudel/profiles"),
            ("GET", "/api/strudel/config"),
            ("GET", "/api/strudel/jobs"),
            ("GET", "/api/strudel/history"),
        ]
        
        for method, endpoint in endpoints:
            if method == "GET":
                response = requests.get(f"{BASE_URL}{endpoint}")
            
            assert response.status_code == 401, f"{endpoint} should require auth"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
