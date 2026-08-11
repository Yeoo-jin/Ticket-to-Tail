"""동행 조건 기반 관광지 추천 (코드 기반 점수 계산, AI 미사용).

관광지 데이터(app/data/places.json)에 없는 장소는 절대 만들어내지 않는다 -
이 서비스는 순수하게 저장된 레코드만 필터링·정렬해서 반환한다.
"""

import random
from typing import Dict, List, Optional, Sequence, Tuple

from app.schemas.common import CompanionType
from app.schemas.place import MealType, Place, PlaceRecommendData, PlaceRecommendRequest, PlaceRecord
from app.services.place_data import load_places
from app.utils.companion_validation import validate_companion_types
from app.utils.errors import InvalidInputError
from app.utils.meal_recommendation import recommend_meals

DEFAULT_RECOMMEND_COUNT = 6
MAX_AUTO_SELECT_COUNT = 3
DEFAULT_RESTAURANT_COUNT_PER_MEAL = 3

# 카페는 "관광지"로 취급해 places 후보 풀에 포함하되(2절 규칙 1), 음식점은 별도 취급한다(규칙 2).
CAFE_CATEGORY = "카페"
RESTAURANT_CATEGORY = "음식점"

# 동행 조건별로 가점을 주는 태그 (요청사항 4절의 예시를 그대로 반영).
_PREFERRED_TAGS: Dict[str, Sequence[str]] = {
    "infant": ("실내", "휴식 공간", "유모차 접근성", "저상 시설"),
    "senior": ("휴식 공간", "저상 시설", "엘리베이터", "실내"),
    "mobility_impaired": ("저상 시설", "엘리베이터", "대중교통 접근"),
    "pet": ("반려동물 동반",),
    "friends_couple": ("야경", "사진 명소", "체험"),
    "solo": ("대중교통 접근", "산책", "체험"),
}

# "만" 표현이 있는 조건 - 해당 조건이 요청에 있으면 지원하지 않는 장소는 아예 제외한다.
_HARD_FILTER_COMPANION_TYPES = ("pet",)


def _passes_hard_filters(place: PlaceRecord, companion_types: Sequence[str]) -> bool:
    for companion_type in _HARD_FILTER_COMPANION_TYPES:
        if companion_type in companion_types and companion_type not in place.companionTypes:
            return False
    return True


def _score(place: PlaceRecord, companion_types: Sequence[str]) -> int:
    score = 0
    for companion_type in companion_types:
        if companion_type not in place.companionTypes:
            # 조건에 부적합한 후보는 감점만 하고, 아래의 가산점(태그·실내·체류시간)은 주지 않는다.
            score -= 2
            continue

        score += 3

        preferred_tags = _PREFERRED_TAGS.get(companion_type, ())
        score += sum(1 for tag in place.tags if tag in preferred_tags)

        if companion_type in ("infant", "senior", "mobility_impaired") and place.indoor:
            score += 2

        if companion_type in ("infant", "senior") and place.estimatedDurationMinutes <= 60:
            score += 1

    return score


def _weighted_sample_without_replacement(
    scored: List[Tuple[PlaceRecord, int]], k: int, rng: random.Random
) -> List[PlaceRecord]:
    """점수가 높을수록 뽑힐 확률이 높은, 복원 없는 가중치 샘플링.

    (Efraimidis-Spirakis 방식: u ** (1/weight)를 키로 정렬) 매 호출마다
    상위권 후보는 대부분 뽑히지만, 순서와 일부 후보는 달라질 수 있다.
    점수가 크게 낮은 후보(조건 불일치)가 상위로 뒤섞이는 것은 방지한다.
    """
    if k <= 0 or not scored:
        return []
    if k >= len(scored):
        items = list(scored)
        rng.shuffle(items)
        return [place for place, _ in items]

    min_score = min(score for _, score in scored)
    keyed = []
    for place, score in scored:
        # 점수 차이를 지수적으로 반영해, 조건에 맞지 않는(감점된) 후보가
        # 상위권으로 뒤섞여 들어오는 일은 거의 없게 하면서도 상위권 후보끼리는
        # 여전히 순서가 바뀔 수 있는 정도의 무작위성을 남긴다.
        weight = 2.0 ** (score - min_score)
        key = rng.random() ** (1.0 / weight)
        keyed.append((key, place))
    keyed.sort(key=lambda item: item[0], reverse=True)
    return [place for _, place in keyed[:k]]


