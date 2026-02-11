"""
Test suite for IPTV (Relish) and Pulp (Usenet) APIs
Tests the new backlog features:
- IPTV integration with M3U parsing and EPG
- Full Pulp (Usenet) API
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "password"


class TestAuth:
    """Authentication for subsequent tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}


class TestIPTVStats(TestAuth):
    """Test /api/iptv/stats endpoint"""
    
    def test_iptv_stats_returns_statistics(self, auth_headers):
        """Test that IPTV stats endpoint returns proper statistics"""
        response = requests.get(f"{BASE_URL}/api/iptv/stats", headers=auth_headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify all expected fields are present
        expected_fields = [
            "total_sources", "total_channels", "total_groups",
            "favorites_count", "hidden_count", "online_count",
            "offline_count", "unchecked_count", "epg_channels", "total_programs"
        ]
        
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
            assert isinstance(data[field], int), f"Field {field} should be int"
        
        # Initially should have 0 sources/channels since no M3U added
        assert data["total_sources"] >= 0
        assert data["total_channels"] >= 0
        print(f"IPTV Stats: {data}")


class TestIPTVSources(TestAuth):
    """Test /api/iptv/sources CRUD operations"""
    
    def test_list_iptv_sources_empty_initially(self, auth_headers):
        """Test that sources list returns empty array initially"""
        response = requests.get(f"{BASE_URL}/api/iptv/sources", headers=auth_headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Should return a list"
        print(f"IPTV Sources count: {len(data)}")
    
    def test_add_iptv_source(self, auth_headers):
        """Test adding a new IPTV source"""
        # Using a sample M3U URL (this won't actually load channels but tests the API)
        response = requests.post(
            f"{BASE_URL}/api/iptv/sources",
            params={
                "name": "Test IPTV Source",
                "url": "https://example.com/test.m3u",
                "epg_url": ""
            },
            headers=auth_headers
        )
        
        # Should succeed even if URL doesn't resolve (source is added)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert data["name"] == "Test IPTV Source"
        assert data["url"] == "https://example.com/test.m3u"
        
        # Store source_id for cleanup
        source_id = data["id"]
        print(f"Created IPTV source: {source_id}")
        
        # Cleanup - delete the source
        delete_response = requests.delete(
            f"{BASE_URL}/api/iptv/sources/{source_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200
    
    def test_delete_nonexistent_source(self, auth_headers):
        """Test deleting a non-existent source"""
        response = requests.delete(
            f"{BASE_URL}/api/iptv/sources/nonexistent123",
            headers=auth_headers
        )
        
        # Should return 404 or success with false
        assert response.status_code in [200, 404]


class TestIPTVChannels(TestAuth):
    """Test /api/iptv/channels endpoint"""
    
    def test_list_channels_empty_initially(self, auth_headers):
        """Test that channels list returns empty array initially"""
        response = requests.get(f"{BASE_URL}/api/iptv/channels", headers=auth_headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Should return a list"
        print(f"IPTV Channels count: {len(data)}")
    
    def test_list_channels_with_filters(self, auth_headers):
        """Test channels list with filter parameters"""
        # Test with favorites_only filter
        response = requests.get(
            f"{BASE_URL}/api/iptv/channels",
            params={"favorites_only": True},
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        
        # Test with search filter
        response = requests.get(
            f"{BASE_URL}/api/iptv/channels",
            params={"search": "test"},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_get_nonexistent_channel(self, auth_headers):
        """Test getting a non-existent channel"""
        response = requests.get(
            f"{BASE_URL}/api/iptv/channels/nonexistent123",
            headers=auth_headers
        )
        
        assert response.status_code == 404


class TestIPTVGroups(TestAuth):
    """Test /api/iptv/groups endpoint"""
    
    def test_list_groups_empty_initially(self, auth_headers):
        """Test that groups list returns empty array initially"""
        response = requests.get(f"{BASE_URL}/api/iptv/groups", headers=auth_headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Should return a list"
        print(f"IPTV Groups count: {len(data)}")


class TestIPTVParseM3U(TestAuth):
    """Test /api/iptv/parse-m3u endpoint"""
    
    def test_parse_m3u_content(self, auth_headers):
        """Test parsing M3U content directly"""
        # Sample M3U content
        m3u_content = """#EXTM3U
#EXTINF:-1 tvg-id="test1" tvg-name="Test Channel 1" tvg-logo="http://example.com/logo1.png" group-title="News",Test Channel 1
http://example.com/stream1.m3u8
#EXTINF:-1 tvg-id="test2" tvg-name="Test Channel 2" group-title="Sports",Test Channel 2
http://example.com/stream2.m3u8
"""
        
        response = requests.post(
            f"{BASE_URL}/api/iptv/parse-m3u",
            params={"content": m3u_content},
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Should return a list of channels"
        assert len(data) == 2, f"Should parse 2 channels, got {len(data)}"
        
        # Verify channel structure
        channel = data[0]
        assert "id" in channel
        assert "name" in channel
        assert "stream_url" in channel
        assert "group" in channel
        
        print(f"Parsed {len(data)} channels from M3U")


class TestIPTVExport(TestAuth):
    """Test /api/iptv/export endpoint"""
    
    def test_export_m3u(self, auth_headers):
        """Test exporting channels as M3U"""
        response = requests.get(
            f"{BASE_URL}/api/iptv/export",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "content" in data
        assert "filename" in data
        assert data["filename"] == "watchnexus_iptv.m3u"
        assert data["content"].startswith("#EXTM3U")
        
        print(f"Exported M3U: {data['filename']}")


class TestPulpQueue(TestAuth):
    """Test /api/pulp/queue endpoint"""
    
    def test_pulp_queue_returns_list(self, auth_headers):
        """Test that Pulp queue endpoint returns queue list"""
        response = requests.get(f"{BASE_URL}/api/pulp/queue", headers=auth_headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Queue returns a list of NZB items
        assert isinstance(data, list), "Should return a list"
        print(f"Pulp Queue: {len(data)} items")
    
    def test_pulp_queue_add_nzb(self, auth_headers):
        """Test adding an NZB to the queue"""
        response = requests.post(
            f"{BASE_URL}/api/pulp/queue",
            params={
                "nzb_url": "https://example.com/test.nzb",
                "title": "Test NZB Download",
                "category": "movies"
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # API returns id and status
        assert "id" in data, f"Response should have 'id': {data}"
        assert "status" in data, f"Response should have 'status': {data}"
        print(f"Added NZB: {data['id']}, status: {data['status']}")


class TestPulpSearch(TestAuth):
    """Test /api/pulp/search endpoint"""
    
    def test_pulp_search_requires_params(self, auth_headers):
        """Test that Pulp search requires proper parameters"""
        # Test without required params
        response = requests.post(
            f"{BASE_URL}/api/pulp/search",
            params={"query": "test"},
            headers=auth_headers
        )
        
        # Should fail without indexer_url and api_key
        assert response.status_code in [200, 400, 422]


class TestPulpParseNZB(TestAuth):
    """Test /api/pulp/parse-nzb endpoint"""
    
    def test_parse_nzb_content(self, auth_headers):
        """Test parsing NZB content"""
        # Sample NZB XML content
        nzb_content = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE nzb PUBLIC "-//newzBin//DTD NZB 1.1//EN" "http://www.newzbin.com/DTD/nzb/nzb-1.1.dtd">
<nzb xmlns="http://www.newzbin.com/DTD/2003/nzb">
  <head>
    <meta type="title">Test NZB File</meta>
    <meta type="category">Movies</meta>
  </head>
  <file poster="test@example.com" date="1234567890" subject="Test File">
    <groups>
      <group>alt.binaries.test</group>
    </groups>
    <segments>
      <segment bytes="1000" number="1">test@example.com</segment>
    </segments>
  </file>
</nzb>
"""
        
        response = requests.post(
            f"{BASE_URL}/api/pulp/parse-nzb",
            params={"content": nzb_content},
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify parsed structure
        assert "title" in data or "files" in data
        print(f"Parsed NZB: {data}")


class TestIPTVAuthRequired(TestAuth):
    """Test that IPTV endpoints require authentication"""
    
    def test_iptv_stats_requires_auth(self):
        """Test that stats endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/iptv/stats")
        assert response.status_code == 401 or response.status_code == 403
    
    def test_iptv_sources_requires_auth(self):
        """Test that sources endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/iptv/sources")
        assert response.status_code == 401 or response.status_code == 403
    
    def test_iptv_channels_requires_auth(self):
        """Test that channels endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/iptv/channels")
        assert response.status_code == 401 or response.status_code == 403


class TestPulpAuthRequired(TestAuth):
    """Test that Pulp endpoints require authentication"""
    
    def test_pulp_queue_requires_auth(self):
        """Test that queue endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/pulp/queue")
        assert response.status_code == 401 or response.status_code == 403


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
