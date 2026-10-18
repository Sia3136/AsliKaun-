"""Smoke test for all three Tier-1/2/3 scorers side by side: fit each on
rider A's history, score honest-A sessions vs handoff(A-device, B-behavior)
sessions, and report which signals actually separate them. This is the
real evaluation question before any threshold tuning happens.
"""
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ml.sim.rider_sim import make_profile, generate_session
from ml.scorers.operational import OperationalScorer
from ml.scorers.motion import MotionScorer
from ml.scorers.touch import TouchScorer

rider_a = make_profile("rider_a", seed=1)
rider_b = make_profile("rider_b", seed=2)

base_time = datetime(2026, 10, 1, 9, 0)
history = [
    generate_session(rider_a, base_time + timedelta(hours=2 * i), seed=100 + i)
    for i in range(60)
]
fit_history, calib_history = history[:40], history[40:]

scorers = {
    "operational": OperationalScorer(contamination=0.05).fit(fit_history, calib_history),
    "motion": MotionScorer(contamination=0.05).fit(fit_history, calib_history),
    "touch": TouchScorer(contamination=0.05).fit(fit_history, calib_history),
}

honest_test = [
    generate_session(rider_a, base_time + timedelta(days=5, hours=2 * i), seed=200 + i)
    for i in range(20)
]
handoff_test = [
    generate_session(rider_a, base_time + timedelta(days=5, hours=2 * i), seed=300 + i, impersonator=rider_b)
    for i in range(20)
]

print(f"{'signal':<12} {'honest mean':>12} {'handoff mean':>13} {'separates?':>11}")
for name, scorer in scorers.items():
    h = [scorer.score(s) for s in honest_test]
    o = [scorer.score(s) for s in handoff_test]
    h_mean, o_mean = sum(h) / len(h), sum(o) / len(o)
    separates = "yes" if o_mean > h_mean + 0.1 else "weak/no"
    print(f"{name:<12} {h_mean:>12.3f} {o_mean:>13.3f} {separates:>11}")
