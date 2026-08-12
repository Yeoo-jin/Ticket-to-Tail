"""여행 날짜별로 추천할 끼니(아침/점심/저녁)를 계산한다.

정책 (요청사항 기준):
- 도착일: 도착 시각 "이후"에 아직 먹을 수 있는 끼니만 추천
  - 09시 이전 도착: 아침+점심+저녁
  - 09~13시 도착: 점심+저녁
  - 13시 이후 도착: 저녁만
- 출발일(도착일과 다른 날, 즉 여행 마지막 날): 출발 시각 "이전"에 이미 먹을 시간이
  있었던 끼니만 추천 (도착일 규칙의 대칭)
  - 09시 이전 출발: 없음
  - 09~13시 출발: 아침만
  - 13~19시 출발: 아침+점심
  - 19시 이후 출발: 아침+점심+저녁
- 도착일이면서 동시에 출발일(당일치기 여행): 위 두 규칙의 교집합
- 그 외 중간 날짜: 항상 아침+점심+저녁 모두
"""

from datetime import date, datetime, time
from typing import Dict, List, Literal, Optional, Sequence

MealType = Literal["breakfast", "lunch", "dinner"]

_ALL_MEALS: List[MealType] = ["breakfast", "lunch", "dinner"]

_BREAKFAST_CUTOFF = time(9, 0)
_LUNCH_CUTOFF = time(13, 0)
_DINNER_CUTOFF = time(19, 0)


def _meals_after_arrival(arrival_time: datetime) -> List[MealType]:
    t = arrival_time.time()
    if t < _BREAKFAST_CUTOFF:
        return ["breakfast", "lunch", "dinner"]
    if t < _LUNCH_CUTOFF:
        return ["lunch", "dinner"]
    return ["dinner"]


def _meals_before_departure(departure_time: datetime) -> List[MealType]:
    t = departure_time.time()
    if t < _BREAKFAST_CUTOFF:
        return []
    if t < _LUNCH_CUTOFF:
        return ["breakfast"]
    if t < _DINNER_CUTOFF:
        return ["breakfast", "lunch"]
    return ["breakfast", "lunch", "dinner"]


def recommend_daily_meals(
    trip_dates: Sequence[date],
    arrival_time: datetime,
    departure_time: Optional[datetime],
) -> Dict[date, List[MealType]]:
    """여행 날짜별로 추천할 끼니 목록을 계산해 {날짜: [끼니, ...]} 형태로 반환한다."""
    if not trip_dates:
        return {}

    start_date = trip_dates[0]
    end_date = trip_dates[-1]

    result: Dict[date, List[MealType]] = {}
    for current in trip_dates:
        is_arrival_day = current == start_date
        # 출발일은 "도착일과 다른, 여행 마지막 날"만 해당한다. 도착일과 마지막 날이
        # 같은 날(당일치기)이면 두 규칙 모두 적용해 교집합을 구한다.
        is_departure_day = current == end_date and departure_time is not None

        if is_arrival_day and is_departure_day:
            arrival_meals = set(_meals_after_arrival(arrival_time))
            departure_meals = set(_meals_before_departure(departure_time))
            meals = [meal for meal in _ALL_MEALS if meal in arrival_meals and meal in departure_meals]
        elif is_arrival_day:
            meals = _meals_after_arrival(arrival_time)
        elif is_departure_day:
            meals = _meals_before_departure(departure_time)
        else:
            meals = list(_ALL_MEALS)

        result[current] = meals

    return result
