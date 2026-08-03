"""AI 호출이 실패했을 때만 사용하는 제한적 템플릿 기반 다이어리 생성.

기본 경로가 아니며, 네트워크 오류·타임아웃·429·5xx 또는 재시도 후에도
검증 실패한 경우에만 diary_service가 호출한다. 사진을 실제로 분석하지
않으므로, 사진을 본 것처럼 표현하지 않는다.
"""

from typing import List, Optional, Sequence

from app.schemas.diary import StoryCard
from app.schemas.diary_extraction import RawDiaryResult

_MAX_FALLBACK_PHOTO_CARDS = 3


def _build_fallback_story_cards(
    *,
    destination: str,
    place_text: str,
    photo_count: int,
    photo_memos: Sequence[Optional[str]],
) -> List[StoryCard]:
    cards: List[StoryCard] = [
        StoryCard(
            id="cover",
            type="cover",
            photoIndexes=[0] if photo_count else [],
            headline=f"{destination} 여행",
            body=f"{destination}에서의 여행을 기록으로 남깁니다.",
            caption="",
            locationLabel=destination,
            dateLabel=None,
            accentWords=[],
            layoutVariant="full-bleed",
        )
    ]

    # 사진이 여러 장이면 일부(최대 3장)를 개별 카드로 보여준다.
    # 사진이 1장뿐이면 cover에서 이미 사용했으므로 무리하게 반복하지 않는다.
    for index in range(1, min(photo_count, _MAX_FALLBACK_PHOTO_CARDS)):
        note = photo_memos[index] if index < len(photo_memos) and photo_memos[index] else None
        cards.append(
            StoryCard(
                id=f"photo-{index}",
                type="single_photo",
                photoIndexes=[index],
                headline=f"기록 {index + 1}",
                body=note or f"{destination} 여행 중의 한 장면입니다.",
                caption=note or f"사진 {index + 1}",
                locationLabel=None,
                dateLabel=None,
                accentWords=[],
                layoutVariant="framed",
            )
        )

    cards.append(
        StoryCard(
            id="quote",
            type="quote",
            photoIndexes=[],
            headline="기억에 남는 순간",
            body=place_text if place_text else f"{destination} 여행",
            caption="",
            locationLabel=None,
            dateLabel=None,
            accentWords=[],
            layoutVariant="text-only",
        )
    )
    cards.append(
        StoryCard(
            id="ending",
            type="ending",
            photoIndexes=[],
            headline="여행을 마치며",
            body=f"{destination} 여행이 이렇게 마무리되었습니다.",
            caption="",
            locationLabel=None,
            dateLabel=None,
            accentWords=[],
            layoutVariant="text-only",
        )
    )
    return cards[:6]


def generate_diary_fallback(
    *,
    destination: str,
    memo: str,
    place_names: Sequence[str],
    photo_count: int,
    photo_memos: Sequence[Optional[str]],
) -> RawDiaryResult:
    place_text = ", ".join(place_names) if place_names else destination

    title = f"{destination} 여행 기록"

    diary_parts = [f"{destination}으로 다녀온 여행을 기록합니다."]
    if place_names:
        diary_parts.append(f"방문한 곳: {place_text}.")
    if memo:
        diary_parts.append(memo)
    diary = " ".join(diary_parts)

    summary = f"{destination} 여행 요약: {place_text}" if place_names else f"{destination} 여행 요약"
    sns_post = f"{destination} 여행 다녀왔어요! {place_text}".strip()

    captions: List[str] = []
    for index in range(photo_count):
        note = photo_memos[index] if index < len(photo_memos) and photo_memos[index] else None
        captions.append(note if note else f"사진 {index + 1}")

    hashtags = [f"#{destination}여행", "#국내여행", "#여행기록"]

    story_cards = _build_fallback_story_cards(
        destination=destination,
        place_text=place_text,
        photo_count=photo_count,
        photo_memos=photo_memos,
    )

    return RawDiaryResult(
        title=title,
        diary=diary,
        summary=summary,
        snsPost=sns_post,
        photoCaptions=captions,
        hashtags=hashtags,
        storyCards=story_cards,
    )
