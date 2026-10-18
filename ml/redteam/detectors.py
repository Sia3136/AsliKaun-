"""Detectors that go beyond a single-session threshold: the frozen
identity anchor (catches slow drift that a fast-adapting baseline misses)
and split-rental clustering (catches two people alternating on one
account). Both are differentiators named in the main doc, not part of the
core two-axis combiner.
"""
import numpy as np
from sklearn.mixture import GaussianMixture

from ml.scorers.operational import extract_features as op_features
from ml.scorers.touch import extract_features as touch_features


class FastBaselineDetector:
    """An EWMA baseline that absorbs every session it sees, flagged or
    not — this is deliberately the naive, vulnerable design. A rolling
    WINDOW mean lags a linear drift by a roughly constant amount set by
    the window size, so tuned wrong it can look like it 'catches' slow
    drift by accident; an EWMA that folds in every new point regardless
    of outcome is what a real fast-adapting baseline looks like, and its
    steady-state lag behind a slope-s drift is s*(1-alpha)/alpha — small
    whenever the drift is genuinely gradual. That's the boiling-frog gap
    this class exists to demonstrate, and why the frozen anchor below is
    the actual fix, not a tuning tweak to this detector."""

    def __init__(self, alpha: float = 0.3, threshold: float = 0.3):
        self.alpha = alpha
        self.threshold = threshold
        self.ewma: float | None = None

    def update(self, behavior_continuity: float) -> bool:
        flagged = False
        if self.ewma is not None:
            flagged = behavior_continuity < self.ewma - self.threshold
        self.ewma = behavior_continuity if self.ewma is None else (
            (1 - self.alpha) * self.ewma + self.alpha * behavior_continuity)
        return flagged


class FrozenAnchorDetector:
    """Anchors on the mean of the first `anchor_window` sessions (stand-in
    for "last strong verification") and never moves it. Accumulates how
    far behavior has drifted below that anchor over time; forces a
    challenge once cumulative drift crosses `drift_threshold`, regardless
    of how gradual the drift was. Call `reset_anchor()` after a real
    re-verification (e.g. the rider passes a step-up challenge)."""

    def __init__(self, anchor_window: int = 10, drift_threshold: float = 3.0):
        self.anchor_window = anchor_window
        self.drift_threshold = drift_threshold
        self._buffer: list[float] = []
        self.anchor_mean: float | None = None
        self.cumulative = 0.0

    def reset_anchor(self, recent_values: list[float]) -> None:
        self.anchor_mean = sum(recent_values) / len(recent_values)
        self.cumulative = 0.0

    def update(self, behavior_continuity: float) -> bool:
        self._buffer.append(behavior_continuity)
        if self.anchor_mean is None:
            if len(self._buffer) >= self.anchor_window:
                self.reset_anchor(self._buffer)
            return False
        deficit = max(0.0, self.anchor_mean - behavior_continuity)
        self.cumulative += deficit
        return self.cumulative >= self.drift_threshold


def split_rental_check(sessions: list[dict]) -> dict:
    """Fits a 2-component Gaussian mixture on [operational + touch]
    features across a rider's session history and checks (a) whether 2
    components fit meaningfully better than 1 (lower BIC), and (b)
    whether the two clusters correlate with time of day — the split-shift
    signature. Needs enough sessions (20+) to be meaningful."""
    X = np.stack([np.concatenate([op_features(s), touch_features(s)]) for s in sessions])
    hours = np.array([s["hour_of_day"] for s in sessions])

    gmm1 = GaussianMixture(n_components=1, random_state=0).fit(X)
    gmm2 = GaussianMixture(n_components=2, random_state=0).fit(X)
    bic1, bic2 = gmm1.bic(X), gmm2.bic(X)
    labels = gmm2.predict(X)

    two_clusters_fit_better = bic2 < bic1
    hour_by_cluster = [hours[labels == c].mean() if np.any(labels == c) else np.nan for c in (0, 1)]
    hour_gap = abs(hour_by_cluster[0] - hour_by_cluster[1]) if not any(np.isnan(hour_by_cluster)) else 0.0
    correlates_with_time = hour_gap > 3.0  # clusters differ by >3h average time-of-day

    return {
        "bic_1_component": float(bic1),
        "bic_2_component": float(bic2),
        "two_clusters_fit_better": bool(two_clusters_fit_better),
        "hour_by_cluster": [float(h) for h in hour_by_cluster],
        "correlates_with_time_of_day": bool(correlates_with_time),
        "split_rental_suspected": bool(two_clusters_fit_better and correlates_with_time),
    }
