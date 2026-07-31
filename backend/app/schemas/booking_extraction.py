from typing import List, Literal, Optional

from pydantic import BaseModel, Field

Period = Literal["AM", "PM"]


class RawBookingEvent(BaseModel):
    """AI 또는 규칙 기반 fallback이 생성하는 정규화 이전의 원시 추출 결과.

    연도/오전·오후 보정은 이 단계에서 하지 않고, 텍스트에 실제로 있는 값만 담는다.
    """

    type: Literal["flight", "train"]
    departureLocation: Optional[str] = None
    arrivalLocation: Optional[str] = None

    departureYear: Optional[int] = None
    departureMonth: Optional[int] = Field(default=None, ge=1, le=12)
    departureDay: Optional[int] = Field(default=None, ge=1, le=31)
    departurePeriod: Optional[Period] = None
    departureHour: Optional[int] = Field(default=None, ge=0, le=23)
    departureMinute: Optional[int] = Field(default=None, ge=0, le=59)

    arrivalYear: Optional[int] = None
    arrivalMonth: Optional[int] = Field(default=None, ge=1, le=12)
    arrivalDay: Optional[int] = Field(default=None, ge=1, le=31)
    arrivalPeriod: Optional[Period] = None
    arrivalHour: Optional[int] = Field(default=None, ge=0, le=23)
    arrivalMinute: Optional[int] = Field(default=None, ge=0, le=59)


class RawExtractionResult(BaseModel):
    bookings: List[RawBookingEvent]
