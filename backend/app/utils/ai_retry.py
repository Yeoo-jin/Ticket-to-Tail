"""AI 공급자 호출 중 발생하는 일시적 오류(AITransientError)에 한해 짧게 대기 후
재시도하는 공통 헬퍼.

설정/인증 오류(AIConfigError)나 응답 검증 실패는 이 함수의 대상이 아니며, 그대로
호출부로 전파되어야 한다(원인이 진짜 오류일 때 조용히 넘어가지 않도록).
"""

import logging
import time
from typing import Callable, TypeVar

from app.services.ai_errors import AITransientError

logger = logging.getLogger(__name__)

T = TypeVar("T")

RETRY_DELAY_SECONDS = 1.5
DEFAULT_ATTEMPTS = 2


def call_with_transient_retry(fn: Callable[[], T], *, attempts: int = DEFAULT_ATTEMPTS) -> T:
    last_error: AITransientError
    for attempt in range(attempts):
        try:
            return fn()
        except AITransientError as exc:
            last_error = exc
            if attempt < attempts - 1:
                logger.warning(
                    "AI 호출이 일시적 오류로 실패해 재시도합니다 (attempt=%d/%d): %s",
                    attempt + 1,
                    attempts,
                    exc,
                )
                time.sleep(RETRY_DELAY_SECONDS)
    raise last_error
