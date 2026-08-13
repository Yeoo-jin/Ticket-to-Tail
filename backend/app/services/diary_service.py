"""POST /api/diaries/generate 오케스트레이션.

흐름: multipart 요청 검증 → timeline·메모 정규화 → 사진 MIME·개수·용량 검증
→ Gemini 호출(실패 시 제한적 fallback) → Pydantic 검증 → 결과 정규화 → 응답 조립.
"""

import json
import logging
from typing import Dict, List, Optional

from fastapi import UploadFile
from pydantic import BaseModel, Field, ValidationError

from app.schemas.common import CompanionType
from app.schemas.diary import DiaryGenerateData, DiaryTone, PhotoCaption, StoryCard
from app.schemas.timeline import CustomPlaceInput, TimelineGenerateData, TimelineItem
from app.services import diary_ai_generator, diary_fallback
from app.services.ai_errors import AIConfigError, AIServiceError, AITransientError, AIValidationFailedError
from app.services.photo_validation import validate_and_read_photos
from app.services.place_data import load_places
from app.utils.companion_validation import validate_companion_types
from app.utils.errors import InvalidInputError

logger = logging.getLogger(__name__)

_TIMELINE_TYPE_LABEL_KO = {
    "arrival": "도착",
    "transport": "이동",
    "attraction": "관광",
    "rest": "휴식",
    "departure": "출발",
}

_COMPANION_LABEL_KO = {
    "solo": "혼자",
    "friends_couple": "친구·연인",
    "infant": "유아 동반",
    "senior": "고령자 동반",
    "mobility_impaired": "교통약자 동반",
    "pet": "반려동물 동반",
}

_MAX_HASHTAGS = 10


class _DiaryRequestPayload(BaseModel):
    companionTypes: List[CompanionType]
    timeline: TimelineGenerateData
    selectedPlaceIds: List[str]
    photoMemos: List[str] = Field(default_factory=list)
    # 사진이 타임라인 화면의 어떤 관광지·식사 항목에서 첨부됐는지(TimelineItem.id). photos와
    # 인덱스가 맞으며, 값이 없거나 일치하는 항목을 못 찾으면 None으로 둔다(연결 정보 없이도
    # 다이어리 생성 자체는 그대로 동작한다).
    photoTimelineItemIds: List[Optional[str]] = Field(default_factory=list)
    # 관광지·음식점 추천 대신 사용자가 직접 추가한 장소. 키는 프론트가 생성한 임시 ID이며
    # selectedPlaceIds에 이 ID가 들어있으면 places.json이 아니라 여기서 이름을 찾는다
    # (/api/timelines/generate의 customPlaces와 같은 방식).
    customPlaces: Dict[str, CustomPlaceInput] = Field(default_factory=dict)


def _load_json_field(raw: Optional[str], field_name: str, required: bool = True):
    if raw is None:
        if required:
            raise InvalidInputError(f"{field_name}이(가) 필요합니다.")
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError) as exc:
        raise InvalidInputError(f"{field_name}의 JSON 형식이 올바르지 않습니다.") from exc


def _format_timeline_lines(items: List[TimelineItem]) -> List[str]:
    lines = []
    for item in items:
        date_part = item.startTime[:10]
        start = item.startTime[11:16]
        end = item.endTime[11:16]
        label = _TIMELINE_TYPE_LABEL_KO.get(item.type, item.type)
        lines.append(f"- [{label}] {item.title} ({date_part} {start}~{end}) @ {item.location}")
    return lines


def _normalize_hashtags(tags: List[str]) -> List[str]:
    normalized: List[str] = []
    seen = set()
    for raw_tag in tags:
        text = raw_tag or ""
        # 모델이 여러 해시태그를 "#a#b#c"처럼 한 문자열로 합쳐 반환하는 경우를 대비해 "#" 기준으로 나눈다.
        for fragment in text.split("#"):
            fragment = fragment.strip()
            if not fragment:
                continue
            # 해시태그에는 공백이 들어갈 수 없으므로 첫 공백 이전 토큰만 사용한다.
            token = fragment.split()[0]
            tag = f"#{token}"
            if tag not in seen:
                seen.add(tag)
                normalized.append(tag)
    return normalized[:_MAX_HASHTAGS]


def _normalize_story_cards(cards: List[StoryCard], photo_count: int) -> List[StoryCard]:
    # AI 응답은 이미 검증을 거치고, fallback은 항상 유효한 카드만 만들지만
    # 방어적으로 photoIndexes 범위를 다시 한 번 걸러내고 id를 순서대로 재부여한다.
    normalized: List[StoryCard] = []
    for index, card in enumerate(cards):
        seen = set()
        valid_indexes = []
        for photo_index in card.photoIndexes:
            if 0 <= photo_index < photo_count and photo_index not in seen:
                seen.add(photo_index)
                valid_indexes.append(photo_index)
        normalized.append(
            card.model_copy(
                update={
                    "id": f"card-{index + 1}",
                    "photoIndexes": valid_indexes,
                    "accentWords": card.accentWords[:4],
                }
            )
        )
    return normalized


def _normalize_photo_captions(
    raw_captions: List[str], photo_count: int, photo_memos: List[str]
) -> List[PhotoCaption]:
    captions = list(raw_captions)[:photo_count]
    while len(captions) < photo_count:
        index = len(captions)
        fallback_text = photo_memos[index] if index < len(photo_memos) and photo_memos[index] else f"사진 {index + 1}"
        captions.append(fallback_text)
    return [PhotoCaption(photoIndex=index, caption=caption) for index, caption in enumerate(captions)]


