import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from api.main import app
import pytest
import requests

client = TestClient(app)

# --- API endpoint tests (do not require running server) ---
def test_api_health():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "healthy"
    assert "database" in data

def test_api_root():
    resp = client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert "message" in data
    assert data["message"].lower().startswith("maestro builder api")

# --- Frontend port test (requires running frontend server) ---
@pytest.mark.skip(reason="Frontend integration test; requires running frontend on port 5174.")
def test_frontend_running():
    resp = requests.get("http://localhost:5174", timeout=3)
    assert resp.status_code == 200
    assert "<!doctype html>" in resp.text.lower() 