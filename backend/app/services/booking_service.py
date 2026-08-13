import logging
from typing import List, Optional, Tuple

from app.schemas.booking import BookingParseData, BookingParseRequest
from app.services import booking_ai_extractor, booking_fallback_parser
from app.services.ai_errors import AIServiceError, AITransientError, AIValidationFailedError
from app.services.datetime_normalizer import apply_date_carry_forward, normalize_bookings
from app.services.missing_fields import compute_missing_fields
from app.utils.errors import InvalidInputError

logger = logging.getLogger(__name__)


def parse_booking_text(request: BookingParseRequest) -> BookingParseData:
    booking_text = request.bookingText.strip()
    if not booking_text:
        raise InvalidInputError()

    try:
        raw_events = booking_ai_extractor.extract_bookings(booking_text)
    except (AITransientError, AIValidationFailedError) as exc:
        logger.warning(
            "AI 추출 실패로 제한적 규칙 기반 fallback을 사용합니다 (사유: %s).", type(exc).__name__
        )
        raw_events = booking_fallback_parser.extract_bookings(booking_text)

    raw_events = apply_date_carry_forward(raw_events)

    bookings = normalize_bookings(raw_events)
    missing_fields = compute_missing_fields(raw_events)

    return BookingParseData(bookings=bookings, missingFields=missing_fields)


def parse_booking_photos(photos: List[Tuple[bytes, str]]) -> BookingParseData:
    # 사진 입력은 텍스트가 아니므로 booking_fallback_parser(정규식 기반)를 쓸 수 없다.
    # AI 호출이 실패하면 복구 수단이 없으므로, 사용자가 텍스트 입력으로 전환할 수 있게
    # 안내 메시지를 담아 AppError로 변환해 던진다(예외를 그대로 흘려보내지 않음).
    try:
        raw_events = booking_ai_extractor.extract_bookings_from_photos(photos)
    except (AITransientError, AIValidationFailedError) as exc:
        logger.warning("사진에서 예매정보 추출 실패, 사진 입력은 대체 수단이 없습니다: %s", type(exc).__name__)
        raise AIServiceError("사진에서 예매정보를 추출하지 못했습니다. 다른 사진을 사용하거나 텍스트로 직접 입력해주세요.") from exc

    raw_events = apply_date_carry_forward(raw_events)

    bookings = normalize_bookings(raw_events)
    missing_fields = compute_missing_fields(raw_events)

    return BookingParseData(bookings=bookings, missingFields=missing_fields)


def parse_booking(booking_text: Optional[str], photos: List[Tuple[bytes, str]]) -> BookingParseData:
    has_text = bool(booking_text and booking_text.strip())
    has_photo = bool(photos)

    if not has_text and not has_photo:
        raise InvalidInputError("예매정보 텍스트 또는 사진 중 하나를 입력해주세요.")
    if has_text and has_photo:
        raise InvalidInputError("예매정보 텍스트와 사진 중 하나만 입력해주세요.")

    if has_photo:
        return parse_booking_photos(photos)
    return parse_booking_text(BookingParseRequest(bookingText=booking_text))
