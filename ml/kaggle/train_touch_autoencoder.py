"""SELF-CONTAINED Kaggle training script for the touch stroke
autoencoder. Copy this whole file into a Kaggle notebook cell.

Setup:
1. Run `python ml/scripts/prepare_touch_training_data.py` locally first
   — it writes ml/kaggle/touch_training_sequences.pkl (a few MB, pre-
   extracted stroke sequences for every H-MOG user NOT in the 18-person
   evaluation cohort, so there's no leakage).
2. Upload that .pkl file as a Kaggle Dataset.
3. New Notebook -> Add Data -> your dataset -> enable GPU.
4. Paste this file into one cell, fix INPUT_PATH below, run it.
5. Download /kaggle/working/touch_autoencoder.pt and bring it back to
   hackforge/ml/weights/touch_autoencoder.pt
"""
import pickle
import random

import numpy as np
import torch
import torch.nn as nn
from torch.nn.utils.rnn import pad_sequence

# ---- fix this to your Kaggle dataset's mount path ----
INPUT_PATH = "/kaggle/input/touch-training-sequences/touch_training_sequences.pkl"
OUTPUT_PATH = "/kaggle/working/touch_autoencoder.pt"

STROKE_FEATURE_DIM = 11
HIDDEN_DIM, LATENT_DIM = 64, 16
BATCH_SIZE = 64
EPOCHS = 40
STEPS_PER_EPOCH = 150
LR = 1e-3
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

print("Loading", INPUT_PATH)
with open(INPUT_PATH, "rb") as f:
    data = pickle.load(f)  # {user_id: [stroke_seq_array (n_strokes, 11), ...]}
print(f"{len(data)} users loaded")

all_sequences = [seq for seqs in data.values() for seq in seqs]
print(f"{len(all_sequences)} total stroke sequences")

# normalize using the pooled training distribution — these stats get
# saved alongside the weights and MUST be reused at evaluation time
stacked_strokes = np.concatenate(all_sequences, axis=0)
feat_mean = stacked_strokes.mean(axis=0)
feat_std = stacked_strokes.std(axis=0)
print("feature means:", feat_mean.round(3))
print("feature stds:", feat_std.round(3))

normalized_sequences = [(seq - feat_mean) / (feat_std + 1e-6) for seq in all_sequences]


class LSTMStrokeAutoencoder(nn.Module):
    def __init__(self, input_dim=STROKE_FEATURE_DIM, hidden_dim=HIDDEN_DIM, latent_dim=LATENT_DIM):
        super().__init__()
        self.encoder = nn.LSTM(input_dim, hidden_dim, batch_first=True)
        self.to_latent = nn.Linear(hidden_dim, latent_dim)
        self.from_latent = nn.Linear(latent_dim, hidden_dim)
        self.decoder = nn.LSTM(hidden_dim, hidden_dim, batch_first=True)
        self.output = nn.Linear(hidden_dim, input_dim)

    def forward(self, x, lengths):
        packed = nn.utils.rnn.pack_padded_sequence(x, lengths.cpu(), batch_first=True, enforce_sorted=False)
        _, (h_n, _) = self.encoder(packed)
        latent = self.to_latent(h_n.squeeze(0))
        max_len = x.shape[1]
        decoder_input = self.from_latent(latent).unsqueeze(1).repeat(1, max_len, 1)
        decoded, _ = self.decoder(decoder_input)
        return self.output(decoded)


def sample_batch(batch_size):
    chosen = random.sample(normalized_sequences, min(batch_size, len(normalized_sequences)))
    tensors = [torch.tensor(s, dtype=torch.float32) for s in chosen]
    lengths = torch.tensor([t.shape[0] for t in tensors])
    padded = pad_sequence(tensors, batch_first=True)
    return padded.to(DEVICE), lengths


model = LSTMStrokeAutoencoder().to(DEVICE)
optimizer = torch.optim.Adam(model.parameters(), lr=LR)
mse = nn.MSELoss()

print(f"Training on {DEVICE} for {EPOCHS} epochs x {STEPS_PER_EPOCH} steps")
for epoch in range(EPOCHS):
    model.train()
    epoch_loss = 0.0
    for step in range(STEPS_PER_EPOCH):
        x, lengths = sample_batch(BATCH_SIZE)
        recon = model(x, lengths)
        # mask padding so it doesn't contribute to the loss
        mask = torch.arange(x.shape[1], device=DEVICE)[None, :] < lengths.to(DEVICE)[:, None]
        mask = mask.unsqueeze(-1).float()
        loss = ((recon - x) ** 2 * mask).sum() / mask.sum() / x.shape[-1]
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        epoch_loss += loss.item()
    print(f"epoch {epoch + 1}/{EPOCHS}  mean reconstruction MSE = {epoch_loss / STEPS_PER_EPOCH:.4f}")

torch.save({"model_state": model.state_dict(), "feat_mean": feat_mean, "feat_std": feat_std}, OUTPUT_PATH)
print("Saved to", OUTPUT_PATH)
print("Download this file and bring it back to hackforge/ml/weights/touch_autoencoder.pt")
