"""Motion anomaly scorer: accelerometer-derived riding-style signature, fit
per rider on that rider's own history. Tier-2 signal per the taxonomy.

For the prototype this uses a per-rider IsolationForest on the session's
mean accelerometer vector (a stand-in for the real feature set). The
roadmap item is an LSTM autoencoder pretrained on H-MOG's accelerometer/
gyroscope sessions and fine-tuned on this simulator's output — swap this
class's `_extract` for that once H-MOG is extracted, keeping the same
fit()/score() interface so the combiner doesn't need to change.
"""
import numpy as np

from ml.scorers.base import IsolationForestScorer


def extract_features(session: dict) -> np.ndarray:
    accel = session.get("accel", [])
    if not accel:
        return np.array([0.0, 0.0, 0.0])
    xs = [a["x"] for a in accel]
    ys = [a["y"] for a in accel]
    zs = [a["z"] for a in accel]
    return np.array([float(np.mean(xs)), float(np.mean(ys)), float(np.mean(zs))])


class MotionScorer(IsolationForestScorer):
    def _extract(self, session: dict) -> np.ndarray:
        return extract_features(session)
