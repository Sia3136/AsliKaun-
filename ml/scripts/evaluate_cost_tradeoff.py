"""Applies the cost-weighted operating point (ml/evaluation/cost_model.py)
to the touch triplet encoder's real pooled scores — the strongest
model we have — to show concretely how the "right" threshold shifts
once a false-accept is treated as costlier than a false-reject, instead
of defaulting to EER (which treats them as equal).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ml.data.hmog_loader import list_users, session_dirs, read_hmog_csv
from ml.features.touch_features import extract_strokes, session_touch_features
from ml.models.touch_triplet_encoder import TouchTripletScorer
from ml.evaluation.harness import evaluate_signal
from ml.evaluation.metrics import eer
from ml.evaluation.cost_model import compare_operating_points

import numpy as np

N_TARGETS, N_IMPOSTORS, SEED = 8, 10, 42
MIN_SESSIONS = 10
WEIGHTS_PATH = str(Path(__file__).resolve().parents[1] / "weights" / "touch_triplet_encoder.pt")

rng = np.random.default_rng(SEED)
all_users = list_users()
shuffled = rng.permutation(all_users).tolist()
targets, impostors = shuffled[:N_TARGETS], shuffled[N_TARGETS:N_TARGETS + N_IMPOSTORS]

stroke_sequences = {}
for uid in targets + impostors:
    sequences = []
    for sd in session_dirs(uid):
        touch_data = read_hmog_csv(sd / "TouchEvent.csv", n_cols=11)
        strokes = extract_strokes(touch_data)
        if len(strokes) >= 3:
            sequences.append(np.stack(strokes).astype("float32"))
    stroke_sequences[uid] = sequences

result = evaluate_signal(stroke_sequences, targets, impostors, TouchTripletScorer,
                          model_kwargs={"weights_path": WEIGHTS_PATH},
                          min_sessions=MIN_SESSIONS, seed=SEED)

genuine = result["pooled_genuine_scores"]
impostor = result["pooled_impostor_scores"]

eer_val, eer_threshold = eer(genuine, impostor)
print(f"EER operating point: threshold={eer_threshold:.3f}  EER={eer_val:.3f}  (implicitly: 1:1 cost ratio)")

print("\nCost-weighted operating points (touch triplet encoder, real H-MOG data):")
print(f"{'cost ratio':>12} {'threshold':>10} {'FAR':>8} {'FRR':>8} {'expected cost/session':>22}")
for point in compare_operating_points(genuine, impostor, cost_ratios=[1.0, 5.0, 10.0, 50.0]):
    print(f"{point['cost_ratio']:>12.0f} {point['threshold']:>10.3f} {point['far']:>8.3f} "
          f"{point['frr']:>8.3f} {point['expected_cost_per_session']:>22.3f}")

print("\nIllustrative cost ratios, not sourced from real incident/friction-cost data — "
      "the point is the DIRECTION the threshold moves, not these exact numbers.")
