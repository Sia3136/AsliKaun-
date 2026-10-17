"""GRU + triplet-loss encoder for touch stroke sequences — the same
architecture pattern as ml/models/gps_triplet_encoder.py, applied here
because the plain autoencoder (ml/models/touch_autoencoder.py) lost
badly to the classical baseline (AUC 0.505, ~random) for a diagnosed
reason: its reconstruction error measured deviation from the POOLED
population, not from any individual rider.

A triplet-trained embedding space is trained with the same pooled data,
but the training objective itself is about separating INDIVIDUALS
(same-person strokes close, different-person strokes far) — so even
though the trained weights are still shared/frozen across everyone, the
embedding space itself is built to be person-discriminative, and the
per-rider centroid-distance score at evaluation time has actual
person-specific structure to exploit, unlike raw reconstruction error.
"""
import numpy as np
import torch
import torch.nn as nn

STROKE_FEATURE_DIM = 11


class GRUStrokeEncoder(nn.Module):
    def __init__(self, input_dim: int = STROKE_FEATURE_DIM, hidden_dim: int = 64, embedding_dim: int = 32):
        super().__init__()
        self.gru = nn.GRU(input_dim, hidden_dim, batch_first=True)
        self.proj = nn.Linear(hidden_dim, embedding_dim)

    def forward(self, x: torch.Tensor, lengths: torch.Tensor) -> torch.Tensor:
        packed = nn.utils.rnn.pack_padded_sequence(x, lengths.cpu(), batch_first=True, enforce_sorted=False)
        _, h_n = self.gru(packed)
        emb = self.proj(h_n.squeeze(0))
        return nn.functional.normalize(emb, dim=-1)


class TouchTripletScorer:
    """Same fit()/raw_score() interface as the other models. `fit()`
    here DOES do real work (unlike the autoencoder) — it computes this
    rider's enrollment centroid in the frozen embedding space, which is
    what makes the score person-specific."""

    def __init__(self, weights_path: str, hidden_dim: int = 64, embedding_dim: int = 32):
        checkpoint = torch.load(weights_path, map_location="cpu", weights_only=False)
        self.model = GRUStrokeEncoder(hidden_dim=hidden_dim, embedding_dim=embedding_dim)
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

    def fit(self, enroll_sequences: list) -> "TouchTripletScorer":
        embs = np.stack([self._embed(s) for s in enroll_sequences])
        centroid = embs.mean(axis=0)
        self.centroid = centroid / (np.linalg.norm(centroid) + 1e-9)
        return self

    def raw_score(self, seq: np.ndarray) -> float:
        if self.centroid is None:
            raise RuntimeError("call fit() first")
        emb = self._embed(seq)
        return float(np.linalg.norm(emb - self.centroid))
