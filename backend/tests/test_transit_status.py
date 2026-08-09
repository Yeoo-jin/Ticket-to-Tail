"""POST /api/bookings/status 및 transit_status_service 검증.

실제 공공데이터포털 API는 호출하지 않는다 - httpx.get을 모두 mock으로 대체한다.
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.transit_status import TransitStatusRequest
from app.services import transit_status_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def api_key_env(monkeypatch):
    monkeypatch.setenv("PUBLIC_DATA_API_KEY", "test-public-data-key")


def _mock_response(payload, status_code=200):
    response = MagicMock()
    response.status_code = status_code
    response.json.return_value = payload
    return response


# ---------------------------------------------------------------------------
# 순수 로직 (지연 계산, 파싱)
# ---------------------------------------------------------------------------


def test_build_status_no_delay():
    from datetime import datetime

    scheduled = datetime(2026, 8, 10, 10, 0)
    actual = datetime(2026, 8, 10, 10, 0)
    result = transit_status_service._build_status(scheduled, actual)
    assert result.found is True
    assert result.delayed is False
    assert result.delayMinutes == 0


def test_build_status_delayed():
    from datetime import datetime

    scheduled = datetime(2026, 8, 10, 10, 0)
    actual = datetime(2026, 8, 10, 10, 15)
    result = transit_status_service._build_status(scheduled, actual)
    assert result.found is True
    assert result.delayed is True
    assert result.delayMinutes == 15
    assert "15분 지연" in result.message


def test_build_status_early_is_not_delayed():
    from datetime import datetime

    scheduled = datetime(2026, 8, 10, 10, 0)
    actual = datetime(2026, 8, 10, 9, 50)
    result = transit_status_service._build_status(scheduled, actual)
    assert result.delayed is False


def test_build_status_no_scheduled_time_is_not_found():
    result = transit_status_service._build_status(None, None)
    assert result.found is False


def test_parse_yyyymmddhhmm_valid_and_invalid():
    assert transit_status_service._parse_yyyymmddhhmm("202608100025") is not None
    assert transit_status_service._parse_yyyymmddhhmm(None) is None
    assert transit_status_service._parse_yyyymmddhhmm("bad-value") is None


def test_parse_rail_datetime_strips_fractional_seconds():
    parsed = transit_status_service._parse_rail_datetime("2026-08-08 05:13:00.0")
    assert parsed is not None
    assert parsed.hour == 5 and parsed.minute == 13


def test_strip_station_suffix():
    assert transit_status_service._strip_station_suffix("서울역") == "서울"
    assert transit_status_service._strip_station_suffix("서울") == "서울"


# ---------------------------------------------------------------------------
# 항공/철도 매칭 로직 (httpx mock)
# ---------------------------------------------------------------------------


def test_flight_status_matches_by_flight_id_and_computes_delay():
    payload = {
        "response": {
            "header": {"resultCode": "00", "resultMsg": "NORMAL SERVICE."},
            "body": {
                "items": [
                    {
                        "flightId": "OZ102",
                        "scheduleDatetime": "202608120600",
                        "estimatedDatetime": "202608120620",
                        "remark": "도착",
                    }
                ]
            },
        }
    }
    request = TransitStatusRequest(
        type="flight",
        transitNumber="OZ102",
        departureLocation="나리타공항",
        arrivalLocation="인천공항",
        arrivalTime="2026-08-12T06:00:00",
    )
    with patch("httpx.get", return_value=_mock_response(payload)):
        result = transit_status_service.get_transit_status(request)

    assert result.found is True
    assert result.delayed is True
    assert result.delayMinutes == 20


def test_flight_status_without_incheon_is_unsupported():
    request = TransitStatusRequest(
        type="flight",
        transitNumber="OZ102",
        departureLocation="김포공항",
        arrivalLocation="제주공항",
        departureTime="2026-08-12T06:00:00",
    )
    result = transit_status_service.get_transit_status(request)
    assert result.found is False
    assert "지원하지 않습니다" in result.message


def test_flight_status_service_error_returns_graceful_not_found():
    with patch("httpx.get", return_value=_mock_response({"OpenAPI_ServiceResponse": {}})):
        request = TransitStatusRequest(
            type="flight",
            transitNumber="OZ102",
            departureLocation="나리타공항",
            arrivalLocation="인천공항",
            arrivalTime="2026-08-12T06:00:00",
        )
        result = transit_status_service.get_transit_status(request)
    assert result.found is False


def test_train_status_matches_closest_scheduled_time_and_computes_delay():
    plan_payload = {
        "response": {
            "body": {
                "items": {
                    "item": [
                        {
                            "trn_no": "00001",
                            "trn_plan_dptre_dt": "2026-08-12 05:13:00.0",
                            "dptre_stn_nm": "서울",
                            "arvl_stn_nm": "부산",
                        },
                        {
                            "trn_no": "00003",
                            "trn_plan_dptre_dt": "2026-08-12 05:27:00.0",
                            "dptre_stn_nm": "서울",
                            "arvl_stn_nm": "부산",
                        },
                    ]
                }
            },
            "header": {"resultCode": "0", "resultMsg": "정상"},
        }
    }
    info_payload = {
        "response": {
            "body": {
                "items": {
                    "item": [
                        {"trn_no": "00001", "trn_dptre_dt": "2026-08-12 05:20:00.0"},
                    ]
                }
            },
            "header": {"resultCode": "0", "resultMsg": "정상"},
        }
    }
    request = TransitStatusRequest(
        type="train",
        transitNumber="KTX 1",
        departureLocation="서울역",
        arrivalLocation="부산역",
        departureTime="2026-08-12T05:13:00",
    )
    with patch("httpx.get", side_effect=[_mock_response(plan_payload), _mock_response(info_payload)]):
        result = transit_status_service.get_transit_status(request)

    assert result.found is True
    assert result.delayed is True
    assert result.delayMinutes == 7


def test_train_status_no_close_match_is_not_found():
    plan_payload = {
        "response": {
            "body": {"items": {"item": [{"trn_no": "00099", "trn_plan_dptre_dt": "2026-08-12 23:00:00.0"}]}},
            "header": {"resultCode": "0", "resultMsg": "정상"},
        }
    }
    request = TransitStatusRequest(
        type="train",
        transitNumber="KTX 1",
        departureLocation="서울역",
        arrivalLocation="부산역",
        departureTime="2026-08-12T05:13:00",
    )
    with patch("httpx.get", return_value=_mock_response(plan_payload)):
        result = transit_status_service.get_transit_status(request)
    assert result.found is False


# ---------------------------------------------------------------------------
# 라우트
# ---------------------------------------------------------------------------


def test_status_route_returns_graceful_payload_when_service_key_missing(monkeypatch):
    monkeypatch.delenv("PUBLIC_DATA_API_KEY", raising=False)
    response = client.post(
        "/api/bookings/status",
        json={
            "type": "flight",
            "transitNumber": "OZ102",
            "departureLocation": "나리타공항",
            "arrivalLocation": "인천공항",
            "arrivalTime": "2026-08-12T06:00:00",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["found"] is False


def test_status_route_with_train_type(monkeypatch):
    with patch("httpx.get", return_value=_mock_response({"response": {"body": {"items": {"item": []}}}})):
        response = client.post(
            "/api/bookings/status",
            json={
                "type": "train",
                "transitNumber": "KTX 1",
                "departureLocation": "서울역",
                "arrivalLocation": "부산역",
                "departureTime": "2026-08-12T05:13:00",
            },
        )
    assert response.status_code == 200
    assert response.json()["data"]["found"] is False
