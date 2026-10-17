"""Validation on real H-MOG data: does a motion/touch signature fit on
one real user's sessions flag a different real user's sessions as
anomalous? This is the actual "science works" check the pitch deck
cites — real per-person data, not the synthetic rider simulator.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ml.data.hmog_loader import list_users, session_dirs, motion_features, touch_features
from ml.scorers.base import PrecomputedVectorScorer

users = list_users()
print(f"{len(users)} H-MOG users available")


def collect_features(user_id: str, extractor, min_sessions: int = 15):
    feats = []
    for sd in session_dirs(user_id):
        f = extractor(sd)
        if f is not None:
            feats.append(f)
    return feats if len(feats) >= min_sessions else None


def validate(signal_name: str, extractor):
    chosen = []
    for uid in users:
        feats = collect_features(uid, extractor)
        if feats:
            chosen.append((uid, feats))
        if len(chosen) == 2:
            break
    if len(chosen) < 2:
        print(f"{signal_name}: could not find 2 users with enough usable sessions")
        return

    (uid_a, feats_a), (uid_b, feats_b) = chosen
    third = len(feats_a) // 3
    fit_a, calib_a, test_a = feats_a[:third], feats_a[third:2 * third], feats_a[2 * third:]
    if not fit_a or not calib_a or not test_a:
        print(f"{signal_name}: user {uid_a} doesn't have enough sessions to split 3 ways")
        return

    scorer = PrecomputedVectorScorer(contamination=0.05).fit(fit_a, calib_a)
    mean_self = sum(scorer.score(f) for f in test_a) / len(test_a)
    mean_other = sum(scorer.score(f) for f in feats_b) / len(feats_b)

    print(f"\n{signal_name}: user A = {uid_a} ({len(feats_a)} sessions), user B = {uid_b} ({len(feats_b)} sessions)")
    print(f"  user A scored on own held-out sessions: mean={mean_self:.3f}")
    print(f"  user A's scorer applied to user B's sessions: mean={mean_other:.3f}")
    print("  separates?", "yes" if mean_other > mean_self + 0.1 else "weak/no")


validate("motion (accelerometer)", motion_features)
validate("touch (pressure/contact/rhythm)", touch_features)
