import pytest

from app.utils.meal_recommendation import recommend_meals


@pytest.mark.parametrize(
    "arrival_time",
    [
        "2026-08-12T00:00:00",
        "2026-08-12T09:00:00",
        "2026-08-12T12:59:00",
    ],
)
def test_arrival_before_13_recommends_lunch_and_dinner(arrival_time):
    assert recommend_meals(arrival_time) == ["lunch", "dinner"]


@pytest.mark.parametrize(
    "arrival_time",
    [
        "2026-08-12T13:00:00",
        "2026-08-12T13:01:00",
        "2026-08-12T18:00:00",
        "2026-08-12T23:59:00",
    ],
)
def test_arrival_at_or_after_13_recommends_dinner_only(arrival_time):
    assert recommend_meals(arrival_time) == ["dinner"]
