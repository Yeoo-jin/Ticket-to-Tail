import io
import json
from unittest.mock import MagicMock, patch

import httpx
from fastapi.testclient import TestClient

from app.main import app
from app.services import diary_ai_generator, diary_service
from app.services.ai_errors import AIConfigError, AIServiceError, AITransientError
from app.services.place_data import load_places
from app.utils import ai_retry

client = TestClient(app)

ALL_PLACE_IDS = {p.placeId for p in load_places()}

DEMO_TIMELINE_DATA = {
    "timeline": [
        {
            "id": "item-001",
            "type": "attraction",
            "startTime": "2026-08-13T10:00:00",
            "endTime": "2026-08-13T11:30:00",
            "title": "국립해양박물관",
            "placeId": "place-001",
            "location": "부산 영도구 해양로301번길 45",
            "description": "부산의 해양 문화를 체험할 수 있는 실내 박물관입니다.",
            "estimated": True,
        }
    ],
    "summary": {
        "placeCount": 1,
        "sightseeingMinutes": 90,
        "estimatedTravelMinutes": 30,
        "companionTypes": ["infant"],
        "pace": "normal",
    },
    "warnings": [],
}


def _fields(**overrides):
    fields = {
        "destination": "부산",
        "tone": "emotional",
        "memo": "유아와 함께한 여행이라 중간중간 쉬어 갔다.",
        "companionTypesJson": json.dumps(["infant"]),
        "timelineJson": json.dumps(DEMO_TIMELINE_DATA),
        "selectedPlaceIdsJson": json.dumps(["place-001"]),
    }
    fields.update(overrides)
    return fields


def _fake_story_cards(photo_count=0):
    cards = [
        {
            "id": "cover",
            "type": "cover",
            "photoIndexes": [0] if photo_count else [],
            "headline": "부산에서의 하루",
            "body": "부산에서 즐거운 하루를 보냈다.",
            "caption": "",
            "locationLabel": "부산",
            "dateLabel": None,
            "accentWords": ["행복"],
            "layoutVariant": "full-bleed",
        }
    ]
    for i in range(1, min(photo_count, 3)):
        cards.append(
            {
                "id": f"photo-{i}",
                "type": "single_photo",
                "photoIndexes": [i],
                "headline": f"순간 {i + 1}",
                "body": "짧은 순간의 기록.",
                "caption": f"사진 {i + 1} 캡션",
                "locationLabel": None,
                "dateLabel": None,
                "accentWords": [],
                "layoutVariant": "framed",
            }
        )
    cards.append(
        {
            "id": "quote",
            "type": "quote",
            "photoIndexes": [],
            "headline": "기억에 남는 순간",
            "body": "여행에서 가장 기억에 남는 순간이었다.",
            "caption": "",
            "locationLabel": None,
            "dateLabel": None,
            "accentWords": [],
            "layoutVariant": "text-only",
        }
    )
    cards.append(
        {
            "id": "ending",
            "type": "ending",
            "photoIndexes": [],
            "headline": "여행을 마치며",
            "body": "즐거운 여행이었다.",
            "caption": "",
            "locationLabel": None,
            "dateLabel": None,
            "accentWords": [],
            "layoutVariant": "text-only",
        }
    )
    return cards[:6]


def _fake_raw_diary(photo_count=0, hashtags=None, story_cards=None):
    return {
        "title": "부산 여행 다이어리",
        "diary": "부산에서 즐거운 하루를 보냈다.",
        "summary": "부산 당일치기 여행 요약",
        "snsPost": "부산 다녀왔어요!",
        "photoCaptions": [f"사진 {i + 1} 캡션" for i in range(photo_count)],
        "hashtags": hashtags if hashtags is not None else ["부산여행", "가족여행", "유아동반여행"],
        "storyCards": story_cards if story_cards is not None else _fake_story_cards(photo_count),
    }


class FakeGeminiResponse:
    def __init__(self, payload=None, raw_text=None):
        self.text = raw_text if raw_text is not None else json.dumps(payload, ensure_ascii=False)


def _fake_gemini_client(*payloads_or_texts):
    fake_client = MagicMock()
    responses = []
    for item in payloads_or_texts:
        if isinstance(item, str):
            responses.append(FakeGeminiResponse(raw_text=item))
        else:
            responses.append(FakeGeminiResponse(payload=item))
    fake_client.models.generate_content.side_effect = responses
    return fake_client


