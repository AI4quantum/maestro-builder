#!/usr/bin/env python3
"""
Test validation functionality for Maestro YAML files.
"""

import subprocess
import os
import sys
import tempfile
import shutil
import pytest
from pathlib import Path

# Add the project root to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent))


def test_complex_agents_validation():
    """Test validation of complex multi-agent YAML file."""
    # Get the test file path
    test_file = Path(__file__).parent / "complex_agents.yaml"
    
    assert test_file.exists(), f"Test file not found: {test_file}"
    
    # Run maestro validate on the test file
    result = subprocess.run(
        ['maestro', 'validate', str(test_file)],
        capture_output=True,
        text=True,
        cwd=Path(__file__).parent.parent  # Run from project root
    )
    
    assert result.returncode == 0, f"Validation failed: {result.stderr or result.stdout}"


def test_api_validation_endpoint():
    """Test the API validation endpoint with the complex YAML using mocking."""
    import asyncio
    from unittest.mock import patch, MagicMock
    
    # Read the test YAML file
    test_file = Path(__file__).parent / "complex_agents.yaml"
    with open(test_file, 'r') as f:
        yaml_content = f.read()
    
    # Prepare the request payload (with double-escaping to simulate frontend)
    import codecs
    escaped_content = codecs.encode(yaml_content, 'unicode_escape').decode('utf-8')
    
    # Test successful validation
    with patch('subprocess.run') as mock_run:
        # Mock successful maestro validation
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "YAML file is valid."
        mock_result.stderr = ""
        mock_run.return_value = mock_result
        
        # Import and test the API service directly
        from api.main import validate_yaml
        from api.main import ValidateYamlRequest
        
        # Create the request object
        request = ValidateYamlRequest(
            yaml_content=escaped_content,
            file_type="agents"
        )
        
        # Test the validation function directly (async)
        result = asyncio.run(validate_yaml(request))
        
        assert result.is_valid, f"Validation failed: {result.errors}"


def test_api_validation_error_case():
    """Test the API validation endpoint with an error case using mocking."""
    import asyncio
    from unittest.mock import patch, MagicMock
    
    # Create invalid YAML content
    invalid_yaml = "invalid: yaml: content:"
    
    # Prepare the request payload (with double-escaping to simulate frontend)
    import codecs
    escaped_content = codecs.encode(invalid_yaml, 'unicode_escape').decode('utf-8')
    
    # Test error validation
    with patch('subprocess.run') as mock_run:
        # Mock failed maestro validation
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stdout = ""
        mock_result.stderr = "Error: Invalid YAML format"
        mock_run.return_value = mock_result
        
        # Import and test the API service directly
        from api.main import validate_yaml
        from api.main import ValidateYamlRequest
        
        # Create the request object
        request = ValidateYamlRequest(
            yaml_content=escaped_content,
            file_type="agents"
        )
        
        # Test the validation function directly (async)
        result = asyncio.run(validate_yaml(request))
        
        assert not result.is_valid, "Should have failed validation"
        assert result.errors, "Should have error messages"


if __name__ == "__main__":
    # For backward compatibility, can still run as script
    pytest.main([__file__]) 