async def generate_diary(
    *,
    destination: str,
    tone: DiaryTone,
    memo: Optional[str],
    companion_types_json: str,
    timeline_json: str,
    selected_place_ids_json: str,
    photo_memos_json: Optional[str],
    photo_timeline_item_ids_json: Optional[str] = None,
    custom_places_json: Optional[str] = None,
    photos: List[UploadFile],
) -> DiaryGenerateData:
    destination = (destination or "").strip()
    if not destination:
        raise InvalidInputError("여행 목적지(destination)를 입력해주세요.")

    companion_types_raw = _load_json_field(companion_types_json, "companionTypesJson")
    timeline_raw = _load_json_field(timeline_json, "timelineJson")
    selected_place_ids_raw = _load_json_field(selected_place_ids_json, "selectedPlaceIdsJson")
    photo_memos_raw = _load_json_field(photo_memos_json, "photoMemosJson", required=False) or []
    photo_timeline_item_ids_raw = (
        _load_json_field(photo_timeline_item_ids_json, "photoTimelineItemIdsJson", required=False) or []
    )
    custom_places_raw = _load_json_field(custom_places_json, "customPlacesJson", required=False) or {}

    try:
        payload = _DiaryRequestPayload.model_validate(
            {
                "companionTypes": companion_types_raw,
                "timeline": timeline_raw,
                "selectedPlaceIds": selected_place_ids_raw,
                "photoMemos": photo_memos_raw,
                "photoTimelineItemIds": photo_timeline_item_ids_raw,
                "customPlaces": custom_places_raw,
            }
        )
    except ValidationError as exc:
        raise InvalidInputError("요청 필드 형식이 올바르지 않습니다.") from exc

    validate_companion_types(payload.companionTypes)

    all_places = load_places()
    by_id = {place.placeId: place for place in all_places}
    unknown_ids = [
        pid for pid in payload.selectedPlaceIds if pid not in by_id and pid not in payload.customPlaces
    ]
    if unknown_ids:
        raise InvalidInputError(f"존재하지 않는 관광지 ID가 있습니다: {', '.join(unknown_ids)}")
    place_names = [
        by_id[pid].name if pid in by_id else payload.customPlaces[pid].name for pid in payload.selectedPlaceIds
    ]

    memo_text = (memo or "").strip()
    has_memo = bool(memo_text)
    has_photos = bool(photos)
    if not has_memo and not has_photos:
        raise InvalidInputError("여행 메모 또는 사진 중 하나는 반드시 입력해야 합니다.")

    photo_data = await validate_and_read_photos(photos)

    companion_labels = [_COMPANION_LABEL_KO.get(t, t) for t in payload.companionTypes]
    timeline_lines = _format_timeline_lines(payload.timeline.timeline)

    # 사진이 타임라인의 어떤 항목(관광지·식사)에서 첨부됐는지 사람이 읽을 수 있는 제목으로
    # 바꿔 AI에게 같이 전달한다 - "이 사진은 해운대암소갈비집 저녁식사에서 찍음"처럼 근거를
    # 붙여 캡션 정확도를 높이기 위함이다. 연결 정보가 없거나 못 찾으면 None으로 둔다.
    timeline_item_titles = {item.id: item.title for item in payload.timeline.timeline}
    photo_place_labels = [
        timeline_item_titles.get(item_id) if item_id else None for item_id in payload.photoTimelineItemIds
    ]

    generation_mode = "ai"
    warnings: List[str] = []

    try:
        raw_result = diary_ai_generator.generate_diary_with_ai(
            destination=destination,
            tone=tone,
            memo=memo_text,
            companion_type_labels=companion_labels,
            timeline_lines=timeline_lines,
            place_names=place_names,
            photo_memos=payload.photoMemos,
            photo_place_labels=photo_place_labels,
            photos=photo_data,
        )
    except (AIConfigError, AIServiceError, AITransientError, AIValidationFailedError) as exc:
        # 원래는 AITransientError/AIValidationFailedError(일시적 오류)만 fallback 대상이었지만,
        # 데모 도중 AI 키·설정 문제(AIConfigError)나 그 외 API 오류(AIServiceError)로 화면에
        # 에러가 그대로 노출되는 일이 없도록, Gemini 쪽에서 나는 오류는 종류에 상관없이
        # 전부 fallback으로 넘긴다.
        logger.warning(
            "AI 다이어리 생성 실패로 제한적 템플릿 fallback을 사용합니다 (사유: %s).", type(exc).__name__
        )
        raw_result = diary_fallback.generate_diary_fallback(
            destination=destination,
            memo=memo_text,
            place_names=place_names,
            photo_count=len(photo_data),
            photo_memos=payload.photoMemos,
        )
        generation_mode = "fallback"
        warnings.append("AI 호출에 실패해 제한적인 템플릿으로 다이어리를 생성했습니다.")

    photo_captions = _normalize_photo_captions(raw_result.photoCaptions, len(photo_data), payload.photoMemos)
    hashtags = _normalize_hashtags(raw_result.hashtags)
    story_cards = _normalize_story_cards(raw_result.storyCards, len(photo_data))

    return DiaryGenerateData(
        title=raw_result.title,
        diary=raw_result.diary,
        summary=raw_result.summary,
        snsPost=raw_result.snsPost,
        photoCaptions=photo_captions,
        hashtags=hashtags,
        storyCards=story_cards,
        generationMode=generation_mode,
        warnings=warnings,
    )
