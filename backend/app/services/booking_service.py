import logging

from app.schemas.booking import BookingParseData, BookingParseRequest
from app.services import booking_ai_extractor, booking_fallback_parser
from app.services.ai_errors import AITransientError, AIValidationFailedError
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
