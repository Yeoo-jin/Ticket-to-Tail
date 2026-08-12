"""예매정보(bookings)에서 여행이 걸쳐 있는 날짜 목록과 도착/출발 경계 시각을 계산한다.

관광지·음식점 추천(day별)과 타임라인 생성이 "여행이 며칠짜리인지"를 똑같은 기준으로
계산해야 하므로, 그 기준(가장 늦은 도착 / 그 이후 가장 이른 출발)을 이 모듈 하나로 모은다.
"""

from datetime import date, datetime, timedelta
from typing import List, Optional, Sequence, Tuple

from app.schemas.booking import Booking


def _parse(value: str) -> datetime:
    return datetime.fromisoformat(value)


def compute_trip_boundary(bookings: Sequence[Booking]) -> Tuple[Optional[datetime], Optional[datetime]]:
    """가장 늦은 도착 시각(관광 시작 시점)과, 그 이후 가장 이른 출발 시각(관광 종료 시점)을 반환한다.

    도착 시각이 하나도 없으면 (None, None). 도착 이후의 출발 예매가 없으면
    (arrival, None) — 그날 하루만 여행하는 것으로 본다.
    """
    arrival_times = [_parse(b.arrivalTime) for b in bookings if b.arrivalTime]
    if not arrival_times:
        return None, None
    arrival = max(arrival_times)

    departure_times = [_parse(b.departureTime) for b in bookings if b.departureTime]
    later_departures = [d for d in departure_times if d > arrival]
    departure = min(later_departures) if later_departures else None

    return arrival, departure


def compute_trip_dates(bookings: Sequence[Booking]) -> List[date]:
    """여행 시작일~종료일(양 끝 포함) 날짜 목록을 반환한다. 도착 시각이 없으면 빈 리스트."""
    arrival, departure = compute_trip_boundary(bookings)
    if arrival is None:
        return []

    start_date = arrival.date()
    end_date = departure.date() if departure else start_date
    if end_date < start_date:
        end_date = start_date

    days = (end_date - start_date).days
    return [start_date + timedelta(days=i) for i in range(days + 1)]
