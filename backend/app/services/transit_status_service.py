"""항공·철도 실시간 운항 현황(지연 여부) 조회.

공공데이터포털(data.go.kr) 공개 API를 사용한다:
- 항공: 인천국제공항공사 항공기 운항현황 (B551177/statusOfAllFltDeOdp)
  * 인천공항 도착/출발 항공편만 조회 가능하다. 인천공항이 관련되지 않은 예매정보는 조회하지 않는다.
- 철도: 한국철도공사 열차운행정보 (B551457/run/v2)
  * 열차번호(trn_no)가 "00001"처럼 내부 관리번호 형식이라 사용자가 입력한 표기(예: "KTX 101")와
    그대로 일치하지 않을 수 있다. 그래서 열차번호로 직접 매칭하지 않고, 출발역·도착역·운행일자
    기준으로 조회한 뒤 예정 출발시각이 예매정보와 가장 가까운 열차를 찾는 방식으로 매칭한다.

이 서비스는 "있으면 좋은" 부가 정보이므로, 외부 API 호출이 실패하거나 일치하는 데이터를
찾지 못해도 예외를 던지지 않고 found=False로 반환한다(예매정보 확인 화면 전체가 깨지지 않도록).
"""

import logging
import os
from datetime import datetime
from typing import Optional

import httpx

from app.schemas.transit_status import TransitStatusData, TransitStatusRequest

logger = logging.getLogger(__name__)

_FLIGHT_BASE_URL = "https://apis.data.go.kr/B551177/statusOfAllFltDeOdp"
_RAIL_BASE_URL = "https://apis.data.go.kr/B551457/run/v2"
_TIMEOUT_SECONDS = 8.0

_INCHEON_KEYWORDS = ("인천공항", "인천국제공항")

_NOT_FOUND = TransitStatusData(found=False, message="실시간 운항 정보를 찾을 수 없습니다.")
_UNSUPPORTED = TransitStatusData(found=False, message="이 구간은 실시간 조회를 지원하지 않습니다.")


def _get_service_key() -> Optional[str]:
    key = os.getenv("PUBLIC_DATA_API_KEY")
    if not key:
        logger.warning("PUBLIC_DATA_API_KEY 환경변수가 설정되지 않았습니다.")
        return None
    return key


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _request_json(base_url: str, operation: str, params: dict) -> Optional[dict]:
    key = _get_service_key()
    if not key:
        return None

    query = {"serviceKey": key, **params}
    try:
        response = httpx.get(f"{base_url}/{operation}", params=query, timeout=_TIMEOUT_SECONDS)
    except httpx.HTTPError as exc:
        logger.warning("공공데이터 API 호출 실패 (%s): %s", operation, type(exc).__name__)
        return None

    if response.status_code != 200:
        logger.warning("공공데이터 API 응답 오류 (%s): status=%s", operation, response.status_code)
        return None

    try:
        payload = response.json()
    except ValueError:
        logger.warning("공공데이터 API 응답이 JSON이 아닙니다 (%s)", operation)
        return None

    # 인증 실패 등 서비스 레벨 오류는 최상위 키가 다르다 (OpenAPI_ServiceResponse).
    if "response" not in payload:
        logger.warning("공공데이터 API 서비스 오류 (%s): %s", operation, payload)
        return None

    return payload


def _extract_items(payload: dict) -> list:
    body = payload.get("response", {}).get("body", {})
    items = body.get("items")
    if items is None:
        return []
    # 항공 API는 items가 바로 배열, 철도 API는 items.item이 배열이다.
    if isinstance(items, list):
        return items
    if isinstance(items, dict):
        item = items.get("item")
        if item is None:
            return []
        return item if isinstance(item, list) else [item]
    return []


def _get_flight_status(request: TransitStatusRequest) -> TransitStatusData:
    departure = request.departureLocation or ""
    arrival = request.arrivalLocation or ""

    if any(keyword in arrival for keyword in _INCHEON_KEYWORDS):
        operation = "getFltArrivalsDeOdp"
        reference_time = _parse_iso_datetime(request.arrivalTime)
    elif any(keyword in departure for keyword in _INCHEON_KEYWORDS):
        operation = "getFltDeparturesDeOdp"
        reference_time = _parse_iso_datetime(request.departureTime)
    else:
        return _UNSUPPORTED

    if not request.transitNumber:
        return TransitStatusData(found=False, message="편명을 알 수 없어 실시간 조회를 할 수 없습니다.")

    search_date = (reference_time or datetime.now()).strftime("%Y%m%d")

    payload = _request_json(
        _FLIGHT_BASE_URL,
        operation,
        {
            "pageNo": 1,
            "numOfRows": 20,
            "searchdtCode": "E",
            "searchDate": search_date,
            "searchFrom": "0000",
            "searchTo": "2400",
            "passengerOrCargo": "P",
            "flightId": request.transitNumber,
            "type": "json",
        },
    )
    if payload is None:
        return _NOT_FOUND

    items = _extract_items(payload)
    match = next((item for item in items if item.get("flightId") == request.transitNumber), None)
    if match is None:
        return _NOT_FOUND

    scheduled = _parse_yyyymmddhhmm(match.get("scheduleDatetime"))
    estimated = _parse_yyyymmddhhmm(match.get("estimatedDatetime"))
    return _build_status(scheduled, estimated, extra_label=match.get("remark"))


