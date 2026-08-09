from fastapi import APIRouter

from app.schemas.booking import BookingParseRequest, BookingParseResponse
from app.schemas.transit_status import TransitStatusRequest, TransitStatusResponse
from app.services.booking_service import parse_booking_text
from app.services.transit_status_service import get_transit_status

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


@router.post("/parse", response_model=BookingParseResponse)
def parse_booking(request: BookingParseRequest) -> BookingParseResponse:
    data = parse_booking_text(request)
    return BookingParseResponse(data=data)


@router.post("/status", response_model=TransitStatusResponse)
def check_transit_status(request: TransitStatusRequest) -> TransitStatusResponse:
    data = get_transit_status(request)
    return TransitStatusResponse(data=data)
