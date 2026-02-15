"""
Test suite for Chromaprint-based audio fingerprinting intro/credits detection.
Tests the analyze-intros and intro-status API endpoints.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFprintModule:
    """Tests for the fprint.py module loading and basic functionality"""
    
    def test_fprint_module_imports(self):
        """Test that fprint.py module can be imported without errors"""
        try:
            import sys
            sys.path.insert(0, '/app/backend')
            from fprint import (
                FprintAnalyzer, 
                get_fprint_analyzer, 
                analyze_series_for_intros,
                AudioSegment,
                DetectedSegment,
                FPCALC_PATH,
                FINGERPRINT_DURATION,
                SIMILARITY_THRESHOLD
            )
            assert FprintAnalyzer is not None
            assert get_fprint_analyzer is not None
            print("PASS: fprint module imported successfully")
        except ImportError as e:
            pytest.fail(f"Failed to import fprint module: {e}")
    
    def test_fprint_analyzer_singleton(self):
        """Test that get_fprint_analyzer returns singleton instance"""
        import sys
        sys.path.insert(0, '/app/backend')
        from fprint import get_fprint_analyzer
        
        analyzer1 = get_fprint_analyzer()
        analyzer2 = get_fprint_analyzer()
        assert analyzer1 is analyzer2
        print("PASS: FprintAnalyzer singleton works correctly")
    
    def test_fprint_constants(self):
        """Test that fprint.py has correct constants configured"""
        import sys
        sys.path.insert(0, '/app/backend')
        from fprint import (
            FPCALC_PATH,
            FINGERPRINT_DURATION,
            CREDITS_DURATION,
            SEGMENT_LENGTH,
            SIMILARITY_THRESHOLD
        )
        
        assert FPCALC_PATH == "fpcalc"
        assert FINGERPRINT_DURATION == 180  # 3 minutes
        assert CREDITS_DURATION == 180
        assert SEGMENT_LENGTH == 30
        assert 0 < SIMILARITY_THRESHOLD < 1  # Should be between 0 and 1
        print(f"PASS: Constants configured correctly - fingerprint duration: {FINGERPRINT_DURATION}s, similarity threshold: {SIMILARITY_THRESHOLD}")


class TestAnalyzeIntrosAPI:
    """Tests for POST /api/marmalade/series/{name}/analyze-intros endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_analyze_intros_endpoint_exists(self, auth_token):
        """Test that analyze-intros endpoint exists and responds"""
        series_name = "TestSeries"
        response = requests.post(
            f"{BASE_URL}/api/marmalade/series/{series_name}/analyze-intros",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={}
        )
        # Should return 200 with expected behavior - need at least 2 episodes
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "message" in data
        print(f"PASS: analyze-intros endpoint responds - success: {data['success']}, message: {data['message']}")
    
    def test_analyze_intros_not_enough_episodes(self, auth_token):
        """Test analyze-intros returns proper error when not enough episodes"""
        series_name = "NonExistentSeries12345"
        response = requests.post(
            f"{BASE_URL}/api/marmalade/series/{series_name}/analyze-intros",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == False
        assert "Need at least 2 episodes" in data["message"]
        print(f"PASS: Returns expected 'not enough episodes' message: {data['message']}")
    
    def test_analyze_intros_requires_auth(self):
        """Test that analyze-intros endpoint requires authentication"""
        series_name = "TestSeries"
        response = requests.post(
            f"{BASE_URL}/api/marmalade/series/{series_name}/analyze-intros",
            json={}
        )
        assert response.status_code == 401
        print("PASS: analyze-intros endpoint requires authentication")
    
    def test_analyze_intros_url_encoding(self, auth_token):
        """Test analyze-intros handles URL-encoded series names"""
        series_name = "Breaking%20Bad"  # URL encoded space
        response = requests.post(
            f"{BASE_URL}/api/marmalade/series/{series_name}/analyze-intros",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={}
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        print(f"PASS: URL-encoded series name handled correctly")


class TestIntroStatusAPI:
    """Tests for GET /api/marmalade/series/{name}/intro-status endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "password"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_intro_status_endpoint_exists(self, auth_token):
        """Test that intro-status endpoint exists and responds"""
        series_name = "TestSeries"
        response = requests.get(
            f"{BASE_URL}/api/marmalade/series/{series_name}/intro-status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "series_name" in data
        assert "total_episodes" in data
        assert "with_segments" in data
        assert "without_segments" in data
        print(f"PASS: intro-status endpoint returns proper structure - total_episodes: {data['total_episodes']}, with_segments: {data['with_segments']}")
    
    def test_intro_status_response_structure(self, auth_token):
        """Test intro-status returns complete response structure"""
        series_name = "TestSeries"
        response = requests.get(
            f"{BASE_URL}/api/marmalade/series/{series_name}/intro-status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify all expected fields
        required_fields = [
            "series_name",
            "total_episodes",
            "with_segments",
            "without_segments",
            "episodes_with_segments",
            "episodes_without_segments"
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Verify types
        assert isinstance(data["total_episodes"], int)
        assert isinstance(data["with_segments"], int)
        assert isinstance(data["without_segments"], int)
        assert isinstance(data["episodes_with_segments"], list)
        assert isinstance(data["episodes_without_segments"], list)
        
        print(f"PASS: intro-status response structure is correct with all required fields")
    
    def test_intro_status_requires_auth(self):
        """Test that intro-status endpoint requires authentication"""
        series_name = "TestSeries"
        response = requests.get(
            f"{BASE_URL}/api/marmalade/series/{series_name}/intro-status"
        )
        assert response.status_code == 401
        print("PASS: intro-status endpoint requires authentication")
    
    def test_intro_status_non_existent_series(self, auth_token):
        """Test intro-status for non-existent series returns empty counts"""
        series_name = "NonExistentSeriesXYZ999"
        response = requests.get(
            f"{BASE_URL}/api/marmalade/series/{series_name}/intro-status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_episodes"] == 0
        assert data["with_segments"] == 0
        assert data["without_segments"] == 0
        print(f"PASS: Non-existent series returns zero counts as expected")


class TestFpcalcBinary:
    """Tests to verify fpcalc binary is installed and working"""
    
    def test_fpcalc_installed(self):
        """Test that fpcalc binary is installed"""
        import subprocess
        result = subprocess.run(["which", "fpcalc"], capture_output=True, text=True)
        assert result.returncode == 0
        assert "fpcalc" in result.stdout
        print(f"PASS: fpcalc found at {result.stdout.strip()}")
    
    def test_fpcalc_version(self):
        """Test that fpcalc can report its version"""
        import subprocess
        result = subprocess.run(["fpcalc", "-version"], capture_output=True, text=True)
        assert result.returncode == 0
        assert "fpcalc version" in result.stdout or "fpcalc version" in result.stderr
        version_info = result.stdout + result.stderr
        print(f"PASS: fpcalc version info: {version_info.strip()}")


class TestZeroLLMUsage:
    """Tests to verify the feature uses zero LLM tokens"""
    
    def test_no_llm_in_fprint_module(self):
        """Verify fprint.py doesn't import any LLM libraries"""
        import ast
        
        with open('/app/backend/fprint.py', 'r') as f:
            content = f.read()
        
        # Parse the module
        tree = ast.parse(content)
        
        # Get all imports
        imports = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    imports.append(node.module)
        
        # LLM-related imports to check for
        llm_imports = ['openai', 'anthropic', 'langchain', 'transformers', 'torch', 'tensorflow']
        
        for llm_import in llm_imports:
            assert llm_import not in imports, f"Found LLM import: {llm_import}"
        
        print(f"PASS: fprint.py contains no LLM imports - pure audio fingerprinting implementation")
    
    def test_analyze_endpoint_no_emergent_key(self, ):
        """Verify analyze-intros doesn't require EMERGENT_LLM_KEY"""
        # Check the endpoint code doesn't reference EMERGENT_LLM_KEY
        with open('/app/backend/server.py', 'r') as f:
            content = f.read()
        
        # Find the analyze_series_intros function
        start_idx = content.find("def analyze_series_intros")
        if start_idx == -1:
            pytest.skip("Could not find analyze_series_intros function")
        
        # Get the function content (rough extraction)
        end_idx = content.find("\n@api_router", start_idx + 100)
        if end_idx == -1:
            end_idx = start_idx + 2000
        
        function_content = content[start_idx:end_idx]
        
        # Check it doesn't use LLM-related variables
        assert "EMERGENT_LLM_KEY" not in function_content
        assert "openai" not in function_content.lower()
        assert "anthropic" not in function_content.lower()
        
        print("PASS: analyze_series_intros function uses no LLM APIs")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
