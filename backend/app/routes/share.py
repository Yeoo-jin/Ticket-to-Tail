import json
from typing import List, Optional

from fastapi import APIRouter, File, Form, UploadFile

from app.schemas.share import (
    ShareCreateData,
    ShareCreateResponse,
    SharedDiaryResponse,
    SharedTimelineResponse,
    ShareTimelineRequest,
)
from app.services.share_service import (
    create_diary_share,
    create_timeline_share,
    get_diary_share,
    get_timeline_share,
)
from app.utils.errors import InvalidInputError

router = APIRouter(prefix="/api/share", tags=["share"])


@router.post("/timeline", response_model=ShareCreateResponse)
def share_timeline(request: ShareTimelineRequest) -> ShareCreateResponse:
    share_id = create_timeline_share(request)
    return ShareCreateResponse(data=ShareCreateData(shareId=share_id))


@router.get("/timeline/{share_id}", response_model=SharedTimelineResponse)
def read_shared_timeline(share_id: str) -> SharedTimelineResponse:
    data = get_timeline_share(share_id)
    return SharedTimelineResponse(data=data)


@router.post("/diary", response_model=ShareCreateResponse)
async def share_diary(
    destination: str = Form(...),
    title: str = Form(...),
    diary: str = Form(...),
    summary: str = Form(...),
    snsPost: str = Form(...),
    hashtagsJson: Optional[str] = Form(None),
    photoCaptionsJson: Optional[str] = Form(None),
    photos: List[UploadFile] = File(default=[]),
) -> ShareCreateResponse:
    try:
        hashtags = json.loads(hashtagsJson) if hashtagsJson else []
        photo_captions = json.loads(photoCaptionsJson) if photoCaptionsJson else []
    except json.JSONDecodeError as exc:
        raise InvalidInputError("hashtagsJson/photoCaptionsJson은 JSON 배열이어야 합니다.") from exc

    share_id = await create_diary_share(
        destination=destination,
        title=title,
        diary=diary,
        summary=summary,
        sns_post=snsPost,
        hashtags=hashtags,
        photos=photos,
        photo_captions=photo_captions,
    )
    return ShareCreateResponse(data=ShareCreateData(shareId=share_id))


@router.get("/diary/{share_id}", response_model=SharedDiaryResponse)
def read_shared_diary(share_id: str) -> SharedDiaryResponse:
    data = get_diary_share(share_id)
    return SharedDiaryResponse(data=data)
