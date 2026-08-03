import pytest

from app.utils.companion_validation import validate_companion_types
from app.utils.errors import InvalidInputError


@pytest.mark.parametrize(
    "companion_types",
    [
        ["solo"],
        ["infant"],
        ["infant", "senior"],
        ["friends_couple", "mobility_impaired", "pet"],
    ],
)
def test_allowed_combinations_pass(companion_types):
    validate_companion_types(companion_types)  # 예외가 발생하지 않아야 한다.


@pytest.mark.parametrize(
    "companion_types",
    [
        ["solo", "infant"],
        ["pet", "solo"],
        ["solo", "friends_couple", "senior"],
    ],
)
def test_solo_combined_with_other_conditions_is_rejected(companion_types):
    with pytest.raises(InvalidInputError):
        validate_companion_types(companion_types)


def test_empty_companion_types_is_rejected():
    with pytest.raises(InvalidInputError):
        validate_companion_types([])
