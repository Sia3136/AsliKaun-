"""Standard biometric evaluation metrics. Convention used throughout:
the score being evaluated is a conformal p-value (higher = looks more
like the rider's own normal behavior). "Accept" a session at threshold
t means p >= t.

FAR(t) = fraction of impostor sessions with p >= t (wrongly accepted)
FRR(t) = fraction of genuine sessions with p <  t (wrongly rejected)
EER     = the threshold where FAR and FRR cross
"""
import numpy as np
from sklearn.metrics import roc_auc_score


def far_frr_curve(genuine_scores, impostor_scores, n_thresholds: int = 500):
    genuine_scores = np.asarray(genuine_scores, dtype=float)
    impostor_scores = np.asarray(impostor_scores, dtype=float)
    all_scores = np.concatenate([genuine_scores, impostor_scores])
    thresholds = np.linspace(all_scores.min(), all_scores.max(), n_thresholds)
    far = np.array([np.mean(impostor_scores >= t) for t in thresholds])
    frr = np.array([np.mean(genuine_scores < t) for t in thresholds])
    return thresholds, far, frr


def eer(genuine_scores, impostor_scores) -> tuple[float, float]:
    """Returns (eer_value, threshold_at_eer)."""
    if len(genuine_scores) == 0 or len(impostor_scores) == 0:
        return float("nan"), float("nan")
    thresholds, far, frr = far_frr_curve(genuine_scores, impostor_scores)
    idx = int(np.argmin(np.abs(far - frr)))
    return float((far[idx] + frr[idx]) / 2), float(thresholds[idx])


def frr_at_far(genuine_scores, impostor_scores, target_far: float = 0.01) -> float:
    if len(genuine_scores) == 0 or len(impostor_scores) == 0:
        return float("nan")
    _, far, frr = far_frr_curve(genuine_scores, impostor_scores, n_thresholds=2000)
    idx = int(np.argmin(np.abs(far - target_far)))
    return float(frr[idx])


def far_at_frr(genuine_scores, impostor_scores, target_frr: float = 0.01) -> float:
    if len(genuine_scores) == 0 or len(impostor_scores) == 0:
        return float("nan")
    _, far, frr = far_frr_curve(genuine_scores, impostor_scores, n_thresholds=2000)
    idx = int(np.argmin(np.abs(frr - target_frr)))
    return float(far[idx])


def auc_roc(genuine_scores, impostor_scores) -> float:
    if len(genuine_scores) == 0 or len(impostor_scores) == 0:
        return float("nan")
    y = [1] * len(genuine_scores) + [0] * len(impostor_scores)
    scores = list(genuine_scores) + list(impostor_scores)
    return float(roc_auc_score(y, scores))


def bootstrap_ci(values, n_boot: int = 1000, ci: float = 0.95, seed: int = 0) -> tuple[float, float, float]:
    """Returns (mean, lo, hi) of a bootstrap over the given per-rider
    values (e.g. per-rider EERs) — the right unit to bootstrap over,
    since riders (not sessions) are the independent samples here."""
    values = np.asarray(values, dtype=float)
    if len(values) == 0:
        return float("nan"), float("nan"), float("nan")
    rng = np.random.default_rng(seed)
    boots = [float(np.mean(rng.choice(values, size=len(values), replace=True))) for _ in range(n_boot)]
    lo, hi = np.percentile(boots, [(1 - ci) / 2 * 100, (1 + ci) / 2 * 100])
    return float(np.mean(values)), float(lo), float(hi)
