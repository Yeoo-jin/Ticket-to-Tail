from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.timeline import TimelineGenerateRequest
from app.services.place_data import load_places
from app.services.timeline_service import generate_timeline
from app.utils.errors import InvalidInputError

client = TestClient(app)

PLACES_BY_ID = {p.placeId: p for p in load_places()}

DEMO_BOOKINGS = [
    {
        "type": "flight",
        "departureLocation": None,
        "arrivalLocation": "인천공항",
        "departureTime": None,
        "arrivalTime": "2026-08-12T10:30:00",
    },
    {
        "type": "train",
        "departureLocation": "서울역",
        "arrivalLocation": "부산역",
        "departureTime": "2026-08-12T13:20:00",
        "arrivalTime": "2026-08-12T16:05:00",
    },
    {
        "type": "flight",
        "departureLocation": "인천공항",
        "arrivalLocation": None,
        "departureTime": "2026-08-14T18:00:00",
        "arrivalTime": None,
    },
]

LATEST_ARRIVAL = datetime.fromisoformat("2026-08-12T16:05:00")
RETURN_DEPARTURE = datetime.fromisoformat("2026-08-14T18:00:00")


def _request(**overrides):
    payload = {
        "bookings": DEMO_BOOKINGS,
        "companionTypes": ["infant"],
        "selectedPlaceIds": ["place-001"],
        "destination": "부산",
        "pace": "normal",
        "seed": 1,
    }
    payload.update(overrides)
    return TimelineGenerateRequest(**payload)


def _dt(item_time: str) -> datetime:
    return datetime.fromisoformat(item_time)


# ---------------------------------------------------------------------------
# 관광지 1개 / 3개 정상 생성
# ---------------------------------------------------------------------------


def test_generates_timeline_with_one_selected_place():
    data = generate_timeline(_request(selectedPlaceIds=["place-001"]))
    assert data.summary.placeCount == 1
    attraction_place_ids = [i.placeId for i in data.timeline if i.type == "attraction"]
    assert attraction_place_ids == ["place-001"]


def test_generates_timeline_with_three_selected_places():
    data = generate_timeline(_request(selectedPlaceIds=["place-001", "place-009", "place-013"], companionTypes=["infant"]))
    attraction_place_ids = {i.placeId for i in data.timeline if i.type == "attraction"}
    assert attraction_place_ids == {"place-001", "place-009", "place-013"}
    assert data.summary.placeCount == 3


# ---------------------------------------------------------------------------
# 0개 또는 4개 선택 시 400 / 존재하지 않는 placeId 거부
# ---------------------------------------------------------------------------


def test_zero_selected_places_raises_invalid_input():
    with pytest.raises(InvalidInputError):
        generate_timeline(_request(selectedPlaceIds=[]))


def test_four_selected_places_raises_invalid_input():
    with pytest.raises(InvalidInputError):
        generate_timeline(
            _request(selectedPlaceIds=["place-001", "place-006", "place-008", "place-009"])
        )


def test_unknown_place_id_raises_invalid_input():
    with pytest.raises(InvalidInputError):
        generate_timeline(_request(selectedPlaceIds=["place-does-not-exist"]))


