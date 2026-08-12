from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.booking import Booking
from app.schemas.common import CompanionType
from app.schemas.place import MealType

TimelineItemType = Literal["arrival", "transport", "attraction", "meal", "rest", "departure"]
Pace = Literal["normal", "relaxed"]


class DaySelection(BaseModel):
    """하루치 선택 결과. /api/places/recommend가 날짜별로 준 후보 중에서
    프론트가 고른 것을 그대로 다시 보낸다."""

    date: str  # YYYY-MM-DD
    # 그날 방문할 관광지(카페 포함) placeId 목록.
    placeIds: List[str] = Field(default_factory=list)
    # 그날 끼니별로 선택한 음식점 placeId. 키는 해당 날짜에 추천된 끼니만 있을 수 있고,
    # "선택 안 함"을 고른 끼니는 키 자체가 없다(끼니당 최대 1곳).
    restaurantIds: Dict[MealType, str] = Field(default_factory=dict)


class CustomPlaceInput(BaseModel):
    """추천 후보 대신 사용자가 직접 입력한 장소. 카카오 장소검색으로 고르면 address/lat/lng가
    함께 오고, 이름만 직접 타이핑했다면 address/lat/lng는 없을 수 있다(좌표가 없으면
    이동시간은 거점 기준 기본값으로 추정되고 지도에는 표시되지 않는다)."""

    name: str
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class TimelineGenerateRequest(BaseModel):
    bookings: List[Booking]
    companionTypes: List[CompanionType]
    days: List[DaySelection]
    destination: str
    pace: Pace = "normal"
    seed: Optional[int] = None
    # 키는 프론트가 생성한 임시 ID(days[].placeIds/restaurantIds에서 이 ID로 참조).
    # places.json에서 찾을 수 없는 ID를 만나면 여기서 찾아, 운영시간 제약 없이 기본
    # 체류시간(60분)으로 다룬다.
    customPlaces: Dict[str, CustomPlaceInput] = Field(default_factory=dict)


class TimelineItem(BaseModel):
    id: str
    type: TimelineItemType
    startTime: str
    endTime: str
    title: str
    placeId: Optional[str] = None
    location: str
    description: str
    # 예매정보에서 온 정확한 시각(False)인지, 백엔드가 데모 규칙으로 추정한 값(True)인지 구분한다.
    # transport/attraction/rest 항목은 estimated=True, 실제 예매 시각을 그대로 쓰는
    # arrival/departure(및 예매편 자체의 transport)는 estimated=False.
    estimated: bool
    # attraction/meal 항목에만 있다(장소 좌표가 있는 경우). 지도(동선 직선 표시)에 쓰며,
    # 공유된 타임라인처럼 관광지 추천 응답을 다시 참조할 수 없는 화면에서도 지도를 그릴 수 있게 한다.
    lat: Optional[float] = None
    lng: Optional[float] = None


class TimelineSummary(BaseModel):
    placeCount: int
    sightseeingMinutes: int
    estimatedTravelMinutes: int
    companionTypes: List[CompanionType]
    pace: Pace


class TimelineGenerateData(BaseModel):
    timeline: List[TimelineItem]
    summary: TimelineSummary
    warnings: List[str]


class TimelineGenerateResponse(BaseModel):
    success: bool = True
    data: TimelineGenerateData
