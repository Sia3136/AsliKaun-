"""One-off calibration: compute real between-person and within-person
accelerometer variance from H-MOG, so rider_sim.py's synthetic personas
have a realistic (not arbitrary N(0,1)) accel_signature spread. Prints
constants to paste into rider_sim.py — not run automatically on every
import, since H-MOG extraction is slow and these numbers don't need to
be recomputed per run.
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ml.data.hmog_loader import list_users, session_dirs, motion_features

N_USERS = 25
per_user_means = []
per_user_stds = []

users = list_users()[:N_USERS]
for uid in users:
    feats = [motion_features(sd) for sd in session_dirs(uid)]
    feats = [f for f in feats if f is not None]
    if len(feats) < 5:
        continue
    X = np.stack(feats)
    per_user_means.append(X.mean(axis=0))
    per_user_stds.append(X.std(axis=0))

per_user_means = np.stack(per_user_means)
per_user_stds = np.stack(per_user_stds)

between_person_std = per_user_means.std(axis=0)   # spread of each person's own "signature"
within_person_std = per_user_stds.mean(axis=0)    # average session-to-session wobble for one person

print(f"users used: {len(per_user_means)}")
print(f"between-person std per axis (x,y,z): {between_person_std.round(3).tolist()}")
print(f"within-person std per axis (x,y,z):  {within_person_std.round(3).tolist()}")
print(f"\npaste into rider_sim.make_profile():")
print(f'    "accel_signature": rng.normal(0, {between_person_std.mean():.3f}, size=3),')
print(f'    "accel_noise": rng.uniform({within_person_std.mean() * 0.7:.3f}, {within_person_std.mean() * 1.3:.3f}),')
