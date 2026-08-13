import pytest

from app.services.ai_errors import AITransientError
from app.utils import ai_retry


@pytest.fixture(autouse=True)
def no_real_sleep(monkeypatch):
    monkeypatch.setattr(ai_retry.time, "sleep", lambda *_args: None)


def test_succeeds_on_first_try_without_retry():
    calls = []

    def fn():
        calls.append(1)
        return "ok"

    assert ai_retry.call_with_transient_retry(fn) == "ok"
    assert len(calls) == 1


def test_retries_once_after_transient_error_then_succeeds():
    calls = []

    def fn():
        calls.append(1)
        if len(calls) == 1:
            raise AITransientError("network down")
        return "ok"

    assert ai_retry.call_with_transient_retry(fn) == "ok"
    assert len(calls) == 2


def test_raises_after_exhausting_attempts():
    calls = []

    def fn():
        calls.append(1)
        raise AITransientError("still down")

    with pytest.raises(AITransientError):
        ai_retry.call_with_transient_retry(fn)
    assert len(calls) == ai_retry.DEFAULT_ATTEMPTS


def test_non_transient_error_is_not_retried():
    calls = []

    def fn():
        calls.append(1)
        raise ValueError("not transient")

    with pytest.raises(ValueError):
        ai_retry.call_with_transient_retry(fn)
    assert len(calls) == 1
