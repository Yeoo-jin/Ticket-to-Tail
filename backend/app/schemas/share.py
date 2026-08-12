from typing import List

from pydantic import BaseModel, Field

from app.schemas.timeline import TimelineItem, TimelineSummary


class ShareTimelineRequest(BaseModel):
    destination: str
    timeline: List[TimelineItem]
    summary: TimelineSummary


class ShareCreateData(BaseModel):
    shareId: str


class ShareCreateResponse(BaseModel):
    success: bool = True
    data: ShareCreateData


class SharedTimelineData(BaseModel):
    destination: str
    timeline: List[TimelineItem]
    summary: TimelineSummary
    createdAt: str


class SharedTimelineResponse(BaseModel):
    success: bool = True
    data: SharedTimelineData


class SharedDiaryPhoto(BaseModel):
    # 백엔드가 정적 파일로 저장한 공유용 사진의 절대 URL(/static/shares/... 경로).
    url: str
    caption: str = ""


class SharedDiaryData(BaseModel):
    destination: str
    title: str
    diary: str
    summary: str
    snsPost: str
    hashtags: List[str] = Field(default_factory=list)
    photos: List[SharedDiaryPhoto] = Field(default_factory=list)
    createdAt: str


class SharedDiaryResponse(BaseModel):
    success: bool = True
    data: SharedDiaryData
