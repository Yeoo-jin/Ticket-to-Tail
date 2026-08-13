from typing import List, Optional

from fastapi import APIRouter, File, Form, UploadFile

from app.schemas.booking import BookingParseResponse
from app.schemas.transit_status import TransitStatusRequest, TransitStatusResponse
from app.services import booking_service
from app.services.photo_validation import validate_and_read_photos
from app.services.transit_status_service import get_transit_status

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


@router.post("/parse", response_model=BookingParseResponse)
async def parse_booking(
    bookingText: Optional[str] = Form(None),
    photos: List[UploadFile] = File(default=[]),
) -> BookingParseResponse:
    # 빈 멀티파트 필드가 UploadFile(filename="")로 들어오는 경우를 걸러낸다(사진 없이
    # bookingText만 보낼 때 일부 클라이언트/테스트 도구가 빈 파일 파트를 함께 보낼 수 있음).
    real_photos = [photo for photo in photos if photo.filename]
    photo_payloads = await validate_and_read_photos(real_photos) if real_photos else []
    data = booking_service.parse_booking(bookingText, photo_payloads)
    return BookingParseResponse(data=data)


@router.post("/status", response_model=TransitStatusResponse)
def check_transit_status(request: TransitStatusRequest) -> TransitStatusResponse:
    data = get_transit_status(request)
    return TransitStatusResponse(data=data)
