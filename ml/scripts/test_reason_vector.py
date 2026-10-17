"""Run a few sessions through the full pipeline (scorers -> combiner ->
reason vector) and print the explanation for every escalated one. Works
with or without ANTHROPIC_API_KEY — without it, explanations are clearly
labeled template fallbacks (see ml/llm/reason_vector.py).
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
from ml.llm.reason_vector import explain

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

t = base_time + timedelta(days=5)
test_sessions = {
    "honest": generate_session(owner, t, seed=601),
    "handoff": generate_session(owner, t, seed=602, impersonator=renter),
    "legit_context_change": generate_session(owner, t, seed=603, context_override={
        "device_id": "dev-owner-NEW-PHONE", "zone": "navi_mumbai"}),
}

for label, session in test_sessions.items():
    ctx = context_continuity(session, baseline)
    scorer_outputs = {name: s.score(session) for name, s in scorers.items()}
    beh = behavior_continuity(scorer_outputs)
    result = classify(ctx, beh)
    print(f"\n{label}: quadrant={result['quadrant']} decision={result['decision']}")
    if result["decision"] == "continue":
        print("  (no challenge -> no reason vector generated, by design)")
        continue
    reason = explain(session, result, scorer_outputs)
    print(f"  generated={reason['generated']} model={reason['model']}")
    print(f"  explanation: {reason['explanation']}")
