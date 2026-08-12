from app.schemas.place import PlaceRecord
from app.services.travel_time_service import estimate_transfer_minutes, estimate_travel_minutes


def _place(**overrides):
    base = {
        "placeId": "place-x",
        "name": "테스트 장소",
        "region": "부산",
        "district": "해운대구",
        "category": "관광지",
        "description": "",
        "tags": [],
        "companionTypes": ["solo"],
        "recommendationReasons": {},
        "estimatedDurationMinutes": 60,
        "openTime": "09:00",
        "closeTime": "18:00",
        "indoor": False,
        "address": "부산 해운대구",
        "lat": None,
        "lng": None,
    }
    base.update(overrides)
    return PlaceRecord(**base)


def test_none_from_place_uses_station_default():
    to_place = _place()
    assert estimate_travel_minutes(None, to_place) == 30


def test_same_district_without_coordinates_uses_short_default():
    from_place = _place(placeId="a", district="해운대구", lat=None, lng=None)
    to_place = _place(placeId="b", district="해운대구", lat=None, lng=None)
    assert estimate_travel_minutes(from_place, to_place) == 15


def test_different_district_without_coordinates_uses_long_default():
    from_place = _place(placeId="a", district="해운대구", lat=None, lng=None)
    to_place = _place(placeId="b", district="중구", lat=None, lng=None)
    assert estimate_travel_minutes(from_place, to_place) == 40


def test_coordinates_take_priority_over_district_when_both_available():
    # 같은 구(district)라고 적혀 있어도 좌표가 있으면 좌표 기반 계산을 우선한다.
    from_place = _place(placeId="a", district="해운대구", lat=35.1591, lng=129.1602)
    to_place = _place(placeId="b", district="해운대구", lat=35.1591, lng=129.1602)
    # 같은 좌표(거리 0km)면 고정 여유시간(5분)만 남는다.
    assert estimate_travel_minutes(from_place, to_place) == 5


def test_coordinate_based_distance_increases_with_distance():
    from_place = _place(placeId="a", lat=35.1591, lng=129.1602)  # 해운대
    near = _place(placeId="b", lat=35.1537, lng=129.1185)  # 광안리(비교적 가까움)
    far = _place(placeId="c", lat=35.0503, lng=129.0883)  # 태종대(멀리)

    near_minutes = estimate_travel_minutes(from_place, near)
    far_minutes = estimate_travel_minutes(from_place, far)
    assert far_minutes > near_minutes


def test_multiplier_scales_result():
    from_place = _place(placeId="a", lat=35.1591, lng=129.1602)
    to_place = _place(placeId="b", lat=35.1537, lng=129.1185)
    base = estimate_travel_minutes(from_place, to_place, multiplier=1.0)
    scaled = estimate_travel_minutes(from_place, to_place, multiplier=2.0)
    assert scaled >= base * 2 - 1  # 반올림 오차 허용


def test_result_never_below_minimum():
    from_place = _place(placeId="a", lat=35.1591, lng=129.1602)
    to_place = _place(placeId="b", lat=35.1591, lng=129.1602)
    assert estimate_travel_minutes(from_place, to_place, multiplier=0.01) == 5


def test_transfer_minutes_zero_for_same_transit_mode():
    assert estimate_transfer_minutes("flight", "flight") == 0
    assert estimate_transfer_minutes("train", "train") == 0


def test_transfer_minutes_positive_for_different_transit_mode():
    assert estimate_transfer_minutes("flight", "train") == 60
    assert estimate_transfer_minutes("train", "flight") == 60
