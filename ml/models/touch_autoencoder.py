"""LSTM sequence autoencoder for per-stroke touch dynamics, trained on
a POOLED population of H-MOG users (not per-rider — a single rider only
has ~15-40 stroke sequences, nowhere near enough to train a sequence
model from scratch). Reconstruction error is the anomaly signal: a
stroke sequence that doesn't match the population's learned "normal
touch dynamics" manifold reconstructs poorly.

`TouchAutoencoderScorer.fit()` is a no-op — the autoencoder's weights
are frozen after Kaggle training and don't change per rider. Per-rider
adaptation happens one layer up, in ml/calibration/conformal.py's
ConformalScorer, which compares THIS rider's reconstruction errors
against their own calibration set. Same fit()/raw_score() interface as
the other models, so it plugs into the same evaluation harness.
"""
import numpy as np
import torch
import torch.nn as nn

STROKE_FEATURE_DIM = 11  # matches ml/features/touch_features.py's STROKE_FEATURE_NAMES


class LSTMStrokeAutoencoder(nn.Module):
    def __init__(self, input_dim: int = STROKE_FEATURE_DIM, hidden_dim: int = 64, latent_dim: int = 16):
        super().__init__()
        self.encoder = nn.LSTM(input_dim, hidden_dim, batch_first=True)
        self.to_latent = nn.Linear(hidden_dim, latent_dim)
        self.from_latent = nn.Linear(latent_dim, hidden_dim)
        self.decoder = nn.LSTM(hidden_dim, hidden_dim, batch_first=True)
        self.output = nn.Linear(hidden_dim, input_dim)

    def forward(self, x: torch.Tensor, lengths: torch.Tensor) -> torch.Tensor:
        packed = nn.utils.rnn.pack_padded_sequence(x, lengths.cpu(), batch_first=True, enforce_sorted=False)
        _, (h_n, _) = self.encoder(packed)
        latent = self.to_latent(h_n.squeeze(0))
        max_len = x.shape[1]
        decoder_input = self.from_latent(latent).unsqueeze(1).repeat(1, max_len, 1)
        decoded, _ = self.decoder(decoder_input)
        return self.output(decoded)


class TouchAutoencoderScorer:
    """Loads the frozen trained model + the feature normalization stats
    saved alongside it (stroke features span very different scales —
    duration in ms vs. direction in radians — so normalization matters
    and must use the SAME mean/std the model was trained with)."""

    def __init__(self, weights_path: str, hidden_dim: int = 64, latent_dim: int = 16):
        checkpoint = torch.load(weights_path, map_location="cpu")
        self.model = LSTMStrokeAutoencoder(hidden_dim=hidden_dim, latent_dim=latent_dim)
        self.model.load_state_dict(checkpoint["model_state"])
        self.model.eval()
        self.feat_mean = checkpoint["feat_mean"]
        self.feat_std = checkpoint["feat_std"]

    def _normalize(self, seq: np.ndarray) -> np.ndarray:
        return (seq - self.feat_mean) / (self.feat_std + 1e-6)

    def fit(self, enroll_sequences: list) -> "TouchAutoencoderScorer":
        return self

    def raw_score(self, seq: np.ndarray) -> float:
        x_norm = self._normalize(seq)
        x = torch.tensor(x_norm, dtype=torch.float32).unsqueeze(0)
        length = torch.tensor([seq.shape[0]])
        with torch.no_grad():
            recon = self.model(x, length)
        return float(torch.mean((recon.squeeze(0) - x.squeeze(0)) ** 2))
