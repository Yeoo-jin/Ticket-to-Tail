import json
from datetime import datetime
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import booking_ai_extractor
from app.services.ai_providers import anthropic_provider, gemini_provider
from app.utils import ai_retry

client = TestClient(app)

FIXED_NOW = datetime(2026, 8, 1, 12, 0, tzinfo=ZoneInfo("Asia/Seoul"))


@pytest.fixture(autouse=True)
def ai_env(monkeypatch):
    # 기본 provider(gemini)를 사용하는 테스트를 위한 환경변수.
    monkeypatch.setenv("AI_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "test-gemini-key")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.6-flash")
    # 보조 provider(anthropic) 관련 테스트에서도 쓸 수 있도록 함께 설정.
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-anthropic-key")
    monkeypatch.setenv("ANTHROPIC_MODEL", "test-model")


@pytest.fixture(autouse=True)
def fixed_now(monkeypatch):
    monkeypatch.setattr("app.services.datetime_normalizer.now_kst", lambda: FIXED_NOW)
    yield FIXED_NOW


# ---------------------------------------------------------------------------
# Gemini mock 유틸
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Anthropic mock 유틸 (AI_PROVIDER=anthropic 검증용)
# ---------------------------------------------------------------------------


class FakeToolUseBlock:
    def __init__(self, tool_input, block_id="tool_1"):
        self.type = "tool_use"
        self.name = "extract_bookings"
        self.input = tool_input
        self.id = block_id

    def model_dump(self):
        return {"type": self.type, "id": self.id, "name": self.name, "input": self.input}


class FakeAnthropicResponse:
    def __init__(self, content):
        self.content = content


def _fake_anthropic_client(*tool_inputs):
    fake_client = MagicMock()
    responses = [FakeAnthropicResponse([FakeToolUseBlock(ti)]) for ti in tool_inputs]
    fake_client.messages.create.side_effect = responses
    return fake_client


def _booking_event(
    type_,
    dep_loc=None,
    arr_loc=None,
    dep_year=None,
    dep_month=None,
    dep_day=None,
    dep_period=None,
    dep_hour=None,
    dep_minute=None,
    arr_year=None,
    arr_month=None,
    arr_day=None,
    arr_period=None,
    arr_hour=None,
    arr_minute=None,
):
    return {
        "type": type_,
        "departureLocation": dep_loc,
        "arrivalLocation": arr_loc,
        "departureYear": dep_year,
        "departureMonth": dep_month,
        "departureDay": dep_day,
        "departurePeriod": dep_period,
        "departureHour": dep_hour,
        "departureMinute": dep_minute,
        "arrivalYear": arr_year,
        "arrivalMonth": arr_month,
        "arrivalDay": arr_day,
        "arrivalPeriod": arr_period,
        "arrivalHour": arr_hour,
        "arrivalMinute": arr_minute,
    }


FULL_TEXT = (
    "2026년 8월 12일 오전 10시 30분 인천공항 도착. "
    "오후 1시 20분 서울역에서 KTX 출발, 오후 4시 5분 부산역 도착. "
    "8월 14일 오후 6시 인천공항 출발."
)

NO_YEAR_TEXT = (
    "8월 12일 오전 10시 30분 인천공항 도착. "
    "오후 1시 20분 서울역에서 KTX 출발, 오후 4시 5분 부산역 도착. "
    "8월 14일 오후 6시 인천공항 출발."
)

SPARSE_TEXT = "서울역에서 부산역까지 이동합니다."


def _full_year_payload():
    return {
        "bookings": [
            _booking_event(
                "flight",
                arr_loc="인천공항",
                arr_year=2026, arr_month=8, arr_day=12, arr_period="AM", arr_hour=10, arr_minute=30,
            ),
            _booking_event(
                "train",
                dep_loc="서울역", arr_loc="부산역",
                dep_year=2026, dep_month=8, dep_day=12, dep_period="PM", dep_hour=1, dep_minute=20,
                arr_year=2026, arr_month=8, arr_day=12, arr_period="PM", arr_hour=4, arr_minute=5,
            ),
            _booking_event(
                "flight",
                dep_loc="인천공항",
                dep_year=2026, dep_month=8, dep_day=14, dep_period="PM", dep_hour=6, dep_minute=0,
            ),
        ]
    }


