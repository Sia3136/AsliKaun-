"""Windowed accelerometer features from H-MOG's Accelerometer.csv
(2.5s windows, 50% overlap) — time + frequency domain per window,
aggregated into a session-level summary. This replaces the old
single-mean-vector motion feature, which threw away all temporal shape.

Accelerometer.csv columns: Systime, EventTime, ActivityID, X, Y, Z,
Phone_orientation (no header row). Systime is ms since epoch.

Frequency features require evenly-spaced samples; H-MOG's sensor events
are not perfectly evenly spaced, so each window is linearly resampled
onto a uniform time grid before FFT — using raw FFT on irregular
timestamps would silently produce meaningless frequency bins.
"""
import numpy as np

COL_SYSTIME, COL_X, COL_Y, COL_Z = 0, 3, 4, 5

WINDOW_MS = 2500
OVERLAP = 0.5
RESAMPLE_HZ = 20.0  # phone accelerometer sampling is roughly this order of magnitude

WINDOW_FEATURE_NAMES = (
    [f"{axis}_{stat}" for axis in ("x", "y", "z") for stat in ("mean", "std", "min", "max")]
    + ["rms_magnitude", "jerk_mean_abs", "corr_xy", "corr_xz", "corr_yz",
       "low_band_energy", "high_band_energy", "spectral_entropy", "dominant_freq"]
)
SESSION_FEATURE_NAMES = [f"{feat}_{stat}" for feat in WINDOW_FEATURE_NAMES for stat in ("mean", "std")]


def _windows(t: np.ndarray):
    if len(t) < 2:
        return
    start = t[0]
    step = WINDOW_MS * (1 - OVERLAP)
    while start + WINDOW_MS <= t[-1]:
        mask = (t >= start) & (t < start + WINDOW_MS)
        yield start, mask
        start += step


def _resample_uniform(t: np.ndarray, v: np.ndarray, hz: float = RESAMPLE_HZ):
    duration_s = (t[-1] - t[0]) / 1000.0
    n = max(8, int(duration_s * hz))
    uniform_t = np.linspace(t[0], t[-1], n)
    return np.interp(uniform_t, t, v), hz


def _window_features(t: np.ndarray, x: np.ndarray, y: np.ndarray, z: np.ndarray) -> np.ndarray | None:
    if len(t) < 10:
        return None
    axis_stats = []
    for v in (x, y, z):
        axis_stats.extend([float(np.mean(v)), float(np.std(v)), float(np.min(v)), float(np.max(v))])

    magnitude = np.sqrt(x ** 2 + y ** 2 + z ** 2)
    rms_magnitude = float(np.sqrt(np.mean(magnitude ** 2)))
    jerk = np.diff(magnitude) / np.maximum(np.diff(t) / 1000.0, 1e-6)
    jerk_mean_abs = float(np.mean(np.abs(jerk))) if jerk.size else 0.0

    corr_xy = float(np.corrcoef(x, y)[0, 1]) if np.std(x) > 0 and np.std(y) > 0 else 0.0
    corr_xz = float(np.corrcoef(x, z)[0, 1]) if np.std(x) > 0 and np.std(z) > 0 else 0.0
    corr_yz = float(np.corrcoef(y, z)[0, 1]) if np.std(y) > 0 and np.std(z) > 0 else 0.0

    mag_resampled, hz = _resample_uniform(t, magnitude)
    n = len(mag_resampled)
    fft_vals = np.fft.rfft(mag_resampled - mag_resampled.mean())
    freqs = np.fft.rfftfreq(n, d=1 / hz)
    power = np.abs(fft_vals) ** 2
    total_power = float(power.sum()) + 1e-9

    low_band = float(power[(freqs >= 0.5) & (freqs < hz / 4)].sum())
    high_band = float(power[(freqs >= hz / 4) & (freqs <= hz / 2)].sum())
    probs = power / total_power
    spectral_entropy = float(-np.sum(probs[probs > 0] * np.log(probs[probs > 0])))
    dominant_freq = float(freqs[1:][np.argmax(power[1:])]) if len(power) > 1 else 0.0

    return np.array(axis_stats + [
        rms_magnitude, jerk_mean_abs, corr_xy, corr_xz, corr_yz,
        low_band, high_band, spectral_entropy, dominant_freq,
    ])


def session_motion_features(accel_data: np.ndarray, min_windows: int = 3) -> np.ndarray | None:
    if accel_data.size == 0 or accel_data.ndim != 2 or accel_data.shape[0] < 20:
        return None
    order = np.argsort(accel_data[:, COL_SYSTIME])
    data = accel_data[order]
    t, x, y, z = data[:, COL_SYSTIME], data[:, COL_X], data[:, COL_Y], data[:, COL_Z]

    window_vecs = []
    for _start, mask in _windows(t):
        if mask.sum() < 10:
            continue
        f = _window_features(t[mask], x[mask], y[mask], z[mask])
        if f is not None:
            window_vecs.append(f)

    if len(window_vecs) < min_windows:
        return None
    W = np.stack(window_vecs)
    agg = []
    for col in range(W.shape[1]):
        agg.extend([float(np.mean(W[:, col])), float(np.std(W[:, col]))])
    return np.array(agg)
