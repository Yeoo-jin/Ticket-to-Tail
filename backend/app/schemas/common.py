from typing import Literal

from pydantic import BaseModel

# docs/api-spec.md "동행 조건 선택값" (타임라인 생성 섹션에 정의되어 있으나
# 관광지 추천 등 companionTypes를 쓰는 다른 API에서도 동일하게 재사용한다).
# 최종 서비스 기획에 맞춰 friends/couple은 friends_couple로 통합된 6개 값만 유효하다.
CompanionType = Literal[
    "solo",
    "friends_couple",
    "infant",
    "senior",
    "mobility_impaired",
    "pet",
]


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail
