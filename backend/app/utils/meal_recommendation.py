"""예매정보의 도착 시각을 기준으로 점심/저녁 중 추천할 식사를 결정한다.

아직 어떤 API 응답에도 연결되지 않은 독립 함수다. 호출 시점·연결 위치(예:
타임라인 생성 로직)는 추후 별도로 결정한다.

정책:
- 13시 이전 도착: 점심 + 저녁 모두 추천
- 13시 이후(13시 정각 포함) 도착: 저녁만 추천
"""

from datetime import datetime, time
from typing import List, Literal

MealType = Literal["lunch", "dinner"]

_LUNCH_CUTOFF = time(13, 0)


def recommend_meals(arrival_time: str) -> List[MealType]:
    """도착 시각(ISO 8601 문자열, Booking.arrivalTime과 동일 형식)을 받아
    추천할 식사 목록을 반환한다.
    """
    arrival_dt = datetime.fromisoformat(arrival_time)

    if arrival_dt.time() < _LUNCH_CUTOFF:
        return ["lunch", "dinner"]
    return ["dinner"]
