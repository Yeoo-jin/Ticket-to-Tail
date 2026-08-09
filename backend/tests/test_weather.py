"""POST /api/weather/forecast 및 weather_service 검증.

실제 기상청 API허브는 호출하지 않는다 - httpx.get을 mock으로 대체한다.
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import weather_service

client = TestClient(app)

_SAMPLE_RESPONSE_TEXT = (
    "#START7777\n"
    "# REG_ID TM_FC        TM_EF        MOD NE STN C MAN_ID       MAN_FC     W1 T W2  TA  ST SKY  PREP WF\n"
    "11H20201,202608091700,202608091200,A02,0,159,2,************,전경옥,NE,1,E,-99,60,DB04,1,흐리고 가끔 비,=\n"
    "11H20201,202608091700,202608100000,A02,1,159,2,************,전경옥,NE,1,E,26,70,DB04,1,흐리고 가끔 비,=\n"
    "11H20201,202608091700,202608101200,A02,2,159,2,************,전경옥,NE,1,E,32,30,DB01,0,맑음,=\n"
    "#7777END\n"
)


@pytest.fixture(autouse=True)
def api_key_env(monkeypatch):
    monkeypatch.setenv("KMA_API_KEY", "test-kma-key")


def _mock_response(text, status_code=200):
    response = MagicMock()
    response.status_code = status_code
    response.text = text
    return response


def test_resolves_known_region_and_parses_first_valid_row():
    with patch("httpx.get", return_value=_mock_response(_SAMPLE_RESPONSE_TEXT)):
        result = weather_service.get_weather_forecast("부산 여행")

    assert result.found is True
    assert result.temperature == 26
    assert result.precipitationExpected is True
    assert result.sky == "흐리고 가끔 비"


def test_skips_placeholder_row_with_missing_temperature():
    # 첫 행은 TA=-99(값 없음)이므로 건너뛰고 두 번째 행을 대표값으로 써야 한다.
    with patch("httpx.get", return_value=_mock_response(_SAMPLE_RESPONSE_TEXT)):
        result = weather_service.get_weather_forecast("부산")
    assert result.temperature != -99


def test_unknown_region_is_unsupported_without_calling_api():
    with patch("httpx.get") as mock_get:
        result = weather_service.get_weather_forecast("울란바토르")
    mock_get.assert_not_called()
    assert result.found is False


def test_missing_api_key_returns_graceful_not_found(monkeypatch):
    monkeypatch.delenv("KMA_API_KEY", raising=False)
    result = weather_service.get_weather_forecast("부산")
    assert result.found is False


def test_http_error_returns_graceful_not_found():
    import httpx as httpx_module

    with patch("httpx.get", side_effect=httpx_module.ConnectTimeout("timeout")):
        result = weather_service.get_weather_forecast("부산")
    assert result.found is False


def test_empty_response_body_returns_graceful_not_found():
    with patch("httpx.get", return_value=_mock_response("#START7777\n#7777END\n")):
        result = weather_service.get_weather_forecast("부산")
    assert result.found is False


def test_weather_route_returns_expected_payload():
    with patch("httpx.get", return_value=_mock_response(_SAMPLE_RESPONSE_TEXT)):
        response = client.post("/api/weather/forecast", json={"destination": "부산"})

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["found"] is True
    assert body["data"]["temperature"] == 26
