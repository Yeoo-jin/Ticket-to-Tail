"""기차역 편의시설 조회 — 유아 동반/교통약자 동반 여행자를 위한 부가 정보.

공공데이터포털(data.go.kr) 한국철도공사_편의시설정보 API(B551457/convenience)를 사용한다:
- 역사내 편의시설(stationFacilities): 엘리베이터/에스컬레이터 수, 화장실·수유실·종합안내센터 유무
- 교통약자 편의시설(weekPersonFacilities): 휠체어리프트 수, 장애인경사로·장애인화장실 유무

인증키는 항공·철도 실시간 운항 조회(transit_status_service)와 같은
PUBLIC_DATA_API_KEY를 공용으로 쓴다(계정당 하나의 공공데이터포털 인증키로 승인된
API를 전부 호출할 수 있어 API별로 별도 발급받지 않는다).

이 서비스는 "있으면 좋은" 부가 정보이므로, 외부 API 호출이 실패하거나 일치하는 역을
찾지 못해도 예외를 던지지 않고 None을 반환한다(타임라인 생성 전체가 깨지지 않도록).
"""

import logging
import os
from typing import Optional

import httpx

from app.schemas.timeline import StationFacility

logger = logging.getLogger(__name__)

_BASE_URL = "https://apis.data.go.kr/B551457/convenience"
_TIMEOUT_SECONDS = 8.0

# 역명(정규화됨) 기준 캐시. 같은 타임라인 요청 안에서 같은 역(예: 환승 왕복으로
# 출발역·도착역이 겹치는 경우)을 중복 호출하지 않기 위함이다. 프로세스가 살아있는
# 동안 유지되며, 편의시설 정보는 자주 바뀌지 않으므로 만료 처리는 하지 않는다.
_cache: dict = {}


def _get_service_key() -> Optional[str]:
    key = os.getenv("PUBLIC_DATA_API_KEY")
    if not key:
        logger.warning("PUBLIC_DATA_API_KEY 환경변수가 설정되지 않았습니다.")
        return None
    return key


def _strip_station_suffix(location: str) -> str:
    return location[:-1] if location.endswith("역") else location


def _to_int(value) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _yn_to_bool(value: Optional[str]) -> bool:
    return isinstance(value, str) and value.strip().upper() == "Y"


def _request_items(operation: str, station_name: str) -> list:
    key = _get_service_key()
    if not key:
        return []

    params = {
        "serviceKey": key,
        "pageNo": 1,
        "numOfRows": 10,
        "returnType": "JSON",
        "cond[stn_nm::EQ]": station_name,
    }
    try:
        response = httpx.get(f"{_BASE_URL}/{operation}", params=params, timeout=_TIMEOUT_SECONDS)
    except httpx.HTTPError as exc:
        logger.warning("역 편의시설 API 호출 실패 (%s): %s", operation, type(exc).__name__)
        return []

    if response.status_code != 200:
        logger.warning("역 편의시설 API 응답 오류 (%s): status=%s", operation, response.status_code)
        return []

    try:
        payload = response.json()
    except ValueError:
        logger.warning("역 편의시설 API 응답이 JSON이 아닙니다 (%s)", operation)
        return []

    body = payload.get("response", {}).get("body", {})
    items = body.get("items")
    if items is None:
        return []
    # 결과가 여러 건이면 items가 배열, 한 건이면 items.item이 단일 객체로 오는
    # 공공데이터포털 공통 패턴을 그대로 따른다(transit_status_service와 동일).
    if isinstance(items, list):
        return items
    if isinstance(items, dict):
        item = items.get("item")
        if item is None:
            return []
        return item if isinstance(item, list) else [item]
    return []


def fetch_station_facility(
    station_name: str, *, include_nursing_room: bool, include_accessible: bool
) -> Optional[StationFacility]:
    """역명(예: "서울역")으로 편의시설을 조회한다.

    include_nursing_room/include_accessible로 실제 필요한 동행조건(유아/교통약자)에
    해당하는 부분만 채운다 — 요청하지 않은 필드는 항상 None으로 남는다.
    둘 다 False면 조회 자체를 하지 않고 None을 반환한다.
    """

    if not include_nursing_room and not include_accessible:
        return None

    normalized = _strip_station_suffix(station_name.strip())
    if not normalized:
        return None

    cache_key = (normalized, include_nursing_room, include_accessible)
    if cache_key in _cache:
        return _cache[cache_key]

    general_items = _request_items("stationFacilities", normalized)
    if not general_items:
        _cache[cache_key] = None
        return None

    general = general_items[0]
    facility = StationFacility(
        stationName=station_name,
        hasElevator=_to_int(general.get("elevt_cnt")) > 0,
        elevatorCount=_to_int(general.get("elevt_cnt")),
        escalatorCount=_to_int(general.get("esclt_cnt")),
        hasGeneralRestroom=_yn_to_bool(general.get("gen_tolt_estnc")),
        hasInfoCenter=_yn_to_bool(general.get("altm_lead_cntr_estnc")),
        hasNursingRoom=_yn_to_bool(general.get("nrsrm_estnc")) if include_nursing_room else None,
    )

    if include_accessible:
        accessible_items = _request_items("weekPersonFacilities", normalized)
        if accessible_items:
            accessible = accessible_items[0]
            facility = facility.model_copy(
                update={
                    "hasAccessibleRestroom": _yn_to_bool(accessible.get("pwdbs_tolt_estnc")),
                    "hasWheelchairRamp": _yn_to_bool(accessible.get("pwdbs_slwy_estnc")),
                    "wheelchairLiftCount": _to_int(accessible.get("whlch_liftt_cnt")),
                }
            )

    _cache[cache_key] = facility
    return facility