def _small_jpeg_bytes(size=1024):
    return b"\xff\xd8\xff" + b"0" * size


def _photo_file(name="a.jpg", size=1024, content_type="image/jpeg"):
    return (name, io.BytesIO(_small_jpeg_bytes(size)), content_type)


def _post(data, files=None):
    with patch.object(diary_ai_generator, "get_gemini_client", return_value=_fake_gemini_client(_fake_raw_diary())):
        return client.post("/api/diaries/generate", data=data, files=files or [])


# ---------------------------------------------------------------------------
# 1. 메모만 있는 정상 요청
# ---------------------------------------------------------------------------


def test_memo_only_request_succeeds():
    with patch.object(
        diary_ai_generator, "get_gemini_client", return_value=_fake_gemini_client(_fake_raw_diary(photo_count=0))
    ):
        response = client.post("/api/diaries/generate", data=_fields())

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["generationMode"] == "ai"
    assert body["data"]["photoCaptions"] == []


# ---------------------------------------------------------------------------
# 2. 사진 1장 + 메모 정상 요청
# ---------------------------------------------------------------------------


def test_one_photo_with_memo_succeeds():
    with patch.object(
        diary_ai_generator, "get_gemini_client", return_value=_fake_gemini_client(_fake_raw_diary(photo_count=1))
    ):
        response = client.post(
            "/api/diaries/generate",
            data=_fields(photoMemosJson=json.dumps(["노을이 예뻤다"])),
            files=[("photos", _photo_file())],
        )

    assert response.status_code == 200
    body = response.json()
    assert len(body["data"]["photoCaptions"]) == 1
    assert body["data"]["photoCaptions"][0]["photoIndex"] == 0


def test_photo_timeline_item_id_links_photo_to_place_in_prompt():
    # 6단계(타임라인 화면)에서 관광지 항목(item-001, "국립해양박물관")에 붙인 사진이면,
    # AI에게 보내는 프롬프트에 그 항목 제목이 근거로 같이 실려야 한다.
    fake_client = _fake_gemini_client(_fake_raw_diary(photo_count=1))
    with patch.object(diary_ai_generator, "get_gemini_client", return_value=fake_client):
        response = client.post(
            "/api/diaries/generate",
            data=_fields(
                photoMemosJson=json.dumps(["여기서 찍음"]),
                photoTimelineItemIdsJson=json.dumps(["item-001"]),
            ),
            files=[("photos", _photo_file())],
        )

    assert response.status_code == 200
    call_kwargs = fake_client.models.generate_content.call_args.kwargs
    prompt_text = call_kwargs["contents"][0]["parts"][0]["text"]
    assert "국립해양박물관" in prompt_text


def test_photo_without_timeline_item_id_still_succeeds():
    # 연결 정보가 없어도(예: 옛 방식으로 저장된 사진) 다이어리 생성 자체는 그대로 동작해야 한다.
    with patch.object(
        diary_ai_generator, "get_gemini_client", return_value=_fake_gemini_client(_fake_raw_diary(photo_count=1))
    ):
        response = client.post(
            "/api/diaries/generate",
            data=_fields(photoMemosJson=json.dumps(["메모"])),
            files=[("photos", _photo_file())],
        )
    assert response.status_code == 200
    assert response.json()["success"] is True


# ---------------------------------------------------------------------------
# 3. 사진 5장 정상 처리 / 4. 사진 6장 400
# ---------------------------------------------------------------------------


def test_five_photos_are_processed_successfully():
    files = [("photos", _photo_file(name=f"p{i}.jpg")) for i in range(5)]
    with patch.object(
        diary_ai_generator, "get_gemini_client", return_value=_fake_gemini_client(_fake_raw_diary(photo_count=5))
    ):
        response = client.post("/api/diaries/generate", data=_fields(memo="다섯 장 테스트"), files=files)

    assert response.status_code == 200
    assert len(response.json()["data"]["photoCaptions"]) == 5


def test_six_photos_returns_400():
    files = [("photos", _photo_file(name=f"p{i}.jpg")) for i in range(6)]
    response = client.post("/api/diaries/generate", data=_fields(memo="여섯 장 테스트"), files=files)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


