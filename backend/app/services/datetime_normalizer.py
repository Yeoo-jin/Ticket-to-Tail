"""추출된 원시 날짜·시간 값을 날짜 정책에 따라 ISO 8601로 정규화한다.

정책 (요청 사항 기준):
1. 이벤트에 연도가 있으면 그 연도를 사용한다.
2. 연도가 없으면, 텍스트에서 가장 먼저 등장한 연도를 이어서 사용한다.
3. 텍스트 전체에 연도가 전혀 없으면 Asia/Seoul 기준 현재 연도를 사용한다.
4. 위 연도 보완은 missingFields의 날짜 누락으로 취급하지 않는다 (missing_fields.py에서 처리).
5. 오전 12시는 0시, 오후 12시는 12시로 변환하고, 오전/오후가 있으면 24시간제로 변환한다.
6. 입력에 없는 월, 일, 시각, 장소는 추측하지 않는다 (월/일/시는 원시 값이 없으면 그대로 null 유지).
7. 날짜(월/일)는 앞에서 확인된 이벤트에만 있고 뒤 이벤트에는 시간(또는 장소)만 있으면,
   같은 이동 맥락으로 보고 마지막으로 확인된 날짜를 이어서 적용한다 (AI가 직접 추측하게
   두지 않고, provider와 무관하게 이 모듈에서 결정적으로 처리한다).
"""

from typing import List, Optional

from app.schemas.booking import Booking
from app.schemas.booking_extraction import RawBookingEvent
from app.utils.time_provider import now_kst
from datetime import datetime


def apply_date_carry_forward(raw_events: List[RawBookingEvent]) -> List[RawBookingEvent]:
    """정책 7 적용: 날짜(월/일) 없이 시간·장소만 있는 이벤트에 직전 날짜를 이어서 채운다.

    출발/도착 모두 없는(=해당 방향 자체가 없는) 경우는 그대로 두어
    missing_fields.py의 "해당 없음" 판정에 영향을 주지 않는다.
    """
    adjusted = [event.model_copy() for event in raw_events]
    last_month_day: Optional[tuple] = None

    for event in adjusted:
        for prefix in ("departure", "arrival"):
            month = getattr(event, f"{prefix}Month")
            day = getattr(event, f"{prefix}Day")
            hour = getattr(event, f"{prefix}Hour")
            location = getattr(event, f"{prefix}Location")

            if month is not None and day is not None:
                last_month_day = (month, day)
                continue

            if last_month_day is not None and (hour is not None or location is not None):
                setattr(event, f"{prefix}Month", last_month_day[0])
                setattr(event, f"{prefix}Day", last_month_day[1])

    return adjusted


def _resolve_document_year(raw_events: List[RawBookingEvent]) -> Optional[int]:
    for event in raw_events:
        if event.departureYear is not None:
            return event.departureYear
        if event.arrivalYear is not None:
            return event.arrivalYear
    return None


def _to_24_hour(period: Optional[str], hour: Optional[int]) -> Optional[int]:
    if hour is None:
        return None
    if period == "AM":
        return 0 if hour == 12 else hour
    if period == "PM":
        return 12 if hour == 12 else hour + 12
    return hour


def _resolve_year(explicit_year: Optional[int], month: Optional[int], day: Optional[int], fallback_year: int) -> Optional[int]:
    if month is None or day is None:
        return None
    if explicit_year is not None:
        return explicit_year
    return fallback_year


def _build_iso_datetime(
    year: Optional[int], month: Optional[int], day: Optional[int], hour: Optional[int], minute: Optional[int]
) -> Optional[str]:
    if year is None or month is None or day is None or hour is None:
        return None
    resolved_minute = 0 if minute is None else minute
    try:
        dt = datetime(year=year, month=month, day=day, hour=hour, minute=resolved_minute)
    except ValueError:
        return None
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def _clean_location(value: Optional[str]) -> Optional[str]:
    # 사진(OCR) 추출 결과에는 앞뒤 공백이 섞여 나오는 경우가 있고, 이게 남아있으면
    # deriveDestinationGuess(프론트)의 정확히 일치하는 지역명 매칭이나 환승 거점 매칭이
    # 조용히 실패한다. 텍스트 입력 경로도 동일하게 거쳐 일관되게 처리한다.
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def normalize_bookings(raw_events: List[RawBookingEvent]) -> List[Booking]:
    fallback_year = _resolve_document_year(raw_events)
    if fallback_year is None:
        fallback_year = now_kst().year

    bookings: List[Booking] = []
    for event in raw_events:
        departure_year = _resolve_year(event.departureYear, event.departureMonth, event.departureDay, fallback_year)
        arrival_year = _resolve_year(event.arrivalYear, event.arrivalMonth, event.arrivalDay, fallback_year)

        departure_hour = _to_24_hour(event.departurePeriod, event.departureHour)
        arrival_hour = _to_24_hour(event.arrivalPeriod, event.arrivalHour)

        departure_time = _build_iso_datetime(
            departure_year, event.departureMonth, event.departureDay, departure_hour, event.departureMinute
        )
        arrival_time = _build_iso_datetime(
            arrival_year, event.arrivalMonth, event.arrivalDay, arrival_hour, event.arrivalMinute
        )

        bookings.append(
            Booking(
                type=event.type,
                transitNumber=event.transitNumber,
                departureLocation=_clean_location(event.departureLocation),
                arrivalLocation=_clean_location(event.arrivalLocation),
                departureTime=departure_time,
                arrivalTime=arrival_time,
            )
        )

    return bookings
