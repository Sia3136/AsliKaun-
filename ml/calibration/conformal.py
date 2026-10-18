"""Split-conformal p-values: wraps any fitted model exposing
`raw_score(x) -> float` (IsolationBaseline, MahalanobisBaseline, or a
future deep model with the same interface) and a held-out calibration
set from the SAME rider's normal history.

p(x) = (1 + #{calibration raw scores >= raw_score(x)}) / (n + 1)

Small p = this session looks unusual compared to almost all of the
rider's own calibration sessions. The +1 in both numerator and
denominator is what makes this a formally valid conformal p-value
(guarantees p is never exactly 0, and gives the finite-sample coverage
guarantee) rather than just an empirical percentile rank.

Calibration must be a DIFFERENT slice of sessions than the model was
fit on — fitting and calibrating on the same data is the train/
calibration leakage bug documented in ml/README.md's known-issues
section (it made every honest session look anomalous the first time
around).
"""
import numpy as np


class ConformalScorer:
    def __init__(self, model):
        self.model = model
        self._calib_raw: np.ndarray | None = None

    def calibrate(self, calib_vectors) -> "ConformalScorer":
        self._calib_raw = np.sort([self.model.raw_score(v) for v in calib_vectors])
        return self

    def p_value(self, x: np.ndarray) -> float:
        if self._calib_raw is None:
            raise RuntimeError("call calibrate() first, with a held-out set")
        raw = self.model.raw_score(x)
        n = len(self._calib_raw)
        count_ge = n - int(np.searchsorted(self._calib_raw, raw, side="left"))
        return (1 + count_ge) / (n + 1)
