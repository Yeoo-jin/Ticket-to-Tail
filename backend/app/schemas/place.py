from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from app.schemas.common import CompanionType


class PlaceRecommendRequest(BaseModel):
    destination: str
    companionTypes: List[CompanionType]
    excludePlaceIds: List[str] = Field(default_factory=list)
    keepPlaceIds: List[str] = Field(default_factory=list)


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
