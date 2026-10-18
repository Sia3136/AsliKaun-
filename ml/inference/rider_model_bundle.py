"""The production inference surface backend calls. Wires together, per
rider: a model per signal, conformal calibration, Fisher fusion, the
two-axis combiner, the per-rider threshold, and the reason vector.

One `RiderModelBundle` per rider, built once from their enrollment +
calibration history (e.g. a nightly batch job, or once enough sessions
accumulate for a new rider) and reused to score incoming sessions in
real time. Rebuild periodically as a rider's history grows.

Per-signal model choice, and an honest caveat on GPS:
- Operational: IsolationForest (never needed a deep-learning attempt).
- Touch: the triplet encoder (confirmed winner on held-out H-MOG
  data, EER 0.352 vs 0.408 classical) — BUT it's running on a
  degraded feature set here, because the frozen session schema's
  touch_events only carries one point per gesture, not the raw
  per-sample path the model was trained on (see
  ml/inference/schema_adapters.py's docstring). Flagged to the team;
  waiting on a schema extension.
- Motion: IsolationForest by default; see ml/README.md's Phase 2
  motion section for whether the triplet encoder won and should
  replace it (that evaluation was still running when this was
  written — check the README before assuming either way).
- GPS: IsolationForest, and NEITHER validated GPS model (classical
  OR the triplet encoder, which won on real ODIDMob courier data)
  can be honestly claimed to work in production as configured. Both
  were trained/evaluated on ODIDMob's per-wave summary (23 hand-
  crafted features, or a leg-by-leg sequence, both needing
  ASSIGN/PICKUP/DELIVERY wave segmentation). The frozen schema's
  `gps` field is just a flat, unsegmented list of (lat, lng, t)
  points — no wave structure at all. `gps_features_from_schema`
  computes a different, smaller, UNVALIDATED feature set (4 GeoLife-
  style speed/turn stats) as a stopgap. Swapping to the triplet
  encoder here would not fix this — it's equally mismatched. Real
  fix: either get wave/stop segmentation into the schema, or
  retrain/re-evaluate a model on the GeoLife-style features before
  trusting any GPS number from this production path.
"""
from pathlib import Path

from ml.calibration.conformal import ConformalScorer
from ml.calibration.fusion import fisher_combine
from ml.calibration.per_rider_threshold import compute_calib_fused_p_values, per_rider_threshold
from ml.combiner.two_axis import ContextBaseline, classify
from ml.inference.schema_adapters import (
    gps_features_from_schema, motion_window_sequence_from_schema,
    operational_features_from_schema, touch_stroke_sequence_from_schema,
)
from ml.llm.reason_vector import explain
from ml.models.isolation_baseline import IsolationBaseline
from ml.models.motion_triplet_encoder import MotionTripletScorer
from ml.models.touch_triplet_encoder import TouchTripletScorer

TOUCH_WEIGHTS_PATH = str(Path(__file__).resolve().parents[1] / "weights" / "touch_triplet_encoder.pt")
MOTION_WEIGHTS_PATH = str(Path(__file__).resolve().parents[1] / "weights" / "motion_triplet_encoder.pt")

CONTEXT_THRESHOLD = 0.6
TARGET_FAR = 0.01  # the product's "~1% false challenge" promise

# Classical signals only (operational, gps) — motion and touch use their
# triplet encoders (ml/README.md's Phase 2: both won decisively, 0.277 vs
# 0.440 for motion, 0.352 vs 0.408 for touch).
CLASSICAL_EXTRACTORS = {
    "operational": operational_features_from_schema,
    "gps": gps_features_from_schema,
}
EXTRACTORS = {
    **CLASSICAL_EXTRACTORS,
    "motion": motion_window_sequence_from_schema,
    "touch": touch_stroke_sequence_from_schema,
}


