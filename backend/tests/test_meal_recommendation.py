from datetime import date, datetime

import pytest

from app.utils.meal_recommendation import recommend_daily_meals


def _dt(iso: str) -> datetime:
    return datetime.fromisoformat(iso)


@pytest.mark.parametrize(
    "arrival_time",
    ["2026-08-12T00:00:00", "2026-08-12T08:59:00"],
)
def test_arrival_before_9_recommends_all_three(arrival_time):
    trip_dates = [date(2026, 8, 12), date(2026, 8, 13)]
    result = recommend_daily_meals(trip_dates, _dt(arrival_time), None)
    assert result[date(2026, 8, 12)] == ["breakfast", "lunch", "dinner"]


@pytest.mark.parametrize(
    "arrival_time",
    ["2026-08-12T09:00:00", "2026-08-12T12:59:00"],
)
def test_arrival_9_to_13_recommends_lunch_and_dinner(arrival_time):
    trip_dates = [date(2026, 8, 12), date(2026, 8, 13)]
    result = recommend_daily_meals(trip_dates, _dt(arrival_time), None)
    assert result[date(2026, 8, 12)] == ["lunch", "dinner"]


@pytest.mark.parametrize(
    "arrival_time",
    ["2026-08-12T13:00:00", "2026-08-12T23:59:00"],
)
def test_arrival_at_or_after_13_recommends_dinner_only(arrival_time):
    trip_dates = [date(2026, 8, 12), date(2026, 8, 13)]
    result = recommend_daily_meals(trip_dates, _dt(arrival_time), None)
    assert result[date(2026, 8, 12)] == ["dinner"]


def test_middle_day_always_recommends_all_three():
    trip_dates = [date(2026, 8, 12), date(2026, 8, 13), date(2026, 8, 14)]
    result = recommend_daily_meals(trip_dates, _dt("2026-08-12T10:00:00"), _dt("2026-08-14T20:00:00"))
    assert result[date(2026, 8, 13)] == ["breakfast", "lunch", "dinner"]


@pytest.mark.parametrize(
    ("departure_time", "expected"),
    [
        ("2026-08-14T08:59:00", []),
        ("2026-08-14T09:00:00", ["breakfast"]),
        ("2026-08-14T12:59:00", ["breakfast"]),
        ("2026-08-14T13:00:00", ["breakfast", "lunch"]),
        ("2026-08-14T18:59:00", ["breakfast", "lunch"]),
        ("2026-08-14T19:00:00", ["breakfast", "lunch", "dinner"]),
    ],
)
def test_departure_day_rule(departure_time, expected):
    trip_dates = [date(2026, 8, 12), date(2026, 8, 13), date(2026, 8, 14)]
    result = recommend_daily_meals(trip_dates, _dt("2026-08-12T10:00:00"), _dt(departure_time))
    assert result[date(2026, 8, 14)] == expected


def test_single_day_trip_intersects_arrival_and_departure_rules():
    trip_dates = [date(2026, 8, 12)]
    # 10시 도착(점심+저녁 가능) ∩ 18시 출발(아침+점심 가능) = 점심만.
    result = recommend_daily_meals(trip_dates, _dt("2026-08-12T10:00:00"), _dt("2026-08-12T18:00:00"))
    assert result[date(2026, 8, 12)] == ["lunch"]


def test_no_departure_booking_only_arrival_rule_applies():
    trip_dates = [date(2026, 8, 12)]
    result = recommend_daily_meals(trip_dates, _dt("2026-08-12T20:00:00"), None)
    assert result[date(2026, 8, 12)] == ["dinner"]


def test_empty_trip_dates_returns_empty_dict():
    assert recommend_daily_meals([], _dt("2026-08-12T10:00:00"), None) == {}
