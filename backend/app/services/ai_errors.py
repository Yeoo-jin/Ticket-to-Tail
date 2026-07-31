"""AI 공급자(provider)에 관계없이 공유하는 예외 타입.

AIConfigError / AIServiceError는 공통 오류 응답으로 즉시 반환되고,
AITransientError / AIValidationFailedError는 booking_service가 잡아서
규칙 기반 fallback으로 전환하는 신호로 사용한다.
"""

from app.utils.errors import AppError


class AIConfigError(AppError):
    """API 키 누락, 인증 실패 등 명확한 설정 오류. fallback 대상 아님."""

    def __init__(self, message: str = "AI 설정이 올바르지 않아 요청을 처리할 수 없습니다."):
        super().__init__(500, "AI_CONFIG_ERROR", message)


class AIServiceError(AppError):
    """네트워크/타임아웃/재시도 대상이 아닌 AI API 오류. fallback 대상 아님."""

    def __init__(self, message: str = "AI 서비스 오류로 요청을 처리할 수 없습니다."):
        super().__init__(500, "AI_SERVICE_ERROR", message)


class AITransientError(Exception):
    """네트워크 오류, 타임아웃 등 일시적 오류. fallback 대상."""


class AIValidationFailedError(Exception):
    """1회 교정 재시도 후에도 AI 응답 검증에 실패. fallback 대상."""
