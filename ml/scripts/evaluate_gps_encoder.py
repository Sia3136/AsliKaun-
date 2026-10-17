"""Evaluates the Kaggle-trained GPS triplet encoder on the SAME 8x10
rider-disjoint cohort and harness as the classical baselines
(ml/scripts/run_phase1_evaluation.py), so the comparison is fair. Run
this after bringing gps_encoder.pt back from Kaggle.

Prerequisite: `pip install torch` (CPU is fine, this only runs
inference) and the weights file at ml/weights/gps_encoder.pt.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ml.data.odidmob_loader import list_day_files, select_cohort, load_courier_routes
from ml.models.gps_triplet_encoder import GPSTripletScorer, route_to_leg_sequence
from ml.models.isolation_baseline import IsolationBaseline
from ml.features.gps_features import route_features
from ml.evaluation.harness import evaluate_signal

N_TARGETS, N_IMPOSTORS, SEED = 8, 10, 42
MIN_SESSIONS = 10
WEIGHTS_PATH = str(Path(__file__).resolve().parents[1] / "weights" / "gps_encoder.pt")


def print_result(model_name: str, result: dict):
    print(f"\nGPS / {model_name}")
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
            f"(ml/kaggle/train_gps_encoder.py) and place gps_encoder.pt there.")

    day_files = list_day_files()
    targets, impostors = select_cohort(N_TARGETS, N_IMPOSTORS, min_waves=15, day_files=day_files, seed=SEED)
    routes_by_courier = load_courier_routes(set(targets + impostors), day_files)

    # SAME cohort, two parallel feature representations: summary vectors
    # for the classical baseline, leg sequences for the deep model.
    summary_vectors, sequence_vectors = {}, {}
    for cid, routes in routes_by_courier.items():
        routes_sorted = sorted(routes, key=lambda r: r[0]["r_time_lst"][0])
        summary_vectors[cid] = [v for props, coords in routes_sorted if (v := route_features(props, coords)) is not None]
        sequence_vectors[cid] = [v for props, _coords in routes_sorted if (v := route_to_leg_sequence(props)) is not None]

    baseline_result = evaluate_signal(summary_vectors, targets, impostors, IsolationBaseline,
                                       min_sessions=MIN_SESSIONS, seed=SEED)
    print_result("IsolationForest (classical baseline)", baseline_result)

    encoder_result = evaluate_signal(sequence_vectors, targets, impostors, GPSTripletScorer,
                                      model_kwargs={"weights_path": WEIGHTS_PATH},
                                      min_sessions=MIN_SESSIONS, seed=SEED)
    print_result("GRU triplet encoder (Phase 2)", encoder_result)

    print("\n--- verdict ---")
    if encoder_result["pooled_eer"] < baseline_result["pooled_eer"]:
        print(f"Deep model WINS: EER {encoder_result['pooled_eer']:.3f} < baseline {baseline_result['pooled_eer']:.3f}. "
              f"Keep the GRU encoder for GPS.")
    else:
        print(f"Deep model did NOT beat the baseline: EER {encoder_result['pooled_eer']:.3f} >= "
              f"baseline {baseline_result['pooled_eer']:.3f}. Keep IsolationForest, report this honestly.")
