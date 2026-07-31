from fastapi import APIRouter

from app.schemas.booking import BookingParseRequest, BookingParseResponse
from app.services.booking_service import parse_booking_text

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


@router.post("/parse", response_model=BookingParseResponse)
def parse_booking(request: BookingParseRequest) -> BookingParseResponse:
    data = parse_booking_text(request)
    return BookingParseResponse(data=data)
