"""선택 관광지 기반 맞춤 타임라인 생성.

시간·제약조건 계산은 전부 이 모듈(코드)에서 결정적으로 처리하며, AI(Gemini)는
호출하지 않는다. 관광지 운영시간·이동시간·휴식시간은 데모 데이터/데모 규칙을
기반으로 한 추정치이며, 실시간 지도·교통 정보가 아니다.
"""

import random
from datetime import date, datetime, time, timedelta
from typing import Dict, List, Optional, Sequence, Tuple

from app.schemas.common import CompanionType
from app.schemas.place import PlaceRecord
from app.schemas.timeline import (
    Pace,
    TimelineGenerateData,
    TimelineGenerateRequest,
    TimelineItem,
    TimelineSummary,
)
from app.services.place_data import load_places
from app.services.timeline_companion_policy import (
    extra_dwell_minutes,
    rest_minutes,
    travel_buffer_minutes,
    travel_multiplier,
)
from app.services.travel_time_service import estimate_travel_minutes
from app.utils.companion_validation import validate_companion_types
from app.utils.errors import InvalidInputError

MIN_SELECTED_PLACES = 1
MAX_SELECTED_PLACES = 3

# 하루 중 관광 일정을 배치할 수 있는 시간대 (데모용 고정값).
DAY_START_HOUR = 9
DAY_END_HOUR = 21

# 이 시간(분) 이상 비면 "개장 대기" 휴식 항목으로 표시하고, 그보다 짧으면 표시하지 않는다.
MIN_WAIT_GAP_MINUTES = 10

BOOKING_TYPE_LABEL = {"flight": "항공편", "train": "열차"}


def _has_final_consonant(text: str) -> bool:
    if not text:
        return False
    code = ord(text[-1])
    if 0xAC00 <= code <= 0xD7A3:
        return (code - 0xAC00) % 28 != 0
    return False


def _ro(word: str) -> str:
    """'으로/로' 조사를 문법에 맞게 붙인다."""
    return f"{word}으로" if _has_final_consonant(word) else f"{word}로"


def _eun(word: str) -> str:
    """'은/는' 조사를 문법에 맞게 붙인다."""
    return f"{word}은" if _has_final_consonant(word) else f"{word}는"


def _parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value)


def _parse_hhmm(value: str) -> Tuple[int, int]:
    hour_str, minute_str = value.split(":")
    return int(hour_str), int(minute_str)


def _place_open_dt(d: date, place: PlaceRecord) -> datetime:
    hour, minute = _parse_hhmm(place.openTime)
    return datetime.combine(d, time(hour, minute))


def _place_close_dt(d: date, place: PlaceRecord) -> datetime:
    if place.closeTime == "24:00":
        return datetime.combine(d + timedelta(days=1), time(0, 0))
    hour, minute = _parse_hhmm(place.closeTime)
    return datetime.combine(d, time(hour, minute))


def _day_window(d: date, touring_start: datetime, touring_end: datetime) -> Tuple[datetime, datetime]:
    start = datetime.combine(d, time(DAY_START_HOUR, 0))
    end = datetime.combine(d, time(DAY_END_HOUR, 0))
    if d == touring_start.date():
        start = max(start, touring_start)
    if d == touring_end.date():
        end = min(end, touring_end)
    return start, end


