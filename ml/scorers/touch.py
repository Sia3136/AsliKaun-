"""Touch-gesture anomaly scorer: tap pressure, area, and inter-tap rhythm,
fit per rider on that rider's own history. Tier-3 signal per the taxonomy.
"""
import numpy as np

from ml.scorers.base import IsolationForestScorer


def extract_features(session: dict) -> np.ndarray:
    taps = session.get("touch_events", [])
    if not taps:
        return np.array([0.0, 0.0, 0.0, 0.0])
    pressures = [t["pressure"] for t in taps]
    areas = [t["area"] for t in taps]
    intervals = np.diff([t["t_offset_ms"] for t in taps]) if len(taps) > 1 else [0.0]
    return np.array([
        float(np.mean(pressures)),
        float(np.std(pressures)) if len(pressures) > 1 else 0.0,
        float(np.mean(areas)),
        float(np.mean(intervals)),
    ])


class TouchScorer(IsolationForestScorer):
    def _extract(self, session: dict) -> np.ndarray:
        return extract_features(session)