def _pick_guaranteed_cafe(
    candidates: List[Tuple[PlaceRecord, int]],
    kept: Sequence[PlaceRecord],
    remaining_slots: int,
    rng: random.Random,
) -> Tuple[Optional[PlaceRecord], List[Tuple[PlaceRecord, int]]]:
    """카페 후보 최소 1개 보장 (2절 규칙 1).

    kept 안에 이미 카페가 있거나, 새로 채울 자리(remaining_slots)가 없거나,
    candidates 안에 카페 후보가 없으면 아무것도 하지 않는다. 그 외에는
    candidates(이미 지역·제외·유지·하드필터를 통과한 후보)의 카페 카테고리만
    모아 가중 샘플링으로 1개를 확정하고, candidates에서 제외한 나머지를 함께 반환한다.
    """
    if remaining_slots <= 0:
        return None, candidates
    if any(place.category == CAFE_CATEGORY for place in kept):
        return None, candidates

    cafe_candidates = [(place, score) for place, score in candidates if place.category == CAFE_CATEGORY]
    if not cafe_candidates:
        return None, candidates

    picked = _weighted_sample_without_replacement(cafe_candidates, 1, rng)
    if not picked:
        return None, candidates

    guaranteed_cafe = picked[0]
    remaining_candidates = [(place, score) for place, score in candidates if place.placeId != guaranteed_cafe.placeId]
    return guaranteed_cafe, remaining_candidates


def _build_reason(place: PlaceRecord, companion_types: Sequence[str]) -> str:
    for companion_type in companion_types:
        reason = place.recommendationReasons.get(companion_type)
        if reason:
            return reason
    return place.description


def _to_response_place(place: PlaceRecord, companion_types: Sequence[str]) -> Place:
    return Place(
        placeId=place.placeId,
        name=place.name,
        description=place.description,
        recommendationReason=_build_reason(place, companion_types),
        estimatedDurationMinutes=place.estimatedDurationMinutes,
        tags=place.tags,
        imageUrl=place.imageUrl,
        category=place.category,
        openTime=place.openTime,
        closeTime=place.closeTime,
    )


def _compute_auto_selected_ids(
    result_places: Sequence[PlaceRecord],
    companion_types: Sequence[str],
    rng: random.Random,
    max_count: int = MAX_AUTO_SELECT_COUNT,
) -> List[str]:
    """이번 응답에 실제로 포함된 장소(result_places)만 대상으로, 내부 점수 상위 max_count개를 고른다.

    동점 후보의 순서는 같은 rng로 미리 섞은 뒤 안정 정렬(sort)하는 방식으로 정하므로,
    seed가 같으면 항상 같은 결과가 나온다 (테스트에서 재현 가능).
    """
    scored = [(place, _score(place, companion_types)) for place in result_places]
    rng.shuffle(scored)
    scored.sort(key=lambda item: item[1], reverse=True)
    return [place.placeId for place, _ in scored[:max_count]]


