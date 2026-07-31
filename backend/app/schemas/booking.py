from typing import List, Literal, Optional

from pydantic import BaseModel

BookingType = Literal["flight", "train"]


class BookingParseRequest(BaseModel):
    bookingText: str


class Booking(BaseModel):
    type: BookingType
    departureLocation: Optional[str] = None
    arrivalLocation: Optional[str] = None
    departureTime: Optional[str] = None
    arrivalTime: Optional[str] = None


class BookingParseData(BaseModel):
    bookings: List[Booking]
    missingFields: List[str]


class BookingParseResponse(BaseModel):
    success: bool = True
    data: BookingParseData
