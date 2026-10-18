"""GRU + triplet-loss trajectory encoder for courier identity (the
Trajectory-User-Linking approach from the revised plan). Trained on
Kaggle GPU (see ml/kaggle/train_gps_encoder.py) on a pool of couriers
EXCLUDING the evaluation cohort, so there's no leakage between training
the embedding space and evaluating it.

At evaluation time, `GPSTripletScorer` exposes the exact same
`fit(items) -> self` / `raw_score(item) -> float` interface as
ml/models/isolation_baseline.py and mahalanobis_baseline.py, so it
plugs into ml/evaluation/harness.py and ml/calibration/conformal.py
with zero changes — the same fair, rider-disjoint EER/AUC comparison
against the classical baselines.

Input here is a per-route LEG SEQUENCE (variable length), not the
23-dim summary vector ml/features/gps_features.py produces for the
classical models — the whole point of the sequence model is to look at
the shape of the route over time, not a flattened average.
"""
import numpy as np
import torch
import torch.nn as nn

LEG_FEATURE_DIM = 4  # [distance_km, duration_min, speed_mps, cumulative_time_frac]


class GRUTrajectoryEncoder(nn.Module):
    def __init__(self, input_dim: int = LEG_FEATURE_DIM, hidden_dim: int = 64, embedding_dim: int = 32):
        super().__init__()
        self.gru = nn.GRU(input_dim, hidden_dim, batch_first=True)
        self.proj = nn.Linear(hidden_dim, embedding_dim)

    def forward(self, x: torch.Tensor, lengths: torch.Tensor) -> torch.Tensor:
        packed = nn.utils.rnn.pack_padded_sequence(x, lengths.cpu(), batch_first=True, enforce_sorted=False)
        _, h_n = self.gru(packed)
        emb = self.proj(h_n.squeeze(0))
        return nn.functional.normalize(emb, dim=-1)


def route_to_leg_sequence(props: dict) -> np.ndarray | None:
    """[distance_km, duration_min, speed_mps, cumulative_time_fraction]
    per leg. Same r_dis_lst/r_time_lst source fields as
    ml/features/gps_features.py, kept as a sequence instead of
    collapsed to summary stats."""
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


class GPSTripletScorer:
    """Evaluation-time wrapper: loads trained weights, embeds a rider's
    enrollment routes, scores new routes by distance from that rider's
    enrollment centroid — higher = more anomalous, same convention as
    the classical baselines."""

    def __init__(self, weights_path: str, hidden_dim: int = 64, embedding_dim: int = 32):
        self.model = GRUTrajectoryEncoder(hidden_dim=hidden_dim, embedding_dim=embedding_dim)
        self.model.load_state_dict(torch.load(weights_path, map_location="cpu"))
        self.model.eval()
        self.centroid: np.ndarray | None = None

    def _embed(self, seq: np.ndarray) -> np.ndarray:
        x = torch.tensor(seq, dtype=torch.float32).unsqueeze(0)
        length = torch.tensor([seq.shape[0]])
        with torch.no_grad():
            emb = self.model(x, length)
        return emb.squeeze(0).numpy()

    def fit(self, enroll_sequences: list) -> "GPSTripletScorer":
        embs = np.stack([self._embed(s) for s in enroll_sequences])
        centroid = embs.mean(axis=0)
        self.centroid = centroid / (np.linalg.norm(centroid) + 1e-9)
        return self

    def raw_score(self, seq: np.ndarray) -> float:
        if self.centroid is None:
            raise RuntimeError("call fit() first")
        emb = self._embed(seq)
        return float(np.linalg.norm(emb - self.centroid))
