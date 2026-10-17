"""The two-axis trust combiner: context continuity x behavioral continuity
-> quadrant -> decision. This is the core architectural differentiator —
it never collapses to one confidence number, because a context change and
a behavior change mean opposite things depending on which one actually
moved (see the main doc's Top Differentiators #1).
"""
from dataclasses import dataclass


@dataclass
class ContextBaseline:
    """A rider's known context values, built up from their session history."""
    device_ids: set
    ip_subnets: set
    zones: set

    @classmethod
    def from_history(cls, sessions: list[dict]) -> "ContextBaseline":
        return cls(
            device_ids={s["device_id"] for s in sessions},
            ip_subnets={s["ip_subnet"] for s in sessions},
            zones={s["zone"] for s in sessions},
        )


def context_continuity(session: dict, baseline: ContextBaseline) -> float:
    """1.0 = device/IP/zone all match the rider's known context. Each of
    the 3 fields contributes equally; rule-based by design (Tier-0, no
    model), per the architecture's Context Change Detector."""
    matches = 0
    matches += 1 if session["device_id"] in baseline.device_ids else 0
    matches += 1 if session["ip_subnet"] in baseline.ip_subnets else 0
    matches += 1 if session["zone"] in baseline.zones else 0
    return matches / 3.0


def behavior_continuity(scorer_outputs: dict) -> float:
    """1.0 = behavior fully matches the rider's history. scorer_outputs is
    {signal_name: anomaly_score in [0,1]} from the operational/motion/
    touch/gps scorers; combined as a simple mean (unweighted — a
    red-team evaluation pass should tune these weights, not guesswork)."""
    if not scorer_outputs:
        return 1.0
    mean_anomaly = sum(scorer_outputs.values()) / len(scorer_outputs)
    return 1.0 - mean_anomaly


QUADRANTS = {
    ("stable", "stable"): {
        "quadrant": "stable",
        "decision": "continue",
        "meaning": "nothing unusual",
    },
    ("changed", "stable"): {
        "quadrant": "legit_change",
        "decision": "rebaseline_silently",
        "meaning": "context changed but behavior didn't — a life change (new phone, moved city), not a handoff",
    },
    ("stable", "changed"): {
        "quadrant": "handoff_signature",
        "decision": "escalate_challenge",
        "meaning": "same device/zone/network, different behavior — the handoff signature",
    },
    ("changed", "changed"): {
        "quadrant": "ambiguous",
        "decision": "lightweight_challenge",
        "meaning": "both axes moved — can't tell yet, ask a cheap question before deciding",
    },
}


def classify(context_cont: float, behavior_cont: float, threshold: float = 0.6) -> dict:
    """threshold: continuity >= threshold counts as 'stable' on that axis.
    0.6 is a starting point, not a calibrated value — the conformal
    calibration step (per-rider, per-cohort) replaces this fixed cutoff."""
    ctx_state = "stable" if context_cont >= threshold else "changed"
    beh_state = "stable" if behavior_cont >= threshold else "changed"
    result = dict(QUADRANTS[(ctx_state, beh_state)])
    result["context_continuity"] = round(context_cont, 3)
    result["behavior_continuity"] = round(behavior_cont, 3)
    result["trust_score"] = round(behavior_cont, 3)
    return result
