"""station_facility_service 검증.

실제 공공데이터포털 API는 호출하지 않는다 - httpx.get을 모두 mock으로 대체한다.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.services import station_facility_service


@pytest.fixture(autouse=True)
def api_key_env(monkeypatch):
    monkeypatch.setenv("PUBLIC_DATA_API_KEY", "test-public-data-key")
    station_facility_service._cache.clear()


def _mock_response(payload, status_code=200):
    response = MagicMock()
    response.status_code = status_code
    response.json.return_value = payload
    return response


_GENERAL_PAYLOAD = {
    "response": {
        "body": {
            "items": {
                "item": {
                    "altm_lead_cntr_estnc": " Y ",
                    "elevt_cnt": "18",
                    "esclt_cnt": "23",
                    "gen_tolt_estnc": " Y ",
                    "nrsrm_estnc": " Y ",
                    "stn_cd": "3900023",
                    "stn_nm": "서울",
                }
            },
            "totalCount": 1,
        }
    }
}

_ACCESSIBLE_PAYLOAD = {
    "response": {
        "body": {
            "items": {
                "item": {
                    "pwdbs_slwy_estnc": " Y ",
                    "pwdbs_tolt_estnc": " N ",
                    "stn_cd": "3900023",
                    "stn_nm": "서울",
                    "whlch_liftt_cnt": "1",
                }
            },
            "totalCount": 1,
        }
    }
}

_EMPTY_PAYLOAD = {"response": {"body": {"items": {"item": []}, "totalCount": 0}}}


def test_strip_station_suffix_removes_trailing_yeok():
    assert station_facility_service._strip_station_suffix("서울역") == "서울"
    assert station_facility_service._strip_station_suffix("부산역") == "부산"
    assert station_facility_service._strip_station_suffix("서울") == "서울"


def test_returns_none_when_neither_companion_type_requested():
    with patch("httpx.get") as mock_get:
        result = station_facility_service.fetch_station_facility(
            "서울역", include_nursing_room=False, include_accessible=False
        )
    assert result is None
    mock_get.assert_not_called()


def test_infant_only_fills_nursing_room_and_common_fields_but_not_accessible():
    with patch("httpx.get", return_value=_mock_response(_GENERAL_PAYLOAD)) as mock_get:
        result = station_facility_service.fetch_station_facility(
            "서울역", include_nursing_room=True, include_accessible=False
        )

    assert result is not None
    assert result.stationName == "서울역"
    assert result.hasElevator is True
    assert result.elevatorCount == 18
    assert result.escalatorCount == 23
    assert result.hasGeneralRestroom is True
    assert result.hasInfoCenter is True
    assert result.hasNursingRoom is True
    assert result.hasAccessibleRestroom is None
    assert result.hasWheelchairRamp is None
    assert result.wheelchairLiftCount is None
    # 교통약자 편의시설 API는 요청하지 않았으므로 stationFacilities 엔드포인트 한 번만 호출된다.
    assert mock_get.call_count == 1
    called_kwargs = mock_get.call_args
    assert "stationFacilities" in called_kwargs.args[0]


def test_mobility_impaired_only_fills_accessible_fields_but_not_nursing_room():
    with patch("httpx.get", side_effect=[_mock_response(_GENERAL_PAYLOAD), _mock_response(_ACCESSIBLE_PAYLOAD)]):
        result = station_facility_service.fetch_station_facility(
            "서울역", include_nursing_room=False, include_accessible=True
        )

    assert result is not None
    assert result.hasNursingRoom is None
    assert result.hasAccessibleRestroom is False
    assert result.hasWheelchairRamp is True
    assert result.wheelchairLiftCount == 1


def test_returns_none_when_station_not_found():
    with patch("httpx.get", return_value=_mock_response(_EMPTY_PAYLOAD)):
        result = station_facility_service.fetch_station_facility(
            "존재하지않는역", include_nursing_room=True, include_accessible=False
        )
    assert result is None


def test_returns_none_gracefully_on_network_error():
    import httpx as httpx_module

    with patch("httpx.get", side_effect=httpx_module.ConnectTimeout("timeout")):
        result = station_facility_service.fetch_station_facility(
            "서울역", include_nursing_room=True, include_accessible=False
        )
    assert result is None


def test_returns_none_when_service_key_missing(monkeypatch):
    monkeypatch.delenv("PUBLIC_DATA_API_KEY", raising=False)
    with patch("httpx.get") as mock_get:
        result = station_facility_service.fetch_station_facility(
            "서울역", include_nursing_room=True, include_accessible=False
        )
    assert result is None
    mock_get.assert_not_called()


def test_repeated_calls_for_same_station_are_cached():
    with patch("httpx.get", return_value=_mock_response(_GENERAL_PAYLOAD)) as mock_get:
        station_facility_service.fetch_station_facility("서울역", include_nursing_room=True, include_accessible=False)
        station_facility_service.fetch_station_facility("서울역", include_nursing_room=True, include_accessible=False)
    assert mock_get.call_count == 1
