"""동행 조건·pace별 타임라인 여유값 정책.

요청사항 4절의 예시를 코드 상수로 옮긴 것이며, 실측 데이터가 아니라
데모용으로 정한 기준값이다.

- solo: 기본 이동·휴식
- friends_couple: 사진·야경 태그가 있는 장소는 체류 시간을 늘림
- infant: 이동 여유·휴식시간을 가장 넉넉하게 늘리는 축에 속함
- senior: 이동·휴식시간 확대
- mobility_impaired: 이동·환승 여유가 가장 넉넉함
- pet: 반려동물 동반 가능한 장소만 사용하고, 휴식은 야외로 안내

동행 조건은 여러 개를 동시에 선택할 수 있다(예: infant + mobility_impaired).
이동 배수·휴식시간·정착 버퍼는 선택된 조건 중 "가장 넉넉한 값"을 채택하고,
체류시간 가산(친구·연인의 야경/사진 명소 여유 등)은 해당되는 조건을 반영하되
합리적인 상한(MAX_EXTRA_DWELL_MINUTES)을 둔다. 어떤 조건도 무시하지 않는다.
"""

from typing import Dict, Sequence

# 도착/출발 예매 시각 전후로 남겨두는 여유시간(정착·수속 등).
TRAVEL_BUFFER_MINUTES: Dict[str, int] = {
    "solo": 15,
    "friends_couple": 15,
    "infant": 30,
    "senior": 30,
    "mobility_impaired": 45,
    "pet": 20,
}

# 관광지 사이에 넣는 기본 휴식시간(분).
REST_BASE_MINUTES: Dict[str, int] = {
    "solo": 15,
    "friends_couple": 20,
    "infant": 40,
    "senior": 35,
    "mobility_impaired": 30,
    "pet": 25,
}

# travel_time_service가 계산한 기본 이동시간에 곱하는 배수.
TRAVEL_TIME_MULTIPLIER: Dict[str, float] = {
    "solo": 1.0,
    "friends_couple": 1.0,
    "infant": 1.3,
    "senior": 1.3,
    "mobility_impaired": 1.6,
    "pet": 1.2,
}

PACE_MULTIPLIER: Dict[str, float] = {
    "normal": 1.0,
    "relaxed": 1.3,
}

# friends_couple 동행일 때 체류 여유를 추가로 주는 태그.
PHOTO_SPOT_TAGS = ("야경", "사진 명소")
PHOTO_SPOT_EXTRA_MINUTES = 15

# 체류시간 가산(extra dwell)에 두는 합리적 상한. 현재는 friends_couple 규칙 하나뿐이지만,
# 이후 조건이 늘어나도 한 장소 체류시간이 과도하게 늘어나지 않도록 상한을 둔다.
MAX_EXTRA_DWELL_MINUTES = 30


def travel_buffer_minutes(companion_types: Sequence[str], pace: str) -> int:
    base = max(TRAVEL_BUFFER_MINUTES[t] for t in companion_types)
    return round(base * PACE_MULTIPLIER[pace])


def rest_minutes(companion_types: Sequence[str], pace: str) -> int:
    base = max(REST_BASE_MINUTES[t] for t in companion_types)
    return round(base * PACE_MULTIPLIER[pace])


def travel_multiplier(companion_types: Sequence[str], pace: str) -> float:
    base = max(TRAVEL_TIME_MULTIPLIER[t] for t in companion_types)
    return base * PACE_MULTIPLIER[pace]


def extra_dwell_minutes(companion_types: Sequence[str], tags, pace: str) -> int:
    total = 0
    if "friends_couple" in companion_types and any(tag in tags for tag in PHOTO_SPOT_TAGS):
        total += round(PHOTO_SPOT_EXTRA_MINUTES * PACE_MULTIPLIER[pace])
    return min(total, MAX_EXTRA_DWELL_MINUTES)
