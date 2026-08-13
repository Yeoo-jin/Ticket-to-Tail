from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.booking import Booking
from app.schemas.common import CompanionType

MealType = Literal["breakfast", "lunch", "dinner"]


class PlaceRecommendRequest(BaseModel):
    destination: str
    companionTypes: List[CompanionType]
    # 여행 날짜·끼니 종류 계산에 쓴다 (app/utils/trip_dates.py, app/utils/meal_recommendation.py 참고).
    # 없으면 날짜별 추천을 계산할 수 없어 restaurants/places 모두 날짜별로 빈 값이 된다.
    bookings: List[Booking] = Field(default_factory=list)
    excludePlaceIds: List[str] = Field(default_factory=list)
    # targetDate가 있는 요청에서만 사용한다 (해당 날짜의 관광지 후보만 다시 뽑을 때,
    # 이미 선택한 관광지를 유지하기 위함). 음식점은 끼니당 1곳만 고르므로 keep 대상이 아니다.
    keepPlaceIds: List[str] = Field(default_factory=list)
    # 있으면 이 날짜(YYYY-MM-DD) 하나만 다시 계산한다 ("다른 후보 추천받기" 새로고침용).
    # 없으면 bookings 기준 여행 전체 날짜를 한 번에 계산한다.
    targetDate: Optional[str] = None


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
    # 지도(동선 직선 표시)용 좌표. scripts/geocode_places.py로 주소를 한 번 변환해
    # places.json에 미리 채워둔다. 좌표가 없는 장소(예: 사용자가 직접 입력한 장소)는 null.
    lat: Optional[float] = None
    lng: Optional[float] = None
    # 선택 필드. 이 후보를 CustomPlaceInput(name/address/lat/lng)과 같은 형태로 그대로
    # 재사용해야 하는 화면(예: 환승 대기 장소 추천)에서만 채워 보낸다.
    address: Optional[str] = None


class PlaceRecommendData(BaseModel):
    # 키는 날짜(YYYY-MM-DD). 요청에 targetDate가 있으면 그 날짜 하나만 채워지고,
    # 없으면 bookings 기준 여행 전체 날짜가 채워진다. 하루당 정확히 3개(가능한 경우)를 담는다.
    placesByDay: Dict[str, List[Place]] = Field(default_factory=dict)
    # 날짜별 자동 선택("추천 관광지 자동 선택") 대상 placeId 목록. placesByDay의 부분집합.
    autoSelectedPlaceIdsByDay: Dict[str, List[str]] = Field(default_factory=dict)
    # 날짜별 식사 시간대별 음식점 후보. 안쪽 키는 "breakfast"/"lunch"/"dinner"
    # (recommend_daily_meals() 결과 기준, 그날 해당하지 않는 끼니는 키 자체가 없다).
    # placesByDay와 달리 카페(category:"카페")는 관광지로 취급해 여기 포함되지 않는다.
    restaurantsByDay: Dict[str, Dict[MealType, List[Place]]] = Field(default_factory=dict)


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
    # scripts/geocode_places.py가 address를 카카오 로컬 API로 변환해 채워 넣는다.
    # 아직 변환 전이거나 지오코딩에 실패한 레코드는 null일 수 있다.
    lat: Optional[float] = None
    lng: Optional[float] = None
