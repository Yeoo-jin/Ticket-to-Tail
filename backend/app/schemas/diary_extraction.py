from typing import List

from pydantic import BaseModel

from app.schemas.diary import StoryCard


class RawDiaryResult(BaseModel):
    """Gemini structured output이 그대로 채우는 원시 다이어리 결과 (검증 전)."""

    title: str
    diary: str
    summary: str
    snsPost: str
    photoCaptions: List[str]
    hashtags: List[str]
    storyCards: List[StoryCard]
