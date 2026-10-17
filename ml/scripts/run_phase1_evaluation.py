"""Phase 1 evaluation: real rider-disjoint EER/AUC for GPS (ODIDMob),
touch (H-MOG), and motion (H-MOG), each with two classical baselines
(IsolationForest, Mahalanobis). This replaces every "separates?
yes/no" line from earlier scripts with reportable numbers.

Reduced-cohort pilot: 8 target riders x 10 impostors per signal, not the
full dataset — stated explicitly, per the revised plan's "pre-register
it as a reduced-cohort pilot" guidance.
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ml.data.odidmob_loader import list_day_files, select_cohort, load_courier_routes
from ml.features.gps_features import route_features
from ml.data.hmog_loader import list_users, session_dirs, read_hmog_csv
from ml.features.touch_features import session_touch_features
from ml.features.motion_features import session_motion_features
from ml.models.isolation_baseline import IsolationBaseline
from ml.models.mahalanobis_baseline import MahalanobisBaseline
from ml.evaluation.harness import evaluate_signal

N_TARGETS, N_IMPOSTORS, SEED = 8, 10, 42
MIN_SESSIONS = 10


def print_result(signal_name: str, model_name: str, result: dict):
    print(f"\n{signal_name} / {model_name}")
    print(f"  riders evaluated: {result['n_riders_evaluated']} "
          f"(sparse/skipped: {result['n_riders_sparse_skipped']})")
    print(f"  pooled EER: {result['pooled_eer']:.3f}   pooled AUC: {result['pooled_auc']:.3f}   "
          f"FRR@FAR=1%: {result['pooled_frr_at_far_1pct']:.3f}")
    mean_eer, (lo, hi) = result["per_rider_mean_eer"], result["per_rider_eer_ci95"]
    print(f"  per-rider mean EER: {mean_eer:.3f}  [95% CI {lo:.3f}, {hi:.3f}]")


def run_gps():
    print("=" * 60)
    print("GPS signal (ODIDMob_Routes, real delivery-wave data)")
    print("=" * 60)
    day_files = list_day_files()
    targets, impostors = select_cohort(N_TARGETS, N_IMPOSTORS, min_waves=15, day_files=day_files, seed=SEED)
    print(f"target couriers: {targets}")
    print(f"impostor couriers: {impostors}")

    routes_by_courier = load_courier_routes(set(targets + impostors), day_files)
    rider_vectors = {}
    for cid, routes in routes_by_courier.items():
        routes_sorted = sorted(routes, key=lambda r: r[0]["r_time_lst"][0])
        vecs = [route_features(props, coords) for props, coords in routes_sorted]
        rider_vectors[cid] = [v for v in vecs if v is not None]

    for model_cls, model_name in [(IsolationBaseline, "IsolationForest"), (MahalanobisBaseline, "Mahalanobis")]:
        result = evaluate_signal(rider_vectors, targets, impostors, model_cls,
                                  min_sessions=MIN_SESSIONS, seed=SEED)
        print_result("GPS", model_name, result)


def run_hmog_signal(signal_name: str, feature_fn, csv_name: str, n_cols: int):
    print("=" * 60)
    print(f"{signal_name} signal (H-MOG, real sensor data)")
    print("=" * 60)
    all_users = list_users()
    rng = np.random.default_rng(SEED)
    shuffled = rng.permutation(all_users).tolist()
    pool = shuffled[: N_TARGETS + N_IMPOSTORS]
    targets, impostors = pool[:N_TARGETS], pool[N_TARGETS:]
    print(f"target users: {targets}")
    print(f"impostor users: {impostors}")

    rider_vectors = {}
    for uid in targets + impostors:
        vecs = []
        for sd in session_dirs(uid):
            data = read_hmog_csv(sd / csv_name, n_cols=n_cols)
            f = feature_fn(data)
            if f is not None:
                vecs.append(f)
        rider_vectors[uid] = vecs

    for model_cls, model_name in [(IsolationBaseline, "IsolationForest"), (MahalanobisBaseline, "Mahalanobis")]:
        result = evaluate_signal(rider_vectors, targets, impostors, model_cls,
                                  min_sessions=MIN_SESSIONS, seed=SEED)
        print_result(signal_name, model_name, result)


if __name__ == "__main__":
    run_gps()
    run_hmog_signal("Touch", session_touch_features, "TouchEvent.csv", n_cols=11)
    run_hmog_signal("Motion", session_motion_features, "Accelerometer.csv", n_cols=7)
