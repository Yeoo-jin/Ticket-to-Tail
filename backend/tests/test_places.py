import random

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.common import CompanionType
from app.schemas.place import PlaceRecommendRequest
from app.services.place_data import load_places
from app.services.place_recommendation_service import (
    MAX_AUTO_SELECT_COUNT,
    get_place_recommendations,
    recommend_places,
)

client = TestClient(app)

ALL_PLACE_IDS = {p.placeId for p in load_places()}
PLACES_BY_ID = {p.placeId: p for p in load_places()}

ALL_COMPANION_TYPES = ("solo", "friends_couple", "infant", "senior", "mobility_impaired", "pet")


# ---------------------------------------------------------------------------
# 동행 조건 enum이 최종 6개로 통일됐는지
# ---------------------------------------------------------------------------


def test_companion_type_enum_has_exactly_six_values():
    import typing

    values = typing.get_args(CompanionType)
    assert set(values) == set(ALL_COMPANION_TYPES)
    assert len(values) == 6


def test_no_place_data_still_uses_legacy_friends_or_couple_values():
    for place in load_places():
        assert "friends" not in place.companionTypes
        assert "couple" not in place.companionTypes
        assert "friends" not in place.recommendationReasons
        assert "couple" not in place.recommendationReasons


def test_legacy_companion_type_value_is_rejected_by_api():
    response = client.post(
        "/api/places/recommend",
        json={"destination": "부산", "companionTypes": ["friends"]},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"

    response = client.post(
        "/api/places/recommend",
        json={"destination": "부산", "companionTypes": ["couple"]},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


# ---------------------------------------------------------------------------
# 1. 부산 도착 + 유아 동반 관광지 추천
# ---------------------------------------------------------------------------


def test_busan_infant_recommendation_via_api():
    response = client.post(
        "/api/places/recommend",
        json={"destination": "부산", "companionTypes": ["infant"]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True

    places = body["data"]["places"]
    assert len(places) == 6
    for place in places:
        assert place["placeId"] in ALL_PLACE_IDS
        assert place["recommendationReason"]
        assert isinstance(place["estimatedDurationMinutes"], int)
        assert "openTime" in place and "closeTime" in place
        assert "tags" in place and "category" in place

    assert "autoSelectedPlaceIds" in body["data"]


# ---------------------------------------------------------------------------
# 2. 부산 도착 + 반려동물 동반 추천 (허용 장소만 반환되는지)
# ---------------------------------------------------------------------------


def test_busan_pet_recommendation_only_returns_pet_friendly_places():
    response = client.post(
        "/api/places/recommend",
        json={"destination": "부산", "companionTypes": ["pet"]},
    )

    assert response.status_code == 200
    places = response.json()["data"]["places"]
    assert len(places) > 0
    for place in places:
        assert "pet" in PLACES_BY_ID[place["placeId"]].companionTypes


# ---------------------------------------------------------------------------
# 3. 지원하지 않는 지역 입력 (success:true, places:[], autoSelectedPlaceIds:[])
# ---------------------------------------------------------------------------


def test_unsupported_region_returns_success_with_empty_places_and_empty_auto_selection():
    response = client.post(
        "/api/places/recommend",
        json={"destination": "제주", "companionTypes": ["solo"]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["places"] == []
    assert body["data"]["autoSelectedPlaceIds"] == []


# ---------------------------------------------------------------------------
# 4. 동행 조건 누락
# ---------------------------------------------------------------------------


def test_missing_companion_types_returns_400_invalid_input():
    response = client.post(
        "/api/places/recommend",
        json={"destination": "부산", "companionTypes": []},
    )

    assert response.status_code == 400
    assert response.json() == {
        "success": False,
        "error": {"code": "INVALID_INPUT", "message": "동행 조건(companionTypes)을 하나 이상 선택해주세요."},
    }


def test_missing_destination_returns_400_invalid_input():
    response = client.post(
        "/api/places/recommend",
        json={"destination": "   ", "companionTypes": ["solo"]},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


# ---------------------------------------------------------------------------
# solo 배타 정책: solo 단독은 허용, solo+다른 조건은 400
# ---------------------------------------------------------------------------


def test_solo_alone_is_allowed():
    response = client.post(
        "/api/places/recommend",
        json={"destination": "부산", "companionTypes": ["solo"]},
    )
    assert response.status_code == 200


def test_solo_with_other_condition_returns_400_invalid_input():
    response = client.post(
        "/api/places/recommend",
        json={"destination": "부산", "companionTypes": ["solo", "infant"]},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


def test_multiple_non_solo_conditions_are_allowed():
    response = client.post(
        "/api/places/recommend",
        json={"destination": "부산", "companionTypes": ["infant", "senior"]},
    )
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# 5. 추천 후보 수 확인
# ---------------------------------------------------------------------------


def test_default_recommend_count_is_six():
    request = PlaceRecommendRequest(destination="부산", companionTypes=["friends_couple"])
    data = get_place_recommendations(request, rng=random.Random(1))
    assert len(data.places) == 6


# ---------------------------------------------------------------------------
# 6. 추천 새로 받기 시 반환 후보/순서가 달라질 수 있는지 (seed 주입으로 재현 가능하게 검증)
# ---------------------------------------------------------------------------


def test_different_seeds_can_change_candidates_or_order():
    places_a, _ = recommend_places("부산", ["friends_couple"], rng=random.Random(1))
    places_b, _ = recommend_places("부산", ["friends_couple"], rng=random.Random(2))

    ids_a = [p.placeId for p in places_a]
    ids_b = [p.placeId for p in places_b]

    assert ids_a != ids_b


def test_same_seed_is_reproducible():
    places_1, auto_1 = recommend_places("부산", ["friends_couple"], rng=random.Random(7))
    places_2, auto_2 = recommend_places("부산", ["friends_couple"], rng=random.Random(7))
    assert [p.placeId for p in places_1] == [p.placeId for p in places_2]
    assert auto_1 == auto_2


# ---------------------------------------------------------------------------
# 7. 관광지 데이터에 없는 장소가 반환되지 않는지 확인 (places, autoSelectedPlaceIds 둘 다)
# ---------------------------------------------------------------------------


def test_no_hallucinated_places_are_ever_returned():
    for seed in range(10):
        for companion_type in ALL_COMPANION_TYPES:
            places, auto_selected_ids = recommend_places("부산", [companion_type], rng=random.Random(seed))
            place_ids = {p.placeId for p in places}
            for place in places:
                assert place.placeId in ALL_PLACE_IDS
            for auto_id in auto_selected_ids:
                assert auto_id in ALL_PLACE_IDS
                assert auto_id in place_ids  # autoSelectedPlaceIds는 반드시 places의 부분집합


# ---------------------------------------------------------------------------
# autoSelectedPlaceIds: 부분집합, 최대 3개, 내부 점수 상위 기준
# ---------------------------------------------------------------------------


def test_auto_selected_place_ids_is_subset_of_places_and_capped_at_three():
    for seed in range(10):
        places, auto_selected_ids = recommend_places("부산", ["infant"], rng=random.Random(seed))
        place_ids = {p.placeId for p in places}
        assert set(auto_selected_ids) <= place_ids
        assert len(auto_selected_ids) <= MAX_AUTO_SELECT_COUNT
        assert len(auto_selected_ids) == len(set(auto_selected_ids))  # 중복 없음


def test_auto_selected_place_ids_prefers_higher_internal_score():
    from app.services.place_data import load_places as _load_places
    from app.services.place_recommendation_service import _score

    places, auto_selected_ids = recommend_places("부산", ["infant"], rng=random.Random(2))
    by_id = {p.placeId: p for p in _load_places()}

    scores = {p.placeId: _score(by_id[p.placeId], ["infant"]) for p in places}
    auto_scores = [scores[pid] for pid in auto_selected_ids]
    other_scores = [scores[p.placeId] for p in places if p.placeId not in auto_selected_ids]

    if other_scores:
        assert min(auto_scores) >= max(other_scores)


def test_auto_selected_place_ids_returns_fewer_than_three_if_fewer_candidates():
    # keepPlaceIds로 후보를 1개만 남겨서, 3개 미만일 때도 존재하는 만큼만 포함되는지 확인.
    places, _ = recommend_places("부산", ["infant"], rng=random.Random(1))
    only_id = places[0].placeId

    kept_places, auto_selected_ids = recommend_places(
        "부산",
        ["infant"],
        keep_place_ids=[only_id],
        exclude_place_ids=[p.placeId for p in places if p.placeId != only_id],
        count=1,
        rng=random.Random(1),
    )
    assert len(kept_places) == 1
    assert auto_selected_ids == [only_id]


# ---------------------------------------------------------------------------
# keepPlaceIds / excludePlaceIds ("다른 장소 추천받기") 동작 확인
# ---------------------------------------------------------------------------


def test_kept_places_are_preserved_and_excluded_places_never_reappear():
    first, _ = recommend_places("부산", ["friends_couple"], rng=random.Random(3))
    first_ids = [p.placeId for p in first]
    kept_ids = first_ids[:2]
    excluded_ids = first_ids[2:]

    second, _ = recommend_places(
        "부산",
        ["friends_couple"],
        exclude_place_ids=excluded_ids,
        keep_place_ids=kept_ids,
        rng=random.Random(4),
    )
    second_ids = [p.placeId for p in second]

    assert second_ids[: len(kept_ids)] == kept_ids
    assert not any(pid in excluded_ids for pid in second_ids)
    assert len(second_ids) == 6


def test_hard_filter_excludes_non_pet_places_even_when_scored():
    places, _ = recommend_places("부산", ["pet"], count=20, rng=random.Random(1))
    for place in places:
        assert "pet" in PLACES_BY_ID[place.placeId].companionTypes


def test_unknown_keep_place_id_raises_common_error():
    import pytest
    from app.utils.errors import InvalidInputError

    with pytest.raises(InvalidInputError):
        recommend_places("부산", ["solo"], keep_place_ids=["place-does-not-exist"], rng=random.Random(1))


def test_refresh_endpoint_rejects_unknown_keep_place_id():
    response = client.post(
        "/api/places/recommend",
        json={
            "destination": "부산",
            "companionTypes": ["solo"],
            "keepPlaceIds": ["place-does-not-exist"],
        },
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


# ---------------------------------------------------------------------------
# "다른 관광지 추천받기" 최종 정책: keep 개수별 유지/신규 개수, 총 6개, 중복 없음
# ---------------------------------------------------------------------------


def _first_round(companion_type="friends_couple", seed=1):
    places, _ = recommend_places("부산", [companion_type], rng=random.Random(seed))
    return places


def test_refresh_with_zero_kept_replaces_all_six():
    first = _first_round(seed=10)
    first_ids = [p.placeId for p in first]

    second, _ = recommend_places(
        "부산",
        ["friends_couple"],
        exclude_place_ids=first_ids,
        keep_place_ids=[],
        rng=random.Random(11),
    )
    second_ids = [p.placeId for p in second]

    assert len(second_ids) <= 6
    assert not any(pid in first_ids for pid in second_ids)


def test_refresh_with_one_kept_keeps_one_and_fills_up_to_five_new():
    first = _first_round(seed=20)
    first_ids = [p.placeId for p in first]
    kept_ids = first_ids[:1]
    excluded_ids = first_ids[1:]

    second, _ = recommend_places(
        "부산",
        ["friends_couple"],
        exclude_place_ids=excluded_ids,
        keep_place_ids=kept_ids,
        rng=random.Random(21),
    )
    second_ids = [p.placeId for p in second]

    assert second_ids[:1] == kept_ids
    new_ids = second_ids[1:]
    assert len(new_ids) <= 5
    assert not any(pid in excluded_ids for pid in new_ids)
    assert len(second_ids) == len(set(second_ids))


def test_refresh_with_two_kept_keeps_two_and_fills_up_to_four_new():
    first = _first_round(seed=30)
    first_ids = [p.placeId for p in first]
    kept_ids = first_ids[:2]
    excluded_ids = first_ids[2:]

    second, _ = recommend_places(
        "부산",
        ["friends_couple"],
        exclude_place_ids=excluded_ids,
        keep_place_ids=kept_ids,
        rng=random.Random(31),
    )
    second_ids = [p.placeId for p in second]

    assert second_ids[:2] == kept_ids
    new_ids = second_ids[2:]
    assert len(new_ids) <= 4
    assert not any(pid in excluded_ids for pid in new_ids)
    assert len(second_ids) == len(set(second_ids))


def test_refresh_with_three_kept_keeps_three_and_fills_up_to_three_new():
    first = _first_round(seed=40)
    first_ids = [p.placeId for p in first]
    kept_ids = first_ids[:3]
    excluded_ids = first_ids[3:]

    second, auto_selected_ids = recommend_places(
        "부산",
        ["friends_couple"],
        exclude_place_ids=excluded_ids,
        keep_place_ids=kept_ids,
        rng=random.Random(41),
    )
    second_ids = [p.placeId for p in second]

    assert second_ids[:3] == kept_ids
    new_ids = second_ids[3:]
    assert len(new_ids) <= 3
    assert not any(pid in excluded_ids for pid in new_ids)
    assert len(second_ids) == len(set(second_ids))
    # 새 후보(자동 선택 대상 포함)가 kept 이외의 항목을 가리킬 수도, 아닐 수도 있지만
    # 어쨌든 이번 응답의 places 부분집합이어야 한다.
    assert set(auto_selected_ids) <= set(second_ids)


def test_refresh_via_api_endpoint_preserves_kept_and_excludes_unselected():
    first_response = client.post(
        "/api/places/recommend",
        json={"destination": "부산", "companionTypes": ["friends_couple"]},
    )
    first_places = first_response.json()["data"]["places"]
    first_ids = [p["placeId"] for p in first_places]
    kept_ids = first_ids[:2]
    excluded_ids = first_ids[2:]

    second_response = client.post(
        "/api/places/recommend",
        json={
            "destination": "부산",
            "companionTypes": ["friends_couple"],
            "keepPlaceIds": kept_ids,
            "excludePlaceIds": excluded_ids,
        },
    )
    assert second_response.status_code == 200
    second_places = second_response.json()["data"]["places"]
    second_ids = [p["placeId"] for p in second_places]

    assert second_ids[:2] == kept_ids
    assert not any(pid in excluded_ids for pid in second_ids)
    assert len(second_ids) == len(set(second_ids))


# ---------------------------------------------------------------------------
# 기존 GET /health 정상 동작 (test_health.py에서도 확인하지만 여기서도 스모크 체크)
# ---------------------------------------------------------------------------


def test_health_still_ok_after_places_feature():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
