"""Run all red-team scenarios through the real pipeline (scorers +
combiner) and report what actually gets caught, including the two
scenarios designed to fool a naive detector: slow drift (needs the
frozen anchor) and split-shift sharing (needs clustering, not scoring).
"""
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ml.sim.rider_sim import make_profile, generate_session
from ml.scorers.operational import OperationalScorer
from ml.scorers.motion import MotionScorer
from ml.scorers.touch import TouchScorer
from ml.combiner.two_axis import ContextBaseline, context_continuity, behavior_continuity, classify
from ml.redteam.scenarios import (
    lazy_renter, slow_drift_renter, split_shift_sharer,
    honest_phone_and_city_change, honest_illness_recovery,
)
from ml.redteam.detectors import FastBaselineDetector, FrozenAnchorDetector, split_rental_check

owner = make_profile("owner", seed=10)
renter = make_profile("renter", seed=20)
base_time = datetime(2026, 10, 1, 9, 0)

history = [
    generate_session(owner, base_time - timedelta(hours=2 * (60 - i)), seed=900 + i)
    for i in range(60)
]
fit_history, calib_history = history[:40], history[40:]
baseline = ContextBaseline.from_history(history)

scorers = {
    "operational": OperationalScorer(contamination=0.05).fit(fit_history, calib_history),
    "motion": MotionScorer(contamination=0.05).fit(fit_history, calib_history),
    "touch": TouchScorer(contamination=0.05).fit(fit_history, calib_history),
}


def behavior_continuity_of(session: dict) -> float:
    return behavior_continuity({name: s.score(session) for name, s in scorers.items()})


def run_scenario_through_pipeline(label: str, sessions: list[dict]):
    fast = FastBaselineDetector(alpha=0.3, threshold=0.3)
    frozen = FrozenAnchorDetector(anchor_window=10, drift_threshold=3.0)
    first_combiner_escalation = None
    first_fast_flag = None
    first_frozen_flag = None

    for i, session in enumerate(sessions):
        ctx = context_continuity(session, baseline)
        beh = behavior_continuity_of(session)
        result = classify(ctx, beh)
        if first_combiner_escalation is None and result["decision"] != "continue":
            first_combiner_escalation = (i, result["quadrant"])
        if first_fast_flag is None and fast.update(beh):
            first_fast_flag = i
        if first_frozen_flag is None and frozen.update(beh):
            first_frozen_flag = i

    print(f"\n{label} ({len(sessions)} sessions)")
    print(f"  combiner first escalation at session {first_combiner_escalation}")
    print(f"  fast-baseline detector first flag at session {first_fast_flag}")
    print(f"  frozen-anchor detector first flag at session {first_frozen_flag}")
    return first_combiner_escalation, first_fast_flag, first_frozen_flag


print("=== 4 attacker types + 2 honest-rider traps ===")

run_scenario_through_pipeline("1. lazy_renter (full handoff, should be caught fast)",
                              lazy_renter(owner, renter, base_time + timedelta(days=5)))

_, fast_flag, frozen_flag = run_scenario_through_pipeline(
    "2. slow_drift_renter (ramps over 60 sessions — the boiling-frog attack)",
    slow_drift_renter(owner, renter, base_time + timedelta(days=5), n=60, gap_hours=3.0))
print(f"  -> frozen anchor {'CAUGHT' if frozen_flag is not None else 'MISSED'} the drift; "
      f"fast baseline {'caught it too (unexpected)' if fast_flag is not None else 'MISSED it as designed — this is the point'}")

split_sessions = split_shift_sharer(owner, renter, base_time + timedelta(days=5), n=30)
run_scenario_through_pipeline("3. split_shift_sharer (owner mornings, renter evenings)", split_sessions)
cluster_result = split_rental_check(split_sessions)
print(f"  split-rental clustering check: {cluster_result}")

run_scenario_through_pipeline(
    "4a. honest_phone_and_city_change (must NOT escalate hard)",
    honest_phone_and_city_change(owner, base_time + timedelta(days=5)))

run_scenario_through_pipeline(
    "4b. honest_illness_recovery (behavior dips, same context — must not match handoff severity)",
    honest_illness_recovery(owner, base_time + timedelta(days=5)))
