from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.booking import Booking
from app.schemas.common import CompanionType
from app.schemas.place import MealType, Place

TimelineItemType = Literal["arrival", "transport", "attraction", "meal", "rest", "departure", "accommodation"]
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
    # 입력하면 매일 마지막 일정 뒤에 숙소로 이동하는 항목이 추가되고, 다음날은 숙소에서
    # 출발하는 것으로 이동시간을 계산한다. 입력하지 않으면 기존과 동일하게(거점 기준) 동작한다.
    accommodation: Optional[CustomPlaceInput] = None
    # 항공↔철도 환승 대기 시간에 들를 곳을 사용자가 직접 검색해 지정한 경우. 있으면
    # 서울역·인천공항 같은 데이터 보유 거점이 아니어도, 그리고 큐레이션된 후보보다
    # 우선해서 이 장소를 채운다(첫 번째로 시간이 맞는 환승 구간 하나에만 적용).
    layoverPlace: Optional[CustomPlaceInput] = None


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


class StationFacility(BaseModel):
    """여정에 포함된 기차역의 편의시설 정보(공공데이터포털 한국철도공사_편의시설정보).
    동행조건에 "infant"가 없으면 hasNursingRoom은 항상 null이고, "mobility_impaired"가
    없으면 hasAccessibleRestroom/hasWheelchairRamp/wheelchairLiftCount는 항상 null이다
    (요청하지 않은 정보와, 조회했지만 실제로 없는 시설을 구분하기 위함)."""

    stationName: str
    hasElevator: bool
    elevatorCount: int
    escalatorCount: int
    hasGeneralRestroom: bool
    hasInfoCenter: bool
    hasNursingRoom: Optional[bool] = None
    hasAccessibleRestroom: Optional[bool] = None
    hasWheelchairRamp: Optional[bool] = None
    wheelchairLiftCount: Optional[int] = None


class TimelineGenerateData(BaseModel):
    timeline: List[TimelineItem]
    summary: TimelineSummary
    warnings: List[str]
    # 유아 동반/교통약자 동반 둘 다 아니면 항상 빈 배열이다. 조회 대상 역이 데이터에
    # 없거나 외부 API 호출이 실패해도 예외 없이 그 역만 빠진 채로 채워진다.
    stationFacilities: List[StationFacility] = Field(default_factory=list)


class TimelineGenerateResponse(BaseModel):
    success: bool = True
    data: TimelineGenerateData


class LayoverCandidatesRequest(BaseModel):
    """항공↔철도 환승 구간에 넣을 수 있는 추천 후보를 미리 보여주기 위한 요청.
    타임라인을 실제로 만들기 전(동행 조건을 아직 안 골랐을 수도 있는 예매정보 확인
    화면)에 호출하므로 companionTypes는 선택值이다."""

    bookings: List[Booking]
    companionTypes: List[CompanionType] = Field(default_factory=list)


class LayoverCandidatesData(BaseModel):
    # 데이터를 가진 거점(서울역/인천공항 등)과 겹치는 환승 구간을 못 찾았으면 null이고
    # candidates도 빈 배열이다 — 이때 프론트는 직접 검색 입력만 보여주면 된다.
    hubRegion: Optional[str] = None
    windowMinutes: Optional[int] = None
    candidates: List[Place] = Field(default_factory=list)


class LayoverCandidatesResponse(BaseModel):
    success: bool = True
    data: LayoverCandidatesData
