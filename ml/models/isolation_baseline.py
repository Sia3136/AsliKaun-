"""IsolationForest baseline, fit per rider on their own enrollment
vectors. `raw_score` is deliberately NOT normalized here — normalization
into a proper probability happens one layer up, in
ml/calibration/conformal.py, against a held-out calibration set (never
the enrollment set itself — see that module's docstring for why)."""
import numpy as np
from pyod.models.iforest import IForest


class IsolationBaseline:
    def __init__(self, contamination: float = 0.05, random_state: int = 0):
        self.contamination = contamination
        self.random_state = random_state
        self.model: IForest | None = None

    def fit(self, X) -> "IsolationBaseline":
        X = np.stack(X)
        self.model = IForest(contamination=self.contamination, random_state=self.random_state)
        self.model.fit(X)
        return self

    def raw_score(self, x: np.ndarray) -> float:
        if self.model is None:
            raise RuntimeError("call fit() first")
        return float(self.model.decision_function(x.reshape(1, -1))[0])
