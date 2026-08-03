"""Gemini 기반 여행 다이어리 생성.

booking 쪽 AI_PROVIDER 디스패처는 건드리지 않고, 다이어리는 Gemini를
직접 호출하는 별도 서비스로 분리한다(이미지 첨부가 필요하기 때문).
"""

import logging
from typing import Optional, Sequence, Tuple

import httpx
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import ValidationError

from app.prompts.diary_prompt import SYSTEM_PROMPT, build_user_prompt
from app.schemas.diary_extraction import RawDiaryResult
from app.services.ai_errors import AIConfigError, AIServiceError, AITransientError, AIValidationFailedError
from app.services.ai_providers.gemini_provider import get_gemini_client, get_gemini_model_name

logger = logging.getLogger(__name__)

_MIN_STORY_CARDS = 3
_MAX_STORY_CARDS = 6


def _build_config() -> "types.GenerateContentConfig":
    return types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        response_mime_type="application/json",
        response_schema=RawDiaryResult,
    )


def _call_model(client: "genai.Client", model: str, contents: list):
    try:
        return client.models.generate_content(model=model, contents=contents, config=_build_config())
    except (httpx.TimeoutException, httpx.ConnectError) as exc:
        logger.warning("Gemini API 네트워크 오류/타임아웃이 발생했습니다.")
        raise AITransientError("Gemini API 네트워크 오류 또는 타임아웃") from exc
    except genai_errors.APIError as exc:
        code = getattr(exc, "code", None)
        logger.warning("Gemini API 오류 응답 (code=%s)", code)
        if code in (401, 403):
            raise AIConfigError("Gemini 인증 오류로 요청을 처리할 수 없습니다.") from exc
        if code == 429 or (isinstance(code, int) and code >= 500):
            raise AITransientError(f"Gemini API 일시적 오류 (code={code})") from exc
        raise AIServiceError() from exc


def _validate_story_cards(cards, expected_photo_count: int) -> None:
    if not (_MIN_STORY_CARDS <= len(cards) <= _MAX_STORY_CARDS):
        raise AIValidationFailedError(
            f"storyCards 개수({len(cards)})가 허용 범위({_MIN_STORY_CARDS}~{_MAX_STORY_CARDS})를 벗어났습니다."
        )
    for card in cards:
        for idx in card.photoIndexes:
            if idx < 0 or idx >= expected_photo_count:
                raise AIValidationFailedError(
                    f"storyCards의 photoIndexes({idx})가 사진 범위(0~{expected_photo_count - 1})를 벗어났습니다."
                )


def _validate_response(response, expected_photo_count: int) -> RawDiaryResult:
    text = getattr(response, "text", None)
    if not text:
        raise AIValidationFailedError("Gemini 응답에 JSON 본문이 없습니다.")
    result = RawDiaryResult.model_validate_json(text)
    if len(result.photoCaptions) != expected_photo_count:
        raise AIValidationFailedError(
            f"photoCaptions 개수({len(result.photoCaptions)})가 사진 수({expected_photo_count})와 일치하지 않습니다."
        )
    _validate_story_cards(result.storyCards, expected_photo_count)
    return result


def _build_contents(prompt_text: str, photos: Sequence[Tuple[bytes, str]]) -> list:
    parts: list = [{"text": prompt_text}]
    for content, mime_type in photos:
        parts.append(types.Part.from_bytes(data=content, mime_type=mime_type))
    return [{"role": "user", "parts": parts}]


def generate_diary_with_ai(
    *,
    destination: str,
    tone: str,
    memo: str,
    companion_type_labels: Sequence[str],
    timeline_lines: Sequence[str],
    place_names: Sequence[str],
    photo_memos: Sequence[Optional[str]],
    photos: Sequence[Tuple[bytes, str]],
) -> RawDiaryResult:
    client = get_gemini_client()
    model = get_gemini_model_name()

    prompt_text = build_user_prompt(
        destination=destination,
        tone=tone,
        memo=memo,
        companion_type_labels=companion_type_labels,
        timeline_lines=timeline_lines,
        place_names=place_names,
        photo_memos=photo_memos,
        photo_count=len(photos),
    )

    contents = _build_contents(prompt_text, photos)
    response = _call_model(client, model, contents)

    try:
        return _validate_response(response, len(photos))
    except (ValidationError, AIValidationFailedError) as first_error:
        logger.warning("Gemini 다이어리 응답 검증 실패, 1회 교정 재시도를 수행합니다: %s", type(first_error).__name__)

        correction_contents = contents + [
            {"role": "model", "parts": [{"text": getattr(response, "text", "") or ""}]},
            {
                "role": "user",
                "parts": [
                    {
                        "text": (
                            "이전 응답이 요구된 스키마와 일치하지 않습니다: "
                            f"{first_error} photoCaptions는 정확히 {len(photos)}개여야 하며, "
                            "지정된 JSON 스키마로만 다시 응답하세요."
                        )
                    }
                ],
            },
        ]

        retry_response = _call_model(client, model, correction_contents)
        try:
            return _validate_response(retry_response, len(photos))
        except (ValidationError, AIValidationFailedError) as second_error:
            logger.warning("교정 재시도 후에도 Gemini 다이어리 응답 검증에 실패했습니다: %s", type(second_error).__name__)
            raise AIValidationFailedError(str(second_error)) from second_error