def _no_year_payload():
    data = _full_year_payload()
    for booking in data["bookings"]:
        booking["departureYear"] = None
        booking["arrivalYear"] = None
    return data


# ---------------------------------------------------------------------------
# 1. 연도 포함 정상 입력
# ---------------------------------------------------------------------------


def test_year_included_full_input():
    with patch.object(gemini_provider, "get_gemini_client", return_value=_fake_gemini_client(_full_year_payload())):
        response = client.post("/api/bookings/parse", data={"bookingText": FULL_TEXT})

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True

    bookings = body["data"]["bookings"]
    assert [b["type"] for b in bookings] == ["flight", "train", "flight"]

    assert bookings[0]["arrivalLocation"] == "인천공항"
    assert bookings[0]["departureLocation"] is None
    assert bookings[0]["arrivalTime"] == "2026-08-12T10:30:00"
    assert bookings[0]["departureTime"] is None

    assert bookings[1]["departureLocation"] == "서울역"
    assert bookings[1]["arrivalLocation"] == "부산역"
    assert bookings[1]["departureTime"] == "2026-08-12T13:20:00"
    assert bookings[1]["arrivalTime"] == "2026-08-12T16:05:00"

    assert bookings[2]["departureLocation"] == "인천공항"
    assert bookings[2]["arrivalLocation"] is None
    assert bookings[2]["departureTime"] == "2026-08-14T18:00:00"
    assert bookings[2]["arrivalTime"] is None

    assert body["data"]["missingFields"] == []


# ---------------------------------------------------------------------------
# 2. 연도 없는 정상 입력
# ---------------------------------------------------------------------------


def test_no_year_input_uses_current_kst_year():
    with patch.object(gemini_provider, "get_gemini_client", return_value=_fake_gemini_client(_no_year_payload())):
        response = client.post("/api/bookings/parse", data={"bookingText": NO_YEAR_TEXT})

    assert response.status_code == 200
    body = response.json()
    bookings = body["data"]["bookings"]

    assert bookings[0]["arrivalTime"] == "2026-08-12T10:30:00"
    assert bookings[1]["departureTime"] == "2026-08-12T13:20:00"
    assert bookings[1]["arrivalTime"] == "2026-08-12T16:05:00"
    assert bookings[2]["departureTime"] == "2026-08-14T18:00:00"
    assert body["data"]["missingFields"] == []


# ---------------------------------------------------------------------------
# 2-1. (회귀) 날짜가 앞 문장에만 있고 뒤 이벤트는 시간만 있는 경우 이어받기
#
# 실제 Gemini API로 FULL_TEXT를 호출했을 때, 중간 열차 구간의 month/day를
# null로 남기고 hour/minute만 채워 반환한 사례를 그대로 재현한 회귀 테스트.
# ---------------------------------------------------------------------------


def test_date_carried_forward_when_only_time_given_for_later_event():
    payload = {
        "bookings": [
            _booking_event(
                "flight",
                arr_loc="인천공항",
                arr_year=2026, arr_month=8, arr_day=12, arr_period="AM", arr_hour=10, arr_minute=30,
            ),
            _booking_event(
                # 실제 Gemini 응답처럼 month/day가 비어있고 hour/minute만 있는 경우
                "train",
                dep_loc="서울역", arr_loc="부산역",
                dep_period="PM", dep_hour=1, dep_minute=20,
                arr_period="PM", arr_hour=4, arr_minute=5,
            ),
            _booking_event(
                "flight",
                dep_loc="인천공항",
                dep_year=2026, dep_month=8, dep_day=14, dep_period="PM", dep_hour=6, dep_minute=0,
            ),
        ]
    }
    with patch.object(gemini_provider, "get_gemini_client", return_value=_fake_gemini_client(payload)):
        response = client.post("/api/bookings/parse", data={"bookingText": FULL_TEXT})

    assert response.status_code == 200
    body = response.json()
    bookings = body["data"]["bookings"]

    # 직전에 확인된 날짜(2026-08-12)가 이어져서 적용되어야 한다.
    assert bookings[1]["departureTime"] == "2026-08-12T13:20:00"
    assert bookings[1]["arrivalTime"] == "2026-08-12T16:05:00"
    assert body["data"]["missingFields"] == []


