"""Operational features from platform-logged session events (acceptance
latency, time-of-day). Low-dimensional by nature — no deep model needed
here, per the revised plan.
"""
import numpy as np

FEATURE_NAMES = ["accept_latency_ms", "hour_sin", "hour_cos"]


def session_operational_features(session: dict) -> np.ndarray:
    hour = session["hour_of_day"]
    return np.array([
        session["accept_latency_ms"],
        np.sin(2 * np.pi * hour / 24),
        np.cos(2 * np.pi * hour / 24),
    ])
