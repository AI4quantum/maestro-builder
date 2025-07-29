"""
Simple frontend tests that don't require a running server.
"""

import pytest
from pathlib import Path


def test_frontend_files_exist():
    """Test that essential frontend files exist."""
    project_root = Path(__file__).parent.parent
    
    # Check for essential frontend files
    essential_files = [
        "src/App.tsx",
        "src/main.tsx", 
        "src/components/YamlPanel.tsx",
        "src/services/api.ts",
        "index.html",
        "package.json",
        "vite.config.ts"
    ]
    
    for file_path in essential_files:
        full_path = project_root / file_path
        assert full_path.exists(), f"Frontend file missing: {file_path}"


def test_yaml_panel_component_structure():
    """Test that YamlPanel component has expected structure."""
    yaml_panel_path = Path(__file__).parent.parent / "src/components/YamlPanel.tsx"
    
    assert yaml_panel_path.exists(), "YamlPanel.tsx not found"
    
    with open(yaml_panel_path, 'r') as f:
        content = f.read()
    
    # Check for essential imports and functionality
    assert "import { useState" in content, "Missing useState import"
    assert "ValidateYamlResponse" in content, "Missing ValidateYamlResponse import"
    assert "handleValidate" in content, "Missing validate handler"
    assert "Validate" in content, "Missing Validate button"


def test_api_service_structure():
    """Test that API service has expected structure."""
    api_service_path = Path(__file__).parent.parent / "src/services/api.ts"
    
    assert api_service_path.exists(), "api.ts not found"
    
    with open(api_service_path, 'r') as f:
        content = f.read()
    
    # Check for essential API functionality
    assert "validateYaml" in content, "Missing validateYaml method"
    assert "ValidateYamlResponse" in content, "Missing ValidateYamlResponse interface"
    assert "API_BASE_URL" in content, "Missing API_BASE_URL"


def test_package_dependencies():
    """Test that package.json has required dependencies."""
    package_json_path = Path(__file__).parent.parent / "package.json"
    
    assert package_json_path.exists(), "package.json not found"
    
    import json
    with open(package_json_path, 'r') as f:
        package_data = json.load(f)
    
    # Check for essential dependencies
    dependencies = package_data.get("dependencies", {})
    dev_dependencies = package_data.get("devDependencies", {})
    
    # Essential React dependencies
    assert "react" in dependencies, "Missing react dependency"
    assert "react-dom" in dependencies, "Missing react-dom dependency"
    
    # Essential dev dependencies
    assert "vite" in dev_dependencies, "Missing vite dev dependency"
    assert "typescript" in dev_dependencies, "Missing typescript dev dependency"


def test_vite_config():
    """Test that Vite config exists and is valid."""
    vite_config_path = Path(__file__).parent.parent / "vite.config.ts"
    
    assert vite_config_path.exists(), "vite.config.ts not found"
    
    with open(vite_config_path, 'r') as f:
        content = f.read()
    
    # Check for essential Vite configuration
    assert "defineConfig" in content, "Missing defineConfig"
    assert "react" in content, "Missing react plugin" 