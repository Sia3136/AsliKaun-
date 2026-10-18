"""Validation (not the final scorer demo): does a GPS movement signature
fit on one real GeoLife user's trajectories actually flag another real
user's trajectories as anomalous? This is the "science works" check for
the GPS/motion signal, using real human mobility data instead of the
synthetic rider simulator — same role H-MOG plays for touch.

Run after the GeoLife zip is extracted into data/geolife/.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ml.data.geolife_loader import list_users, load_user_trajectories, trajectory_features
from ml.scorers.gps import GPSScorer

users = list_users()
print(f"{len(users)} GeoLife users found")

# Pick the first two users with enough usable trajectories.
chosen = []
for uid in users:
    trajs = load_user_trajectories(uid, limit=60)
    feats = [trajectory_features(t) for t in trajs]
    feats = [f for f in feats if f is not None]
    if len(feats) >= 20:
        chosen.append((uid, feats))
    if len(chosen) == 2:
        break

if len(chosen) < 2:
    raise SystemExit("Could not find 2 GeoLife users with enough usable trajectories")

(uid_a, feats_a), (uid_b, feats_b) = chosen
print(f"user A = {uid_a} ({len(feats_a)} trajectories), user B = {uid_b} ({len(feats_b)} trajectories)")

third = len(feats_a) // 3
fit_a, calib_a, test_a = feats_a[:third], feats_a[third:2 * third], feats_a[2 * third:]

scorer = GPSScorer(contamination=0.05).fit(fit_a, calib_a)

scores_self = [scorer.score(f) for f in test_a]
scores_other = [scorer.score(f) for f in feats_b]

mean_self = sum(scores_self) / len(scores_self)
mean_other = sum(scores_other) / len(scores_other)
print(f"user A scored on own held-out trajectories: mean={mean_self:.3f}")
print(f"user A's scorer applied to user B's trajectories: mean={mean_other:.3f}")
print("separates?", "yes" if mean_other > mean_self + 0.1 else "weak/no")
