"""관광지 간 예상 이동시간 추정 (데모 전용, 실시간 지도·경로 API 미사용).

이동시간 계산 로직을 타임라인 생성 로직과 분리해 별도 서비스로 둔다.
값은 실제 이동시간이 아니라 데모용 추정치이며, 화면에는 "예상 이동시간"으로 표시해야 한다.
"""

import math
from typing import Optional

from app.schemas.place import PlaceRecord

# 데모용 고정 상수. 두 장소 모두 좌표(lat/lng)가 있으면 직선거리 기반으로 계산하고,
# 좌표가 없는 쪽이 있으면(지오코딩 실패 등) district가 같은지 여부로만 대략 구분한다.
SAME_DISTRICT_MINUTES = 15
DIFFERENT_DISTRICT_MINUTES = 40
# 예매정보상 도착 거점(역·공항 등)에서 첫 관광지까지 이동하는 데모용 고정 이동시간.
STATION_TO_FIRST_PLACE_MINUTES = 30
# 서로 다른 교통수단(항공↔철도) 사이를 갈아탈 때 걸리는 데모용 고정 환승 이동시간.
TRANSFER_BETWEEN_TRANSIT_MODES_MINUTES = 60

# 좌표 기반 거리 계산에 쓰는 데모용 가정값. 실제 도로 경로가 아니라 직선거리(haversine)를
# 대중교통+도보가 섞인 평균 속도로 나눈 값이라, 실제 소요시간과 차이가 날 수 있다.
_EARTH_RADIUS_KM = 6371.0
_AVERAGE_SPEED_KMH = 25.0
_FIXED_OVERHEAD_MINUTES = 5  # 대기·환승 등 거리와 무관하게 붙는 기본 여유시간.

_MIN_TRAVEL_MINUTES = 5


def estimate_transfer_minutes(from_type: str, to_type: str) -> int:
    """연속된 두 예매편의 교통수단이 다르면(예: 항공→철도) 공항·역 사이를 이동하는
    데모용 고정 환승 시간을, 같은 수단이면 0을 반환한다."""
    if from_type == to_type:
        return 0
    return TRANSFER_BETWEEN_TRANSIT_MODES_MINUTES


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * _EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def estimate_travel_minutes(
    from_place: Optional[PlaceRecord],
    to_place: PlaceRecord,
    multiplier: float = 1.0,
) -> int:
    """from_place가 None이면 역/공항 등 교통 거점에서 출발하는 것으로 본다.

    두 장소 모두 좌표가 있으면 직선거리 기반으로 추정하고(자율 입력 장소도 카카오
    장소검색으로 좌표를 받으면 여기 포함된다), 아니면 기존 district 비교 방식으로
    대체한다.
    """
    if from_place is None:
        base_minutes = STATION_TO_FIRST_PLACE_MINUTES
    elif from_place.lat is not None and from_place.lng is not None and to_place.lat is not None and to_place.lng is not None:
        distance_km = _haversine_km(from_place.lat, from_place.lng, to_place.lat, to_place.lng)
        base_minutes = (distance_km / _AVERAGE_SPEED_KMH) * 60 + _FIXED_OVERHEAD_MINUTES
    elif from_place.district == to_place.district:
        base_minutes = SAME_DISTRICT_MINUTES
    else:
        base_minutes = DIFFERENT_DISTRICT_MINUTES

    return max(_MIN_TRAVEL_MINUTES, round(base_minutes * multiplier))
