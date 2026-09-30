from backend.security import PinGuard


def test_correct_pin_gives_token():
    guard = PinGuard("1234")
    token = guard.verify("1234")
    assert token and guard.is_valid_token(token)


def test_wrong_pin_gives_nothing():
    guard = PinGuard("1234")
    assert guard.verify("0000") is None
    assert not guard.is_valid_token(None)
    assert not guard.is_valid_token("made-up")


def test_lockout_after_too_many_failures():
    guard = PinGuard("1234", max_failures=3, lockout_seconds=30)
    for _ in range(3):
        guard.verify("0000")
    assert guard.seconds_locked() > 0
    # Even the right PIN is refused while locked.
    assert guard.verify("1234") is None


def test_revoked_token_stops_working():
    guard = PinGuard("1234")
    token = guard.verify("1234")
    guard.revoke(token)
    assert not guard.is_valid_token(token)


def test_each_lockout_lasts_twice_as_long_and_a_right_pin_resets_it(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr("backend.security.time.monotonic", lambda: now[0])
    guard = PinGuard("1234", max_failures=2, lockout_seconds=30, max_lockout_seconds=100)

    def lock_out() -> int:
        guard.verify("0000")
        guard.verify("0000")
        return guard.seconds_locked()

    assert lock_out() == 30
    now[0] += 31
    assert lock_out() == 60
    now[0] += 61
    assert lock_out() == 100          # capped
    now[0] += 101
    assert guard.verify("1234") is not None
    assert lock_out() == 30           # a right PIN starts over