def _parse_yyyymmddhhmm(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y%m%d%H%M")
    except ValueError:
        return None


def _strip_station_suffix(location: str) -> str:
    return location[:-1] if location.endswith("역") else location


def _get_train_status(request: TransitStatusRequest) -> TransitStatusData:
    if not request.departureLocation or not request.arrivalLocation:
        return _NOT_FOUND

    departure_time = _parse_iso_datetime(request.departureTime)
    if departure_time is None:
        return TransitStatusData(found=False, message="출발 시각을 알 수 없어 실시간 조회를 할 수 없습니다.")

    run_ymd = departure_time.strftime("%Y%m%d")
    dptre_stn_nm = _strip_station_suffix(request.departureLocation)
    arvl_stn_nm = _strip_station_suffix(request.arrivalLocation)

    plan_payload = _request_json(
        _RAIL_BASE_URL,
        "travelerTrainRunPlan2",
        {
            "pageNo": 1,
            "numOfRows": 100,
            "returnType": "JSON",
            "cond[run_ymd::EQ]": run_ymd,
            "cond[dptre_stn_nm::EQ]": dptre_stn_nm,
            "cond[arvl_stn_nm::EQ]": arvl_stn_nm,
        },
    )
    if plan_payload is None:
        return _NOT_FOUND

    candidates = _extract_items(plan_payload)
    best_match = None
    best_diff = None
    for item in candidates:
        planned = _parse_rail_datetime(item.get("trn_plan_dptre_dt"))
        if planned is None:
            continue
        diff = abs((planned - departure_time).total_seconds())
        if best_diff is None or diff < best_diff:
            best_diff = diff
            best_match = item

    # 예정 출발시각이 예매정보와 30분 넘게 차이나면 다른 열차로 보고 매칭하지 않는다.
    if best_match is None or best_diff is None or best_diff > 30 * 60:
        return _NOT_FOUND

    trn_no = best_match.get("trn_no")
    scheduled = _parse_rail_datetime(best_match.get("trn_plan_dptre_dt"))

    info_payload = _request_json(
        _RAIL_BASE_URL,
        "travelerTrainRunInfo2",
        {
            "pageNo": 1,
            "numOfRows": 100,
            "returnType": "JSON",
            "cond[run_ymd::EQ]": run_ymd,
            "cond[stn_nm::EQ]": dptre_stn_nm,
        },
    )
    if info_payload is None:
        return _build_status(scheduled, None)

    actual = None
    for item in _extract_items(info_payload):
        if item.get("trn_no") == trn_no:
            actual = _parse_rail_datetime(item.get("trn_dptre_dt"))
            break

    return _build_status(scheduled, actual)


def _parse_rail_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        # 예: "2026-08-08 05:13:00.0"
        return datetime.strptime(value.split(".")[0], "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return None


def _build_status(scheduled: Optional[datetime], actual: Optional[datetime], extra_label: Optional[str] = None) -> TransitStatusData:
    if scheduled is None:
        return _NOT_FOUND

    if actual is None:
        message = "예정된 일정이 확인됐지만, 아직 실시간 상태 정보는 나오지 않았습니다."
        return TransitStatusData(found=True, delayed=False, scheduledTime=scheduled.isoformat(), message=message)

    delay_minutes = round((actual - scheduled).total_seconds() / 60)
    delayed = delay_minutes > 0

    if delayed:
        message = f"{delay_minutes}분 지연되었습니다."
    else:
        message = "정상 운행 중입니다."
    if extra_label:
        message = f"{message} ({extra_label})"

    return TransitStatusData(
        found=True,
        delayed=delayed,
        delayMinutes=delay_minutes if delayed else 0,
        scheduledTime=scheduled.isoformat(),
        actualTime=actual.isoformat(),
        message=message,
    )


def get_transit_status(request: TransitStatusRequest) -> TransitStatusData:
    if request.type == "flight":
        return _get_flight_status(request)
    if request.type == "train":
        return _get_train_status(request)
    return _UNSUPPORTED
