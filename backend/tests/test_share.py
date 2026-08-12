import io
import json
import os
import time

from fastapi.testclient import TestClient

from app.main import app
from app.services import share_service

client = TestClient(app)


def _small_jpeg_bytes(size=1024):
    return b"\xff\xd8\xff" + b"0" * size


def _photo_file(name="a.jpg", size=1024, content_type="image/jpeg"):
    return (name, io.BytesIO(_small_jpeg_bytes(size)), content_type)


TIMELINE_PAYLOAD = {
    "destination": "부산",
    "timeline": [
        {
            "id": "item-001",
            "type": "attraction",
            "startTime": "2026-08-12T10:00:00",
            "endTime": "2026-08-12T11:00:00",
            "title": "국립해양박물관",
            "placeId": "place-001",
            "location": "부산 영도구",
            "description": "설명",
            "estimated": True,
        }
    ],
    "summary": {
        "placeCount": 1,
        "sightseeingMinutes": 60,
        "estimatedTravelMinutes": 0,
        "companionTypes": ["solo"],
        "pace": "normal",
    },
}


# ---------------------------------------------------------------------------
# 타임라인 공유
# ---------------------------------------------------------------------------


def test_create_and_read_timeline_share_round_trip():
    create_response = client.post("/api/share/timeline", json=TIMELINE_PAYLOAD)
    assert create_response.status_code == 200
    share_id = create_response.json()["data"]["shareId"]
    assert share_id

    read_response = client.get(f"/api/share/timeline/{share_id}")
    assert read_response.status_code == 200
    data = read_response.json()["data"]
    assert data["destination"] == "부산"
    assert data["timeline"][0]["title"] == "국립해양박물관"
    assert data["summary"]["placeCount"] == 1
    assert "createdAt" in data


def test_read_unknown_timeline_share_returns_404():
    response = client.get("/api/share/timeline/does-not-exist")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


# ---------------------------------------------------------------------------
# 다이어리 공유 (사진 포함)
# ---------------------------------------------------------------------------


def _diary_fields(**overrides):
    fields = {
        "destination": "부산",
        "title": "부산에서 보낸 하루",
        "diary": "즐거운 여행이었다.",
        "summary": "짧은 요약",
        "snsPost": "SNS용 문구",
        "hashtagsJson": json.dumps(["#부산여행"]),
        "photoCaptionsJson": json.dumps(["광안대교 야경"]),
    }
    fields.update(overrides)
    return fields


def test_create_and_read_diary_share_round_trip():
    create_response = client.post(
        "/api/share/diary",
        data=_diary_fields(),
        files=[("photos", _photo_file())],
    )
    assert create_response.status_code == 200
    share_id = create_response.json()["data"]["shareId"]

    read_response = client.get(f"/api/share/diary/{share_id}")
    assert read_response.status_code == 200
    data = read_response.json()["data"]
    assert data["title"] == "부산에서 보낸 하루"
    assert data["hashtags"] == ["#부산여행"]
    assert len(data["photos"]) == 1
    assert data["photos"][0]["caption"] == "광안대교 야경"
    assert data["photos"][0]["url"].startswith(f"/static/shares/{share_id}/")

    # 저장된 사진이 정적 파일로 실제 서빙되는지 확인.
    photo_response = client.get(data["photos"][0]["url"])
    assert photo_response.status_code == 200


def test_diary_share_without_photos_succeeds():
    create_response = client.post("/api/share/diary", data=_diary_fields(hashtagsJson=None, photoCaptionsJson=None))
    assert create_response.status_code == 200
    share_id = create_response.json()["data"]["shareId"]

    read_response = client.get(f"/api/share/diary/{share_id}")
    assert read_response.json()["data"]["photos"] == []
    assert read_response.json()["data"]["hashtags"] == []


def test_diary_share_rejects_more_than_five_photos():
    files = [("photos", _photo_file(name=f"p{i}.jpg")) for i in range(6)]
    response = client.post("/api/share/diary", data=_diary_fields(), files=files)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


def test_diary_share_rejects_unsupported_photo_type():
    files = [("photos", ("a.gif", io.BytesIO(b"GIF89a"), "image/gif"))]
    response = client.post("/api/share/diary", data=_diary_fields(), files=files)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


def test_read_unknown_diary_share_returns_404():
    response = client.get("/api/share/diary/does-not-exist")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


# ---------------------------------------------------------------------------
# 만료된 공유 자동 정리
# ---------------------------------------------------------------------------


def test_expired_timeline_share_is_purged_and_returns_404():
    create_response = client.post("/api/share/timeline", json=TIMELINE_PAYLOAD)
    share_id = create_response.json()["data"]["shareId"]
    path = share_service.TIMELINE_DIR / f"{share_id}.json"
    assert path.exists()

    old_time = time.time() - (share_service.SHARE_EXPIRY_DAYS + 1) * 86400
    os.utime(path, (old_time, old_time))

    response = client.get(f"/api/share/timeline/{share_id}")
    assert response.status_code == 404
    assert not path.exists()
