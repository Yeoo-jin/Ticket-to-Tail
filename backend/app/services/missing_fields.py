"""출발/도착을 독립적으로 계산하는 missingFields 로직."""

from typing import List, Optional

from app.schemas.booking_extraction import RawBookingEvent

_TYPE_LABELS = {"flight": "항공편", "train": "열차"}


def _direction_missing_fields(
    type_kr: str,
    direction_kr: str,
    location: Optional[str],
    month: Optional[int],
    day: Optional[int],
    hour: Optional[int],
) -> List[str]:
    date_complete = month is not None and day is not None
    time_complete = hour is not None

    if location is None and not date_complete and not time_complete:
        # 이 방향 자체가 텍스트에 등장하지 않은 경우 (예: 도착만 있는 항공편의 출발쪽).
        return []

    missing: List[str] = []
    if location is None:
        missing.append(f"{type_kr} {direction_kr} 장소")
    if not date_complete:
        missing.append(f"{type_kr} {direction_kr} 날짜")
    if not time_complete:
        missing.append(f"{type_kr} {direction_kr} 시간")
    return missing


def compute_missing_fields(raw_events: List[RawBookingEvent]) -> List[str]:
    ordered: List[str] = []
    seen = set()

    for event in raw_events:
        type_kr = _TYPE_LABELS[event.type]

        directions = (
            ("출발", event.departureLocation, event.departureMonth, event.departureDay, event.departureHour),
            ("도착", event.arrivalLocation, event.arrivalMonth, event.arrivalDay, event.arrivalHour),
        )
        for direction_kr, location, month, day, hour in directions:
            for field in _direction_missing_fields(type_kr, direction_kr, location, month, day, hour):
                if field not in seen:
                    seen.add(field)
                    ordered.append(field)

    return ordered
