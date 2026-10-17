"""Fits per-rider conformal-calibrated models for each behavioral
signal and produces the p-values the two-axis combiner's
`behavior_continuity` fuses. This is the real wiring between
ml/models + ml/calibration (built for the Phase 1 real-data evaluation)
and the synthetic combiner/red-team tests, which previously used the
old scorers/*.py classes and an approximate percentile score instead of
a formal conformal p-value.
"""
from ml.calibration.conformal import ConformalScorer
from ml.models.isolation_baseline import IsolationBaseline
from ml.scorers.motion import extract_features as motion_extract
from ml.scorers.operational import extract_features as op_extract
from ml.scorers.touch import extract_features as touch_extract

SIGNAL_EXTRACTORS = {
    "operational": op_extract,
    "motion": motion_extract,
    "touch": touch_extract,
}


class RiderSignalModels:
    """One IsolationBaseline + ConformalScorer per signal, fit on a
    rider's enrollment sessions and calibrated on a disjoint slice of
    their history — same protocol as the Phase 1 harness, just applied
    to the synthetic session format."""

    def __init__(self, contamination: float = 0.05):
        self.contamination = contamination
        self.scorers: dict[str, ConformalScorer] = {}

    def fit(self, enroll_sessions: list[dict], calib_sessions: list[dict]) -> "RiderSignalModels":
        for name, extract in SIGNAL_EXTRACTORS.items():
            model = IsolationBaseline(contamination=self.contamination).fit(
                [extract(s) for s in enroll_sessions])
            self.scorers[name] = ConformalScorer(model).calibrate(
                [extract(s) for s in calib_sessions])
        return self

    def p_values(self, session: dict) -> dict[str, float]:
        return {name: scorer.p_value(SIGNAL_EXTRACTORS[name](session))
                for name, scorer in self.scorers.items()}
