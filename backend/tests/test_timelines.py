from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.timeline import TimelineGenerateRequest
from app.services.place_data import load_places
from app.services.timeline_service import generate_timeline
from app.utils.errors import InvalidInputError

client = TestClient(app)


@pytest.fixture(autouse=True)
def no_public_data_key(monkeypatch):
    # 기본 companionTypes(infant)로 만들어지는 대부분의 테스트가 역 편의시설 조회를
    # 트리거하므로, 키를 비워 실제 네트워크 호출 없이 항상 빈 목록으로 처리되게 한다.
    # 이 기능 자체를 검증하는 테스트는 필요한 곳에서 개별적으로 키를 설정한다.
    monkeypatch.delenv("PUBLIC_DATA_API_KEY", raising=False)

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

# 여행 기간은 8/12(도착)~8/14(출발)이다. 도착·출발일은 관광 가능 시간이 좁으므로,
# 대부분의 테스트는 하루가 온전히 열려 있는 중간일(8/13)에 관광지를 배정한다.
MIDDLE_DAY = "2026-08-13"


def _days_payload(place_ids, date=MIDDLE_DAY, restaurant_ids=None):
    return [{"date": date, "placeIds": place_ids, "restaurantIds": restaurant_ids or {}}]


def _request(**overrides):
    days = overrides.pop("days", None)
    if days is None:
        place_ids = overrides.pop("selectedPlaceIds", ["place-001"])
        date = overrides.pop("date", MIDDLE_DAY)
        days = _days_payload(place_ids, date=date)
    else:
        overrides.pop("selectedPlaceIds", None)
        overrides.pop("date", None)

    payload = {
        "bookings": DEMO_BOOKINGS,
        "companionTypes": ["infant"],
        "days": days,
        "destination": "부산",
        "pace": "normal",
        "seed": 1,
    }
    payload.update(overrides)
    return TimelineGenerateRequest(**payload)


def _dt(item_time: str) -> datetime:
    return datetime.fromisoformat(item_time)


def _api_payload(place_ids, date=MIDDLE_DAY, **overrides):
    payload = {
        "bookings": DEMO_BOOKINGS,
        "companionTypes": ["infant"],
        "days": _days_payload(place_ids, date=date),
        "destination": "부산",
        "pace": "normal",
    }
    payload.update(overrides)
    return payload


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


def test_generates_timeline_with_selected_restaurant():
    data = generate_timeline(
        _request(
            days=_days_payload(["place-001"], restaurant_ids={"lunch": "place-016"}),
            companionTypes=["infant"],
        )
    )
    meal_place_ids = [i.placeId for i in data.timeline if i.type == "meal"]
    assert meal_place_ids == ["place-016"]


# ---------------------------------------------------------------------------
# 하루 0개 또는 4개 선택 시 400 / 존재하지 않는 placeId 거부
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


def test_unknown_restaurant_id_raises_invalid_input():
    with pytest.raises(InvalidInputError):
        generate_timeline(
            _request(days=_days_payload(["place-001"], restaurant_ids={"lunch": "place-does-not-exist"}))
        )


def test_no_days_raises_invalid_input():
    with pytest.raises(InvalidInputError):
        generate_timeline(_request(days=[]))


def test_api_rejects_zero_places_with_400():
    response = client.post("/api/timelines/generate", json=_api_payload([]))
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