def _compute_touring_window(bookings, buffer_minutes: int) -> Tuple[datetime, datetime, List[str]]:
    warnings: List[str] = []

    arrival_times = [_parse_dt(b.arrivalTime) for b in bookings if b.arrivalTime]
    if not arrival_times:
        raise InvalidInputError("예매정보에서 도착 시각을 확인할 수 없어 타임라인을 생성할 수 없습니다.")

    # 여러 교통편 중 가장 마지막 도착 시각이, 실제로 목적지에 도착해 관광을 시작할 수 있는 시점이다.
    touring_start = max(arrival_times) + timedelta(minutes=buffer_minutes)

    departure_times = [_parse_dt(b.departureTime) for b in bookings if b.departureTime]
    later_departures = [d for d in departure_times if d > touring_start]
    if later_departures:
        # 다음 출발 예매 전까지 돌아올 이동 여유를 남긴다.
        touring_end = min(later_departures) - timedelta(minutes=buffer_minutes)
    else:
        touring_end = touring_start.replace(hour=DAY_END_HOUR, minute=0, second=0, microsecond=0)
        if touring_end <= touring_start:
            touring_end = touring_start + timedelta(hours=4)

    if touring_end <= touring_start:
        warnings.append("이동 여유를 반영하면 관광 가능한 시간이 없어 관광 일정을 배치하지 못했습니다.")
        touring_end = touring_start

    return touring_start, touring_end, warnings


def _try_place_attraction(
    cursor: datetime,
    place: PlaceRecord,
    last_place: Optional[PlaceRecord],
    touring_start: datetime,
    touring_end: datetime,
    multiplier: float,
    extra_dwell: int,
) -> Tuple[Optional[dict], datetime]:
    """cursor 이후로 place를 배치할 수 있는 첫 번째 위치를 찾는다.

    운영시간·하루 시간대·touring_end를 넘으면 다음 날로 넘어가며 재시도하고,
    끝까지 자리가 없으면 (None, cursor)를 반환한다.
    """
    while True:
        if cursor.date() > touring_end.date():
            return None, cursor

        day_start, day_end = _day_window(cursor.date(), touring_start, touring_end)
        if cursor < day_start:
            cursor = day_start
        if cursor >= day_end:
            next_date = cursor.date() + timedelta(days=1)
            if next_date > touring_end.date():
                return None, cursor
            cursor = datetime.combine(next_date, time(DAY_START_HOUR, 0))
            continue

        travel_minutes = estimate_travel_minutes(last_place, place, multiplier)
        travel_start = cursor
        travel_end = travel_start + timedelta(minutes=travel_minutes)

        open_dt = _place_open_dt(cursor.date(), place)
        close_dt = _place_close_dt(cursor.date(), place)

        visit_start = max(travel_end, open_dt)
        visit_end = visit_start + timedelta(minutes=place.estimatedDurationMinutes + extra_dwell)

        effective_end = min(day_end, close_dt, touring_end)

        if visit_start < effective_end and visit_end <= effective_end:
            return (
                {
                    "travel_start": travel_start,
                    "travel_end": travel_end,
                    "visit_start": visit_start,
                    "visit_end": visit_end,
                },
                visit_end,
            )

        next_date = cursor.date() + timedelta(days=1)
        if next_date > touring_end.date():
            return None, cursor
        cursor = datetime.combine(next_date, time(DAY_START_HOUR, 0))


