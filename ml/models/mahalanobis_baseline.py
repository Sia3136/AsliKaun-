"""Mahalanobis-distance baseline, fit per rider on their own enrollment
vectors. Uses shrinkage toward a scaled identity matrix so the
covariance stays invertible when the feature count is close to (or
exceeds) the enrollment sample count — a real risk here, since our
touch/motion feature vectors run 40-60 dimensions and enrollment sets
are often only 15-40 sessions.
"""
import numpy as np


class MahalanobisBaseline:
    def __init__(self, shrinkage: float = 0.2):
        self.shrinkage = shrinkage
        self.mean: np.ndarray | None = None
        self.inv_cov: np.ndarray | None = None

    def fit(self, X) -> "MahalanobisBaseline":
        X = np.stack(X)
        self.mean = X.mean(axis=0)
        cov = np.cov(X, rowvar=False)
        if cov.ndim == 0:
            cov = cov.reshape(1, 1)
        d = cov.shape[0]
        target = np.eye(d) * (np.trace(cov) / d if d else 1.0)
        cov_shrunk = (1 - self.shrinkage) * cov + self.shrinkage * target
        self.inv_cov = np.linalg.pinv(cov_shrunk)
        return self

    def raw_score(self, x: np.ndarray) -> float:
        if self.mean is None:
            raise RuntimeError("call fit() first")
        diff = x - self.mean
        return float(np.sqrt(max(diff @ self.inv_cov @ diff.T, 0.0)))
