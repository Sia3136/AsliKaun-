"""Per-rider operating threshold for the fused behavior p-value —
delivers on the plan's "calibrate each rider's challenge threshold on
their own history" promise, which the current global `behavior_alpha`
(ml/combiner/two_axis.py) does not: it's one pooled value measured
across the whole evaluation cohort, not specific to any individual
rider.

Honest constraint this module makes explicit rather than hiding: a
conformal threshold aimed at a target false-accept rate can only
resolve as finely as 1/(n_calib + 1). To genuinely promise "at most 1%
of this rider's honest sessions get challenged," that rider needs
around 100 calibration sessions — most riders in our real evaluation
data (H-MOG, ODIDMob) have 10-20. Below the resolvable threshold, this
falls back to the population-pooled value (ml/scripts/evaluate_fusion.py's
measured 0.29) rather than silently promising a precision the data
can't support — this is the same "cold start" principle already in the
edge-case matrix (new riders get population priors, not false
individual confidence).

Known simplification, not textbook-pure: the fused p-values used to set
a rider's threshold are computed on the SAME calibration sessions used
to calibrate each per-signal ConformalScorer (not a further-held-out
slice). This double-dips mildly and is slightly optimistic. A
4-way split (enroll / per-signal-calib / threshold-calib / test) would
remove this bias but needs even more per-rider history than we
currently have — revisit once real production data accumulates.
"""
import numpy as np

from ml.calibration.fusion import fisher_combine

POPULATION_FALLBACK_THRESHOLD = 0.29  # ml/scripts/evaluate_fusion.py's measured EER-balancing value


def min_calib_for_target_far(target_far: float) -> int:
    """Minimum calibration-set size for a threshold to resolve this
    false-accept rate at all (1/(n+1) <= target_far)."""
    return int(np.ceil(1.0 / target_far) - 1)


def per_rider_threshold(calib_fused_p_values: list[float], target_far: float = 0.01) -> dict:
    """Returns the rider-specific threshold achieving (as closely as the
    data allows) `target_far`, using Empirical Bayes / credibility-weighted
    shrinkage when sample size is moderate (5 <= n < required_n), full
    per-rider calibration when n >= required_n, or population fallback when n < 5.
    """
    n = len(calib_fused_p_values)
    required_n = min_calib_for_target_far(target_far)

    if n < 5:
        return {
            "threshold": POPULATION_FALLBACK_THRESHOLD,
            "source": "population_fallback",
            "target_far": target_far,
            "n_calib": n,
            "n_required_for_target": required_n,
            "note": (
                f"insufficient calibration history (n={n} < 5) — using population "
                f"threshold until more sessions accumulate"
            ),
        }

    sorted_p = np.sort(calib_fused_p_values)

    if n >= required_n:
        idx = int(np.floor(target_far * (n + 1))) - 1
        idx = max(0, min(idx, n - 1))
        threshold = float(sorted_p[idx])
        return {
            "threshold": round(threshold, 4),
            "source": "per_rider_calibrated",
            "target_far": target_far,
            "n_calib": n,
            "achieved_resolution": 1.0 / (n + 1),
            "note": f"fully calibrated from this rider's own {n} calibration sessions",
        }

    # Empirical Bayes / Credibility weighting for 5 <= n < required_n:
    # Blend the rider's personal calibration empirical quantile with the population prior.
    # Credibility weight w_n = n / (n + n_0), where n_0 = 10 (half-weight at 10 sessions).
    n_0 = 10.0
    weight_rider = float(n / (n + n_0))
    # Minimum resolvable quantile for this n
    effective_percentile = max(target_far * 100.0, (1.0 / (n + 1)) * 100.0)
    raw_quantile = float(np.percentile(sorted_p, effective_percentile))
    blended = float(weight_rider * raw_quantile + (1.0 - weight_rider) * POPULATION_FALLBACK_THRESHOLD)

    return {
        "threshold": round(blended, 4),
        "source": "empirical_bayes_calibrated",
        "target_far": target_far,
        "n_calib": n,
        "weight_rider": round(weight_rider, 3),
        "raw_quantile": round(raw_quantile, 4),
        "achieved_resolution": 1.0 / (n + 1),
        "note": (
            f"empirically calibrated with {round(weight_rider*100, 1)}% rider credibility weight "
            f"over {n} sessions blended with population prior"
        ),
    }


def compute_calib_fused_p_values(rider_signal_models, calib_sessions: list, extractors: dict) -> list[float]:
    """Runs each calibration session back through the rider's OWN fitted
    per-signal scorers to get the fused p-value distribution a
    per-rider threshold is set from. `rider_signal_models`:
    {signal_name: ConformalScorer}; `extractors`: {signal_name: fn}."""
    fused = []
    for session in calib_sessions:
        p_values = {}
        for signal, scorer in rider_signal_models.items():
            vec = extractors[signal](session)
            if vec is not None:
                p_values[signal] = scorer.p_value(vec)
        if p_values:
            fused.append(fisher_combine(p_values))
    return fused
