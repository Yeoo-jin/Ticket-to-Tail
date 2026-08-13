from typing import List, Optional

from fastapi import APIRouter, File, Form, UploadFile

from app.schemas.diary import DiaryGenerateResponse, DiaryTone
from app.services.diary_service import generate_diary

router = APIRouter(prefix="/api/diaries", tags=["diaries"])


@router.post("/generate", response_model=DiaryGenerateResponse)
async def generate(
    destination: str = Form(...),
    tone: DiaryTone = Form(...),
    memo: Optional[str] = Form(None),
    companionTypesJson: str = Form(...),
    timelineJson: str = Form(...),
    selectedPlaceIdsJson: str = Form(...),
    photoMemosJson: Optional[str] = Form(None),
    photoTimelineItemIdsJson: Optional[str] = Form(None),
    photos: List[UploadFile] = File(default=[]),
) -> DiaryGenerateResponse:
    data = await generate_diary(
        destination=destination,
        tone=tone,
        memo=memo,
        companion_types_json=companionTypesJson,
        timeline_json=timelineJson,
        selected_place_ids_json=selectedPlaceIdsJson,
        photo_memos_json=photoMemosJson,
        photo_timeline_item_ids_json=photoTimelineItemIdsJson,
        photos=photos,
    )
    return DiaryGenerateResponse(data=data)
