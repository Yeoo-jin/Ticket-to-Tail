"""관광지 간 예상 이동시간 추정 (데모 전용, 실시간 지도 API 미사용).

이동시간 계산 로직을 타임라인 생성 로직과 분리해 별도 서비스로 둔다.
값은 실제 이동시간이 아니라 데모용 추정치이며, 화면에는 "예상 이동시간"으로 표시해야 한다.
"""

from typing import Optional

from app.schemas.place import PlaceRecord

# 데모용 고정 상수 (district가 같은지 여부만으로 짧은 이동/긴 이동을 구분한다).
SAME_DISTRICT_MINUTES = 15
DIFFERENT_DISTRICT_MINUTES = 40
# 예매정보상 도착 거점(역·공항 등)에서 첫 관광지까지 이동하는 데모용 고정 이동시간.
STATION_TO_FIRST_PLACE_MINUTES = 30

_MIN_TRAVEL_MINUTES = 5


def estimate_travel_minutes(
    from_place: Optional[PlaceRecord],
    to_place: PlaceRecord,
    multiplier: float = 1.0,
) -> int:
    """from_place가 None이면 역/공항 등 교통 거점에서 출발하는 것으로 본다."""
    if from_place is None:
        base_minutes = STATION_TO_FIRST_PLACE_MINUTES
    elif from_place.district == to_place.district:
        base_minutes = SAME_DISTRICT_MINUTES
    else:
        base_minutes = DIFFERENT_DISTRICT_MINUTES

    return max(_MIN_TRAVEL_MINUTES, round(base_minutes * multiplier))
