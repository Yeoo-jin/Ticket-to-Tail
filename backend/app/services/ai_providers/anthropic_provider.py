"""Anthropic Claude 기반 예매정보 추출 provider (보조 provider).

기본 provider는 Gemini이며, AI_PROVIDER=anthropic으로 설정했을 때만 사용된다.
"""

import logging
import os
from typing import List, Optional

import anthropic
from pydantic import ValidationError

from app.prompts.booking_parse_prompt import EXTRACT_BOOKINGS_TOOL, SYSTEM_PROMPT
from app.schemas.booking_extraction import RawBookingEvent, RawExtractionResult
from app.services.ai_errors import AIConfigError, AIServiceError, AITransientError, AIValidationFailedError

logger = logging.getLogger(__name__)

MAX_TOKENS = 2048
TOOL_NAME = "extract_bookings"


def get_anthropic_client() -> anthropic.Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        logger.error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.")
        raise AIConfigError()
    return anthropic.Anthropic(api_key=api_key)


def get_anthropic_model_name() -> str:
    model = os.getenv("ANTHROPIC_MODEL")
    if not model:
        logger.error("ANTHROPIC_MODEL 환경변수가 설정되지 않았습니다.")
        raise AIConfigError()
    return model


def _call_tool(client: anthropic.Anthropic, model: str, messages: list):
    try:
        return client.messages.create(
            model=model,
            max_tokens=MAX_TOKENS,
            system=SYSTEM_PROMPT,
            tools=[EXTRACT_BOOKINGS_TOOL],
            tool_choice={"type": "tool", "name": TOOL_NAME},
            messages=messages,
        )
    except anthropic.APIConnectionError as exc:
        # anthropic.APITimeoutError는 APIConnectionError의 하위 클래스이므로 함께 처리된다.
        logger.warning("Anthropic API 네트워크 오류/타임아웃이 발생했습니다.")
        raise AITransientError("Anthropic API 네트워크 오류 또는 타임아웃") from exc
    except anthropic.APIStatusError as exc:
        logger.warning("Anthropic API 오류 응답 (status=%s)", getattr(exc, "status_code", "unknown"))
        raise AIServiceError() from exc


def _find_tool_use_block(response):
    for block in response.content:
        if getattr(block, "type", None) == "tool_use" and getattr(block, "name", None) == TOOL_NAME:
            return block
    return None


def _validate_tool_block(block) -> List[RawBookingEvent]:
    if block is None:
        raise AIValidationFailedError("AI 응답에서 extract_bookings 도구 호출을 찾을 수 없습니다.")
    result = RawExtractionResult.model_validate(block.input)
    return result.bookings


def extract_bookings(booking_text: str) -> List[RawBookingEvent]:
    client = get_anthropic_client()
    model = get_anthropic_model_name()

    messages = [{"role": "user", "content": booking_text}]
    response = _call_tool(client, model, messages)
    block = _find_tool_use_block(response)

    try:
        return _validate_tool_block(block)
    except (ValidationError, AIValidationFailedError) as first_error:
        logger.warning("AI 응답 검증 실패, 1회 교정 재시도를 수행합니다: %s", type(first_error).__name__)

        correction_messages = messages + _build_correction_turn(response, block, first_error)
        retry_response = _call_tool(client, model, correction_messages)
        retry_block = _find_tool_use_block(retry_response)

        try:
            return _validate_tool_block(retry_block)
        except (ValidationError, AIValidationFailedError) as second_error:
            logger.warning("교정 재시도 후에도 AI 응답 검증에 실패했습니다: %s", type(second_error).__name__)
            raise AIValidationFailedError(str(second_error)) from second_error


def _build_correction_turn(response, block: Optional[object], error: Exception) -> list:
    error_message = (
        "이전 응답이 요구된 스키마와 일치하지 않습니다: "
        f"{error} extract_bookings 도구를 사용해 올바른 형식으로 다시 반환하세요."
    )
    assistant_content = [b.model_dump() for b in response.content]

    if block is not None:
        user_content = [
            {
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": error_message,
                "is_error": True,
            }
        ]
    else:
        user_content = error_message

    return [
        {"role": "assistant", "content": assistant_content},
        {"role": "user", "content": user_content},
    ]
