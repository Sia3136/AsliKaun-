"""GRU + triplet-loss encoder for motion window sequences — same
pattern as ml/models/touch_triplet_encoder.py (the one that actually
won), applied to the one signal that never got a Phase 2 attempt.
Motion is the weakest classical signal (EER 0.440); worth testing
whether the same person-discriminative-objective fix that worked for
touch helps here too, rather than assuming it based on the pattern
alone.
"""
import numpy as np
import torch
import torch.nn as nn

WINDOW_FEATURE_DIM = 21  # len(ml.features.motion_features.WINDOW_FEATURE_NAMES)


class GRUWindowEncoder(nn.Module):
    def __init__(self, input_dim: int = WINDOW_FEATURE_DIM, hidden_dim: int = 64, embedding_dim: int = 32):
        super().__init__()
        self.gru = nn.GRU(input_dim, hidden_dim, batch_first=True)
        self.proj = nn.Linear(hidden_dim, embedding_dim)

    def forward(self, x: torch.Tensor, lengths: torch.Tensor) -> torch.Tensor:
        packed = nn.utils.rnn.pack_padded_sequence(x, lengths.cpu(), batch_first=True, enforce_sorted=False)
        _, h_n = self.gru(packed)
        emb = self.proj(h_n.squeeze(0))
        return nn.functional.normalize(emb, dim=-1)


class MotionTripletScorer:
    def __init__(self, weights_path: str, hidden_dim: int = 64, embedding_dim: int = 32):
        checkpoint = torch.load(weights_path, map_location="cpu", weights_only=False)
        self.model = GRUWindowEncoder(hidden_dim=hidden_dim, embedding_dim=embedding_dim)
        self.model.load_state_dict(checkpoint["model_state"])
        self.model.eval()
        self.feat_mean = checkpoint["feat_mean"]
        self.feat_std = checkpoint["feat_std"]
        self.centroid: np.ndarray | None = None

    def _embed(self, seq: np.ndarray) -> np.ndarray:
        seq_norm = (seq - self.feat_mean) / (self.feat_std + 1e-6)
        x = torch.tensor(seq_norm, dtype=torch.float32).unsqueeze(0)
        length = torch.tensor([seq.shape[0]])
        with torch.no_grad():
            emb = self.model(x, length)
        return emb.squeeze(0).numpy()

    def fit(self, enroll_sequences: list) -> "MotionTripletScorer":
        embs = np.stack([self._embed(s) for s in enroll_sequences])
        centroid = embs.mean(axis=0)
        self.centroid = centroid / (np.linalg.norm(centroid) + 1e-9)
        return self

    def raw_score(self, seq: np.ndarray) -> float:
        if self.centroid is None:
            raise RuntimeError("call fit() first")
        emb = self._embed(seq)
        return float(np.linalg.norm(emb - self.centroid))
