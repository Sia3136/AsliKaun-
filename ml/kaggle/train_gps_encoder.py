"""SELF-CONTAINED Kaggle training script for the GPS trajectory encoder.

Copy this whole file into a Kaggle notebook cell and run it. It has no
dependency on the rest of this repo — everything it needs is duplicated
inline — because a Kaggle notebook only sees whatever dataset you
attach to it, not this local checkout.

Setup steps (see the chat instructions for the full walkthrough):
1. Zip hackforge/data/ODIDMob_Routes/ (the per-day *.geojson files —
   skip AllDeliveryRoutes.geojson, it's redundant and huge) and upload
   it as a Kaggle Dataset.
2. New Notebook -> Add Data -> your uploaded dataset -> enable GPU
   (Settings -> Accelerator -> GPU T4 x2 or similar).
3. Paste this whole file into one cell, fix INPUT_DIR below to match
   your dataset's mount path (shown in the Kaggle file browser on the
   right, usually /kaggle/input/<your-dataset-slug>), run it.
4. Download /kaggle/working/gps_encoder.pt when it finishes — that's
   the file you bring back to this repo.
"""
import glob
import json
import random
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.nn.utils.rnn import pad_sequence

# ---- fix this to your Kaggle dataset's mount path ----
INPUT_DIR = "/kaggle/input/odidmob-routes"
OUTPUT_PATH = "/kaggle/working/gps_encoder.pt"

# These 18 courier IDs are the evaluation cohort used locally
# (ml/scripts/run_phase1_evaluation.py) — excluded from training so
# there's no leakage between the embedding space and the evaluation.
EVAL_COHORT_IDS = {
    10329228, 117109065, 118918993, 117672177, 118770561, 118816345, 122220553, 101992442,
    101009538, 113172298, 112025322, 100134611, 10135747, 120508210, 111193122, 10591853,
    110846282, 125330265,
}

MIN_WAVES_PER_COURIER = 10
MAX_TRAINING_COURIERS = 400
HIDDEN_DIM, EMBEDDING_DIM = 64, 32
BATCH_COURIERS = 32  # couriers per training step -> 32 anchor/positive/negative triplets
EPOCHS = 30
STEPS_PER_EPOCH = 100
LR = 1e-3
MARGIN = 0.2
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


def iter_routes(day_file):
    with open(day_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    for feat in data["features"]:
        if feat["properties"].get("feature_type") == "route":
            yield feat["properties"]


def route_to_leg_sequence(props):
    r_dis_lst = props.get("r_dis_lst") or []
    r_time_lst = props.get("r_time_lst") or []
    if len(r_dis_lst) < 2 or len(r_time_lst) < 3:
        return None
    dists = np.array(r_dis_lst, dtype=float)
    durs = np.diff(np.array(r_time_lst, dtype=float))
    n = min(len(dists), len(durs))
    if n < 2:
        return None
    dists, durs = dists[:n], durs[:n]
    durs_safe = np.where(durs > 0, durs, 1.0)
    speeds = dists / durs_safe
    cum_time = np.cumsum(durs)
    total_time = cum_time[-1] if cum_time[-1] > 0 else 1.0
    return np.stack([dists / 1000.0, durs / 60.0, speeds, cum_time / total_time], axis=1).astype(np.float32)


print("Loading routes from", INPUT_DIR)
day_files = sorted(glob.glob(str(Path(INPUT_DIR) / "DeliveryRoutes_*.geojson")))
print(f"{len(day_files)} day files found")

courier_sequences: dict[int, list[np.ndarray]] = {}
for day_file in day_files:
    for props in iter_routes(day_file):
        cid = props["courier_id"]
        if cid in EVAL_COHORT_IDS:
            continue
        seq = route_to_leg_sequence(props)
        if seq is not None:
            courier_sequences.setdefault(cid, []).append(seq)

eligible = [cid for cid, seqs in courier_sequences.items() if len(seqs) >= MIN_WAVES_PER_COURIER]
random.Random(0).shuffle(eligible)
train_couriers = eligible[:MAX_TRAINING_COURIERS]
print(f"{len(eligible)} couriers eligible (>= {MIN_WAVES_PER_COURIER} waves), "
      f"using {len(train_couriers)} for training")


class GRUTrajectoryEncoder(nn.Module):
    def __init__(self, input_dim=4, hidden_dim=HIDDEN_DIM, embedding_dim=EMBEDDING_DIM):
        super().__init__()
        self.gru = nn.GRU(input_dim, hidden_dim, batch_first=True)
        self.proj = nn.Linear(hidden_dim, embedding_dim)

    def forward(self, x, lengths):
        packed = nn.utils.rnn.pack_padded_sequence(x, lengths.cpu(), batch_first=True, enforce_sorted=False)
        _, h_n = self.gru(packed)
        emb = self.proj(h_n.squeeze(0))
        return nn.functional.normalize(emb, dim=-1)


def sample_triplet_batch(batch_size):
    anchors, positives, negatives = [], [], []
    couriers = random.sample(train_couriers, min(batch_size, len(train_couriers)))
    for cid in couriers:
        seqs = courier_sequences[cid]
        a, p = random.sample(seqs, 2)
        neg_cid = random.choice([c for c in train_couriers if c != cid])
        n = random.choice(courier_sequences[neg_cid])
        anchors.append(torch.tensor(a))
        positives.append(torch.tensor(p))
        negatives.append(torch.tensor(n))
    return anchors, positives, negatives


def embed_batch(model, seqs):
    lengths = torch.tensor([s.shape[0] for s in seqs])
    padded = pad_sequence(seqs, batch_first=True).to(DEVICE)
    return model(padded, lengths)


model = GRUTrajectoryEncoder().to(DEVICE)
optimizer = torch.optim.Adam(model.parameters(), lr=LR)
triplet_loss = nn.TripletMarginLoss(margin=MARGIN)

print(f"Training on {DEVICE} for {EPOCHS} epochs x {STEPS_PER_EPOCH} steps")
for epoch in range(EPOCHS):
    model.train()
    epoch_loss = 0.0
    for step in range(STEPS_PER_EPOCH):
        anchors, positives, negatives = sample_triplet_batch(BATCH_COURIERS)
        emb_a = embed_batch(model, anchors)
        emb_p = embed_batch(model, positives)
        emb_n = embed_batch(model, negatives)
        loss = triplet_loss(emb_a, emb_p, emb_n)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        epoch_loss += loss.item()
    print(f"epoch {epoch + 1}/{EPOCHS}  mean triplet loss = {epoch_loss / STEPS_PER_EPOCH:.4f}")

torch.save(model.state_dict(), OUTPUT_PATH)
print("Saved weights to", OUTPUT_PATH)
print("Download this file from the Kaggle output panel and bring it back to "
      "hackforge/ml/weights/gps_encoder.pt")
