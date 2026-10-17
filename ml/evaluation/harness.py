"""Signal-agnostic evaluation harness: given time-ordered feature
vectors per rider, runs the enrollment/calibration/genuine-test/
impostor-test protocol across a cohort of target riders and reports
EER, AUC, FRR@FAR=1%, pooled AND per-rider-with-CI.

This is intentionally decoupled from any one dataset or signal — the
same function evaluates GPS, touch, or motion vectors, as long as
they're pre-extracted (ml/features/*.py) and time-ordered per rider.
"""
import numpy as np

from ml.calibration.conformal import ConformalScorer
from ml.evaluation.metrics import eer, auc_roc, frr_at_far, bootstrap_ci
from ml.evaluation.splits import chronological_split


def evaluate_signal(
    rider_vectors: dict,
    target_ids: list,
    impostor_ids: list,
    model_cls,
    model_kwargs: dict | None = None,
    min_sessions: int = 10,
    impostor_samples_per_rider: int = 3,
    seed: int = 0,
) -> dict:
    """rider_vectors: {rider_id: [feature_vector, ...]} already time-ordered.
    Riders with fewer than `min_sessions` are skipped (reported as a
    separate sparse cohort count, never silently dropped without note).
    """
    model_kwargs = model_kwargs or {}
    rng = np.random.default_rng(seed)

    per_rider = []
    pooled_genuine, pooled_impostor = [], []
    sparse_skipped = []

    for rid in target_ids:
        sessions = rider_vectors.get(rid, [])
        if len(sessions) < min_sessions:
            sparse_skipped.append(rid)
            continue
        enroll, calib, test = chronological_split(sessions)
        if len(enroll) < 3 or len(calib) < 3 or len(test) < 2:
            sparse_skipped.append(rid)
            continue

        model = model_cls(**model_kwargs).fit(enroll)
        scorer = ConformalScorer(model).calibrate(calib)

        genuine_p = [scorer.p_value(v) for v in test]
        impostor_p = []
        for iid in impostor_ids:
            imp_sessions = rider_vectors.get(iid, [])
            if not imp_sessions:
                continue
            k = min(impostor_samples_per_rider, len(imp_sessions))
            idxs = rng.choice(len(imp_sessions), size=k, replace=False)
            impostor_p.extend(scorer.p_value(imp_sessions[i]) for i in idxs)

        if len(genuine_p) < 2 or len(impostor_p) < 5:
            sparse_skipped.append(rid)
            continue

        rider_eer, _ = eer(genuine_p, impostor_p)
        rider_auc = auc_roc(genuine_p, impostor_p)
        per_rider.append({
            "rider_id": rid, "eer": rider_eer, "auc": rider_auc,
            "n_genuine": len(genuine_p), "n_impostor": len(impostor_p),
        })
        pooled_genuine.extend(genuine_p)
        pooled_impostor.extend(impostor_p)

    pooled_eer, _ = eer(pooled_genuine, pooled_impostor)
    pooled_auc = auc_roc(pooled_genuine, pooled_impostor)
    pooled_frr1 = frr_at_far(pooled_genuine, pooled_impostor, target_far=0.01)

    per_rider_eers = [r["eer"] for r in per_rider]
    mean_eer, lo, hi = bootstrap_ci(per_rider_eers, seed=seed)

    return {
        "n_riders_evaluated": len(per_rider),
        "n_riders_sparse_skipped": len(sparse_skipped),
        "sparse_skipped_ids": sparse_skipped,
        "pooled_eer": pooled_eer,
        "pooled_auc": pooled_auc,
        "pooled_frr_at_far_1pct": pooled_frr1,
        "per_rider_mean_eer": mean_eer,
        "per_rider_eer_ci95": (lo, hi),
        "per_rider_results": per_rider,
    }