def _schedule_attractions(
    ordered_places: Sequence[PlaceRecord],
    touring_start: datetime,
    touring_end: datetime,
    companion_types: Sequence[str],
    pace: str,
    rng: random.Random,
) -> Tuple[List[dict], List[str]]:
    items: List[dict] = []
    warnings: List[str] = []

    multiplier = travel_multiplier(companion_types, pace)
    rest_base = rest_minutes(companion_types, pace)

    cursor = touring_start
    last_place: Optional[PlaceRecord] = None
    last_place_date: Optional[date] = None

    for index, place in enumerate(ordered_places):
        # 날짜가 바뀌면 전날 어디서 묵었는지 알 수 없으므로, 역/거점에서 출발하는 것으로 취급한다.
        effective_last_place = last_place if last_place_date == cursor.date() else None
        extra_dwell = extra_dwell_minutes(companion_types, place.tags, pace)

        placement, cursor = _try_place_attraction(
            cursor, place, effective_last_place, touring_start, touring_end, multiplier, extra_dwell
        )

        if placement is None:
            warnings.append(f"{_eun(place.name)} 이용 가능한 시간 안에 배치하지 못해 일정에서 제외했습니다.")
            continue

        travel_start, travel_end = placement["travel_start"], placement["travel_end"]
        visit_start, visit_end = placement["visit_start"], placement["visit_end"]

        if travel_end > travel_start:
            items.append(
                {
                    "type": "transport",
                    "start": travel_start,
                    "end": travel_end,
                    "title": f"{_ro(place.name)} 이동",
                    "placeId": None,
                    "location": place.name,
                    "description": "데모 데이터를 기반으로 계산한 예상 이동시간입니다. 실제 소요시간과 다를 수 있습니다.",
                    "estimated": True,
                }
            )

        if visit_start >= travel_end + timedelta(minutes=MIN_WAIT_GAP_MINUTES):
            items.append(
                {
                    "type": "rest",
                    "start": travel_end,
                    "end": visit_start,
                    "title": "개장 대기",
                    "placeId": None,
                    "location": place.address,
                    "description": f"{place.name} 운영 시작 전까지 대기하는 시간입니다.",
                    "estimated": True,
                }
            )

        items.append(
            {
                "type": "attraction",
                "start": visit_start,
                "end": visit_end,
                "title": place.name,
                "placeId": place.placeId,
                "location": place.address,
                "description": place.description,
                "estimated": True,
            }
        )

        cursor = visit_end
        last_place = place
        last_place_date = visit_end.date()

        has_next = index < len(ordered_places) - 1
        if has_next:
            jitter = rng.randint(-5, 10)
            rest_len = max(10, rest_base + jitter)
            day_start, day_end = _day_window(cursor.date(), touring_start, touring_end)
            rest_end = min(cursor + timedelta(minutes=rest_len), day_end)
            if rest_end > cursor:
                description = (
                    "반려동물과 함께 야외에서 쉬어가는 휴식 시간입니다."
                    if "pet" in companion_types
                    else "다음 일정 전 휴식 시간입니다."
                )
                items.append(
                    {
                        "type": "rest",
                        "start": cursor,
                        "end": rest_end,
                        "title": "휴식",
                        "placeId": None,
                        "location": place.address,
                        "description": description,
                        "estimated": True,
                    }
                )
                cursor = rest_end

    return items, warnings


def _build_booking_items(bookings, buffer_minutes: int) -> List[dict]:
    items: List[dict] = []

    for booking in bookings:
        type_label = BOOKING_TYPE_LABEL.get(booking.type, booking.type)

        has_departure = bool(booking.departureTime and booking.departureLocation)
        has_arrival = bool(booking.arrivalTime and booking.arrivalLocation)

        if has_departure and has_arrival:
            items.append(
                {
                    "type": "transport",
                    "start": _parse_dt(booking.departureTime),
                    "end": _parse_dt(booking.arrivalTime),
                    "title": f"{_ro(type_label)} {booking.departureLocation} → {booking.arrivalLocation} 이동",
                    "placeId": None,
                    "location": booking.arrivalLocation,
                    "description": "예매된 교통편 이동 구간입니다.",
                    "estimated": False,
                }
            )
        elif has_arrival:
            start = _parse_dt(booking.arrivalTime)
            items.append(
                {
                    "type": "arrival",
                    "start": start,
                    "end": start + timedelta(minutes=buffer_minutes),
                    "title": f"{booking.arrivalLocation} 도착",
                    "placeId": None,
                    "location": booking.arrivalLocation,
                    "description": "예매정보 기준 도착 시각이며, 정리·이동 준비 여유 시간을 함께 표시합니다.",
                    "estimated": False,
                }
            )
        elif has_departure:
            end = _parse_dt(booking.departureTime)
            items.append(
                {
                    "type": "departure",
                    "start": end - timedelta(minutes=buffer_minutes),
                    "end": end,
                    "title": f"{booking.departureLocation} 출발",
                    "placeId": None,
                    "location": booking.departureLocation,
                    "description": "예매정보 기준 출발 시각이며, 출발 전 이동·수속 여유 시간을 함께 표시합니다.",
                    "estimated": False,
                }
            )

    return items


