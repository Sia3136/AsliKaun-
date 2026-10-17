"""Multi-signal fusion of conformal p-values. Replaces the old
`behavior_continuity = 1 - mean(anomaly_scores)` in the two-axis
combiner, which let one noisy signal drag the average around and had no
statistical grounding.

Fisher's method is the default: it only produces a small fused p-value
when MULTIPLE signals independently look unusual, which is the actual
design intent ("handoff signature" should mean several things moved
together, not that one signal had a bad day). Noisy-OR is kept as an
even more conservative alternative (also requires broad agreement, in a
different functional form) and as a simple baseline to compare against.
"""
import numpy as np
from scipy import stats


def fisher_combine(p_values: dict[str, float]) -> float:
    """Assumes signals are reasonably independent (operational, GPS,
    touch, motion are measuring different things in practice — this is
    a simplifying assumption, not proven independence; flag it if a
    future evaluation shows the signals are correlated enough to bias
    this)."""
    ps = np.clip(np.array(list(p_values.values()), dtype=float), 1e-12, 1.0)
    k = len(ps)
    if k == 0:
        return 1.0
    X = -2.0 * np.sum(np.log(ps))
    return float(1.0 - stats.chi2.cdf(X, df=2 * k))


def noisy_or_combine(p_values: dict[str, float]) -> float:
    ps = np.clip(np.array(list(p_values.values()), dtype=float), 0.0, 1.0)
    return float(np.prod(ps)) if len(ps) else 1.0


# Missing-signal policy (see the revised plan): a missing signal is
# dropped from the dict passed to fisher_combine/noisy_or_combine
# BEFORE calling it — never imputed as anomalous or as perfectly normal.
MISSING_SIGNAL_POLICY = {
    "touch_missing": "use gps + operational (+ motion if present); mark sdk_unavailable",
    "motion_missing": "use touch + gps + operational",
    "gps_missing": "use touch + motion + operational; reduce confidence",
    "all_behavioral_missing": "insufficient_evidence; never challenge on operational alone",
    "fewer_than_5_calibration_sessions": "population prior + explicit low-confidence state",
}
