"""업로드된 여행 사진 검증 (형식·용량·개수).

실제 파일은 디스크나 DB에 저장하지 않고, 요청을 처리하는 동안에만
메모리에서 bytes로 다룬 뒤 응답과 함께 버려진다.
"""

from typing import List, Tuple

from fastapi import UploadFile

from app.utils.errors import InvalidInputError

ALLOWED_MIME_TYPES = ("image/jpeg", "image/png", "image/webp")
MAX_PHOTO_COUNT = 5
MAX_PHOTO_BYTES = 5 * 1024 * 1024


async def validate_and_read_photos(photos: List[UploadFile]) -> List[Tuple[bytes, str]]:
    if len(photos) > MAX_PHOTO_COUNT:
        raise InvalidInputError(f"사진은 최대 {MAX_PHOTO_COUNT}장까지 업로드할 수 있습니다.")

    results: List[Tuple[bytes, str]] = []
    for photo in photos:
        content_type = photo.content_type
        if content_type not in ALLOWED_MIME_TYPES:
            raise InvalidInputError(
                f"지원하지 않는 사진 형식입니다({content_type}). jpg, png, webp 파일만 업로드할 수 있습니다."
            )

        content = await photo.read()
        if len(content) > MAX_PHOTO_BYTES:
            raise InvalidInputError("사진 1장의 용량은 최대 5MB까지 업로드할 수 있습니다.")

        results.append((content, content_type))

    return results
