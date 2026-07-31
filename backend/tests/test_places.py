import random

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.place import PlaceRecommendRequest
from app.services.place_data import load_places
from app.services.place_recommendation_service import get_place_recommendations, recommend_places

client = TestClient(app)

ALL_PLACE_IDS = {p.placeId for p in load_places()}
PLACES_BY_ID = {p.placeId: p for p in load_places()}


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
# 3. 지원하지 않는 지역 입력
# ---------------------------------------------------------------------------


def test_unsupported_region_returns_success_with_empty_places():
    response = client.post(
        "/api/places/recommend",
        json={"destination": "제주", "companionTypes": ["solo"]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["places"] == []


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
# 5. 추천 후보 수 확인
# ---------------------------------------------------------------------------


def test_default_recommend_count_is_six():
    request = PlaceRecommendRequest(destination="부산", companionTypes=["friends"])
    data = get_place_recommendations(request, rng=random.Random(1))
    assert len(data.places) == 6


# ---------------------------------------------------------------------------
# 6. 추천 새로 받기 시 반환 후보/순서가 달라질 수 있는지 (seed 주입으로 재현 가능하게 검증)
# ---------------------------------------------------------------------------


def test_different_seeds_can_change_candidates_or_order():
    places_a = recommend_places("부산", ["friends"], rng=random.Random(1))
    places_b = recommend_places("부산", ["friends"], rng=random.Random(2))

    ids_a = [p.placeId for p in places_a]
    ids_b = [p.placeId for p in places_b]

    assert ids_a != ids_b


def test_same_seed_is_reproducible():
    ids_1 = [p.placeId for p in recommend_places("부산", ["friends"], rng=random.Random(7))]
    ids_2 = [p.placeId for p in recommend_places("부산", ["friends"], rng=random.Random(7))]
    assert ids_1 == ids_2


# ---------------------------------------------------------------------------
# 7. 관광지 데이터에 없는 장소가 반환되지 않는지 확인
# ---------------------------------------------------------------------------


def test_no_hallucinated_places_are_ever_returned():
    for seed in range(10):
        for companion_type in ("infant", "senior", "mobility_impaired", "pet", "friends", "couple", "solo"):
            places = recommend_places("부산", [companion_type], rng=random.Random(seed))
            for place in places:
                assert place.placeId in ALL_PLACE_IDS


# ---------------------------------------------------------------------------
# keepPlaceIds / excludePlaceIds ("다른 장소 추천받기") 동작 확인
# ---------------------------------------------------------------------------


def test_kept_places_are_preserved_and_excluded_places_never_reappear():
    first = recommend_places("부산", ["friends"], rng=random.Random(3))
    first_ids = [p.placeId for p in first]
    kept_ids = first_ids[:2]
    excluded_ids = first_ids[2:]

    second = recommend_places(
        "부산",
        ["friends"],
        exclude_place_ids=excluded_ids,
        keep_place_ids=kept_ids,
        rng=random.Random(4),
    )
    second_ids = [p.placeId for p in second]

    assert second_ids[: len(kept_ids)] == kept_ids
    assert not any(pid in excluded_ids for pid in second_ids)
    assert len(second_ids) == 6


def test_hard_filter_excludes_non_pet_places_even_when_scored():
    places = recommend_places("부산", ["pet"], count=20, rng=random.Random(1))
    for place in places:
        assert "pet" in PLACES_BY_ID[place.placeId].companionTypes


# ---------------------------------------------------------------------------
# 기존 GET /health 정상 동작 (test_health.py에서도 확인하지만 여기서도 스모크 체크)
# ---------------------------------------------------------------------------


def test_health_still_ok_after_places_feature():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
