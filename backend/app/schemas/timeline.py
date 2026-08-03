from typing import List, Literal, Optional

from pydantic import BaseModel

from app.schemas.booking import Booking
from app.schemas.common import CompanionType

TimelineItemType = Literal["arrival", "transport", "attraction", "rest", "departure"]
Pace = Literal["normal", "relaxed"]


class TimelineGenerateRequest(BaseModel):
    bookings: List[Booking]
    companionTypes: List[CompanionType]
    selectedPlaceIds: List[str]
    destination: str
    pace: Pace = "normal"
    seed: Optional[int] = None


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