# ---------------------------------------------------------------------------
# 3. 정보 부족 입력
# ---------------------------------------------------------------------------


def test_sparse_input_reports_missing_date_and_time_both_directions():
    payload = {"bookings": [_booking_event("train", dep_loc="서울역", arr_loc="부산역")]}
    with patch.object(gemini_provider, "get_gemini_client", return_value=_fake_gemini_client(payload)):
        response = client.post("/api/bookings/parse", data={"bookingText": SPARSE_TEXT})

    assert response.status_code == 200
    body = response.json()
    booking = body["data"]["bookings"][0]

    assert booking["type"] == "train"
    assert booking["departureLocation"] == "서울역"
    assert booking["arrivalLocation"] == "부산역"
    assert booking["departureTime"] is None
    assert booking["arrivalTime"] is None

    assert body["data"]["missingFields"] == [
        "열차 출발 날짜",
        "열차 출발 시간",
        "열차 도착 날짜",
        "열차 도착 시간",
    ]


# ---------------------------------------------------------------------------
# 4. 빈 문자열
# ---------------------------------------------------------------------------


def test_empty_booking_text_returns_400_invalid_input():
    response = client.post("/api/bookings/parse", data={"bookingText": "   "})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


def test_missing_booking_text_field_returns_400_invalid_input():
    response = client.post("/api/bookings/parse", data={})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


# ---------------------------------------------------------------------------
# 5. 잘못된 Gemini JSON 후 재시도
# ---------------------------------------------------------------------------


def test_gemini_invalid_json_retries_once_then_succeeds():
    invalid_text = "이건 유효한 JSON이 아닙니다 {"
    valid_payload = {
        "bookings": [
            _booking_event(
                "train",
                dep_loc="서울역", arr_loc="부산역",
                dep_year=2026, dep_month=8, dep_day=12, dep_period="PM", dep_hour=1, dep_minute=20,
                arr_year=2026, arr_month=8, arr_day=12, arr_period="PM", arr_hour=4, arr_minute=5,
            )
        ]
    }
    fake_client = _fake_gemini_client(invalid_text, valid_payload)

    with patch.object(gemini_provider, "get_gemini_client", return_value=fake_client):
        response = client.post("/api/bookings/parse", data={"bookingText": "서울역에서 부산역까지 KTX로 이동"})

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["bookings"][0]["type"] == "train"
    assert body["data"]["bookings"][0]["departureTime"] == "2026-08-12T13:20:00"
    assert fake_client.models.generate_content.call_count == 2


def test_gemini_transient_network_error_is_retried_and_succeeds(monkeypatch):
    # 네트워크 순단처럼 한 번은 실패했다가 바로 다음 시도에서 성공하는 경우, fallback으로
    # 넘어가지 않고 재시도만으로 정상 응답이 나와야 한다.
    monkeypatch.setattr(ai_retry.time, "sleep", lambda *_args: None)

    valid_payload = {
        "bookings": [_booking_event("train", dep_loc="서울역", arr_loc="부산역")]
    }
    fake_client = MagicMock()
    fake_client.models.generate_content.side_effect = [
        httpx.TimeoutException("timed out"),
        FakeGeminiResponse(payload=valid_payload),
    ]

    with patch.object(gemini_provider, "get_gemini_client", return_value=fake_client):
        response = client.post("/api/bookings/parse", data={"bookingText": "서울역에서 부산역까지 KTX로 이동"})

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["bookings"][0]["type"] == "train"
    assert fake_client.models.generate_content.call_count == 2


# ---------------------------------------------------------------------------
# 6. Gemini 장애 후 fallback
# ---------------------------------------------------------------------------


