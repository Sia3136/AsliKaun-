"""The fusion check: does combining operational + motion + touch via
conformal p-values + Fisher's method actually beat the best single
signal, under the same rider-disjoint EER/AUC protocol used for the
real-data Phase 1 evaluation?

This has to run on the SYNTHETIC simulator, not real data — no public
dataset has operational+motion+touch simultaneously for the same
person, so real GPS/H-MOG results can only be evaluated per-signal
(see run_phase1_evaluation.py). This script is the one place all
signals exist together for the same (synthetic) rider, which is the
only way to test the fusion claim itself.

Impostor sessions = a full handoff: a different rider's behavior
(operational+motion+touch) running on the target rider's own context —
the same construction used throughout ml/redteam/scenarios.py.
"""
import sys
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ml.sim.rider_sim import make_profile, generate_session
from ml.scorers.operational import extract_features as op_extract
from ml.scorers.motion import extract_features as motion_extract
from ml.scorers.touch import extract_features as touch_extract
from ml.models.isolation_baseline import IsolationBaseline
from ml.calibration.conformal import ConformalScorer
from ml.calibration.fusion import fisher_combine, noisy_or_combine
from ml.evaluation.splits import chronological_split
from ml.evaluation.metrics import eer, auc_roc, frr_at_far, bootstrap_ci

N_TARGETS, N_IMPOSTORS, SEED = 10, 10, 7
N_HONEST_SESSIONS = 60
N_IMPOSTOR_SESSIONS_PER_PAIR = 3
MIN_SESSIONS = 10

SIGNAL_EXTRACTORS = {
    "operational": op_extract,
    "motion": motion_extract,
    "touch": touch_extract,
}


def build_cohort(n_targets: int, n_impostors: int, seed: int):
    rng = np.random.default_rng(seed)
    seeds = rng.permutation(100000)[: n_targets + n_impostors]
    targets = [make_profile(f"target_{i}", int(seeds[i])) for i in range(n_targets)]
    impostors = [make_profile(f"impostor_{i}", int(seeds[n_targets + i])) for i in range(n_impostors)]
    return targets, impostors


def honest_sessions(profile: dict, base_time, n: int, seed_offset: int):
    return [
        generate_session(profile, base_time + timedelta(hours=2 * i), seed=seed_offset + i)
        for i in range(n)
    ]


def impostor_sessions(target_profile: dict, impostor_profile: dict, base_time, n: int, seed_offset: int):
    return [
        generate_session(target_profile, base_time + timedelta(hours=2 * i), seed=seed_offset + i,
                          impersonator=impostor_profile)
        for i in range(n)
    ]


def main():
    targets, impostors = build_cohort(N_TARGETS, N_IMPOSTORS, SEED)
    base_time = datetime(2026, 10, 1, 9, 0)

    # per-signal p-value lists across ALL riders (pooled), plus fused
    pooled = {sig: {"genuine": [], "impostor": []} for sig in SIGNAL_EXTRACTORS}
    pooled["fused_fisher"] = {"genuine": [], "impostor": []}
    pooled["fused_noisy_or"] = {"genuine": [], "impostor": []}
    per_rider_eer = {k: [] for k in pooled}

    for t_idx, target in enumerate(targets):
        sessions = honest_sessions(target, base_time, N_HONEST_SESSIONS, seed_offset=10000 * t_idx)
        enroll, calib, test = chronological_split(sessions)
        if len(enroll) < MIN_SESSIONS or len(calib) < 5 or len(test) < 5:
            continue

        scorers = {}
        for sig, extract in SIGNAL_EXTRACTORS.items():
            model = IsolationBaseline(contamination=0.05).fit([extract(s) for s in enroll])
            scorer = ConformalScorer(model).calibrate([extract(s) for s in calib])
            scorers[sig] = scorer

        # genuine test sessions
        genuine_p_per_signal = {sig: [] for sig in SIGNAL_EXTRACTORS}
        genuine_p_fused_fisher, genuine_p_fused_or = [], []
        for s in test:
            p_by_sig = {sig: scorers[sig].p_value(extract(s)) for sig, extract in SIGNAL_EXTRACTORS.items()}
            for sig, p in p_by_sig.items():
                genuine_p_per_signal[sig].append(p)
            genuine_p_fused_fisher.append(fisher_combine(p_by_sig))
            genuine_p_fused_or.append(noisy_or_combine(p_by_sig))

        # impostor sessions: every OTHER rider in the cohort impersonates this target
        impostor_p_per_signal = {sig: [] for sig in SIGNAL_EXTRACTORS}
        impostor_p_fused_fisher, impostor_p_fused_or = [], []
        other_riders = [r for r in targets + impostors if r["rider_id"] != target["rider_id"]]
        for i_idx, imp in enumerate(other_riders):
            imp_sessions = impostor_sessions(target, imp, base_time + timedelta(days=30), n=N_IMPOSTOR_SESSIONS_PER_PAIR,
                                              seed_offset=50000 * t_idx + 100 * i_idx)
            for s in imp_sessions:
                p_by_sig = {sig: scorers[sig].p_value(extract(s)) for sig, extract in SIGNAL_EXTRACTORS.items()}
                for sig, p in p_by_sig.items():
                    impostor_p_per_signal[sig].append(p)
                impostor_p_fused_fisher.append(fisher_combine(p_by_sig))
                impostor_p_fused_or.append(noisy_or_combine(p_by_sig))

        for sig in SIGNAL_EXTRACTORS:
            pooled[sig]["genuine"].extend(genuine_p_per_signal[sig])
            pooled[sig]["impostor"].extend(impostor_p_per_signal[sig])
            rider_eer, _ = eer(genuine_p_per_signal[sig], impostor_p_per_signal[sig])
            per_rider_eer[sig].append(rider_eer)

        pooled["fused_fisher"]["genuine"].extend(genuine_p_fused_fisher)
        pooled["fused_fisher"]["impostor"].extend(impostor_p_fused_fisher)
        rider_eer, _ = eer(genuine_p_fused_fisher, impostor_p_fused_fisher)
        per_rider_eer["fused_fisher"].append(rider_eer)

        pooled["fused_noisy_or"]["genuine"].extend(genuine_p_fused_or)
        pooled["fused_noisy_or"]["impostor"].extend(impostor_p_fused_or)
        rider_eer, _ = eer(genuine_p_fused_or, impostor_p_fused_or)
        per_rider_eer["fused_noisy_or"].append(rider_eer)

    print(f"{'signal':<16} {'pooled EER':>10} {'pooled AUC':>10} {'FRR@FAR1%':>10} {'mean rider EER':>15} {'95% CI':>18}")
    for key in ["operational", "motion", "touch", "fused_fisher", "fused_noisy_or"]:
        g, imp = pooled[key]["genuine"], pooled[key]["impostor"]
        pooled_eer, _ = eer(g, imp)
        pooled_auc = auc_roc(g, imp)
        frr1 = frr_at_far(g, imp, target_far=0.01)
        mean_eer, lo, hi = bootstrap_ci(per_rider_eer[key], seed=SEED)
        print(f"{key:<16} {pooled_eer:>10.3f} {pooled_auc:>10.3f} {frr1:>10.3f} {mean_eer:>15.3f} "
              f"   [{lo:.3f}, {hi:.3f}]")


if __name__ == "__main__":
    main()
