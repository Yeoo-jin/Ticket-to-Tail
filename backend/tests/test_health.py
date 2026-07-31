from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_docs_expose_booking_parse():
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/api/bookings/parse" in paths
    assert "post" in paths["/api/bookings/parse"]

    docs_response = client.get("/docs")
    assert docs_response.status_code == 200