def test_api_rejects_zero_places_with_400():
    response = client.post(
        "/api/timelines/generate",
        json={
            "bookings": DEMO_BOOKINGS,
            "companionTypes": ["infant"],
            "selectedPlaceIds": [],
            "destination": "부산",
            "pace": "normal",
        },
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


def test_api_rejects_four_places_with_400():
    response = client.post(
        "/api/timelines/generate",
        json={
            "bookings": DEMO_BOOKINGS,
            "companionTypes": ["infant"],
            "selectedPlaceIds": ["place-001", "place-006", "place-008", "place-009"],
            "destination": "부산",
            "pace": "normal",
        },
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


def test_api_rejects_unknown_place_id_with_400():
    response = client.post(
        "/api/timelines/generate",
        json={
            "bookings": DEMO_BOOKINGS,
            "companionTypes": ["infant"],
            "selectedPlaceIds": ["place-unknown"],
            "destination": "부산",
            "pace": "normal",
        },
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


# ---------------------------------------------------------------------------
# 도착 시각 이전 일정 없음 / 다음 출발 시각 이후 일정 없음
# ---------------------------------------------------------------------------


def test_no_estimated_items_before_arrival_or_after_return_departure():
    data = generate_timeline(
        _request(selectedPlaceIds=["place-001", "place-009", "place-013"], companionTypes=["infant"])
    )
    for item in data.timeline:
        if item.estimated:
            assert _dt(item.startTime) >= LATEST_ARRIVAL
            assert _dt(item.endTime) <= RETURN_DEPARTURE


# ---------------------------------------------------------------------------
# 운영시간 준수
# ---------------------------------------------------------------------------


def test_attractions_respect_place_operating_hours():
    data = generate_timeline(
        _request(selectedPlaceIds=["place-001", "place-009", "place-013"], companionTypes=["infant"])
    )
    for item in data.timeline:
        if item.type != "attraction":
            continue
        place = PLACES_BY_ID[item.placeId]
        if place.closeTime == "24:00":
            continue
        start_hm = _dt(item.startTime).strftime("%H:%M")
        end_hm = _dt(item.endTime).strftime("%H:%M")
        assert place.openTime <= start_hm
        assert end_hm <= place.closeTime


# ---------------------------------------------------------------------------
# 시간 중복 없음 / 시간순 정렬
# ---------------------------------------------------------------------------


def test_timeline_items_do_not_overlap_and_are_sorted():
    data = generate_timeline(
        _request(selectedPlaceIds=["place-001", "place-009", "place-013"], companionTypes=["infant"])
    )
    items = data.timeline
    for previous, current in zip(items, items[1:]):
        assert _dt(previous.startTime) <= _dt(current.startTime)
        assert _dt(previous.endTime) <= _dt(current.startTime)


# ---------------------------------------------------------------------------
# 유아 동반 휴식 증가 / 교통약자 이동 여유 증가
# ---------------------------------------------------------------------------


def _rest_minutes_total(data):
    return sum(
        int((_dt(i.endTime) - _dt(i.startTime)).total_seconds() // 60) for i in data.timeline if i.type == "rest"
    )


def test_infant_gets_more_rest_than_solo():
    solo = generate_timeline(
        _request(selectedPlaceIds=["place-001", "place-009", "place-013"], companionTypes=["solo"], seed=5)
    )
    infant = generate_timeline(
        _request(selectedPlaceIds=["place-001", "place-009", "place-013"], companionTypes=["infant"], seed=5)
    )
    assert _rest_minutes_total(infant) > _rest_minutes_total(solo)


def test_mobility_impaired_gets_more_travel_buffer_than_solo():
    solo = generate_timeline(
        _request(selectedPlaceIds=["place-001", "place-009", "place-013"], companionTypes=["solo"], seed=5)
    )
    mobility = generate_timeline(
        _request(selectedPlaceIds=["place-001", "place-009", "place-013"], companionTypes=["mobility_impaired"], seed=5)
    )
    assert mobility.summary.estimatedTravelMinutes > solo.summary.estimatedTravelMinutes


# ---------------------------------------------------------------------------
# normal과 relaxed 차이
# ---------------------------------------------------------------------------


def test_relaxed_pace_gives_more_room_than_normal():
    normal = generate_timeline(
        _request(selectedPlaceIds=["place-001", "place-009", "place-013"], companionTypes=["senior"], pace="normal", seed=9)
    )
    relaxed = generate_timeline(
        _request(selectedPlaceIds=["place-001", "place-009", "place-013"], companionTypes=["senior"], pace="relaxed", seed=9)
    )
    assert _rest_minutes_total(relaxed) >= _rest_minutes_total(normal)
    assert relaxed.summary.estimatedTravelMinutes >= normal.summary.estimatedTravelMinutes


# ---------------------------------------------------------------------------
# 같은 seed 결과 재현 / 다시 생성해도 선택 관광지 유지
# ---------------------------------------------------------------------------


def test_same_seed_reproduces_identical_timeline():
    request = _request(selectedPlaceIds=["place-001", "place-009", "place-013"], companionTypes=["infant"], seed=123)
    first = generate_timeline(request)
    second = generate_timeline(request)
    assert [item.model_dump() for item in first.timeline] == [item.model_dump() for item in second.timeline]


def test_regenerating_with_different_seed_keeps_same_selected_places():
    ids = ["place-001", "place-009", "place-013"]
    first = generate_timeline(_request(selectedPlaceIds=ids, companionTypes=["infant"], seed=1))
    second = generate_timeline(_request(selectedPlaceIds=ids, companionTypes=["infant"], seed=2))

    first_places = {i.placeId for i in first.timeline if i.type == "attraction"}
    second_places = {i.placeId for i in second.timeline if i.type == "attraction"}
    assert first_places == set(ids)
    assert second_places == set(ids)


# ---------------------------------------------------------------------------
# 복수 동행 조건 결합
# ---------------------------------------------------------------------------


def test_single_companion_type_still_works():
    data = generate_timeline(_request(selectedPlaceIds=["place-001"], companionTypes=["senior"]))
    assert data.summary.companionTypes == ["senior"]
    assert data.summary.placeCount == 1


def test_friends_couple_and_infant_combination_is_accepted():
    data = generate_timeline(
        _request(selectedPlaceIds=["place-001", "place-009"], companionTypes=["friends_couple", "infant"])
    )
    assert set(data.summary.companionTypes) == {"friends_couple", "infant"}
    assert data.summary.placeCount == 2


def test_infant_and_senior_combination_is_accepted():
    data = generate_timeline(
        _request(selectedPlaceIds=["place-001", "place-009"], companionTypes=["infant", "senior"])
    )
    assert set(data.summary.companionTypes) == {"infant", "senior"}
    assert data.summary.placeCount == 2


def test_infant_plus_mobility_impaired_gives_more_room_than_either_alone():
    ids = ["place-001", "place-009", "place-013"]
    infant_only = generate_timeline(_request(selectedPlaceIds=ids, companionTypes=["infant"], seed=5))
    mobility_only = generate_timeline(_request(selectedPlaceIds=ids, companionTypes=["mobility_impaired"], seed=5))
    combined = generate_timeline(
        _request(selectedPlaceIds=ids, companionTypes=["infant", "mobility_impaired"], seed=5)
    )

    assert combined.summary.estimatedTravelMinutes >= infant_only.summary.estimatedTravelMinutes
    assert combined.summary.estimatedTravelMinutes >= mobility_only.summary.estimatedTravelMinutes
    assert _rest_minutes_total(combined) >= _rest_minutes_total(infant_only)
    assert _rest_minutes_total(combined) >= _rest_minutes_total(mobility_only)


def test_combination_order_does_not_change_result():
    ids = ["place-001", "place-009", "place-013"]
    order_a = generate_timeline(
        _request(selectedPlaceIds=ids, companionTypes=["infant", "mobility_impaired"], seed=7)
    )
    order_b = generate_timeline(
        _request(selectedPlaceIds=ids, companionTypes=["mobility_impaired", "infant"], seed=7)
    )
    assert order_a.summary.model_dump() == order_b.summary.model_dump()
    assert [item.model_dump() for item in order_a.timeline] == [item.model_dump() for item in order_b.timeline]


def test_duplicate_companion_type_value_raises_invalid_input():
    with pytest.raises(InvalidInputError):
        generate_timeline(_request(selectedPlaceIds=["place-001"], companionTypes=["infant", "infant"]))


def test_empty_companion_types_raises_invalid_input():
    with pytest.raises(InvalidInputError):
        generate_timeline(_request(selectedPlaceIds=["place-001"], companionTypes=[]))


def test_solo_alone_is_allowed():
    data = generate_timeline(_request(selectedPlaceIds=["place-001"], companionTypes=["solo"]))
    assert data.summary.companionTypes == ["solo"]


def test_solo_combined_with_other_condition_raises_invalid_input():
    with pytest.raises(InvalidInputError):
        generate_timeline(_request(selectedPlaceIds=["place-001"], companionTypes=["solo", "infant"]))


def test_api_rejects_duplicate_companion_type_with_400():
    response = client.post(
        "/api/timelines/generate",
        json={
            "bookings": DEMO_BOOKINGS,
            "companionTypes": ["pet", "pet"],
            "selectedPlaceIds": ["place-001"],
            "destination": "부산",
            "pace": "normal",
        },
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


def test_api_rejects_empty_companion_types_with_400():
    response = client.post(
        "/api/timelines/generate",
        json={
            "bookings": DEMO_BOOKINGS,
            "companionTypes": [],
            "selectedPlaceIds": ["place-001"],
            "destination": "부산",
            "pace": "normal",
        },
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


def test_api_rejects_solo_combined_with_other_condition_with_400():
    response = client.post(
        "/api/timelines/generate",
        json={
            "bookings": DEMO_BOOKINGS,
            "companionTypes": ["solo", "friends_couple", "senior"],
            "selectedPlaceIds": ["place-001"],
            "destination": "부산",
            "pace": "normal",
        },
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


def test_api_accepts_solo_alone():
    response = client.post(
        "/api/timelines/generate",
        json={
            "bookings": DEMO_BOOKINGS,
            "companionTypes": ["solo"],
            "selectedPlaceIds": ["place-001"],
            "destination": "부산",
            "pace": "normal",
        },
    )
    assert response.status_code == 200
    assert response.json()["data"]["summary"]["companionTypes"] == ["solo"]


def test_api_accepts_multiple_different_companion_types():
    response = client.post(
        "/api/timelines/generate",
        json={
            "bookings": DEMO_BOOKINGS,
            "companionTypes": ["friends_couple", "mobility_impaired", "pet"],
            "selectedPlaceIds": ["place-006"],
            "destination": "부산",
            "pace": "normal",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert set(body["data"]["summary"]["companionTypes"]) == {"friends_couple", "mobility_impaired", "pet"}


# ---------------------------------------------------------------------------
# pet 동행: 반려동물 비허용 장소 제외 + warnings
# ---------------------------------------------------------------------------


def test_pet_companion_excludes_non_pet_places_with_warning():
    # place-001(국립해양박물관)은 pet을 지원하지 않는다.
    assert "pet" not in PLACES_BY_ID["place-001"].companionTypes
    data = generate_timeline(_request(selectedPlaceIds=["place-001"], companionTypes=["pet"]))
    assert data.summary.placeCount == 0
    assert any("place-001" not in w and "국립해양박물관" in w for w in data.warnings)


def test_pet_combined_with_other_condition_still_excludes_non_pet_places():
    # companionTypes에 pet이 "포함"되어 있기만 해도(다른 조건과 함께여도) 비허용 장소는 제외되어야 한다.
    assert "pet" not in PLACES_BY_ID["place-001"].companionTypes
    data = generate_timeline(
        _request(selectedPlaceIds=["place-001"], companionTypes=["pet", "friends_couple"])
    )
    assert data.summary.placeCount == 0
    assert any("국립해양박물관" in w for w in data.warnings)


# ---------------------------------------------------------------------------
# API 레벨 정상 흐름 (200)
# ---------------------------------------------------------------------------


def test_api_generates_timeline_successfully():
    response = client.post(
        "/api/timelines/generate",
        json={
            "bookings": DEMO_BOOKINGS,
            "companionTypes": ["infant"],
            "selectedPlaceIds": ["place-001", "place-009"],
            "destination": "부산",
            "pace": "normal",
            "seed": 1,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["summary"]["placeCount"] == 2
    assert body["data"]["warnings"] == []
    types = {item["type"] for item in body["data"]["timeline"]}
    assert types <= {"arrival", "transport", "attraction", "rest", "departure"}


# ---------------------------------------------------------------------------
# 기존 GET /health, /docs 정상
# ---------------------------------------------------------------------------


def test_health_still_ok_after_timeline_feature():
    response = client.get("/health")
    assert response.status_code == 200


def test_docs_expose_timeline_generate():
    response = client.get("/openapi.json")
    assert response.status_code == 200
    assert "/api/timelines/generate" in response.json()["paths"]
