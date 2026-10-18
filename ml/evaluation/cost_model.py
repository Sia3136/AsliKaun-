"""Cost-weighted operating point — the gap EER leaves open. EER finds
the threshold where false-accept and false-reject rates are EQUAL,
which implicitly treats them as equally costly. The plan's own safety
framing (main doc: physical-safety and legal-liability consequences of
a false accept) says they aren't: a missed handoff is far more
expensive than an unnecessary challenge. This picks the threshold that
minimizes actual expected cost, given a stated cost RATIO — not a
precise dollar model (none exists; this is illustrative, same caveat
the main doc already applies to its own pricing numbers), but a
principled way to pick an operating point instead of defaulting to EER
or an arbitrary FAR target.
"""
import numpy as np

from ml.evaluation.metrics import far_frr_curve


def cost_weighted_threshold(
    genuine_scores,
    impostor_scores,
    cost_of_missed_handoff: float = 10.0,
    cost_of_false_challenge: float = 1.0,
    n_thresholds: int = 1000,
) -> dict:
    """Finds the threshold minimizing:
        FAR(t) * cost_of_missed_handoff + FRR(t) * cost_of_false_challenge
    (both FAR and FRR are RATES in [0,1], so this is expected cost per
    session under that ratio, not an absolute dollar figure — the ratio
    is what matters, not the individual numbers). Default 10:1 is
    illustrative, not sourced from real incident/friction cost data;
    state your own ratio once real unit-economics exist, same caveat
    the main doc already applies to its pricing section.
    """
    thresholds, far, frr = far_frr_curve(genuine_scores, impostor_scores, n_thresholds=n_thresholds)
    cost = far * cost_of_missed_handoff + frr * cost_of_false_challenge
    idx = int(np.argmin(cost))
    return {
        "threshold": float(thresholds[idx]),
        "far": float(far[idx]),
        "frr": float(frr[idx]),
        "expected_cost_per_session": float(cost[idx]),
        "cost_ratio": cost_of_missed_handoff / cost_of_false_challenge,
    }


def compare_operating_points(genuine_scores, impostor_scores, cost_ratios: list[float] = (1.0, 5.0, 10.0, 50.0)) -> list[dict]:
    """Shows how the optimal threshold moves as the assumed cost ratio
    changes — illustrates that EER (effectively ratio=1.0) is just one
    point on this curve, not a universally correct choice."""
    return [
        {"cost_ratio": r, **cost_weighted_threshold(genuine_scores, impostor_scores,
                                                      cost_of_missed_handoff=r, cost_of_false_challenge=1.0)}
        for r in cost_ratios
    ]
