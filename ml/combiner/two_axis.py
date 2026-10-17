"""The two-axis trust combiner: context continuity x behavioral continuity
-> quadrant -> decision. This is the core architectural differentiator —
it never collapses to one confidence number, because a context change and
a behavior change mean opposite things depending on which one actually
moved (see the main doc's Top Differentiators #1).
"""
from dataclasses import dataclass

from ml.calibration.fusion import fisher_combine


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


def behavior_continuity(p_values: dict) -> float:
    """1.0 = behavior fully matches the rider's history. `p_values` is
    {signal_name: conformal p-value in [0,1]} from
    ml/combiner/signal_models.py's RiderSignalModels (or any per-signal
    ConformalScorer) — a p-value near 1 means that signal looks
    thoroughly normal against the rider's own calibration set, near 0
    means it looks anomalous.

    Fused with Fisher's method rather than averaged: the fusion check
    in ml/scripts/evaluate_fusion.py measured this directly — on the
    synthetic cohort, Fisher fusion dropped EER from 0.222 (best single
    signal) to 0.158, vs. the old mean-of-anomaly-scores approach this
    function used to use. Fisher only produces a small fused p-value
    (= low behavior_continuity) when MULTIPLE signals independently
    look unusual, which is the actual design intent — a single noisy
    signal shouldn't be able to drag the verdict around."""
    if not p_values:
        return 1.0
    return fisher_combine(p_values)


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


def classify(context_cont: float, behavior_cont: float,
             context_threshold: float = 0.6, behavior_alpha: float = 0.05) -> dict:
    """context_threshold: context_continuity (a simple match-fraction,
    0/0.33/0.67/1) >= this counts as 'stable' — unchanged semantics.

    behavior_alpha: behavior_continuity is now a Fisher-fused conformal
    p-value (see behavior_continuity's docstring), which is uniformly
    distributed on [0,1] for genuinely normal behavior BY CONSTRUCTION —
    that's what makes it a valid p-value. So 'stable' must mean p is
    NOT small, i.e. behavior_cont >= behavior_alpha, with alpha a
    standard significance level (0.05 default), not a 0.6 cutoff.
    Using the old 0.6 threshold here would flag ~60% of genuinely
    honest sessions on the behavior axis alone, since P(uniform < 0.6)
    = 0.6 — this was a real bug caught when the fusion math was
    formalized, not a style choice. alpha itself is still a starting
    point; the product's per-rider conformal calibration (not yet
    wired) would let each rider's threshold be set from their own
    history to hit a target false-challenge rate directly."""
    ctx_state = "stable" if context_cont >= context_threshold else "changed"
    beh_state = "stable" if behavior_cont >= behavior_alpha else "changed"
    result = dict(QUADRANTS[(ctx_state, beh_state)])
    result["context_continuity"] = round(context_cont, 3)
    result["behavior_continuity"] = round(behavior_cont, 3)
    result["trust_score"] = round(behavior_cont, 3)
    return result
