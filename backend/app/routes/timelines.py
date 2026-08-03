from fastapi import APIRouter

from app.schemas.timeline import TimelineGenerateRequest, TimelineGenerateResponse
from app.services.timeline_service import generate_timeline

router = APIRouter(prefix="/api/timelines", tags=["timelines"])


@router.post("/generate", response_model=TimelineGenerateResponse)
def generate(request: TimelineGenerateRequest) -> TimelineGenerateResponse:
    data = generate_timeline(request)
    return TimelineGenerateResponse(data=data)
