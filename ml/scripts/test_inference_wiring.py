"""Plumbing test for ml/inference/rider_model_bundle.py — NOT a
real-data accuracy validation (that's what Phase 1/2 already did). This
only confirms the RiderModelBundle wiring runs end-to-end against
schema-shaped data without crashing, including the missing-signal path
(the synthetic simulator doesn't produce GPS or enough accel samples
per session, so those signals should gracefully skip, not error).
"""
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ml.sim.rider_sim import make_profile, generate_session
from ml.inference.rider_model_bundle import RiderModelBundle

rider = make_profile("rider_x", seed=1)
renter = make_profile("renter_y", seed=2)
base_time = datetime(2026, 10, 1, 9, 0)

history = [
    generate_session(rider, base_time + timedelta(hours=2 * i), seed=100 + i)
    for i in range(60)
]
enroll, calib = history[:40], history[40:]

print("Fitting RiderModelBundle...")
bundle = RiderModelBundle.fit(enroll, calib)
print(f"Signals that got a model: {list(bundle.scorers.keys())}")
print(f"Per-rider threshold: {bundle.threshold_info}")
assert "operational" in bundle.scorers, "operational signal should always be present for synthetic data"
assert "touch" in bundle.scorers, "touch signal should be present (rider_sim provides pressure/area/duration)"
assert "motion" not in bundle.scorers, "motion should be SKIPPED (rider_sim only gives 1 accel sample/session)"
assert "gps" not in bundle.scorers, "gps should be SKIPPED (rider_sim provides no gps field at all)"
print("PASS: missing-signal policy correctly skipped motion/gps, kept operational/touch")

t = base_time + timedelta(days=5)
honest = generate_session(rider, t, seed=201)
handoff = generate_session(rider, t, seed=202, impersonator=renter)

print("\nScoring an honest session...")
r1 = bundle.score(honest)
print(f"  quadrant={r1['quadrant']} decision={r1['decision']} p_values={r1['p_values']}")

print("\nScoring a handoff session...")
r2 = bundle.score(handoff)
print(f"  quadrant={r2['quadrant']} decision={r2['decision']} p_values={r2['p_values']}")
if r2["decision"] != "continue":
    print(f"  reason_vector: {r2.get('reason_vector')}")

print("\nPASS: RiderModelBundle.fit() and .score() both ran end-to-end without errors")