def generate_timeline(
    request: TimelineGenerateRequest, rng: Optional[random.Random] = None
) -> TimelineGenerateData:
    if rng is None:
        rng = random.Random(request.seed) if request.seed is not None else random.Random()

    if not (MIN_SELECTED_PLACES <= len(request.selectedPlaceIds) <= MAX_SELECTED_PLACES):
        raise InvalidInputError("관광지는 1개 이상 3개 이하로 선택해야 합니다.")

    if len(set(request.selectedPlaceIds)) != len(request.selectedPlaceIds):
        raise InvalidInputError("selectedPlaceIds에 중복된 관광지 ID가 있습니다.")

    validate_companion_types(request.companionTypes)

    if len(set(request.companionTypes)) != len(request.companionTypes):
        raise InvalidInputError("companionTypes에 동일한 동행 조건이 중복되어 있습니다.")

    if not request.bookings:
        raise InvalidInputError("예매정보가 필요합니다.")

    all_places = load_places()
    by_id: Dict[str, PlaceRecord] = {p.placeId: p for p in all_places}

    unknown_ids = [pid for pid in request.selectedPlaceIds if pid not in by_id]
    if unknown_ids:
        raise InvalidInputError(f"존재하지 않는 관광지 ID가 있습니다: {', '.join(unknown_ids)}")

    # set으로 다뤄 순서와 무관하게 항상 같은 정책 결과가 나오게 한다.
    companion_types: List[CompanionType] = sorted(set(request.companionTypes))
    pace: Pace = request.pace

    selected_places = [by_id[pid] for pid in request.selectedPlaceIds]

    warnings: List[str] = []

    if "pet" in companion_types:
        kept_places = []
        for place in selected_places:
            if "pet" in place.companionTypes:
                kept_places.append(place)
            else:
                warnings.append(f"{_eun(place.name)} 반려동물 동반 조건에서 이용할 수 없어 일정에서 제외했습니다.")
        selected_places = kept_places

    buffer_minutes = travel_buffer_minutes(companion_types, pace)
    touring_start, touring_end, window_warnings = _compute_touring_window(request.bookings, buffer_minutes)
    warnings.extend(window_warnings)

    ordered_places = list(selected_places)
    rng.shuffle(ordered_places)

    touring_items: List[dict] = []
    if ordered_places:
        touring_items, schedule_warnings = _schedule_attractions(
            ordered_places, touring_start, touring_end, companion_types, pace, rng
        )
        warnings.extend(schedule_warnings)

    booking_items = _build_booking_items(request.bookings, buffer_minutes)

    raw_items = booking_items + touring_items
    raw_items.sort(key=lambda item: (item["start"], item["end"]))

    timeline: List[TimelineItem] = []
    for index, raw in enumerate(raw_items, start=1):
        timeline.append(
            TimelineItem(
                id=f"item-{index:03d}",
                type=raw["type"],
                startTime=raw["start"].strftime("%Y-%m-%dT%H:%M:%S"),
                endTime=raw["end"].strftime("%Y-%m-%dT%H:%M:%S"),
                title=raw["title"],
                placeId=raw.get("placeId"),
                location=raw["location"],
                description=raw["description"],
                estimated=raw["estimated"],
            )
        )

    placed_place_ids = {raw["placeId"] for raw in touring_items if raw.get("placeId")}
    sightseeing_minutes = sum(
        int((raw["end"] - raw["start"]).total_seconds() // 60) for raw in touring_items if raw["type"] == "attraction"
    )
    estimated_travel_minutes = sum(
        int((raw["end"] - raw["start"]).total_seconds() // 60) for raw in touring_items if raw["type"] == "transport"
    )

    summary = TimelineSummary(
        placeCount=len(placed_place_ids),
        sightseeingMinutes=sightseeing_minutes,
        estimatedTravelMinutes=estimated_travel_minutes,
        companionTypes=companion_types,
        pace=pace,
    )

    return TimelineGenerateData(timeline=timeline, summary=summary, warnings=warnings)
