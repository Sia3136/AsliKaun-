"""Red-team scenario generators: the 4 attacker types + 2 honest-rider
edge cases from the main doc's "what to build first" list. Each returns
a time-ordered list of sessions for one rider_id, so a detector can be
run session-by-session to measure time-to-detection.
"""
from datetime import timedelta

from ml.sim.rider_sim import blend_profiles, generate_session


def lazy_renter(owner: dict, renter: dict, base_time, n: int = 10, gap_hours: float = 2.0) -> list[dict]:
    """Full handoff from session 0 — the easy case, should be caught fast."""
    return [
        generate_session(owner, base_time + timedelta(hours=gap_hours * i), seed=1000 + i, impersonator=renter)
        for i in range(n)
    ]


def slow_drift_renter(owner: dict, renter: dict, base_time, n: int = 30, gap_hours: float = 4.0) -> list[dict]:
    """Behavior ramps linearly from owner's to renter's over n sessions —
    defeats a detector that only compares each session to a fast-adapting
    recent baseline (the boiling-frog attack; see ml/redteam/detectors.py)."""
    sessions = []
    for i in range(n):
        alpha = i / (n - 1)
        blended = blend_profiles(owner, renter, alpha)
        sessions.append(generate_session(
            owner, base_time + timedelta(hours=gap_hours * i), seed=2000 + i, impersonator=blended))
    return sessions


def split_shift_sharer(owner: dict, renter: dict, base_time, n: int = 30) -> list[dict]:
    """Owner drives the morning shift, renter the evening shift, every
    day — two stable behavioral identities on one account, correlated
    with time of day. A single-baseline detector just sees one noisy
    rider; this needs the clustering check in detectors.py."""
    sessions = []
    for day in range(n // 2):
        morning = base_time + timedelta(days=day, hours=9)
        evening = base_time + timedelta(days=day, hours=19)
        sessions.append(generate_session(owner, morning, seed=3000 + day))
        sessions.append(generate_session(owner, evening, seed=3500 + day, impersonator=renter))
    return sessions


def honest_phone_and_city_change(owner: dict, base_time, n: int = 10, gap_hours: float = 2.0) -> list[dict]:
    """The honest-rider trap: context changes (new phone, new city) but
    behavior stays the owner's own. Must NOT be flagged as a handoff."""
    return [
        generate_session(owner, base_time + timedelta(hours=gap_hours * i), seed=4000 + i, context_override={
            "device_id": f"dev-{owner['rider_id']}-NEW-PHONE",
            "zone": next(z for z in ["andheri", "bandra", "dadar", "powai", "thane", "navi_mumbai"]
                         if z not in owner["zones"]),
        })
        for i in range(n)
    ]


def honest_illness_recovery(owner: dict, base_time, n: int = 10, gap_hours: float = 2.0) -> list[dict]:
    """The honest-rider trap: a real but temporary behavior shift (injury,
    rough roads, rushing) with the SAME context. Must not be escalated as
    hard as a true handoff, even though behavior_continuity does dip."""
    shifted = dict(owner)
    shifted["accel_noise"] = owner["accel_noise"] * 2.2
    shifted["accept_latency_mean_ms"] = owner["accept_latency_mean_ms"] * 1.4
    return [
        generate_session(owner, base_time + timedelta(hours=gap_hours * i), seed=5000 + i, impersonator=shifted)
        for i in range(n)
    ]


SCENARIOS = {
    "lazy_renter": lazy_renter,
    "slow_drift_renter": slow_drift_renter,
    "split_shift_sharer": split_shift_sharer,
    "honest_phone_and_city_change": honest_phone_and_city_change,
    "honest_illness_recovery": honest_illness_recovery,
}
