from fastapi import APIRouter

from app.schemas.timeline import (
    LayoverCandidatesRequest,
    LayoverCandidatesResponse,
    TimelineGenerateRequest,
    TimelineGenerateResponse,
)
from app.services.timeline_service import find_layover_candidates, generate_timeline

router = APIRouter(prefix="/api/timelines", tags=["timelines"])


@router.post("/generate", response_model=TimelineGenerateResponse)
def generate(request: TimelineGenerateRequest) -> TimelineGenerateResponse:
    data = generate_timeline(request)
    return TimelineGenerateResponse(data=data)


@router.post("/layover-candidates", response_model=LayoverCandidatesResponse)
def layover_candidates(request: LayoverCandidatesRequest) -> LayoverCandidatesResponse:
    data = find_layover_candidates(request.bookings, request.companionTypes)
    return LayoverCandidatesResponse(data=data)
