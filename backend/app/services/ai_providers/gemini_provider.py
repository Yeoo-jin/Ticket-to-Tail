"""Google Gemini 기반 예매정보 추출 provider (기본 provider).

공식 Google Gen AI Python SDK(google-genai)의 structured output 기능을 사용해
RawExtractionResult Pydantic 스키마와 동일한 JSON 구조를 강제한다.
"""

import logging
import os
from typing import List, Tuple

import httpx
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import ValidationError

from app.prompts.booking_parse_prompt import PHOTO_SYSTEM_PROMPT, SYSTEM_PROMPT
from app.schemas.booking_extraction import RawBookingEvent, RawExtractionResult
from app.services.ai_errors import AIConfigError, AIServiceError, AITransientError, AIValidationFailedError
from app.utils.ai_retry import call_with_transient_retry

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gemini-3.6-flash"


def get_gemini_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.")
        raise AIConfigError()
    return genai.Client(api_key=api_key)


def get_gemini_model_name() -> str:
    return os.getenv("GEMINI_MODEL") or DEFAULT_MODEL


def _build_config(system_prompt: str = SYSTEM_PROMPT) -> "types.GenerateContentConfig":
    return types.GenerateContentConfig(
        system_instruction=system_prompt,
        response_mime_type="application/json",
        response_schema=RawExtractionResult,
    )


def _call_model(client: "genai.Client", model: str, contents: list, system_prompt: str = SYSTEM_PROMPT):
    def attempt():
        try:
            return client.models.generate_content(model=model, contents=contents, config=_build_config(system_prompt))
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

    return call_with_transient_retry(attempt)


def _validate_response(response) -> List[RawBookingEvent]:
    text = getattr(response, "text", None)
    if not text:
        raise AIValidationFailedError("Gemini 응답에 JSON 본문이 없습니다.")
    result = RawExtractionResult.model_validate_json(text)
    return result.bookings


def extract_bookings(booking_text: str) -> List[RawBookingEvent]:
    client = get_gemini_client()
    model = get_gemini_model_name()

    contents = [{"role": "user", "parts": [{"text": booking_text}]}]
    response = _call_model(client, model, contents)

    try:
        return _validate_response(response)
    except (ValidationError, AIValidationFailedError) as first_error:
        logger.warning("Gemini 응답 검증 실패, 1회 교정 재시도를 수행합니다: %s", type(first_error).__name__)

        contents = contents + [
            {"role": "model", "parts": [{"text": getattr(response, "text", "") or ""}]},
            {
                "role": "user",
                "parts": [
                    {
                        "text": (
                            "이전 응답이 요구된 JSON 스키마와 일치하지 않습니다: "
                            f"{first_error} 올바른 형식으로 다시 응답하세요."
                        )
                    }
                ],
            },
        ]

        retry_response = _call_model(client, model, contents)
        try:
            return _validate_response(retry_response)
        except (ValidationError, AIValidationFailedError) as second_error:
            logger.warning("교정 재시도 후에도 Gemini 응답 검증에 실패했습니다: %s", type(second_error).__name__)
            raise AIValidationFailedError(str(second_error)) from second_error


_PHOTO_USER_INSTRUCTION = (
    "첨부된 이미지는 예매 내역 목록을 캡처한 화면입니다. 이미지가 여러 장이면 서로 다른 "
    "예매 내역(예: 항공권 캡처 + KTX 캡처)일 수 있습니다. 모든 이미지에 보이는 모든 예매 건을 규칙에 따라 추출하세요."
)


def extract_bookings_from_photos(photos: List[Tuple[bytes, str]]) -> List[RawBookingEvent]:
    client = get_gemini_client()
    model = get_gemini_model_name()

    parts: list = [{"text": _PHOTO_USER_INSTRUCTION}]
    for photo_bytes, mime_type in photos:
        parts.append(types.Part.from_bytes(data=photo_bytes, mime_type=mime_type))
    contents = [{"role": "user", "parts": parts}]
    response = _call_model(client, model, contents, system_prompt=PHOTO_SYSTEM_PROMPT)

    try:
        return _validate_response(response)
    except (ValidationError, AIValidationFailedError) as first_error:
        logger.warning("Gemini 사진 응답 검증 실패, 1회 교정 재시도를 수행합니다: %s", type(first_error).__name__)

        contents = contents + [
            {"role": "model", "parts": [{"text": getattr(response, "text", "") or ""}]},
            {
                "role": "user",
                "parts": [
                    {
                        "text": (
                            "이전 응답이 요구된 JSON 스키마와 일치하지 않습니다: "
                            f"{first_error} 올바른 형식으로 다시 응답하세요."
                        )
                    }
                ],
            },
        ]

        retry_response = _call_model(client, model, contents, system_prompt=PHOTO_SYSTEM_PROMPT)
        try:
            return _validate_response(retry_response)
        except (ValidationError, AIValidationFailedError) as second_error:
            logger.warning("교정 재시도 후에도 Gemini 사진 응답 검증에 실패했습니다: %s", type(second_error).__name__)
            raise AIValidationFailedError(str(second_error)) from second_error
