"""AI 호출이 실패했을 때만 사용하는 제한적인 규칙 기반 fallback 파서.

기본 추출 경로가 아니며, network/timeout 또는 재시도 후에도 실패한
AI 응답 검증 실패 상황에서만 booking_service가 호출한다.
"""

import re
from typing import List, Optional, Tuple

from app.schemas.booking_extraction import RawBookingEvent

_DATE_PATTERN = re.compile(r"(?:(\d{4})년\s*)?(\d{1,2})월\s*(\d{1,2})일")
_TIME_PATTERN = re.compile(r"(오전|오후)?\s*(\d{1,2})시\s*(?:(\d{1,2})분)?")
_LOCATION_PATTERN = re.compile(r"[가-힣0-9]+(?:공항|역)")

# 앞뒤에 조사·"편"이 바로 붙는 경우가 많아(예: "OZ102편으로") \b(단어 경계)를 쓰면 매치가
# 안 될 수 있다. 한글도 \w로 취급되는 유니코드 정규식 특성 때문. 그래서 경계 대신 문자
# 클래스 형태(대문자 2개+숫자, 또는 KTX/SRT+숫자) 자체로만 구분한다.
_TRANSIT_NUMBER_PATTERN = re.compile(r"(?:[A-Z]{2}\d{2,4}|(?:KTX|SRT)\s?\d{1,4})")

_TRAIN_KEYWORDS = ("KTX", "SRT", "기차", "열차", "무궁화호", "새마을호")
_FLIGHT_KEYWORDS = ("항공편", "비행기")

_PERIOD_MAP = {"오전": "AM", "오후": "PM"}

DateParts = Tuple[Optional[int], Optional[int], Optional[int]]


class _Event:
    __slots__ = ("direction", "type", "transit_number", "location", "year", "month", "day", "period", "hour", "minute")

    def __init__(self):
        self.direction: Optional[str] = None
        self.type: Optional[str] = None
        self.transit_number: Optional[str] = None
        self.location: Optional[str] = None
        self.year: Optional[int] = None
        self.month: Optional[int] = None
        self.day: Optional[int] = None
        self.period: Optional[str] = None
        self.hour: Optional[int] = None
        self.minute: Optional[int] = None


def _parse_clause(clause: str, last_date: DateParts) -> _Event:
    event = _Event()

    date_match = _DATE_PATTERN.search(clause)
    if date_match:
        year_str, month_str, day_str = date_match.groups()
        event.year = int(year_str) if year_str else None
        event.month = int(month_str)
        event.day = int(day_str)
    else:
        event.year, event.month, event.day = last_date

    time_match = _TIME_PATTERN.search(clause)
    if time_match:
        period_kr, hour_str, minute_str = time_match.groups()
        event.period = _PERIOD_MAP.get(period_kr)
        event.hour = int(hour_str)
        event.minute = int(minute_str) if minute_str else 0

    location_match = _LOCATION_PATTERN.search(clause)
    if location_match:
        event.location = location_match.group(0)

    transit_match = _TRANSIT_NUMBER_PATTERN.search(clause)
    if transit_match:
        event.transit_number = transit_match.group(0)

    if "도착" in clause:
        event.direction = "arrival"
    elif "출발" in clause:
        event.direction = "departure"

    if any(keyword in clause for keyword in _TRAIN_KEYWORDS):
        event.type = "train"
    elif any(keyword in clause for keyword in _FLIGHT_KEYWORDS):
        event.type = "flight"
    elif event.location and event.location.endswith("공항"):
        event.type = "flight"
    elif event.location and event.location.endswith("역"):
        event.type = "train"

    return event


def _events_from_text(text: str) -> List[_Event]:
    events: List[_Event] = []
    last_date: DateParts = (None, None, None)

    for sentence in text.split("."):
        sentence = sentence.strip()
        if not sentence:
            continue
        for clause in sentence.split(","):
            clause = clause.strip()
            if not clause:
                continue

            event = _parse_clause(clause, last_date)
            if event.month is not None and event.day is not None:
                last_date = (event.year, event.month, event.day)

            if event.direction is not None and event.type is not None:
                events.append(event)

    return events


def _to_raw_booking(booking_type: str, departure: Optional[_Event], arrival: Optional[_Event]) -> RawBookingEvent:
    transit_number = (departure.transit_number if departure else None) or (arrival.transit_number if arrival else None)
    return RawBookingEvent(
        type=booking_type,
        transitNumber=transit_number,
        departureLocation=departure.location if departure else None,
        departureYear=departure.year if departure else None,
        departureMonth=departure.month if departure else None,
        departureDay=departure.day if departure else None,
        departurePeriod=departure.period if departure else None,
        departureHour=departure.hour if departure else None,
        departureMinute=departure.minute if departure else None,
        arrivalLocation=arrival.location if arrival else None,
        arrivalYear=arrival.year if arrival else None,
        arrivalMonth=arrival.month if arrival else None,
        arrivalDay=arrival.day if arrival else None,
        arrivalPeriod=arrival.period if arrival else None,
        arrivalHour=arrival.hour if arrival else None,
        arrivalMinute=arrival.minute if arrival else None,
    )


def extract_bookings(booking_text: str) -> List[RawBookingEvent]:
    events = _events_from_text(booking_text)

    bookings: List[RawBookingEvent] = []
    index = 0
    while index < len(events):
        current = events[index]
        next_event = events[index + 1] if index + 1 < len(events) else None

        if (
            current.direction == "departure"
            and next_event is not None
            and next_event.direction == "arrival"
            and next_event.type == current.type
        ):
            bookings.append(_to_raw_booking(current.type, current, next_event))
            index += 2
            continue

        if current.direction == "departure":
            bookings.append(_to_raw_booking(current.type, current, None))
        else:
            bookings.append(_to_raw_booking(current.type, None, current))
        index += 1

    return bookings
