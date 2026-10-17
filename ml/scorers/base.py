"""Shared per-rider IsolationForest scorer base class.

Calibration note: an IsolationForest's raw decision_function is
systematically biased low (more "normal") on the exact points it was
trained on — many splits are chosen based on those very values — so
comparing a new point's raw score against the training set's own raw
scores makes every unseen point look more anomalous than it really is,
even when it comes from the identical distribution (this is what made
every honest test session score 0.6-0.9 in the first pass). The fix is
the standard one: fit the model on one slice of a rider's history, then
calibrate the percentile-rank baseline on a DIFFERENT held-out slice of
honest history the model never saw, and score new points against that
held-out distribution instead of the training one.
"""
import numpy as np
from pyod.models.iforest import IForest


class IsolationForestScorer:
    def __init__(self, contamination: float = 0.05, random_state: int = 0):
        self.contamination = contamination
        self.random_state = random_state
        self.model: IForest | None = None
        self._calib_raw: np.ndarray | None = None

    def _extract(self, item) -> np.ndarray:
        raise NotImplementedError

    def fit(self, items: list, calibration_items: list | None = None) -> "IsolationForestScorer":
        """`calibration_items`: a held-out slice of the SAME rider's honest
        history, disjoint from `items`, used to set the normal-score
        baseline. If omitted, falls back to using `items` itself (less
        accurate — scores will run high, as the training-bias note above
        explains)."""
        X = np.stack([self._extract(i) for i in items])
        self.model = IForest(contamination=self.contamination, random_state=self.random_state)
        self.model.fit(X)
        calib_source = calibration_items if calibration_items else items
        Xc = np.stack([self._extract(i) for i in calib_source])
        self._calib_raw = np.sort(self.model.decision_function(Xc))
        return self

    def score(self, item) -> float:
        """Percentile rank of this item's anomaly score against the
        rider's held-out calibration distribution; higher = more
        anomalous relative to that rider's normal behavior."""
        if self.model is None:
            raise RuntimeError("call fit() with the rider's history first")
        x = self._extract(item).reshape(1, -1)
        raw = float(self.model.decision_function(x)[0])
        rank = float(np.searchsorted(self._calib_raw, raw, side="right"))
        return float(np.clip(rank / len(self._calib_raw), 0.0, 1.0))


class PrecomputedVectorScorer(IsolationForestScorer):
    """For signals whose feature vectors are computed upstream (GPS
    trajectories, H-MOG validation) rather than extracted from a session
    dict — `_extract` is the identity function."""

    def _extract(self, feature_vector: np.ndarray) -> np.ndarray:
        return feature_vector
