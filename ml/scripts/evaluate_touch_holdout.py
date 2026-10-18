"""Touch holdout re-validation — with an honest constraint stated up
front: H-MOG has only 100 users total. 18 were used as the evaluation
cohort, 81 were used as the Kaggle training pool for the autoencoder
and triplet encoder (ml/scripts/prepare_touch_training_data.py) — that
accounts for 99/100 users, so there is NO third, fully-disjoint group
left to build a genuinely fresh target-rider cohort from.

What this script DOES check, honestly: the same 8 already-fitted target
riders (their enrollment/calibration data is unchanged, so their models
are identical to the main evaluation), tested against a NEW, LARGER,
different impostor pool (20 users instead of the original 10, drawn
from the training pool) — this validates robustness to a wider set of
attackers, which is a real and useful check, but it is NOT a fully
independent holdout the way the GPS one is. Re-using training-pool
users as impostors here is fine (they were never scored against these
riders' models before, and using them as impostor PROBES doesn't
involve any further training), but it is not a clean three-way split.
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ml.data.hmog_loader import list_users, session_dirs, read_hmog_csv
from ml.features.touch_features import extract_strokes, session_touch_features
from ml.models.isolation_baseline import IsolationBaseline
from ml.models.touch_triplet_encoder import TouchTripletScorer
from ml.evaluation.harness import evaluate_signal

N_TARGETS, ORIGINAL_N_IMPOSTORS, SEED = 8, 10, 42
N_HOLDOUT_IMPOSTORS = 20
MIN_SESSIONS = 10
WEIGHTS_PATH = str(Path(__file__).resolve().parents[1] / "weights" / "touch_triplet_encoder.pt")


def print_result(model_name: str, result: dict):
    print(f"\nTouch (HOLDOUT impostors) / {model_name}")
    print(f"  riders evaluated: {result['n_riders_evaluated']} "
          f"(sparse/skipped: {result['n_riders_sparse_skipped']})")
    print(f"  pooled EER: {result['pooled_eer']:.3f}   pooled AUC: {result['pooled_auc']:.3f}   "
          f"FRR@FAR=1%: {result['pooled_frr_at_far_1pct']:.3f}")
    mean_eer, (lo, hi) = result["per_rider_mean_eer"], result["per_rider_eer_ci95"]
    print(f"  per-rider mean EER: {mean_eer:.3f}  [95% CI {lo:.3f}, {hi:.3f}]")


if __name__ == "__main__":
    rng = np.random.default_rng(SEED)
    all_users = list_users()
    shuffled = rng.permutation(all_users).tolist()
    targets = shuffled[:N_TARGETS]
    original_impostors = set(shuffled[N_TARGETS:N_TARGETS + ORIGINAL_N_IMPOSTORS])

    # training-pool users, excluding the original impostors already
    # tested, excluding the targets themselves
    remaining = [u for u in all_users if u not in targets and u not in original_impostors]
    holdout_rng = np.random.default_rng(999)
    holdout_impostors = holdout_rng.permutation(remaining).tolist()[:N_HOLDOUT_IMPOSTORS]

    print(f"target users (SAME as original eval, models unchanged): {targets}")
    print(f"HOLDOUT impostor users (NEW, not used in original eval): {holdout_impostors}")
    assert not set(holdout_impostors) & original_impostors, "holdout impostors overlap original impostors!"

    summary_vectors, stroke_sequences = {}, {}
    for uid in targets + holdout_impostors:
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

    baseline_result = evaluate_signal(summary_vectors, targets, holdout_impostors, IsolationBaseline,
                                       min_sessions=MIN_SESSIONS, seed=SEED)
    print_result("IsolationForest (classical)", baseline_result)

    triplet_result = evaluate_signal(stroke_sequences, targets, holdout_impostors, TouchTripletScorer,
                                      model_kwargs={"weights_path": WEIGHTS_PATH},
                                      min_sessions=MIN_SESSIONS, seed=SEED)
    print_result("GRU triplet encoder", triplet_result)

    print("\n--- holdout verdict ---")
    print(f"Original impostor set:  classical 0.408 vs triplet 0.352 (triplet won)")
    print(f"Holdout impostor set:   classical {baseline_result['pooled_eer']:.3f} vs "
          f"triplet {triplet_result['pooled_eer']:.3f} "
          f"({'triplet wins again' if triplet_result['pooled_eer'] <= baseline_result['pooled_eer'] else 'classical wins here — conclusion does NOT generalize, investigate'})")
