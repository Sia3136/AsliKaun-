"""GPS holdout re-validation: a FRESH cohort of 8 targets + 10
impostors, disjoint from the original 18-person evaluation cohort used
throughout ml/README.md's Phase 1/2 results. ODIDMob_Routes has 800+
eligible couriers, so this is a genuinely new set of people, not a
reused one — checks whether the "classical beats GPS triplet encoder"
conclusion holds up, or was an artifact of the specific 18 people we'd
been looking at repeatedly.

Caveat: the Kaggle training script (ml/kaggle/train_gps_encoder.py)
picked its ~400 training couriers with its own random seed, run inside
the Kaggle environment — this script can't guarantee zero overlap with
that specific set (only with the 18-person EVAL cohort, which IS
guaranteed disjoint). Any overlap would, if anything, help the triplet
encoder's score here, not hurt it — so a loss on this holdout despite
that is a stronger result, not a weaker one.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ml.data.odidmob_loader import list_day_files, select_cohort, load_courier_routes
from ml.features.gps_features import route_features
from ml.models.gps_triplet_encoder import GPSTripletScorer, route_to_leg_sequence
from ml.models.isolation_baseline import IsolationBaseline
from ml.evaluation.harness import evaluate_signal

N_TARGETS, N_IMPOSTORS = 8, 10
HOLDOUT_SEED = 999  # different from the original SEED=42 cohort
MIN_SESSIONS = 10
WEIGHTS_PATH = str(Path(__file__).resolve().parents[1] / "weights" / "gps_encoder.pt")

ORIGINAL_EVAL_COHORT = {
    10329228, 117109065, 118918993, 117672177, 118770561, 118816345, 122220553, 101992442,
    101009538, 113172298, 112025322, 100134611, 10135747, 120508210, 111193122, 10591853,
    110846282, 125330265,
}


def print_result(model_name: str, result: dict):
    print(f"\nGPS (HOLDOUT) / {model_name}")
    print(f"  riders evaluated: {result['n_riders_evaluated']} "
          f"(sparse/skipped: {result['n_riders_sparse_skipped']})")
    print(f"  pooled EER: {result['pooled_eer']:.3f}   pooled AUC: {result['pooled_auc']:.3f}   "
          f"FRR@FAR=1%: {result['pooled_frr_at_far_1pct']:.3f}")
    mean_eer, (lo, hi) = result["per_rider_mean_eer"], result["per_rider_eer_ci95"]
    print(f"  per-rider mean EER: {mean_eer:.3f}  [95% CI {lo:.3f}, {hi:.3f}]")


if __name__ == "__main__":
    day_files = list_day_files()
    # select_cohort doesn't know about ORIGINAL_EVAL_COHORT, so pick a
    # larger pool and filter, retrying with a different seed if needed.
    targets, impostors = None, None
    for seed in range(HOLDOUT_SEED, HOLDOUT_SEED + 20):
        t, i = select_cohort(N_TARGETS + 5, N_IMPOSTORS + 10, min_waves=15, day_files=day_files, seed=seed)
        t = [c for c in t if c not in ORIGINAL_EVAL_COHORT][:N_TARGETS]
        i = [c for c in i if c not in ORIGINAL_EVAL_COHORT][:N_IMPOSTORS]
        if len(t) == N_TARGETS and len(i) == N_IMPOSTORS:
            targets, impostors = t, i
            break
    assert targets and impostors, "could not find a clean holdout cohort"
    assert not (set(targets) | set(impostors)) & ORIGINAL_EVAL_COHORT, "holdout cohort overlaps original eval cohort!"
    print(f"HOLDOUT target couriers (fresh, never evaluated before): {targets}")
    print(f"HOLDOUT impostor couriers (fresh, never evaluated before): {impostors}")

    routes_by_courier = load_courier_routes(set(targets + impostors), day_files)
    summary_vectors, sequence_vectors = {}, {}
    for cid, routes in routes_by_courier.items():
        routes_sorted = sorted(routes, key=lambda r: r[0]["r_time_lst"][0])
        summary_vectors[cid] = [v for props, coords in routes_sorted if (v := route_features(props, coords)) is not None]
        sequence_vectors[cid] = [v for props, _c in routes_sorted if (v := route_to_leg_sequence(props)) is not None]

    baseline_result = evaluate_signal(summary_vectors, targets, impostors, IsolationBaseline,
                                       min_sessions=MIN_SESSIONS, seed=HOLDOUT_SEED)
    print_result("IsolationForest (classical)", baseline_result)

    encoder_result = evaluate_signal(sequence_vectors, targets, impostors, GPSTripletScorer,
                                      model_kwargs={"weights_path": WEIGHTS_PATH},
                                      min_sessions=MIN_SESSIONS, seed=HOLDOUT_SEED)
    print_result("GRU triplet encoder", encoder_result)

    print("\n--- holdout verdict ---")
    print(f"Original eval cohort: classical 0.397 vs triplet 0.433 (classical won)")
    print(f"Holdout cohort:       classical {baseline_result['pooled_eer']:.3f} vs "
          f"triplet {encoder_result['pooled_eer']:.3f} "
          f"({'classical wins again' if baseline_result['pooled_eer'] <= encoder_result['pooled_eer'] else 'triplet wins here — conclusion does NOT generalize, investigate'})")
