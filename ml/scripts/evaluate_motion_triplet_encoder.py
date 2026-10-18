"""Evaluates the Kaggle-trained motion triplet encoder on the SAME 8x10
rider-disjoint H-MOG cohort and harness as the classical baseline. Run
after bringing motion_triplet_encoder.pt back from Kaggle.
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ml.data.hmog_loader import list_users, session_dirs, read_hmog_csv
from ml.features.motion_features import session_motion_features, session_motion_window_sequence
from ml.models.isolation_baseline import IsolationBaseline
from ml.models.motion_triplet_encoder import MotionTripletScorer
from ml.evaluation.harness import evaluate_signal

N_TARGETS, N_IMPOSTORS, SEED = 8, 10, 42
MIN_SESSIONS = 10
WEIGHTS_PATH = str(Path(__file__).resolve().parents[1] / "weights" / "motion_triplet_encoder.pt")


def print_result(model_name: str, result: dict):
    print(f"\nMotion / {model_name}")
    print(f"  riders evaluated: {result['n_riders_evaluated']} "
          f"(sparse/skipped: {result['n_riders_sparse_skipped']})")
    print(f"  pooled EER: {result['pooled_eer']:.3f}   pooled AUC: {result['pooled_auc']:.3f}   "
          f"FRR@FAR=1%: {result['pooled_frr_at_far_1pct']:.3f}")
    mean_eer, (lo, hi) = result["per_rider_mean_eer"], result["per_rider_eer_ci95"]
    print(f"  per-rider mean EER: {mean_eer:.3f}  [95% CI {lo:.3f}, {hi:.3f}]")


if __name__ == "__main__":
    if not Path(WEIGHTS_PATH).exists():
        raise SystemExit(
            f"No weights found at {WEIGHTS_PATH}. Train on Kaggle first "
            f"(ml/kaggle/train_motion_triplet_encoder.py) and place motion_triplet_encoder.pt there.")

    rng = np.random.default_rng(SEED)
    all_users = list_users()
    shuffled = rng.permutation(all_users).tolist()
    targets, impostors = shuffled[:N_TARGETS], shuffled[N_TARGETS:N_TARGETS + N_IMPOSTORS]

    summary_vectors, window_sequences = {}, {}
    for uid in targets + impostors:
        summaries, sequences = [], []
        for sd in session_dirs(uid):
            accel_data = read_hmog_csv(sd / "Accelerometer.csv", n_cols=7)
            summary = session_motion_features(accel_data)
            if summary is not None:
                summaries.append(summary)
            seq = session_motion_window_sequence(accel_data)
            if seq is not None:
                sequences.append(seq)
        summary_vectors[uid] = summaries
        window_sequences[uid] = sequences

    baseline_result = evaluate_signal(summary_vectors, targets, impostors, IsolationBaseline,
                                       min_sessions=MIN_SESSIONS, seed=SEED)
    print_result("IsolationForest (classical baseline)", baseline_result)

    triplet_result = evaluate_signal(window_sequences, targets, impostors, MotionTripletScorer,
                                      model_kwargs={"weights_path": WEIGHTS_PATH},
                                      min_sessions=MIN_SESSIONS, seed=SEED)
    print_result("GRU triplet encoder (Phase 2)", triplet_result)

    print("\n--- verdict ---")
    if triplet_result["pooled_eer"] < baseline_result["pooled_eer"]:
        print(f"Deep model WINS: EER {triplet_result['pooled_eer']:.3f} < baseline {baseline_result['pooled_eer']:.3f}. "
              f"Keep the triplet encoder for motion.")
    else:
        print(f"Deep model did NOT beat the baseline: EER {triplet_result['pooled_eer']:.3f} >= "
              f"baseline {baseline_result['pooled_eer']:.3f}. Keep IsolationForest, report this honestly.")
