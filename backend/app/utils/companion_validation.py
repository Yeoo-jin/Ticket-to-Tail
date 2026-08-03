"""companionTypes 배열에 공통으로 적용하는 검증 규칙.

/api/places/recommend, /api/timelines/generate 등 companionTypes를 받는
모든 API에서 동일하게 사용한다.

정책:
- 최소 1개 이상 선택해야 한다.
- solo는 "동행인 없음"을 의미하므로 다른 조건과 함께 선택할 수 없다
  (["solo"]는 허용, ["solo","infant"]는 거부). solo가 아닌 조건끼리는
  자유롭게 여러 개 선택할 수 있다.
"""

from typing import Sequence

from app.utils.errors import InvalidInputError

SOLO = "solo"


def validate_companion_types(companion_types: Sequence[str]) -> None:
    if not companion_types:
        raise InvalidInputError("동행 조건(companionTypes)을 하나 이상 선택해주세요.")

    unique_types = set(companion_types)
    if SOLO in unique_types and len(unique_types) > 1:
        raise InvalidInputError("solo는 다른 동행 조건과 함께 선택할 수 없습니다.")
