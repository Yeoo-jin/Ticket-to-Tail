"""선택 관광지·음식점(날짜별) 기반 맞춤 타임라인 생성.

시간·제약조건 계산은 전부 이 모듈(코드)에서 결정적으로 처리하며, AI(Gemini)는
호출하지 않는다. 관광지 운영시간·이동시간·휴식시간은 데모 데이터/데모 규칙을
기반으로 한 추정치이며, 실시간 지도·교통 정보가 아니다.
"""

import random
from datetime import date, datetime, time, timedelta
from typing import Dict, List, Optional, Sequence, Tuple, get_args

from app.schemas.common import CompanionType
from app.schemas.place import MealType, PlaceRecord
from app.schemas.timeline import (
    CustomPlaceInput,
    DaySelection,
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
from app.services.travel_time_service import estimate_transfer_minutes, estimate_travel_minutes
from app.utils.companion_validation import validate_companion_types
from app.utils.errors import InvalidInputError

MIN_DAILY_PLACES = 1
MAX_DAILY_PLACES = 3

# 하루 중 관광 일정을 배치할 수 있는 시간대 (데모용 고정값).
DAY_START_HOUR = 9
DAY_END_HOUR = 22

# 끼니별로 방문을 고정하는 시간대(데모용 고정값, 요청사항 기준). 이 창 밖에서는
# 배치하지 않고(창을 넘기지 않음), 관광지는 창과 창 사이 남는 시간에 나눠 배치한다.
MEAL_WINDOWS: Dict[MealType, Tuple[int, int]] = {
    "breakfast": (8, 10),
    "lunch": (11, 13),
    "dinner": (18, 20),
}

# 이 시간(분) 이상 비면 "개장 대기" 휴식 항목으로 표시하고, 그보다 짧으면 표시하지 않는다.
MIN_WAIT_GAP_MINUTES = 10

BOOKING_TYPE_LABEL = {"flight": "항공편", "train": "열차"}

# 사용자가 추천 후보 대신 직접 입력한 장소를 다룰 때 쓰는 기본 체류시간(분).
# 운영시간 제약이 없어 24시간 아무 때나 배치 가능한 것으로 취급한다.
CUSTOM_PLACE_DURATION_MINUTES = 60
_ALL_COMPANION_TYPES: List[CompanionType] = list(get_args(CompanionType))


def _build_custom_place_record(place_id: str, custom_place: CustomPlaceInput, destination: str) -> PlaceRecord:
    """사용자가 추천 후보 대신 직접 입력한 장소를 위한 임시 레코드를 만든다.
    places.json에는 저장하지 않고, 이 요청을 처리하는 동안만 메모리에 존재한다.
    카카오 장소검색으로 좌표(lat/lng)까지 받았으면 그대로 써서, 다른 장소와의 이동시간도
    거리 기반으로 계산되고 지도에도 표시된다. 좌표가 없으면(이름만 직접 입력) 거점 기준
    기본 이동시간으로 대체되고 지도에는 표시되지 않는다."""
    return PlaceRecord(
        placeId=place_id,
        name=custom_place.name,
        region=destination,
        district=destination,
        category="직접 입력",
        description="사용자가 직접 추가한 장소입니다.",
        tags=[],
        companionTypes=_ALL_COMPANION_TYPES,
        recommendationReasons={},
        estimatedDurationMinutes=CUSTOM_PLACE_DURATION_MINUTES,
        openTime="00:00",
        closeTime="24:00",
        indoor=False,
        address=custom_place.address or custom_place.name,
        imageUrl=None,
        mealType=None,
        lat=custom_place.lat,
        lng=custom_place.lng,
    )


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


def _split_evenly(items: Sequence[PlaceRecord], bucket_count: int) -> List[List[PlaceRecord]]:
    """items를 bucket_count개의 구간에 앞에서부터 최대한 고르게 나눠 담는다."""
    if bucket_count <= 0:
        return [list(items)]
    base, extra = divmod(len(items), bucket_count)
    buckets: List[List[PlaceRecord]] = []
    index = 0
    for i in range(bucket_count):
        size = base + (1 if i < extra else 0)
        buckets.append(list(items[index : index + size]))
        index += size
    return buckets


def _distribute_by_weight(items: Sequence[PlaceRecord], weights: Sequence[int]) -> List[List[PlaceRecord]]:
    """items를 weights(구간별 여유 분(分)) 비율에 최대한 맞춰 나눠 담는다.

    끼니 시간대가 고정(MEAL_WINDOWS)이라, 관광지를 구간별로 그냥 균등하게 나누면
    끼니 사이 여유가 짧은 구간에 너무 많은 관광지가 몰려 그 다음 끼니를 창 안에
    배치하지 못하는 경우가 생긴다. 그래서 구간이 넓을수록(=시간 여유가 클수록)
    더 많은 관광지를 배정한다.
    """
    total_weight = sum(weights)
    if not items or total_weight <= 0:
        return _split_evenly(items, len(weights))

    n = len(items)
    raw = [n * weight / total_weight for weight in weights]
    counts = [int(value) for value in raw]
    remainder = n - sum(counts)
    fractional_order = sorted(range(len(weights)), key=lambda i: raw[i] - counts[i], reverse=True)
    for i in fractional_order[:remainder]:
        counts[i] += 1

    buckets: List[List[PlaceRecord]] = []
    index = 0
    for count in counts:
        buckets.append(list(items[index : index + count]))
        index += count
    return buckets


def _try_place_on_day(
    cursor: datetime,
    day_end: datetime,
    place: PlaceRecord,
    last_place: Optional[PlaceRecord],
    multiplier: float,
    extra_dwell: int,
    earliest_start: Optional[datetime],
    latest_end: Optional[datetime] = None,
) -> Tuple[Optional[dict], datetime]:
    """cursor 이후, 그리고 이 날짜 안(day_end 전, latest_end가 있으면 그 전)에 place를
    배치할 수 있으면 배치하고, 그렇지 않으면 (None, cursor)를 반환한다. 다른 날짜로는
    넘어가지 않는다(요청상 각 항목이 이미 특정 날짜에 배정돼 있으므로 날짜를 넘겨
    배치하면 안 된다). latest_end는 끼니 시간대(MEAL_WINDOWS)처럼 창 끝이 고정된
    항목에만 쓰이며, 그 시각을 넘겨서까지 밀어 배치하지 않는다."""
    if cursor >= day_end:
        return None, cursor
    if earliest_start is not None and earliest_start > cursor:
        cursor = min(earliest_start, day_end)

    travel_minutes = estimate_travel_minutes(last_place, place, multiplier)
    travel_start = cursor
    travel_end = travel_start + timedelta(minutes=travel_minutes)

    open_dt = _place_open_dt(cursor.date(), place)
    close_dt = _place_close_dt(cursor.date(), place)

    visit_start = max(travel_end, open_dt)
    visit_end = visit_start + timedelta(minutes=place.estimatedDurationMinutes + extra_dwell)

    effective_end = min(day_end, close_dt)
    if latest_end is not None:
        effective_end = min(effective_end, latest_end)

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
    return None, cursor


def _place_visit_item(place: PlaceRecord, placement: dict, item_kind: str) -> dict:
    return {
        "type": item_kind,
        "start": placement["visit_start"],
        "end": placement["visit_end"],
        "title": place.name,
        "placeId": place.placeId,
        "location": place.address,
        "description": place.description,
        "estimated": True,
        "lat": place.lat,
        "lng": place.lng,
    }


def _schedule_day(
    day_places: Sequence[PlaceRecord],
    day_meals: Dict[MealType, PlaceRecord],
    day_date: date,
    touring_start: datetime,
    touring_end: datetime,
    companion_types: Sequence[str],
    pace: str,
    rng: random.Random,
    cursor: datetime,
    last_place: Optional[PlaceRecord],
) -> Tuple[List[dict], datetime, Optional[PlaceRecord], List[str]]:
    """식당(끼니)을 관광지보다 먼저, 우선적으로 배치한다(요청사항 기준) — 관광지끼리
    시간을 다투다 끼니가 밀려나는 일이 없도록, 끼니를 먼저 확정한 뒤 그 사이사이 남는
    시간에 관광지를 채워 넣는다. 이렇게 하면 관광지 하나가 오래 걸려도 다른 날 다른
    끼니에는 영향이 없고, 관광지·끼니가 불필요하게 제외되는 경우도 줄어든다."""
    warnings: List[str] = []

    multiplier = travel_multiplier(companion_types, pace)
    rest_base = rest_minutes(companion_types, pace)

    day_start, day_end = _day_window(day_date, touring_start, touring_end)
    cursor = max(cursor, day_start)

    # --- 1단계: 끼니를 시간대(MEAL_WINDOWS) 순서대로 먼저 확정한다 ---
    ordered_meals = sorted(day_meals.items(), key=lambda entry: MEAL_WINDOWS[entry[0]][0])
    meal_results: List[Tuple[PlaceRecord, dict]] = []
    meal_cursor = cursor
    meal_last_place = last_place

    for meal_type, meal_place in ordered_meals:
        start_hour, end_hour = MEAL_WINDOWS[meal_type]
        window_start = datetime.combine(day_date, time(start_hour, 0))
        window_end = datetime.combine(day_date, time(end_hour, 0))
        extra_dwell = extra_dwell_minutes(companion_types, meal_place.tags, pace)

        start_cursor = max(meal_cursor, window_start, day_start)
        placement, _ = _try_place_on_day(
            start_cursor, day_end, meal_place, meal_last_place, multiplier, extra_dwell, window_start, window_end
        )
        if placement is None and meal_last_place is not None:
            # 이전 일정에서 이어진 이동시간 때문에 창을 놓쳤을 수 있으니, 거점에서 바로
            # 오는 것으로 한 번 더 시도해 끼니가 최대한 배치되도록 한다.
            placement, _ = _try_place_on_day(
                window_start, day_end, meal_place, None, multiplier, extra_dwell, window_start, window_end
            )

        if placement is None:
            warnings.append(
                f"{_eun(meal_place.name)} 이용 가능한 시간 안에 배치하지 못해 {day_date.isoformat()} 일정에서 제외했습니다."
            )
            continue

        meal_results.append((meal_place, placement))
        meal_cursor = placement["visit_end"]
        meal_last_place = meal_place

    # --- 2단계: 끼니 사이사이(첫 끼니 전, 끼니 사이, 마지막 끼니 후) 남는 시간에
    #     관광지를 그 여유 길이에 비례해 나눠 채운다 ---
    boundaries = [day_start]
    gap_last_places: List[Optional[PlaceRecord]] = [last_place]
    for meal_place, placement in meal_results:
        # 끼니 자체의 이동 구간(travel_start~)부터는 그 끼니가 "차지한" 시간으로 보고,
        # 관광지가 그 구간을 침범해 이동 항목과 겹쳐 보이지 않게 한다.
        boundaries.append(placement["travel_start"])
        boundaries.append(placement["visit_end"])
        gap_last_places.append(meal_place)
    boundaries.append(day_end)

    gap_bounds = [(boundaries[i], boundaries[i + 1]) for i in range(0, len(boundaries) - 1, 2)]
    gap_minutes = [max(0, int((end - start).total_seconds() // 60)) for start, end in gap_bounds]

    shuffled_places = list(day_places)
    rng.shuffle(shuffled_places)
    buckets = _distribute_by_weight(shuffled_places, gap_minutes)

    attraction_results: List[Tuple[PlaceRecord, dict]] = []
    for (gap_start, gap_end), bucket, gap_last_place in zip(gap_bounds, buckets, gap_last_places):
        local_cursor = gap_start
        local_last_place = gap_last_place
        for place in bucket:
            extra_dwell = extra_dwell_minutes(companion_types, place.tags, pace)
            placement, next_cursor = _try_place_on_day(
                local_cursor, gap_end, place, local_last_place, multiplier, extra_dwell, None, None
            )
            if placement is None:
                warnings.append(
                    f"{_eun(place.name)} 이용 가능한 시간 안에 배치하지 못해 {day_date.isoformat()} 일정에서 제외했습니다."
                )
                continue
            attraction_results.append((place, placement))
            # 다음 관광지의 이동을 곧바로 이어 붙이지 않고, 그 사이에 쉴 시간을 남겨둔다
            # (3단계에서 이 여유를 "휴식" 항목으로 보여준다).
            jitter = rng.randint(-5, 10)
            rest_len = max(10, rest_base + jitter)
            local_cursor = min(next_cursor + timedelta(minutes=rest_len), gap_end)
            local_last_place = place

    # --- 3단계: 끼니 + 관광지를 시간순으로 합쳐 이동·휴식 항목을 끼워 넣는다 ---
    all_results = [(place, placement, "meal") for place, placement in meal_results] + [
        (place, placement, "attraction") for place, placement in attraction_results
    ]
    all_results.sort(key=lambda entry: entry[1]["visit_start"])

    items: List[dict] = []
    for index, (place, placement, item_kind) in enumerate(all_results):
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

        items.append(_place_visit_item(place, placement, item_kind))

        has_next = index < len(all_results) - 1
        if has_next:
            # 다음 항목의 이동(travel_start)은 이미 2단계에서 독립적으로 정해져 있으므로,
            # 그 시작 시각을 넘겨서까지 휴식을 넣으면 두 항목이 겹쳐 보인다. 다음 이동이
            # 시작되기 전까지 실제로 남는 시간만 휴식으로 보여준다(남는 시간이 없으면 생략).
            next_travel_start = all_results[index + 1][1]["travel_start"]
            jitter = rng.randint(-5, 10)
            rest_len = max(10, rest_base + jitter)
            rest_end = min(visit_end + timedelta(minutes=rest_len), next_travel_start, day_end)
            if rest_end > visit_end:
                description = (
                    "반려동물과 함께 야외에서 쉬어가는 휴식 시간입니다."
                    if "pet" in companion_types
                    else "다음 일정 전 휴식 시간입니다."
                )
                items.append(
                    {
                        "type": "rest",
                        "start": visit_end,
                        "end": rest_end,
                        "title": "휴식",
                        "placeId": None,
                        "location": place.address,
                        "description": description,
                        "estimated": True,
                    }
                )

    final_cursor = all_results[-1][1]["visit_end"] if all_results else cursor
    final_last_place = all_results[-1][0] if all_results else last_place
    return items, final_cursor, final_last_place, warnings


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


def _booking_primary_time(booking) -> Optional[datetime]:
    if booking.arrivalTime:
        return _parse_dt(booking.arrivalTime)
    if booking.departureTime:
        return _parse_dt(booking.departureTime)
    return None


# 두 예매편 사이 간격이 이보다 크면 "환승"이 아니라 그 사이에 관광 등 다른 일정이
# 있는 것으로 보고 환승 이동 항목을 추가하지 않는다.
_MAX_TRANSFER_GAP = timedelta(hours=6)


def _build_transfer_items(bookings, buffer_minutes: int) -> List[dict]:
    """서로 다른 교통수단(예: 항공→철도)으로 짧은 간격 안에 이어지는 예매편 사이에
    공항·역 환승 이동 항목을 추가한다. 같은 교통수단이 이어지거나(예: 항공→항공),
    간격이 커서 그 사이에 관광 등 다른 일정이 있다고 볼 수 있으면 추가하지 않는다."""
    timed = [(booking, _booking_primary_time(booking)) for booking in bookings]
    timed = [(booking, t) for booking, t in timed if t is not None]
    timed.sort(key=lambda pair: pair[1])

    items: List[dict] = []
    for (prev, _), (nxt, _) in zip(timed, timed[1:]):
        if prev.type == nxt.type:
            continue
        if not (prev.arrivalLocation and prev.arrivalTime):
            continue
        if not (nxt.departureLocation and nxt.departureTime):
            continue
        if _parse_dt(nxt.departureTime) - _parse_dt(prev.arrivalTime) > _MAX_TRANSFER_GAP:
            continue

        transfer_minutes = estimate_transfer_minutes(prev.type, nxt.type)
        if transfer_minutes <= 0:
            continue

        # 도착 직후 정리·수속 여유(buffer_minutes)가 끝난 시점부터 환승 이동을 시작하는
        # 것으로 봐, 같은 예매편에서 만들어지는 "도착" 항목과 시간이 겹치지 않게 한다.
        start = _parse_dt(prev.arrivalTime) + timedelta(minutes=buffer_minutes)
        end = start + timedelta(minutes=transfer_minutes)
        items.append(
            {
                "type": "transport",
                "start": start,
                "end": end,
                "title": f"{prev.arrivalLocation} → {nxt.departureLocation} 환승 이동",
                "placeId": None,
                "location": nxt.departureLocation,
                "description": "서로 다른 교통수단 사이를 이동하는 데 걸리는 예상 환승 시간입니다. 실제 소요시간과 다를 수 있습니다.",
                "estimated": True,
            }
        )
    return items


def _resolve_day_records(
    day: DaySelection, by_id: Dict[str, PlaceRecord]
) -> Tuple[List[PlaceRecord], Dict[MealType, PlaceRecord], List[str]]:
    unknown: List[str] = []

    places: List[PlaceRecord] = []
    for place_id in day.placeIds:
        record = by_id.get(place_id)
        if record is None:
            unknown.append(place_id)
        else:
            places.append(record)

    meals: Dict[MealType, PlaceRecord] = {}
    for meal_type, place_id in day.restaurantIds.items():
        record = by_id.get(place_id)
        if record is None:
            unknown.append(place_id)
        else:
            meals[meal_type] = record

    return places, meals, unknown


def generate_timeline(
    request: TimelineGenerateRequest, rng: Optional[random.Random] = None
) -> TimelineGenerateData:
    if rng is None:
        rng = random.Random(request.seed) if request.seed is not None else random.Random()

    if not request.days:
        raise InvalidInputError("최소 하루 이상의 일정(days)이 필요합니다.")

    for day in request.days:
        if not (MIN_DAILY_PLACES <= len(day.placeIds) <= MAX_DAILY_PLACES):
            raise InvalidInputError(f"{day.date}에는 관광지를 1개 이상 3개 이하로 선택해야 합니다.")
        if len(set(day.placeIds)) != len(day.placeIds):
            raise InvalidInputError(f"{day.date}의 관광지 목록에 중복된 ID가 있습니다.")

    validate_companion_types(request.companionTypes)

    if len(set(request.companionTypes)) != len(request.companionTypes):
        raise InvalidInputError("companionTypes에 동일한 동행 조건이 중복되어 있습니다.")

    if not request.bookings:
        raise InvalidInputError("예매정보가 필요합니다.")

    all_places = load_places()
    by_id: Dict[str, PlaceRecord] = {p.placeId: p for p in all_places}
    for custom_id, custom_place in request.customPlaces.items():
        # 실제 관광지 ID와 우연히 겹치더라도, 사용자가 이번 요청에서 직접 입력한 장소를
        # 우선한다(places.json을 덮어쓰는 게 아니라 이번 요청 안에서만 쓰는 임시 조회용이므로).
        by_id[custom_id] = _build_custom_place_record(custom_id, custom_place, request.destination)

    unknown_ids: List[str] = []
    resolved_days: List[Tuple[date, List[PlaceRecord], Dict[MealType, PlaceRecord]]] = []
    for day in request.days:
        places, meals, unknown = _resolve_day_records(day, by_id)
        unknown_ids.extend(unknown)
        resolved_days.append((date.fromisoformat(day.date), places, meals))

    if unknown_ids:
        raise InvalidInputError(f"존재하지 않는 관광지·음식점 ID가 있습니다: {', '.join(unknown_ids)}")

    # set으로 다뤄 순서와 무관하게 항상 같은 정책 결과가 나오게 한다.
    companion_types: List[CompanionType] = sorted(set(request.companionTypes))
    pace: Pace = request.pace

    warnings: List[str] = []

    if "pet" in companion_types:
        filtered_days = []
        for day_date, places, meals in resolved_days:
            kept_places = []
            for place in places:
                if "pet" in place.companionTypes:
                    kept_places.append(place)
                else:
                    warnings.append(f"{_eun(place.name)} 반려동물 동반 조건에서 이용할 수 없어 일정에서 제외했습니다.")
            filtered_days.append((day_date, kept_places, meals))
        resolved_days = filtered_days

    buffer_minutes = travel_buffer_minutes(companion_types, pace)
    touring_start, touring_end, window_warnings = _compute_touring_window(request.bookings, buffer_minutes)
    warnings.extend(window_warnings)

    resolved_days.sort(key=lambda item: item[0])

    touring_items: List[dict] = []
    cursor = touring_start
    for day_date, places, meals in resolved_days:
        # 날짜가 바뀌면 전날 마지막으로 어디에 있었는지 알 수 없으므로(숙소로 돌아갔다고
        # 본다), 매일 역/거점에서 새로 출발하는 것으로 취급한다(last_place=None).
        day_items, cursor, _, day_warnings = _schedule_day(
            places, meals, day_date, touring_start, touring_end, companion_types, pace, rng, cursor, None
        )
        touring_items.extend(day_items)
        warnings.extend(day_warnings)

    booking_items = _build_booking_items(request.bookings, buffer_minutes)
    booking_items.extend(_build_transfer_items(request.bookings, buffer_minutes))

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
                lat=raw.get("lat"),
                lng=raw.get("lng"),
            )
        )

    placed_place_ids = {raw["placeId"] for raw in touring_items if raw.get("placeId")}
    sightseeing_minutes = sum(
        int((raw["end"] - raw["start"]).total_seconds() // 60)
        for raw in touring_items
        if raw["type"] in ("attraction", "meal")
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