def recommend_places(
    destination: str,
    companion_types: Sequence[CompanionType],
    exclude_place_ids: Optional[Sequence[str]] = None,
    keep_place_ids: Optional[Sequence[str]] = None,
    count: int = DEFAULT_RECOMMEND_COUNT,
    rng: Optional[random.Random] = None,
) -> Tuple[List[Place], List[str]]:
    """관광지 추천 결과와, 그중 자동 선택 대상(autoSelectedPlaceIds)을 함께 반환한다."""
    rng = rng or random.Random()
    exclude_ids = set(exclude_place_ids or [])
    keep_ids = list(dict.fromkeys(keep_place_ids or []))  # 순서 유지, 중복 제거

    all_places = load_places()
    by_id = {place.placeId: place for place in all_places}

    unknown_keep_ids = [pid for pid in keep_ids if pid not in by_id]
    if unknown_keep_ids:
        raise InvalidInputError(
            f"keepPlaceIds에 존재하지 않는 관광지 ID가 있습니다: {', '.join(unknown_keep_ids)}"
        )

    kept = [by_id[pid] for pid in keep_ids]
    kept_ids = {p.placeId for p in kept}

    candidates = [
        place
        for place in all_places
        if place.region == destination
        and place.placeId not in exclude_ids
        and place.placeId not in kept_ids
        # 음식점은 관광지 후보 풀에 넣지 않는다 - recommend_restaurants()에서 별도로 다룬다.
        and place.category != RESTAURANT_CATEGORY
        and _passes_hard_filters(place, companion_types)
    ]

    scored: List[Tuple[PlaceRecord, int]] = [(place, _score(place, companion_types)) for place in candidates]

    remaining_slots = max(count - len(kept), 0)

    guaranteed_cafe, scored = _pick_guaranteed_cafe(scored, kept, remaining_slots, rng)
    if guaranteed_cafe is not None:
        remaining_slots -= 1

    chosen = _weighted_sample_without_replacement(scored, remaining_slots, rng)
    if guaranteed_cafe is not None:
        chosen = [guaranteed_cafe] + chosen

    result_places = kept + chosen
    response_places = [_to_response_place(place, companion_types) for place in result_places]
    auto_selected_ids = _compute_auto_selected_ids(result_places, companion_types, rng)

    return response_places, auto_selected_ids


def recommend_restaurants(
    destination: str,
    companion_types: Sequence[CompanionType],
    meal_types: Sequence[MealType],
    count_per_meal: int = DEFAULT_RESTAURANT_COUNT_PER_MEAL,
    rng: Optional[random.Random] = None,
) -> Dict[MealType, List[Place]]:
    """식사 시간대별(점심/저녁) 음식점 후보 추천 (2절 규칙 2).

    meal_types에 없는 버킷은 결과에 아예 포함하지 않는다
    (예: 저녁만 추천 대상이면 결과는 {"dinner": [...]} 형태).
    """
    rng = rng or random.Random()
    all_places = load_places()

    result: Dict[MealType, List[Place]] = {}
    for meal_type in meal_types:
        candidates = [
            place
            for place in all_places
            if place.region == destination
            and place.category == RESTAURANT_CATEGORY
            and place.mealType == meal_type
            and _passes_hard_filters(place, companion_types)
        ]
        scored = [(place, _score(place, companion_types)) for place in candidates]
        chosen = _weighted_sample_without_replacement(scored, count_per_meal, rng)
        result[meal_type] = [_to_response_place(place, companion_types) for place in chosen]

    return result


def get_place_recommendations(
    request: PlaceRecommendRequest, rng: Optional[random.Random] = None
) -> PlaceRecommendData:
    destination = request.destination.strip()
    if not destination:
        raise InvalidInputError("여행 목적지(destination)를 입력해주세요.")
    validate_companion_types(request.companionTypes)

    places, auto_selected_ids = recommend_places(
        destination=destination,
        companion_types=request.companionTypes,
        exclude_place_ids=request.excludePlaceIds,
        keep_place_ids=request.keepPlaceIds,
        rng=rng,
    )

    restaurants: Dict[MealType, List[Place]] = {}
    if request.arrivalTime:
        meal_types = recommend_meals(request.arrivalTime)
        restaurants = recommend_restaurants(
            destination=destination,
            companion_types=request.companionTypes,
            meal_types=meal_types,
            rng=rng,
        )

    return PlaceRecommendData(places=places, autoSelectedPlaceIds=auto_selected_ids, restaurants=restaurants)
