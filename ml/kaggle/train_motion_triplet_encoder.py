"""SELF-CONTAINED Kaggle training script for the motion window triplet
encoder. Motion is the one signal that never got a Phase 2 attempt
(weakest classical signal, EER 0.440) — same architecture pattern as
the touch triplet encoder (the one that actually won), tested here
rather than assumed to work by analogy.

Setup:
1. Run `python ml/scripts/prepare_motion_training_data.py` locally
   first — writes ml/kaggle/motion_training_sequences.pkl.
2. Upload that file as a new Kaggle Dataset.
3. New Notebook -> Add Data -> your dataset -> enable GPU.
4. Paste this file into one cell, fix INPUT_PATH, run it.
5. Download /kaggle/working/motion_triplet_encoder.pt and bring it back
   to hackforge/ml/weights/motion_triplet_encoder.pt
"""
import pickle
import random

import numpy as np
import torch
import torch.nn as nn
from torch.nn.utils.rnn import pad_sequence

INPUT_PATH = "/kaggle/input/motion-training-sequences/motion_training_sequences.pkl"
OUTPUT_PATH = "/kaggle/working/motion_triplet_encoder.pt"

WINDOW_FEATURE_DIM = 21
HIDDEN_DIM, EMBEDDING_DIM = 64, 32
BATCH_USERS = 32
EPOCHS = 40
STEPS_PER_EPOCH = 150
LR = 1e-3
MARGIN = 0.2
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

print("Loading", INPUT_PATH)
with open(INPUT_PATH, "rb") as f:
    data = pickle.load(f)  # {user_id: [window_seq_array (n_windows, 21), ...]}
users_with_enough = [uid for uid, seqs in data.items() if len(seqs) >= 2]
print(f"{len(users_with_enough)} users with >= 2 sessions")

stacked_windows = np.concatenate([s for seqs in data.values() for s in seqs], axis=0)
feat_mean = stacked_windows.mean(axis=0)
feat_std = stacked_windows.std(axis=0)

normalized = {uid: [(s - feat_mean) / (feat_std + 1e-6) for s in seqs] for uid, seqs in data.items()}


class GRUWindowEncoder(nn.Module):
    def __init__(self, input_dim=WINDOW_FEATURE_DIM, hidden_dim=HIDDEN_DIM, embedding_dim=EMBEDDING_DIM):
        super().__init__()
        self.gru = nn.GRU(input_dim, hidden_dim, batch_first=True)
        self.proj = nn.Linear(hidden_dim, embedding_dim)

    def forward(self, x, lengths):
        packed = nn.utils.rnn.pack_padded_sequence(x, lengths.cpu(), batch_first=True, enforce_sorted=False)
        _, h_n = self.gru(packed)
        emb = self.proj(h_n.squeeze(0))
        return nn.functional.normalize(emb, dim=-1)


def embed_batch(model, seqs):
    tensors = [torch.tensor(s, dtype=torch.float32) for s in seqs]
    lengths = torch.tensor([t.shape[0] for t in tensors])
    padded = pad_sequence(tensors, batch_first=True).to(DEVICE)
    return model(padded, lengths)


def sample_triplet_batch(batch_size):
    anchors, positives, negatives = [], [], []
    chosen_users = random.sample(users_with_enough, min(batch_size, len(users_with_enough)))
    for uid in chosen_users:
        seqs = normalized[uid]
        a, p = random.sample(seqs, 2)
        neg_uid = random.choice([u for u in users_with_enough if u != uid])
        n = random.choice(normalized[neg_uid])
        anchors.append(a)
        positives.append(p)
        negatives.append(n)
    return anchors, positives, negatives


model = GRUWindowEncoder().to(DEVICE)
optimizer = torch.optim.Adam(model.parameters(), lr=LR)
triplet_loss = nn.TripletMarginLoss(margin=MARGIN)

print(f"Training on {DEVICE} for {EPOCHS} epochs x {STEPS_PER_EPOCH} steps")
for epoch in range(EPOCHS):
    model.train()
    epoch_loss = 0.0
    for step in range(STEPS_PER_EPOCH):
        anchors, positives, negatives = sample_triplet_batch(BATCH_USERS)
        emb_a = embed_batch(model, anchors)
        emb_p = embed_batch(model, positives)
        emb_n = embed_batch(model, negatives)
        loss = triplet_loss(emb_a, emb_p, emb_n)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        epoch_loss += loss.item()
    print(f"epoch {epoch + 1}/{EPOCHS}  mean triplet loss = {epoch_loss / STEPS_PER_EPOCH:.4f}")

torch.save({"model_state": model.state_dict(), "feat_mean": feat_mean, "feat_std": feat_std}, OUTPUT_PATH)
print("Saved to", OUTPUT_PATH)
print("Download this file and bring it back to hackforge/ml/weights/motion_triplet_encoder.pt")