class RiderModelBundle:
    def __init__(self):
        self.context_baseline: ContextBaseline | None = None
        self.scorers: dict[str, ConformalScorer] = {}
        self.threshold_info: dict | None = None

    @classmethod
    def fit(cls, enroll_sessions: list[dict], calib_sessions: list[dict],
            contamination: float = 0.05, target_far: float = TARGET_FAR) -> "RiderModelBundle":
        """`enroll_sessions` and `calib_sessions` must be disjoint
        slices of the SAME rider's history, chronologically ordered —
        same discipline as ml/evaluation/splits.py, required to avoid
        the train/calibration leakage bug documented in ml/README.md."""
        bundle = cls()
        bundle.context_baseline = ContextBaseline.from_history(enroll_sessions + calib_sessions)

        for signal, extract in CLASSICAL_EXTRACTORS.items():
            enroll_vecs = [v for s in enroll_sessions if (v := extract(s)) is not None]
            calib_vecs = [v for s in calib_sessions if (v := extract(s)) is not None]
            if len(enroll_vecs) < 5 or len(calib_vecs) < 5:
                continue  # insufficient data for this signal — see missing-signal policy
            model = IsolationBaseline(contamination=contamination).fit(enroll_vecs)
            bundle.scorers[signal] = ConformalScorer(model).calibrate(calib_vecs)

        for signal, scorer_cls, weights_path in (
            ("touch", TouchTripletScorer, TOUCH_WEIGHTS_PATH),
            ("motion", MotionTripletScorer, MOTION_WEIGHTS_PATH),
        ):
            extract = EXTRACTORS[signal]
            enroll_vecs = [v for s in enroll_sessions if (v := extract(s)) is not None]
            calib_vecs = [v for s in calib_sessions if (v := extract(s)) is not None]
            if len(enroll_vecs) >= 5 and len(calib_vecs) >= 5:
                model = scorer_cls(weights_path=weights_path).fit(enroll_vecs)
                bundle.scorers[signal] = ConformalScorer(model).calibrate(calib_vecs)

        # Per-rider threshold (ml/calibration/per_rider_threshold.py): falls
        # back to the population value when this rider doesn't yet have
        # enough calibration history to resolve target_far individually.
        calib_fused_p = compute_calib_fused_p_values(bundle.scorers, calib_sessions, EXTRACTORS)
        bundle.threshold_info = per_rider_threshold(calib_fused_p, target_far=target_far)

        return bundle

    def score(self, session: dict, generate_reason: bool = True) -> dict:
        """Returns the combiner's quadrant/decision/trust_score dict,
        plus `p_values` (per-signal, for the explanation/dashboard) and
        `reason_vector` (only populated when the decision escalates and
        generate_reason=True — keeps LLM calls to the sessions that
        actually need an explanation)."""
        if self.context_baseline is None:
            raise RuntimeError("call RiderModelBundle.fit() first")

        ctx = self._context_continuity(session)
        p_values = {}
        for signal, scorer in self.scorers.items():
            vec = EXTRACTORS[signal](session)
            if vec is not None:
                p_values[signal] = scorer.p_value(vec)
        # missing-signal policy: signals that returned no vector are
        # simply absent from p_values, never imputed — see
        # ml/calibration/fusion.py's MISSING_SIGNAL_POLICY
        if not p_values:
            return {"quadrant": "insufficient_evidence", "decision": "no_action",
                    "context_continuity": ctx, "behavior_continuity": None,
                    "trust_score": None, "p_values": {}}

        beh = fisher_combine(p_values)
        behavior_alpha = self.threshold_info["threshold"] if self.threshold_info else 0.29
        result = classify(ctx, beh, context_threshold=CONTEXT_THRESHOLD, behavior_alpha=behavior_alpha)
        result["p_values"] = p_values
        result["threshold_info"] = self.threshold_info

        if generate_reason and result["decision"] != "continue":
            reason = explain(session, result, p_values)
            result["reason_vector"] = reason["explanation"]
            result["reason_generated"] = reason["generated"]

        return result

    def _context_continuity(self, session: dict) -> float:
        b = self.context_baseline
        matches = 0
        matches += 1 if session["device_id"] in b.device_ids else 0
        matches += 1 if session["ip_subnet"] in b.ip_subnets else 0
        matches += 1 if session["zone"] in b.zones else 0
        return matches / 3.0
