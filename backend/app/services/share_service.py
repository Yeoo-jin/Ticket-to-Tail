"""타임라인·다이어리 공유 링크 저장/조회.

로그인 없이 카카오톡 등으로 링크만 공유해 다른 사람도 열람할 수 있게 하는 기능이라,
별도 DB 없이 places.json과 같은 방식으로 파일 하나당 공유 하나를 저장한다. 사진을
포함하는 다이어리 공유는 서버에 사진 파일도 함께 저장하는데, 이 프로젝트의 "업로드
사진을 서버에 저장하지 않는다"는 원칙과 부딪히는 예외라 SHARE_EXPIRY_DAYS가 지나면
접근 시점에 자동으로 정리(삭제)한다.
"""

import json
import secrets
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import UploadFile

from app.schemas.share import (
    SharedDiaryData,
    SharedDiaryPhoto,
    SharedTimelineData,
    ShareTimelineRequest,
)
from app.schemas.timeline import TimelineItem, TimelineSummary
from app.utils.errors import InvalidInputError, NotFoundError

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BACKEND_DIR / "app" / "data" / "shares"
STATIC_DIR = BACKEND_DIR / "app" / "static" / "shares"
TIMELINE_DIR = DATA_DIR / "timeline"
DIARY_DIR = DATA_DIR / "diary"

SHARE_EXPIRY_DAYS = 7
MAX_DIARY_PHOTOS = 5
ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _generate_share_id() -> str:
    return secrets.token_urlsafe(8)


def _purge_expired(json_dir: Path, photo_root: Optional[Path] = None) -> None:
    if not json_dir.exists():
        return
    cutoff = time.time() - SHARE_EXPIRY_DAYS * 86400
    for path in json_dir.glob("*.json"):
        if path.stat().st_mtime < cutoff:
            share_id = path.stem
            path.unlink(missing_ok=True)
            if photo_root:
                shutil.rmtree(photo_root / share_id, ignore_errors=True)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# 타임라인 공유
# ---------------------------------------------------------------------------


def create_timeline_share(request: ShareTimelineRequest) -> str:
    TIMELINE_DIR.mkdir(parents=True, exist_ok=True)
    _purge_expired(TIMELINE_DIR)

    share_id = _generate_share_id()
    payload = {
        "destination": request.destination,
        "timeline": [item.model_dump() for item in request.timeline],
        "summary": request.summary.model_dump(),
        "createdAt": _now_iso(),
    }
    (TIMELINE_DIR / f"{share_id}.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return share_id


def get_timeline_share(share_id: str) -> SharedTimelineData:
    _purge_expired(TIMELINE_DIR)
    path = TIMELINE_DIR / f"{share_id}.json"
    if not path.exists():
        raise NotFoundError("공유 링크를 찾을 수 없거나 만료되었습니다.")

    raw = json.loads(path.read_text(encoding="utf-8"))
    return SharedTimelineData(
        destination=raw["destination"],
        timeline=[TimelineItem(**item) for item in raw["timeline"]],
        summary=TimelineSummary(**raw["summary"]),
        createdAt=raw["createdAt"],
    )


# ---------------------------------------------------------------------------
# 다이어리 공유 (사진 포함)
# ---------------------------------------------------------------------------


async def create_diary_share(
    destination: str,
    title: str,
    diary: str,
    summary: str,
    sns_post: str,
    hashtags: List[str],
    photos: List[UploadFile],
    photo_captions: List[str],
) -> str:
    if len(photos) > MAX_DIARY_PHOTOS:
        raise InvalidInputError(f"사진은 최대 {MAX_DIARY_PHOTOS}장까지 공유할 수 있습니다.")
    for photo in photos:
        if photo.content_type not in ALLOWED_PHOTO_TYPES:
            raise InvalidInputError("사진은 JPEG, PNG, WEBP 형식만 업로드할 수 있습니다.")

    DIARY_DIR.mkdir(parents=True, exist_ok=True)
    _purge_expired(DIARY_DIR, STATIC_DIR)

    share_id = _generate_share_id()
    photo_dir = STATIC_DIR / share_id
    photo_dir.mkdir(parents=True, exist_ok=True)

    saved_photos = []
    for index, photo in enumerate(photos):
        extension = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[photo.content_type]
        filename = f"{index}.{extension}"
        content = await photo.read()
        (photo_dir / filename).write_bytes(content)
        caption = photo_captions[index] if index < len(photo_captions) else ""
        saved_photos.append({"url": f"/static/shares/{share_id}/{filename}", "caption": caption})

    payload = {
        "destination": destination,
        "title": title,
        "diary": diary,
        "summary": summary,
        "snsPost": sns_post,
        "hashtags": hashtags,
        "photos": saved_photos,
        "createdAt": _now_iso(),
    }
    (DIARY_DIR / f"{share_id}.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return share_id


def get_diary_share(share_id: str) -> SharedDiaryData:
    _purge_expired(DIARY_DIR, STATIC_DIR)
    path = DIARY_DIR / f"{share_id}.json"
    if not path.exists():
        raise NotFoundError("공유 링크를 찾을 수 없거나 만료되었습니다.")

    raw = json.loads(path.read_text(encoding="utf-8"))
    return SharedDiaryData(
        destination=raw["destination"],
        title=raw["title"],
        diary=raw["diary"],
        summary=raw["summary"],
        snsPost=raw["snsPost"],
        hashtags=raw["hashtags"],
        photos=[SharedDiaryPhoto(**photo) for photo in raw["photos"]],
        createdAt=raw["createdAt"],
    )
