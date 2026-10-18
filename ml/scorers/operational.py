"""Operational anomaly scorer: IsolationForest on acceptance-latency and
time-of-day, fit per rider on that rider's own session history. Tier-1
signal per the taxonomy; touch and motion are separate scorers so each
stays an independent signal per the architecture.
"""
import numpy as np

from ml.scorers.base import IsolationForestScorer


def extract_features(session: dict) -> np.ndarray:
    hour = session["hour_of_day"]
    hour_sin = np.sin(2 * np.pi * hour / 24)
    hour_cos = np.cos(2 * np.pi * hour / 24)
    return np.array([
        session["accept_latency_ms"],
        hour_sin,
        hour_cos,
    ])


class OperationalScorer(IsolationForestScorer):
    def _extract(self, session: dict) -> np.ndarray:
        return extract_features(session)
