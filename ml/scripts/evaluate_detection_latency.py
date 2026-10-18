"""Detection latency as an actual tracked metric, not a single
anecdotal spot-check. The original plan named "detection latency:
sessions or minutes until handoff flagged" as a metric to report
alongside EER/AUC — until now it was only checked for one rider pair
per red-team scenario (ml/scripts/test_redteam.py). This runs the same
idea across many synthetic rider pairs and reports the distribution
(median, IQR) plus the censored rate (handoffs never caught within the
session budget) — exactly the kind of number a single pair can't give
you honestly.

Uses the real production path (RiderSignalModels + classify(), the
same two-axis combiner test_redteam.py uses) so this reflects the
actual current fusion/threshold behavior, not a simplified stand-in.
"""
import sys
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ml.sim.rider_sim import make_profile, generate_session
from ml.combiner.signal_models import RiderSignalModels
from ml.combiner.two_axis import ContextBaseline, context_continuity, behavior_continuity, classify
from ml.redteam.detectors import FrozenAnchorDetector
from ml.redteam.scenarios import lazy_renter, slow_drift_renter

N_PAIRS = 15
SESSION_BUDGET = 60  # cap for slow-drift sessions; censored if never caught by then


def detection_latency_for_pair(owner_seed: int, renter_seed: int, scenario: str) -> int | None:
    owner = make_profile(f"owner_{owner_seed}", seed=owner_seed)
    renter = make_profile(f"renter_{renter_seed}", seed=renter_seed)
    base_time = datetime(2026, 10, 1, 9, 0)

    history = [
        generate_session(owner, base_time - timedelta(hours=2 * (60 - i)), seed=owner_seed * 1000 + i)
        for i in range(60)
    ]
    fit_history, calib_history = history[:40], history[40:]
    baseline = ContextBaseline.from_history(history)
    signal_models = RiderSignalModels(contamination=0.05).fit(fit_history, calib_history)

    attack_time = base_time + timedelta(days=5)
    if scenario == "lazy_renter":
        # Full immediate handoff: the single-session combiner is the right
        # mechanism — it's designed to catch exactly this case fast.
        sessions = lazy_renter(owner, renter, attack_time, n=SESSION_BUDGET, gap_hours=2.0)
        for i, session in enumerate(sessions):
            ctx = context_continuity(session, baseline)
            beh = behavior_continuity(signal_models.p_values(session))
            result = classify(ctx, beh)
            if result["decision"] != "continue":
                return i
        return None

    # Slow drift: the single-session combiner is the WRONG mechanism to
    # measure this with — a flag at session 0-1 (near-pure owner behavior,
    # alpha~=0) is noise, not genuine drift detection. The frozen-anchor
    # detector (ml/redteam/detectors.py) is what the architecture actually
    # uses to catch this attack (cumulative distance from a frozen
    # baseline), so that's what latency should be measured against —
    # using the single-session combiner here would silently report noise
    # as if it were detection.
    sessions = slow_drift_renter(owner, renter, attack_time, n=SESSION_BUDGET, gap_hours=3.0)  # matches test_redteam.py
    frozen = FrozenAnchorDetector(anchor_window=10, drift_threshold=6.0)  # same retuned values as test_redteam.py
    for i, session in enumerate(sessions):
        beh = behavior_continuity(signal_models.p_values(session))
        if frozen.update(beh):
            return i
    return None


def run_scenario(scenario: str):
    latencies, censored = [], 0
    for i in range(N_PAIRS):
        lat = detection_latency_for_pair(owner_seed=10 + i, renter_seed=1000 + i, scenario=scenario)
        if lat is None:
            censored += 1
        else:
            latencies.append(lat)

    print(f"\n{scenario}  ({N_PAIRS} rider pairs, session budget = {SESSION_BUDGET})")
    print(f"  censored (never caught): {censored}/{N_PAIRS}")
    if latencies:
        print(f"  median detection latency: {np.median(latencies):.0f} sessions")
        print(f"  IQR: [{np.percentile(latencies, 25):.0f}, {np.percentile(latencies, 75):.0f}] sessions")
        print(f"  min/max: {min(latencies)}/{max(latencies)} sessions")
    else:
        print("  no pairs detected at all — see censored rate above")


if __name__ == "__main__":
    run_scenario("lazy_renter")
    run_scenario("slow_drift_renter")