# ---------------------------------------------------------------------------
# 5. 지원하지 않는 파일 형식 거부 / 6. 용량 초과 거부
# ---------------------------------------------------------------------------


def test_unsupported_photo_type_returns_400():
    files = [("photos", ("a.gif", io.BytesIO(b"gif-bytes"), "image/gif"))]
    response = client.post("/api/diaries/generate", data=_fields(), files=files)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


def test_oversized_photo_returns_400():
    oversized = 5 * 1024 * 1024 + 1
    files = [("photos", ("big.jpg", io.BytesIO(_small_jpeg_bytes(oversized)), "image/jpeg"))]
    response = client.post("/api/diaries/generate", data=_fields(), files=files)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


# ---------------------------------------------------------------------------
# 7. 사진과 메모가 모두 없을 때 400
# ---------------------------------------------------------------------------


def test_no_memo_and_no_photos_returns_400():
    response = client.post("/api/diaries/generate", data=_fields(memo=""))
    assert response.status_code == 400
    assert response.json() == {
        "success": False,
        "error": {"code": "INVALID_INPUT", "message": "여행 메모 또는 사진 중 하나는 반드시 입력해야 합니다."},
    }


def test_blank_memo_and_no_photos_returns_400():
    response = client.post("/api/diaries/generate", data=_fields(memo="   "))
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


# ---------------------------------------------------------------------------
# 8. 잘못된 tone 거부
# ---------------------------------------------------------------------------


def test_invalid_tone_returns_400():
    response = client.post("/api/diaries/generate", data=_fields(tone="dramatic"))
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


# ---------------------------------------------------------------------------
# 9. companionTypes 빈 배열 거부 / 10. solo + 다른 조건 조합 거부
# ---------------------------------------------------------------------------


def test_empty_companion_types_returns_400():
    response = client.post("/api/diaries/generate", data=_fields(companionTypesJson=json.dumps([])))
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


