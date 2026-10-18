"""Pre-extracts per-window motion sequences for every H-MOG user NOT in
the 18-person evaluation cohort — same rationale as
prepare_touch_training_data.py (avoid re-implementing CSV/zip parsing
inside the Kaggle notebook; keep the upload small).
"""
import pickle
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ml.data.hmog_loader import list_users, session_dirs, read_hmog_csv
from ml.features.motion_features import session_motion_window_sequence

EVAL_COHORT_IDS = {
    '737973', '352716', '720193', '326223', '525584', '561993', '663153', '398248',
    '962159', '808022', '171538', '395129', '389015', '693572', '872895', '998757',
    '675397', '751131',
}

OUTPUT_PATH = Path(__file__).resolve().parents[1] / "kaggle" / "motion_training_sequences.pkl"


def main():
    all_users = list_users()
    train_users = [u for u in all_users if u not in EVAL_COHORT_IDS]
    print(f"{len(all_users)} total H-MOG users, {len(train_users)} available for training")

    data = {}
    for i, uid in enumerate(train_users):
        sequences = []
        for sd in session_dirs(uid):
            accel_data = read_hmog_csv(sd / "Accelerometer.csv", n_cols=7)
            seq = session_motion_window_sequence(accel_data)
            if seq is not None:
                sequences.append(seq)
        if sequences:
            data[uid] = sequences
        if (i + 1) % 10 == 0:
            print(f"  processed {i + 1}/{len(train_users)} users")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "wb") as f:
        pickle.dump(data, f)

    total_sequences = sum(len(v) for v in data.values())
    print(f"\nSaved {len(data)} users, {total_sequences} window sequences to {OUTPUT_PATH}")
    print(f"File size: {OUTPUT_PATH.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
