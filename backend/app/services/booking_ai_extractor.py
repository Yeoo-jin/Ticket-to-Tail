"""AI_PROVIDER 환경변수에 따라 실제 AI provider(gemini/anthropic)로 위임하는 dispatcher.

기본 provider는 gemini이며, 예산 상황에 따라 AI_PROVIDER=anthropic으로 전환할 수 있다.
"""

import logging
import os
from typing import List, Tuple

from app.schemas.booking_extraction import RawBookingEvent
from app.services.ai_errors import (  # noqa: F401  (하위 호환을 위한 재수출)
    AIConfigError,
    AIServiceError,
    AITransientError,
    AIValidationFailedError,
)
from app.services.ai_providers import anthropic_provider, gemini_provider

logger = logging.getLogger(__name__)

DEFAULT_PROVIDER = "gemini"

_PROVIDERS = {
    "gemini": gemini_provider,
    "anthropic": anthropic_provider,
}


def get_provider_name() -> str:
    provider = os.getenv("AI_PROVIDER", DEFAULT_PROVIDER).strip().lower()
    if provider not in _PROVIDERS:
        raise AIConfigError(f"지원하지 않는 AI_PROVIDER 값입니다: {provider}")
    return provider


def extract_bookings(booking_text: str) -> List[RawBookingEvent]:
    provider_name = get_provider_name()
    provider = _PROVIDERS[provider_name]
    return provider.extract_bookings(booking_text)


def extract_bookings_from_photos(photos: List[Tuple[bytes, str]]) -> List[RawBookingEvent]:
    provider_name = get_provider_name()
    provider = _PROVIDERS[provider_name]
    return provider.extract_bookings_from_photos(photos)