def test_solo_combined_with_other_condition_returns_400():
    response = client.post(
        "/api/diaries/generate", data=_fields(companionTypesJson=json.dumps(["solo", "infant"]))
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


# ---------------------------------------------------------------------------
# 11. timelineJson 파싱 오류
# ---------------------------------------------------------------------------


def test_malformed_timeline_json_returns_400():
    response = client.post("/api/diaries/generate", data=_fields(timelineJson="not valid json{"))
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


def test_timeline_json_missing_required_fields_returns_400():
    response = client.post("/api/diaries/generate", data=_fields(timelineJson=json.dumps({"foo": "bar"})))
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


# ---------------------------------------------------------------------------
# 12. selectedPlaceIds에 존재하지 않는 관광지 ID
# ---------------------------------------------------------------------------


def test_unknown_selected_place_id_returns_400():
    response = client.post(
        "/api/diaries/generate", data=_fields(selectedPlaceIdsJson=json.dumps(["place-does-not-exist"]))
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


# ---------------------------------------------------------------------------
# 13/19. Gemini 정상 구조화 응답 + 해시태그 정규화
# ---------------------------------------------------------------------------


def test_gemini_success_normalizes_hashtags():
    raw = _fake_raw_diary(photo_count=0, hashtags=["#부산여행", "부산여행", "가족여행", "  ", "여행"])
    with patch.object(diary_ai_generator, "get_gemini_client", return_value=_fake_gemini_client(raw)):
        response = client.post("/api/diaries/generate", data=_fields())

    assert response.status_code == 200
    hashtags = response.json()["data"]["hashtags"]
    assert hashtags == ["#부산여행", "#가족여행", "#여행"]  # 중복 제거, # 접두사 정규화
    assert all(tag.startswith("#") for tag in hashtags)


def test_hashtags_capped_at_ten():
    raw = _fake_raw_diary(photo_count=0, hashtags=[f"태그{i}" for i in range(15)])
    with patch.object(diary_ai_generator, "get_gemini_client", return_value=_fake_gemini_client(raw)):
        response = client.post("/api/diaries/generate", data=_fields())

    assert response.status_code == 200
    assert len(response.json()["data"]["hashtags"]) == 10


def test_hashtags_are_split_when_model_concatenates_them_into_one_string():
    # 실제 Gemini 호출에서 관찰된 사례: hashtags가 ["#a b#c#d"]처럼 하나의 문자열로 뭉쳐 반환됨.
    concatenated = "#부산여행 leaves통해서도#유아동반여행통해서도#국립해양박물관통해서도#광안리해수욕장통해서도"
    raw = _fake_raw_diary(photo_count=0, hashtags=[concatenated])
    with patch.object(diary_ai_generator, "get_gemini_client", return_value=_fake_gemini_client(raw)):
        response = client.post("/api/diaries/generate", data=_fields())

    assert response.status_code == 200
    hashtags = response.json()["data"]["hashtags"]
    assert hashtags == [
        "#부산여행",
        "#유아동반여행통해서도",
        "#국립해양박물관통해서도",
        "#광안리해수욕장통해서도",
    ]
    assert all(tag.startswith("#") and " " not in tag for tag in hashtags)


# ---------------------------------------------------------------------------
# 14. Gemini 잘못된 JSON 후 1회 재시도 성공
# ---------------------------------------------------------------------------


def test_invalid_json_retries_once_then_succeeds():
    invalid_text = "이건 유효한 JSON이 아닙니다 {"
    valid_payload = _fake_raw_diary(photo_count=0)
    fake_client = _fake_gemini_client(invalid_text, valid_payload)

    with patch.object(diary_ai_generator, "get_gemini_client", return_value=fake_client):
        response = client.post("/api/diaries/generate", data=_fields())

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["generationMode"] == "ai"
    assert fake_client.models.generate_content.call_count == 2


# ---------------------------------------------------------------------------
# 15/16. Gemini 장애 시 fallback, generationMode == fallback
# ---------------------------------------------------------------------------


def test_ai_transient_failure_falls_back_to_template():
    with patch.object(
        diary_service.diary_ai_generator,
        "generate_diary_with_ai",
        side_effect=AITransientError("network down"),
    ):
        response = client.post("/api/diaries/generate", data=_fields())

    assert response.status_code == 200
    body = response.json()["data"]
    assert body["generationMode"] == "fallback"
    assert any("AI 호출에 실패" in w for w in body["warnings"])
    for field in ("title", "diary", "summary", "snsPost", "photoCaptions", "hashtags", "storyCards", "warnings"):
        assert field in body


def test_transient_network_error_is_retried_and_succeeds_without_fallback(monkeypatch):
    # 네트워크 순단처럼 한 번 실패했다가 바로 다음 시도에서 성공하면, fallback 템플릿(사진을
    # 실제로 반영하지 않는 밋밋한 결과)이 아니라 재시도만으로 정상 AI 결과가 나와야 한다.
    monkeypatch.setattr(ai_retry.time, "sleep", lambda *_args: None)

    fake_client = MagicMock()
    fake_client.models.generate_content.side_effect = [
        httpx.TimeoutException("timed out"),
        FakeGeminiResponse(payload=_fake_raw_diary()),
    ]

    with patch.object(diary_ai_generator, "get_gemini_client", return_value=fake_client):
        response = client.post("/api/diaries/generate", data=_fields())

    assert response.status_code == 200
    body = response.json()["data"]
    assert body["generationMode"] == "ai"
    assert fake_client.models.generate_content.call_count == 2


def test_ai_config_error_also_falls_back_to_template():
    # API 키 문제 등 AIConfigError(원래는 500으로 그대로 전파됐다)도 화면에 에러가
    # 뜨는 대신 fallback으로 처리돼야 한다 — 데모 중 AI 설정이 불안정해도 다이어리
    # 생성 자체는 항상 성공해야 하기 때문.
    with patch.object(
        diary_service.diary_ai_generator,
        "generate_diary_with_ai",
        side_effect=AIConfigError("Gemini 인증 오류로 요청을 처리할 수 없습니다."),
    ):
        response = client.post("/api/diaries/generate", data=_fields())

    assert response.status_code == 200
    body = response.json()["data"]
    assert body["generationMode"] == "fallback"


def test_ai_service_error_also_falls_back_to_template():
    with patch.object(
        diary_service.diary_ai_generator,
        "generate_diary_with_ai",
        side_effect=AIServiceError("Gemini 서비스 오류"),
    ):
        response = client.post("/api/diaries/generate", data=_fields())

    assert response.status_code == 200
    body = response.json()["data"]
    assert body["generationMode"] == "fallback"


# ---------------------------------------------------------------------------
# 17/18. 사진 유무에 따른 photoCaptions 개수 일치
# ---------------------------------------------------------------------------


def test_no_photos_gives_empty_photo_captions():
    with patch.object(
        diary_ai_generator, "get_gemini_client", return_value=_fake_gemini_client(_fake_raw_diary(photo_count=0))
    ):
        response = client.post("/api/diaries/generate", data=_fields())

    assert response.status_code == 200
    assert response.json()["data"]["photoCaptions"] == []


def test_photo_caption_count_matches_photo_count():
    files = [("photos", _photo_file(name="a.jpg")), ("photos", _photo_file(name="b.jpg"))]
    with patch.object(
        diary_ai_generator, "get_gemini_client", return_value=_fake_gemini_client(_fake_raw_diary(photo_count=2))
    ):
        response = client.post("/api/diaries/generate", data=_fields(), files=files)

    assert response.status_code == 200
    captions = response.json()["data"]["photoCaptions"]
    assert len(captions) == 2
    assert [c["photoIndex"] for c in captions] == [0, 1]


def test_photo_caption_count_is_normalized_even_if_ai_mismatches_after_retry():
    # 재시도까지 photoCaptions 개수가 계속 안 맞는 극단적인 경우에도
    # (AITransientError/AIValidationFailedError로 fallback 처리되어) 최종 응답 개수는 항상 사진 수와 일치해야 한다.
    mismatched = _fake_raw_diary(photo_count=0)  # 사진은 1장인데 캡션 0개로 응답
    fake_client = _fake_gemini_client(mismatched, mismatched)
    files = [("photos", _photo_file())]

    with patch.object(diary_ai_generator, "get_gemini_client", return_value=fake_client):
        response = client.post("/api/diaries/generate", data=_fields(), files=files)

    assert response.status_code == 200
    body = response.json()["data"]
    assert len(body["photoCaptions"]) == 1
    assert body["generationMode"] == "fallback"


# ---------------------------------------------------------------------------
# storyCards: 사진 0/1/3/5장별 카드 생성, photoIndexes 범위, type/layoutVariant 검증, fallback
# ---------------------------------------------------------------------------


def test_zero_photos_produce_text_only_story_cards():
    with patch.object(
        diary_ai_generator, "get_gemini_client", return_value=_fake_gemini_client(_fake_raw_diary(photo_count=0))
    ):
        response = client.post("/api/diaries/generate", data=_fields())

    assert response.status_code == 200
    cards = response.json()["data"]["storyCards"]
    assert 3 <= len(cards) <= 6
    for card in cards:
        assert card["photoIndexes"] == []
        assert card["type"] in ("cover", "quote", "ending")


def test_one_photo_produces_story_cards_without_excessive_repetition():
    files = [("photos", _photo_file())]
    with patch.object(
        diary_ai_generator, "get_gemini_client", return_value=_fake_gemini_client(_fake_raw_diary(photo_count=1))
    ):
        response = client.post("/api/diaries/generate", data=_fields(), files=files)

    assert response.status_code == 200
    cards = response.json()["data"]["storyCards"]
    assert 3 <= len(cards) <= 6
    usage_count = sum(card["photoIndexes"].count(0) for card in cards)
    assert usage_count <= 2


def test_three_photos_produce_story_cards_within_range():
    files = [("photos", _photo_file(name=f"p{i}.jpg")) for i in range(3)]
    with patch.object(
        diary_ai_generator, "get_gemini_client", return_value=_fake_gemini_client(_fake_raw_diary(photo_count=3))
    ):
        response = client.post("/api/diaries/generate", data=_fields(memo="세 장 테스트"), files=files)

    assert response.status_code == 200
    cards = response.json()["data"]["storyCards"]
    assert 3 <= len(cards) <= 6
    used_indexes = {idx for card in cards for idx in card["photoIndexes"]}
    assert used_indexes.issubset({0, 1, 2})


def test_five_photos_produce_story_cards_within_range():
    files = [("photos", _photo_file(name=f"p{i}.jpg")) for i in range(5)]
    with patch.object(
        diary_ai_generator, "get_gemini_client", return_value=_fake_gemini_client(_fake_raw_diary(photo_count=5))
    ):
        response = client.post("/api/diaries/generate", data=_fields(memo="다섯 장 테스트"), files=files)

    assert response.status_code == 200
    cards = response.json()["data"]["storyCards"]
    assert 3 <= len(cards) <= 6
    used_indexes = {idx for card in cards for idx in card["photoIndexes"]}
    assert all(0 <= idx < 5 for idx in used_indexes)


def test_photo_index_out_of_range_in_story_card_falls_back_to_template():
    bad = _fake_raw_diary(photo_count=1)
    bad["storyCards"][0]["photoIndexes"] = [5]  # 사진은 1장인데 존재하지 않는 인덱스를 참조
    fake_client = _fake_gemini_client(bad, bad)  # 재시도 후에도 동일하게 잘못된 응답
    files = [("photos", _photo_file())]

    with patch.object(diary_ai_generator, "get_gemini_client", return_value=fake_client):
        response = client.post("/api/diaries/generate", data=_fields(), files=files)

    assert response.status_code == 200
    body = response.json()["data"]
    assert body["generationMode"] == "fallback"
    assert 3 <= len(body["storyCards"]) <= 6


def test_story_card_count_outside_range_falls_back_to_template():
    bad = _fake_raw_diary(photo_count=0)
    bad["storyCards"] = bad["storyCards"][:2]  # 최소 3개 미만
    fake_client = _fake_gemini_client(bad, bad)

    with patch.object(diary_ai_generator, "get_gemini_client", return_value=fake_client):
        response = client.post("/api/diaries/generate", data=_fields())

    assert response.status_code == 200
    assert response.json()["data"]["generationMode"] == "fallback"


def test_invalid_story_card_type_retries_then_succeeds():
    valid_payload = _fake_raw_diary(photo_count=0)
    invalid_payload = json.loads(json.dumps(valid_payload))
    invalid_payload["storyCards"][0]["type"] = "not_a_real_type"
    fake_client = _fake_gemini_client(invalid_payload, valid_payload)

    with patch.object(diary_ai_generator, "get_gemini_client", return_value=fake_client):
        response = client.post("/api/diaries/generate", data=_fields())

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["generationMode"] == "ai"
    assert fake_client.models.generate_content.call_count == 2


def test_invalid_layout_variant_retries_then_succeeds():
    valid_payload = _fake_raw_diary(photo_count=0)
    invalid_payload = json.loads(json.dumps(valid_payload))
    invalid_payload["storyCards"][0]["layoutVariant"] = "not_a_real_layout"
    fake_client = _fake_gemini_client(invalid_payload, valid_payload)

    with patch.object(diary_ai_generator, "get_gemini_client", return_value=fake_client):
        response = client.post("/api/diaries/generate", data=_fields())

    assert response.status_code == 200
    assert response.json()["data"]["generationMode"] == "ai"


def test_fallback_story_cards_include_cover_quote_and_ending():
    with patch.object(
        diary_service.diary_ai_generator,
        "generate_diary_with_ai",
        side_effect=AITransientError("network down"),
    ):
        response = client.post("/api/diaries/generate", data=_fields())

    assert response.status_code == 200
    body = response.json()["data"]
    assert body["generationMode"] == "fallback"
    types = [card["type"] for card in body["storyCards"]]
    assert "cover" in types
    assert "quote" in types
    assert "ending" in types
    assert 3 <= len(body["storyCards"]) <= 6


def test_story_card_ids_and_layout_fields_are_normalized():
    with patch.object(
        diary_ai_generator, "get_gemini_client", return_value=_fake_gemini_client(_fake_raw_diary(photo_count=0))
    ):
        response = client.post("/api/diaries/generate", data=_fields())

    assert response.status_code == 200
    cards = response.json()["data"]["storyCards"]
    assert [card["id"] for card in cards] == [f"card-{i + 1}" for i in range(len(cards))]
    for card in cards:
        assert card["layoutVariant"] in ("full-bleed", "framed", "split-2", "asymmetric", "text-only")


# ---------------------------------------------------------------------------
# 20. 기존 GET /health, /docs 정상
# ---------------------------------------------------------------------------


def test_health_still_ok_after_diary_feature():
    response = client.get("/health")
    assert response.status_code == 200


def test_docs_expose_diary_generate():
    response = client.get("/openapi.json")
    assert response.status_code == 200
    assert "/api/diaries/generate" in response.json()["paths"]
