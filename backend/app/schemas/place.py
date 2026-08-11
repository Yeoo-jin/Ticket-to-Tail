from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.common import CompanionType

MealType = Literal["lunch", "dinner"]


class PlaceRecommendRequest(BaseModel):
    destination: str
    companionTypes: List[CompanionType]
    excludePlaceIds: List[str] = Field(default_factory=list)
    keepPlaceIds: List[str] = Field(default_factory=list)
    # 있으면 도착 시각 기준으로 점심/저녁 음식점 추천(restaurants)을 함께 계산한다.
    # 없으면 restaurants는 빈 객체로 반환한다 (app/utils/meal_recommendation.py 참고).
    arrivalTime: Optional[str] = None


class Place(BaseModel):
    """docs/api-spec.md / CLAUDE.md에 고정된 필드는 이름을 바꾸지 않는다.

    placeId, name, description, recommendationReason,
    estimatedDurationMinutes, tags, imageUrl 은 공통 계약이며,
    category/openTime/closeTime은 선택적으로 추가된 필드다.
    """

    placeId: str
    name: str
    description: str
    recommendationReason: str
    estimatedDurationMinutes: int
    tags: List[str]
    imageUrl: Optional[str] = None
    category: Optional[str] = None
    openTime: Optional[str] = None
    closeTime: Optional[str] = None


class PlaceRecommendData(BaseModel):
    places: List[Place]
    # 자동 선택("추천 관광지 자동 선택") 대상으로 추천하는 placeId 목록. places의 부분집합이며,
    # 내부 추천 점수 상위 항목(최대 3개)이다. 프론트는 점수를 직접 계산하지 않고 이 값만 사용한다.
    # 선택 필드가 아니라 항상 채워서 반환하는 정식 응답 필드이므로 기본값을 두지 않는다.
    autoSelectedPlaceIds: List[str]
    # 식사 시간대별 음식점 후보. 키는 "lunch"/"dinner" (recommend_meals() 결과 기준).
    # 요청에 arrivalTime이 없으면 빈 객체({})를 반환한다. places와 달리 카페(category:"카페")는
    # 관광지로 취급해 여기 포함되지 않고 places 쪽에 들어간다.
    restaurants: Dict[MealType, List[Place]] = Field(default_factory=dict)


class PlaceRecommendResponse(BaseModel):
    success: bool = True
    data: PlaceRecommendData


class PlaceRecord(BaseModel):
    """backend/app/data/places.json 원본 레코드 (내부 전용, API 응답 스키마와 다름).

    운영시간(openTime/closeTime)과 예상 체류시간은 실제 실시간 정보가 아니라
    데모/프로토타입용 샘플 값이다.
    """

    placeId: str
    name: str
    region: str
    district: str
    category: str
    description: str
    tags: List[str]
    companionTypes: List[CompanionType]
    recommendationReasons: Dict[str, str]
    estimatedDurationMinutes: int
    openTime: str
    closeTime: str
    indoor: bool
    address: str
    imageUrl: Optional[str] = None
    # category가 "음식점"인 레코드에만 값이 있다("lunch"/"dinner"). 그 외(관광지, 카페)는 null.
    mealType: Optional[MealType] = None
