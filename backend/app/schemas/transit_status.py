from typing import Literal, Optional

from pydantic import BaseModel


class TransitStatusRequest(BaseModel):
    type: Literal["flight", "train"]
    transitNumber: Optional[str] = None
    departureLocation: Optional[str] = None
    arrivalLocation: Optional[str] = None
    departureTime: Optional[str] = None
    arrivalTime: Optional[str] = None


class TransitStatusData(BaseModel):
    found: bool
    delayed: bool = False
    delayMinutes: Optional[int] = None
    scheduledTime: Optional[str] = None
    actualTime: Optional[str] = None
    message: str


class TransitStatusResponse(BaseModel):
    success: bool = True
    data: TransitStatusData