def test_gemini_transient_failure_falls_back_to_rule_based_parser():
    with patch.object(
        gemini_provider,
        "extract_bookings",
        side_effect=booking_ai_extractor.AITransientError("network down"),
    ):
        response = client.post("/api/bookings/parse", data={"bookingText": FULL_TEXT})

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True

    bookings = body["data"]["bookings"]
    assert [b["type"] for b in bookings] == ["flight", "train", "flight"]
    assert bookings[0]["arrivalLocation"] == "인천공항"
    assert bookings[1]["departureLocation"] == "서울역"
    assert bookings[1]["arrivalLocation"] == "부산역"
    assert bookings[2]["departureLocation"] == "인천공항"


# ---------------------------------------------------------------------------
# 7. API 키 누락 오류 (조용히 fallback하지 않아야 함)
# ---------------------------------------------------------------------------


def test_missing_gemini_api_key_returns_config_error_without_silent_fallback(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    response = client.post("/api/bookings/parse", data={"bookingText": FULL_TEXT})

    assert response.status_code == 500
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "AI_CONFIG_ERROR"


# ---------------------------------------------------------------------------
# 8. GET /health, /docs 노출
# ---------------------------------------------------------------------------


def test_health_still_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_docs_expose_booking_parse():
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/api/bookings/parse" in paths

    docs_response = client.get("/docs")
    assert docs_response.status_code == 200


# ---------------------------------------------------------------------------
# 보너스: AI_PROVIDER로 공급자 선택이 실제로 동작하는지 확인
# ---------------------------------------------------------------------------


def test_ai_provider_env_dispatches_to_anthropic(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "anthropic")
    payload = {
        "bookings": [
            _booking_event(
                "train",
                dep_loc="서울역", arr_loc="부산역",
                dep_year=2026, dep_month=8, dep_day=12, dep_period="PM", dep_hour=1, dep_minute=20,
                arr_year=2026, arr_month=8, arr_day=12, arr_period="PM", arr_hour=4, arr_minute=5,
            )
        ]
    }

    with patch.object(anthropic_provider, "get_anthropic_client", return_value=_fake_anthropic_client(payload)):
        response = client.post("/api/bookings/parse", data={"bookingText": "서울역에서 부산역까지 KTX로 이동"})

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["bookings"][0]["type"] == "train"
    assert body["data"]["bookings"][0]["departureTime"] == "2026-08-12T13:20:00"


def test_unknown_ai_provider_returns_config_error(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "unknown-provider")

    response = client.post("/api/bookings/parse", data={"bookingText": FULL_TEXT})

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "AI_CONFIG_ERROR"


# ---------------------------------------------------------------------------
# 9. 사진 업로드 입력
# ---------------------------------------------------------------------------

_FAKE_PHOTO = ("ticket.png", b"fake-image-bytes", "image/png")


def test_photo_upload_extracts_bookings_via_multimodal_call():
    payload = {
        "bookings": [
            _booking_event(
                "train",
                dep_loc="서울역", arr_loc="부산역",
                dep_year=2026, dep_month=8, dep_day=12, dep_period="PM", dep_hour=1, dep_minute=20,
                arr_year=2026, arr_month=8, arr_day=12, arr_period="PM", arr_hour=4, arr_minute=5,
            )
        ]
    }
    fake_client = _fake_gemini_client(payload)

    with patch.object(gemini_provider, "get_gemini_client", return_value=fake_client):
        response = client.post("/api/bookings/parse", files=[("photos", _FAKE_PHOTO)])

    assert response.status_code == 200
    body = response.json()
    booking = body["data"]["bookings"][0]
    assert booking["type"] == "train"
    assert booking["departureLocation"] == "서울역"
    assert booking["departureTime"] == "2026-08-12T13:20:00"

    # 이미지가 실제로 멀티모달 contents에 실려 보내졌는지 확인 (텍스트 지시문 + 이미지 파트).
    call_kwargs = fake_client.models.generate_content.call_args.kwargs
    parts = call_kwargs["contents"][0]["parts"]
    assert len(parts) == 2


def test_two_photos_are_both_sent_in_one_multimodal_call():
    # 항공권 캡처 1장 + KTX 캡처 1장처럼 서로 다른 예매 내역을 사진 두 장으로 나눠 올려도
    # 한 번의 AI 호출에 두 이미지가 함께 실려 가고, 응답의 두 booking이 전부 반환돼야 한다.
    payload = {
        "bookings": [
            _booking_event("flight", dep_loc="김포공항", arr_loc="인천공항"),
            _booking_event(
                "train",
                dep_loc="서울역", arr_loc="부산역",
                dep_year=2026, dep_month=8, dep_day=12, dep_period="PM", dep_hour=1, dep_minute=20,
                arr_year=2026, arr_month=8, arr_day=12, arr_period="PM", arr_hour=4, arr_minute=5,
            ),
        ]
    }
    fake_client = _fake_gemini_client(payload)
    flight_photo = ("flight.png", b"fake-flight-bytes", "image/png")
    train_photo = ("ktx.jpg", b"fake-ktx-bytes", "image/jpeg")

    with patch.object(gemini_provider, "get_gemini_client", return_value=fake_client):
        response = client.post(
            "/api/bookings/parse",
            files=[("photos", flight_photo), ("photos", train_photo)],
        )

    assert response.status_code == 200
    bookings = response.json()["data"]["bookings"]
    assert [b["type"] for b in bookings] == ["flight", "train"]

    call_kwargs = fake_client.models.generate_content.call_args.kwargs
    parts = call_kwargs["contents"][0]["parts"]
    # 텍스트 지시문 1개 + 이미지 2개.
    assert len(parts) == 3


def test_both_text_and_photo_together_returns_400():
    response = client.post(
        "/api/bookings/parse",
        data={"bookingText": FULL_TEXT},
        files=[("photos", _FAKE_PHOTO)],
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


def test_photo_ai_transient_failure_returns_service_error_without_silent_fallback():
    # 사진 입력은 텍스트가 아니므로 정규식 기반 fallback을 쓸 수 없다 - 조용히 넘어가지
    # 않고 명확한 AI_SERVICE_ERROR로 응답해야 한다(텍스트 경로처럼 fallback되면 안 됨).
    with patch.object(
        gemini_provider,
        "extract_bookings_from_photos",
        side_effect=booking_ai_extractor.AITransientError("network down"),
    ):
        response = client.post("/api/bookings/parse", files=[("photos", _FAKE_PHOTO)])

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "AI_SERVICE_ERROR"


def test_location_whitespace_from_ai_is_trimmed():
    # 사진(OCR) 추출은 지명 앞뒤에 공백이 섞여 나오는 경우가 있다 - 그대로 두면 프론트의
    # 정확히 일치하는 지역명/환승 거점 매칭이 조용히 실패하므로 서버에서 정리해야 한다.
    payload = {
        "bookings": [
            _booking_event(
                "train",
                dep_loc=" 서울역", arr_loc="부산역 ",
                dep_year=2026, dep_month=8, dep_day=12, dep_period="PM", dep_hour=1, dep_minute=20,
                arr_year=2026, arr_month=8, arr_day=12, arr_period="PM", arr_hour=4, arr_minute=5,
            )
        ]
    }
    with patch.object(gemini_provider, "get_gemini_client", return_value=_fake_gemini_client(payload)):
        response = client.post("/api/bookings/parse", files=[("photos", _FAKE_PHOTO)])

    assert response.status_code == 200
    booking = response.json()["data"]["bookings"][0]
    assert booking["departureLocation"] == "서울역"
    assert booking["arrivalLocation"] == "부산역"


def test_unsupported_photo_mime_type_returns_400():
    response = client.post(
        "/api/bookings/parse",
        files=[("photos", ("ticket.gif", b"fake-bytes", "image/gif"))],
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


def test_six_photos_exceeds_max_returns_400():
    files = [("photos", (f"ticket{i}.png", b"fake-bytes", "image/png")) for i in range(6)]
    response = client.post("/api/bookings/parse", files=files)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"