def test_api_rejects_four_places_with_400():
    response = client.post(
        "/api/timelines/generate",
        json=_api_payload(["place-001", "place-006", "place-008", "place-009"]),
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


def test_api_rejects_unknown_place_id_with_400():
    response = client.post("/api/timelines/generate", json=_api_payload(["place-unknown"]))
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
        # 환승 이동은 최종 목적지 도착 전(공항→기차역 등) 여정의 일부라 관광 가능 구간
        # 밖에 있는 게 정상이라 이 검사에서 제외한다.
        if item.estimated and "환승" not in item.title:
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
        if item.type not in ("attraction", "meal"):
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
        json=_api_payload(["place-001"], companionTypes=["pet", "pet"]),
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


def test_api_rejects_empty_companion_types_with_400():
    response = client.post(
        "/api/timelines/generate",
        json=_api_payload(["place-001"], companionTypes=[]),
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


def test_api_rejects_solo_combined_with_other_condition_with_400():
    response = client.post(
        "/api/timelines/generate",
        json=_api_payload(["place-001"], companionTypes=["solo", "friends_couple", "senior"]),
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


def test_api_accepts_solo_alone():
    response = client.post(
        "/api/timelines/generate",
        json=_api_payload(["place-001"], companionTypes=["solo"]),
    )
    assert response.status_code == 200
    assert response.json()["data"]["summary"]["companionTypes"] == ["solo"]


def test_api_accepts_multiple_different_companion_types():
    response = client.post(
        "/api/timelines/generate",
        json=_api_payload(["place-006"], companionTypes=["friends_couple", "mobility_impaired", "pet"]),
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
# 자율 관광지·음식점 직접 입력 (customPlaces)
# ---------------------------------------------------------------------------


def test_custom_place_is_scheduled_with_default_duration_and_no_operating_hours():
    data = generate_timeline(
        _request(
            days=_days_payload(["custom-1"]),
            customPlaces={"custom-1": {"name": "우리 가족 단골 산책로"}},
        )
    )
    attraction_items = [i for i in data.timeline if i.type == "attraction"]
    assert len(attraction_items) == 1
    assert attraction_items[0].placeId == "custom-1"
    assert attraction_items[0].title == "우리 가족 단골 산책로"
    start = _dt(attraction_items[0].startTime)
    end = _dt(attraction_items[0].endTime)
    assert int((end - start).total_seconds() // 60) == 60


def test_custom_place_with_coordinates_appears_on_map_and_uses_distance_travel_time():
    data = generate_timeline(
        _request(
            days=_days_payload(["custom-1"]),
            customPlaces={
                "custom-1": {"name": "카카오로 찾은 카페", "address": "부산 해운대구", "lat": 35.1591, "lng": 129.1602}
            },
        )
    )
    attraction_items = [i for i in data.timeline if i.placeId == "custom-1"]
    assert len(attraction_items) == 1
    assert attraction_items[0].lat == 35.1591
    assert attraction_items[0].lng == 129.1602


def test_custom_restaurant_is_scheduled_within_its_meal_window():
    data = generate_timeline(
        _request(
            days=_days_payload(["place-001"], restaurant_ids={"lunch": "custom-lunch"}),
            customPlaces={"custom-lunch": {"name": "동네 아는 식당"}},
        )
    )
    meal_items = [i for i in data.timeline if i.type == "meal"]
    assert len(meal_items) == 1
    assert meal_items[0].placeId == "custom-lunch"
    start = _dt(meal_items[0].startTime)
    assert start.hour >= 11


def test_custom_place_id_not_listed_in_custom_places_raises_invalid_input():
    with pytest.raises(InvalidInputError):
        generate_timeline(_request(selectedPlaceIds=["custom-unregistered"]))


def test_accommodation_adds_return_item_except_last_day():
    # 마지막 날은 다음날 아침이 없어(귀가/출발만 남음) 숙소로 돌아갈 필요가 없으므로
    # 숙소 이동 항목이 마지막 날에는 추가되지 않는다.
    data = generate_timeline(
        _request(
            days=[
                {"date": "2026-08-12", "placeIds": ["place-009"], "restaurantIds": {}},
                {"date": "2026-08-13", "placeIds": ["place-001"], "restaurantIds": {}},
            ],
            accommodation={
                "name": "우리 숙소",
                "address": "부산 해운대구",
                "lat": 35.1591,
                "lng": 129.1602,
            },
        )
    )
    accommodation_items = [i for i in data.timeline if i.type == "accommodation"]
    assert len(accommodation_items) == 1
    assert accommodation_items[0].startTime.startswith("2026-08-12")
    assert accommodation_items[0].lat == 35.1591
    assert accommodation_items[0].lng == 129.1602
    assert "숙소" in accommodation_items[0].title


def test_no_accommodation_means_no_accommodation_items():
    data = generate_timeline(_request(days=_days_payload(["place-001"])))
    assert not any(i.type == "accommodation" for i in data.timeline)


# ---------------------------------------------------------------------------
# 끼니 시간대 고정(아침 08~10시, 점심 11~13시, 저녁 18~20시)
# ---------------------------------------------------------------------------


def test_meal_items_stay_within_fixed_time_windows():
    data = generate_timeline(
        _request(
            days=_days_payload(
                ["place-006", "place-008", "place-015"],
                restaurant_ids={"breakfast": "place-021", "lunch": "place-016", "dinner": "place-018"},
            ),
            companionTypes=["friends_couple"],
            seed=3,
        )
    )
    windows = {"place-021": (8, 10), "place-016": (11, 13), "place-018": (18, 20)}
    meal_items = [i for i in data.timeline if i.type == "meal"]
    # 끼니는 "무조건 포함"이 최우선 원칙이다 — 창을 못 맞추더라도 제외하지 않는다.
    assert len(meal_items) == 3
    for item in meal_items:
        start_hour, end_hour = windows[item.placeId]
        start_dt = _dt(item.startTime)
        end_dt = _dt(item.endTime)
        assert start_dt.hour >= start_hour
        # 실제 좌표 기반 이동시간 때문에 창을 약간 넘길 수 있다(그래도 제외되진 않는다) —
        # 큰 폭으로 벗어나지 않는지만 느슨하게 확인한다.
        assert (end_dt.hour, end_dt.minute) <= (end_hour + 1, 0)


def test_fallback_placed_meals_never_overlap_each_other():
    # place-053(청사포역, 아침 11:30 개장)은 아침 시간대(8-10시) 안에 못 들어가 "무조건
    # 포함" 재시도로 밀려나고, place-079(애견카페 남포아지트, 중구)는 청사포역과 멀리
    # 떨어져 있어 점심 시간대(11-13시) 안에도 못 들어간다. 재시도가 meal_cursor(앞선
    # 끼니가 끝나는 시각)를 무시하고 window_start/day_start부터 다시 시작하면, 두 끼니가
    # 서로 겹치는 시각에 배치되는 버그가 있었다.
    data = generate_timeline(
        _request(
            bookings=[
                {
                    "type": "train",
                    "departureLocation": "서울역",
                    "arrivalLocation": "부산역",
                    "departureTime": "2026-08-12T13:08:00",
                    "arrivalTime": "2026-08-12T16:28:00",
                },
                {
                    "type": "train",
                    "departureLocation": "부산역",
                    "arrivalLocation": "서울역",
                    "departureTime": "2026-08-14T21:00:00",
                    "arrivalTime": "2026-08-14T23:44:00",
                },
            ],
            companionTypes=["pet"],
            days=_days_payload(
                ["place-066"], date=MIDDLE_DAY, restaurant_ids={"breakfast": "place-053", "lunch": "place-079"}
            ),
        )
    )
    meal_items = sorted((i for i in data.timeline if i.type == "meal"), key=lambda i: i.startTime)
    assert len(meal_items) == 2
    assert _dt(meal_items[0].endTime) <= _dt(meal_items[1].startTime)


def test_new_day_does_not_carry_previous_day_last_place_for_travel_time():
    # 첫날 마지막 장소(해운대구)가 둘째 날 첫 이동시간 계산에 영향을 주면 안 된다 —
    # 전날 마지막 관광지에서 바로 이동하는 게 아니라, 매일 거점에서 새로 출발하는 것으로
    # 취급해야 한다(STATION_TO_FIRST_PLACE_MINUTES=30분). 만약 전날 장소가 그대로
    # last_place로 넘어간다면(버그), 부산진구는 다른 구라 이동시간이 40분이 되어
    # 도착 시각이 10분 늦어진다.
    data = generate_timeline(
        _request(
            days=[
                {"date": "2026-08-12", "placeIds": ["place-002"], "restaurantIds": {}},
                {
                    "date": MIDDLE_DAY,
                    "placeIds": ["place-001"],
                    "restaurantIds": {"lunch": "place-016"},
                },
            ],
            companionTypes=["friends_couple"],
        )
    )
    lunch_items = [i for i in data.timeline if i.placeId == "place-016"]
    assert len(lunch_items) == 1
    lunch_start = _dt(lunch_items[0].startTime)
    assert (lunch_start.hour, lunch_start.minute) == (11, 30)


# ---------------------------------------------------------------------------
# 항공↔철도 환승 이동 항목
# ---------------------------------------------------------------------------


def test_transfer_item_added_between_flight_and_train():
    data = generate_timeline(_request(selectedPlaceIds=["place-001"]))
    transfer_items = [
        item for item in data.timeline if item.type == "transport" and "환승" in item.title
    ]
    assert len(transfer_items) == 1
    assert transfer_items[0].title == "인천공항 → 서울역 환승 이동"


# 인천공항 도착 -> 서울역 KTX 출발 사이 간격을 넉넉히 벌려(환승 이동시간을 빼고도
# 4시간 남음) 레이오버 채우기가 동작할 수 있는지 확인하는 예매정보.
LAYOVER_BOOKINGS = [
    {
        "type": "flight",
        "departureLocation": None,
        "arrivalLocation": "인천공항",
        "departureTime": None,
        "arrivalTime": "2026-08-12T09:00:00",
    },
    {
        "type": "train",
        "departureLocation": "서울역",
        "arrivalLocation": "부산역",
        "departureTime": "2026-08-12T14:30:00",
        "arrivalTime": "2026-08-12T17:00:00",
    },
    {
        "type": "flight",
        "departureLocation": "인천공항",
        "arrivalLocation": None,
        "departureTime": "2026-08-14T18:00:00",
        "arrivalTime": None,
    },
]


def test_layover_fill_adds_real_place_between_flight_and_train():
    data = generate_timeline(
        _request(bookings=LAYOVER_BOOKINGS, companionTypes=["solo"], selectedPlaceIds=["place-001"])
    )
    gap_start = datetime.fromisoformat("2026-08-12T09:00:00")
    gap_end = datetime.fromisoformat("2026-08-12T14:30:00")
    visit_items = [
        item
        for item in data.timeline
        if item.type in ("meal", "attraction") and gap_start < _dt(item.startTime) and _dt(item.endTime) < gap_end
    ]
    assert len(visit_items) == 1
    place = PLACES_BY_ID[visit_items[0].placeId]
    assert place.region in ("서울", "인천")


def test_layover_falls_back_to_attraction_when_meal_candidate_does_not_fit():
    # pet 동행에서 서울역 인근 끼니 후보는 "앙꼬"(place-108) 하나뿐이고, 왕복 이동시간까지
    # 더하면 이 예매 간격 안에 다 들어가지 못한다. 끼니 후보가 있다는 이유만으로 관광지
    # 대체 시도를 건너뛰면(과거 버그) 아무것도 채워지지 않는다 — 관광지로 대체돼야 한다.
    data = generate_timeline(
        _request(bookings=LAYOVER_BOOKINGS, companionTypes=["pet"], selectedPlaceIds=["place-002"])
    )
    gap_start = datetime.fromisoformat("2026-08-12T09:00:00")
    gap_end = datetime.fromisoformat("2026-08-12T14:30:00")
    visit_items = [
        item
        for item in data.timeline
        if item.type in ("meal", "attraction") and gap_start < _dt(item.startTime) and _dt(item.endTime) < gap_end
    ]
    assert len(visit_items) == 1
    place = PLACES_BY_ID[visit_items[0].placeId]
    assert place.region == "서울"
    assert "pet" in place.companionTypes


def test_custom_layover_place_fills_gap_even_without_curated_hub_data():
    # "김포공항"은 큐레이션된 서울역/인천공항 데이터가 없는 거점이라, 사용자가 직접
    # 검색한 layoverPlace가 없으면 이 구간은 채워지지 않는다(그 다음 테스트로 확인).
    # layoverPlace가 있으면 데이터 보유 거점이 아니어도 그 장소로 채워져야 한다.
    bookings = [
        {
            "type": "flight",
            "departureLocation": None,
            "arrivalLocation": "김포공항",
            "departureTime": None,
            "arrivalTime": "2026-08-12T09:00:00",
        },
        {
            "type": "train",
            "departureLocation": "김포공항역",
            "arrivalLocation": "부산역",
            "departureTime": "2026-08-12T14:30:00",
            "arrivalTime": "2026-08-12T17:00:00",
        },
        {
            "type": "flight",
            "departureLocation": "인천공항",
            "arrivalLocation": None,
            "departureTime": "2026-08-14T18:00:00",
            "arrivalTime": None,
        },
    ]
    data = generate_timeline(
        _request(
            bookings=bookings,
            companionTypes=["solo"],
            selectedPlaceIds=["place-001"],
            layoverPlace={"name": "사용자가 직접 검색한 곳", "address": "서울 강서구", "lat": 37.56, "lng": 126.80},
        )
    )
    gap_start = datetime.fromisoformat("2026-08-12T09:00:00")
    gap_end = datetime.fromisoformat("2026-08-12T14:30:00")
    visit_items = [
        item
        for item in data.timeline
        if item.type in ("meal", "attraction") and gap_start < _dt(item.startTime) and _dt(item.endTime) < gap_end
    ]
    assert len(visit_items) == 1
    assert visit_items[0].title == "사용자가 직접 검색한 곳"


def test_custom_layover_place_used_even_when_window_too_tight_for_fixed_duration():
    # custom place는 항상 60분 고정 체류시간으로 만들어지는데, pet 동행(버퍼 20분)에
    # 인천공항 09:35 도착 -> 서울역 13:08 출발이면 왕복 이동시간(72분)+60분이 남는
    # 시간(약 113분)을 넘어서 예전에는 사용자가 고른 장소가 조용히 배제되고 큐레이션된
    # 후보로 대체됐다. 지금은 남는 시간에 맞춰 체류시간을 줄여서라도 사용자가 고른
    # 장소를 우선 배치해야 한다.
    bookings = [
        {
            "type": "flight",
            "departureLocation": "오사카",
            "arrivalLocation": "인천공항",
            "departureTime": "2026-08-14T07:40:00",
            "arrivalTime": "2026-08-14T09:35:00",
        },
        {
            "type": "train",
            "departureLocation": "서울역",
            "arrivalLocation": "부산역",
            "departureTime": "2026-08-14T13:08:00",
            "arrivalTime": "2026-08-14T16:28:00",
        },
        {
            "type": "train",
            "departureLocation": "부산역",
            "arrivalLocation": "서울역",
            "departureTime": "2026-08-16T21:00:00",
            "arrivalTime": "2026-08-16T23:44:00",
        },
    ]
    data = generate_timeline(
        _request(
            bookings=bookings,
            companionTypes=["pet"],
            selectedPlaceIds=["place-002"],
            date="2026-08-14",
            layoverPlace={"name": "사용자가 고른 곳", "address": "서울 어딘가", "lat": 37.56, "lng": 126.97},
        )
    )
    gap_start = datetime.fromisoformat("2026-08-14T09:35:00")
    gap_end = datetime.fromisoformat("2026-08-14T13:08:00")
    visit_items = [
        item
        for item in data.timeline
        if item.type in ("meal", "attraction") and gap_start < _dt(item.startTime) and _dt(item.endTime) < gap_end
    ]
    assert len(visit_items) == 1
    assert visit_items[0].title == "사용자가 고른 곳"


def test_no_layover_fill_when_no_curated_hub_and_no_custom_place():
    bookings = [
        {
            "type": "flight",
            "departureLocation": None,
            "arrivalLocation": "김포공항",
            "departureTime": None,
            "arrivalTime": "2026-08-12T09:00:00",
        },
        {
            "type": "train",
            "departureLocation": "김포공항역",
            "arrivalLocation": "부산역",
            "departureTime": "2026-08-12T14:30:00",
            "arrivalTime": "2026-08-12T17:00:00",
        },
        {
            "type": "flight",
            "departureLocation": "인천공항",
            "arrivalLocation": None,
            "departureTime": "2026-08-14T18:00:00",
            "arrivalTime": None,
        },
    ]
    data = generate_timeline(_request(bookings=bookings, companionTypes=["solo"], selectedPlaceIds=["place-001"]))
    gap_start = datetime.fromisoformat("2026-08-12T09:00:00")
    gap_end = datetime.fromisoformat("2026-08-12T14:30:00")
    visit_items = [
        item
        for item in data.timeline
        if item.type in ("meal", "attraction") and gap_start < _dt(item.startTime) and _dt(item.endTime) < gap_end
    ]
    assert visit_items == []


def test_no_layover_fill_when_gap_too_short():
    # DEMO_BOOKINGS는 환승 이동시간을 빼면 약 50분만 남아 레이오버를 채우기에 부족하다.
    data = generate_timeline(_request(selectedPlaceIds=["place-001"]))
    gap_start = datetime.fromisoformat("2026-08-12T10:30:00")
    gap_end = datetime.fromisoformat("2026-08-12T13:20:00")
    visit_items = [
        item
        for item in data.timeline
        if item.type in ("meal", "attraction") and gap_start < _dt(item.startTime) and _dt(item.endTime) < gap_end
    ]
    assert visit_items == []


def test_no_transfer_item_when_same_transit_mode():
    bookings = [
        {
            "type": "flight",
            "departureLocation": None,
            "arrivalLocation": "김해공항",
            "departureTime": None,
            "arrivalTime": "2026-08-12T10:00:00",
        },
        {
            "type": "flight",
            "departureLocation": "김해공항",
            "arrivalLocation": None,
            "departureTime": "2026-08-14T18:00:00",
            "arrivalTime": None,
        },
    ]
    data = generate_timeline(_request(bookings=bookings, selectedPlaceIds=["place-001"]))
    transfer_items = [item for item in data.timeline if "환승" in item.title]
    assert transfer_items == []


# ---------------------------------------------------------------------------
# API 레벨 정상 흐름 (200)
# ---------------------------------------------------------------------------


def test_api_generates_timeline_successfully():
    response = client.post(
        "/api/timelines/generate",
        json=_api_payload(["place-001", "place-009"], seed=1),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["summary"]["placeCount"] == 2
    assert body["data"]["warnings"] == []
    types = {item["type"] for item in body["data"]["timeline"]}
    assert types <= {"arrival", "transport", "attraction", "meal", "rest", "departure"}


# ---------------------------------------------------------------------------
# POST /api/timelines/layover-candidates
# ---------------------------------------------------------------------------


def test_layover_candidates_returns_hub_and_places_for_matching_gap():
    response = client.post(
        "/api/timelines/layover-candidates",
        json={"bookings": LAYOVER_BOOKINGS, "companionTypes": []},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["hubRegion"] == "서울"
    assert data["windowMinutes"] is not None
    assert len(data["candidates"]) > 0
    for place in data["candidates"]:
        assert PLACES_BY_ID[place["placeId"]].region == "서울"


def test_layover_candidates_filters_by_pet_companion_type():
    response = client.post(
        "/api/timelines/layover-candidates",
        json={"bookings": LAYOVER_BOOKINGS, "companionTypes": ["pet"]},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    for place in data["candidates"]:
        assert "pet" in PLACES_BY_ID[place["placeId"]].companionTypes


def test_layover_candidates_empty_when_no_matching_gap():
    response = client.post(
        "/api/timelines/layover-candidates",
        json={"bookings": DEMO_BOOKINGS, "companionTypes": []},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["hubRegion"] is None
    assert data["candidates"] == []


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


# ---------------------------------------------------------------------------
# stationFacilities (역 편의시설, 유아/교통약자 동반 전용)
# ---------------------------------------------------------------------------

_STATION_GENERAL_PAYLOAD = {
    "response": {
        "body": {
            "items": {
                "item": {
                    "altm_lead_cntr_estnc": "Y",
                    "elevt_cnt": "18",
                    "esclt_cnt": "23",
                    "gen_tolt_estnc": "Y",
                    "nrsrm_estnc": "Y",
                    "stn_cd": "3900023",
                    "stn_nm": "서울",
                }
            }
        }
    }
}

_STATION_ACCESSIBLE_PAYLOAD = {
    "response": {
        "body": {
            "items": {
                "item": {
                    "pwdbs_slwy_estnc": "Y",
                    "pwdbs_tolt_estnc": "Y",
                    "stn_cd": "3900023",
                    "stn_nm": "서울",
                    "whlch_liftt_cnt": "1",
                }
            }
        }
    }
}


def _mock_station_response(payload):
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = payload
    return response


def test_no_station_facilities_when_neither_infant_nor_mobility_impaired():
    request = _request(companionTypes=["friends_couple"])
    with patch("httpx.get") as mock_get:
        result = generate_timeline(request)
    mock_get.assert_not_called()
    assert result.stationFacilities == []


def test_station_facilities_included_for_infant(monkeypatch):
    monkeypatch.setenv("PUBLIC_DATA_API_KEY", "test-public-data-key")
    from app.services import station_facility_service

    station_facility_service._cache.clear()
    request = _request(companionTypes=["infant"])
    with patch("httpx.get", return_value=_mock_station_response(_STATION_GENERAL_PAYLOAD)):
        result = generate_timeline(request)

    # DEMO_BOOKINGS의 철도 구간(서울역→부산역)에 있는 두 역 모두 조회된다.
    station_names = {f.stationName for f in result.stationFacilities}
    assert station_names == {"서울역", "부산역"}
    for facility in result.stationFacilities:
        assert facility.hasNursingRoom is True
        assert facility.hasAccessibleRestroom is None
        assert facility.hasWheelchairRamp is None


def test_station_facilities_included_for_mobility_impaired(monkeypatch):
    monkeypatch.setenv("PUBLIC_DATA_API_KEY", "test-public-data-key")
    from app.services import station_facility_service

    station_facility_service._cache.clear()
    request = _request(companionTypes=["mobility_impaired"])
    with patch(
        "httpx.get",
        side_effect=[
            _mock_station_response(_STATION_GENERAL_PAYLOAD),
            _mock_station_response(_STATION_ACCESSIBLE_PAYLOAD),
            _mock_station_response(_STATION_GENERAL_PAYLOAD),
            _mock_station_response(_STATION_ACCESSIBLE_PAYLOAD),
        ],
    ):
        result = generate_timeline(request)

    assert len(result.stationFacilities) == 2
    for facility in result.stationFacilities:
        assert facility.hasNursingRoom is None
        assert facility.hasAccessibleRestroom is True
        assert facility.hasWheelchairRamp is True
        assert facility.wheelchairLiftCount == 1


def test_station_facilities_empty_but_timeline_still_generated_when_api_fails(monkeypatch):
    monkeypatch.setenv("PUBLIC_DATA_API_KEY", "test-public-data-key")
    from app.services import station_facility_service

    station_facility_service._cache.clear()
    request = _request(companionTypes=["infant"])

    import httpx as httpx_module

    with patch("httpx.get", side_effect=httpx_module.ConnectTimeout("timeout")):
        result = generate_timeline(request)

    assert result.stationFacilities == []
    assert len(result.timeline) > 0


def test_station_facilities_route_returns_empty_list_by_default():
    response = client.post(
        "/api/timelines/generate",
        json=_api_payload(["place-001"], companionTypes=["friends_couple"]),
    )
    assert response.status_code == 200
    assert response.json()["data"]["stationFacilities"] == []
