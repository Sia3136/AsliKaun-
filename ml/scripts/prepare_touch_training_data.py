"""Pre-extracts per-stroke sequences for every H-MOG user NOT in the
18-person evaluation cohort, and pickles them into one compact file to
upload to Kaggle. Doing this locally (rather than re-parsing raw H-MOG
zips inside the Kaggle notebook) avoids re-implementing CSV/zip parsing
in the self-contained Kaggle script, and the output is a few MB instead
of several GB.
"""
import pickle
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ml.data.hmog_loader import list_users, session_dirs, read_hmog_csv
from ml.features.touch_features import extract_strokes

# Same 18 users used by ml/scripts/run_phase1_evaluation.py's touch/motion
# evaluation cohort — excluded here so there's no leakage between the
# pooled autoencoder's training data and the evaluation cohort.
EVAL_COHORT_IDS = {
    '737973', '352716', '720193', '326223', '525584', '561993', '663153', '398248',
    '962159', '808022', '171538', '395129', '389015', '693572', '872895', '998757',
    '675397', '751131',
}

OUTPUT_PATH = Path(__file__).resolve().parents[1] / "kaggle" / "touch_training_sequences.pkl"


def main():
    all_users = list_users()
    train_users = [u for u in all_users if u not in EVAL_COHORT_IDS]
    print(f"{len(all_users)} total H-MOG users, {len(train_users)} available for training "
          f"after excluding the {len(EVAL_COHORT_IDS)}-user evaluation cohort")

    data = {}
    for i, uid in enumerate(train_users):
        sequences = []
        for sd in session_dirs(uid):
            touch_data = read_hmog_csv(sd / "TouchEvent.csv", n_cols=11)
            strokes = extract_strokes(touch_data)
            if len(strokes) >= 3:
                sequences.append(__import__("numpy").stack(strokes).astype("float32"))
        if sequences:
            data[uid] = sequences
        if (i + 1) % 10 == 0:
            print(f"  processed {i + 1}/{len(train_users)} users")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "wb") as f:
        pickle.dump(data, f)

    total_sequences = sum(len(v) for v in data.values())
    print(f"\nSaved {len(data)} users, {total_sequences} stroke sequences to {OUTPUT_PATH}")
    print(f"File size: {OUTPUT_PATH.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
