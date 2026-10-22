from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_health_check_returns_ok():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "BhuVerify"
    assert "disclaimer" in data
    assert "Demo registry match - not an official government verification" in data["disclaimer"]
