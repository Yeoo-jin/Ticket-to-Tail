from typing import List, Literal, Optional

from pydantic import BaseModel, Field

DiaryTone = Literal["emotional", "plain", "cheerful", "concise"]
GenerationMode = Literal["ai", "fallback"]

# storyCards의 카드 종류와 레이아웃 변형. AI/fallback 양쪽 모두 이 값만 사용한다.
StoryCardType = Literal["cover", "single_photo", "collage", "quote", "ending"]
StoryCardLayoutVariant = Literal["full-bleed", "framed", "split-2", "asymmetric", "text-only"]


class PhotoCaption(BaseModel):
    photoIndex: int
    caption: str


class StoryCard(BaseModel):
    id: str
    type: StoryCardType
    photoIndexes: List[int] = Field(default_factory=list)
    headline: str
    body: str
    caption: str = ""
    locationLabel: Optional[str] = None
    dateLabel: Optional[str] = None
    accentWords: List[str] = Field(default_factory=list)
    layoutVariant: StoryCardLayoutVariant


class DiaryGenerateData(BaseModel):
    title: str
    diary: str
    summary: str
    snsPost: str
    photoCaptions: List[PhotoCaption]
    hashtags: List[str]
    storyCards: List[StoryCard]
    generationMode: GenerationMode
    warnings: List[str]


class DiaryGenerateResponse(BaseModel):
    success: bool = True
    data: DiaryGenerateData
