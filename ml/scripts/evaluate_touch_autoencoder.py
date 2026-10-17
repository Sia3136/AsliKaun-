"""Evaluates the Kaggle-trained touch stroke autoencoder on the SAME
8x10 rider-disjoint H-MOG cohort and harness as the classical baseline
(ml/scripts/run_phase1_evaluation.py). Run after bringing
touch_autoencoder.pt back from Kaggle.
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ml.data.hmog_loader import list_users, session_dirs, read_hmog_csv
from ml.features.touch_features import extract_strokes, session_touch_features
from ml.models.isolation_baseline import IsolationBaseline
from ml.models.touch_autoencoder import TouchAutoencoderScorer
from ml.evaluation.harness import evaluate_signal

N_TARGETS, N_IMPOSTORS, SEED = 8, 10, 42
MIN_SESSIONS = 10
WEIGHTS_PATH = str(Path(__file__).resolve().parents[1] / "weights" / "touch_autoencoder.pt")


def print_result(model_name: str, result: dict):
    print(f"\nTouch / {model_name}")
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
            f"(ml/kaggle/train_touch_autoencoder.py) and place touch_autoencoder.pt there.")

    rng = np.random.default_rng(SEED)
    all_users = list_users()
    shuffled = rng.permutation(all_users).tolist()
    targets, impostors = shuffled[:N_TARGETS], shuffled[N_TARGETS:N_TARGETS + N_IMPOSTORS]
    print(f"target users: {targets}")
    print(f"impostor users: {impostors}")

    # Two parallel feature representations for the SAME cohort: the
    # 59-dim distributional summary for the classical baseline, raw
    # per-stroke sequences for the deep model.
    summary_vectors, stroke_sequences = {}, {}
    for uid in targets + impostors:
        summaries, sequences = [], []
        for sd in session_dirs(uid):
            touch_data = read_hmog_csv(sd / "TouchEvent.csv", n_cols=11)
            summary = session_touch_features(touch_data)
            if summary is not None:
                summaries.append(summary)
            strokes = extract_strokes(touch_data)
            if len(strokes) >= 3:
                sequences.append(np.stack(strokes).astype("float32"))
        summary_vectors[uid] = summaries
        stroke_sequences[uid] = sequences

    baseline_result = evaluate_signal(summary_vectors, targets, impostors, IsolationBaseline,
                                       min_sessions=MIN_SESSIONS, seed=SEED)
    print_result("IsolationForest (classical baseline)", baseline_result)

    ae_result = evaluate_signal(stroke_sequences, targets, impostors, TouchAutoencoderScorer,
                                 model_kwargs={"weights_path": WEIGHTS_PATH},
                                 min_sessions=MIN_SESSIONS, seed=SEED)
    print_result("LSTM stroke autoencoder (Phase 2)", ae_result)

    print("\n--- verdict ---")
    if ae_result["pooled_eer"] < baseline_result["pooled_eer"]:
        print(f"Deep model WINS: EER {ae_result['pooled_eer']:.3f} < baseline {baseline_result['pooled_eer']:.3f}. "
              f"Keep the LSTM autoencoder for touch.")
    else:
        print(f"Deep model did NOT beat the baseline: EER {ae_result['pooled_eer']:.3f} >= "
              f"baseline {baseline_result['pooled_eer']:.3f}. Keep IsolationForest, report this honestly.")
