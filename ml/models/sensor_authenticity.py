"""Adversarial Sensor Authenticity & Injection Replay Detection.

Protects against:
1. Root-level synthetic sensor mocking (e.g. Frida / Xposed hooks injecting flat or linear floats).
2. Telemetry loop replay attacks (attackers replaying a pre-recorded genuine 30s session continuously).
3. Non-physical touch injections (e.g. `adb shell input tap` generating touch events with zero chassis IMU recoil).

Physics-based MEMS characteristics analyzed:
- Thermal Johnson-Nyquist noise & Brownian micro-vibrations (Shannon entropy of sensor LSBs).
- Differenced lagged autocorrelation (detects periodic repeating telemetry chunks).
- Touch-to-chassis mechanical recoil coupling (Newton's third law impulse in Delta a_z).
"""
from __future__ import annotations

import logging
from typing import Any

import numpy as np

logger = logging.getLogger("aslikaun.sensor_authenticity")


def _compute_shannon_entropy(series: np.ndarray, num_bins: int = 10) -> float:
    """Computes empirical Shannon entropy in bits for sensor derivative fluctuations."""
    diffs = np.diff(series)
    if len(diffs) < 3:
        return 2.5  # insufficient data to convict
    # Filter tiny floating precision artifacts
    diffs = np.round(diffs, 4)
    if np.all(diffs == 0.0):
        return 0.0
    hist, _ = np.histogram(diffs, bins=num_bins)
    p = hist / (np.sum(hist) + 1e-9)
    p = p[p > 0]
    return float(-np.sum(p * np.log2(p)))


def _max_periodic_autocorrelation(series: np.ndarray, min_lag: int = 3, max_lag: int = 15) -> float:
    """Computes peak autocorrelation on the differenced stream to detect periodic looped replays."""
    diff = np.diff(series)
    n = len(diff)
    if n < min_lag * 2:
        return 0.0
    d = diff - np.mean(diff)
    denom = np.sum(d**2) + 1e-9
    corrs = []
    for k in range(min_lag, min(max_lag, n // 2)):
        r_k = float(np.sum(d[:-k] * d[k:]) / denom)
        corrs.append(r_k)
    return float(max(corrs)) if corrs else 0.0


class SensorAuthenticityDetector:
    """Evaluates telemetry payload for physical sensor reality vs adversarial mocking/injection."""

    def __init__(
        self,
        min_entropy_threshold: float = 0.85,
        max_autocorr_threshold: float = 0.72,
    ):
        self.min_entropy_threshold = min_entropy_threshold
        self.max_autocorr_threshold = max_autocorr_threshold

    def verify_session(self, session: dict[str, Any]) -> dict[str, Any]:
        accel = session.get("accel") or []
        touches = session.get("touch_events") or []

        flags: list[str] = []
        attack_detected = "none"
        score = 1.0

        # Need at least 10 samples to evaluate physical sensor noise
        if len(accel) < 10:
            return {
                "is_authentic": True,
                "authenticity_score": 1.0,
                "attack_detected": "none",
                "flags": [],
                "entropy_bits": None,
                "max_autocorr": None,
                "note": "insufficient_samples_for_entropy_audit",
            }

        try:
            az = np.array([float(a.get("z", 9.8)) for a in accel], dtype=np.float32)
            ay = np.array([float(a.get("y", 0.0)) for a in accel], dtype=np.float32)
            ax = np.array([float(a.get("x", 0.0)) for a in accel], dtype=np.float32)
        except Exception:
            return {
                "is_authentic": False,
                "authenticity_score": 0.0,
                "attack_detected": "malformed_sensor_data",
                "flags": ["malformed_accel_values"],
                "entropy_bits": 0.0,
                "max_autocorr": 0.0,
            }

        # 1. Physical MEMS entropy audit (detects static float injections or linear generators)
        entropy_z = _compute_shannon_entropy(az)
        entropy_y = _compute_shannon_entropy(ay)
        entropy_x = _compute_shannon_entropy(ax)
        mean_entropy = float(np.mean([entropy_z, entropy_y, entropy_x]))

        if mean_entropy < self.min_entropy_threshold:
            flags.append("insufficient_sensor_entropy_mocking_detected")
            attack_detected = "synthetic_flat_or_linear_injection"
            score -= 0.65

        # 2. Lagged autocorrelation audit (detects replayed repeating telemetry loops)
        autocorr_z = _max_periodic_autocorrelation(az)
        autocorr_y = _max_periodic_autocorrelation(ay)
        max_autocorr = float(max(autocorr_z, autocorr_y))

        if max_autocorr > self.max_autocorr_threshold:
            flags.append("periodic_telemetry_loop_detected")
            if attack_detected == "none":
                attack_detected = "replayed_loop_attack"
            score -= 0.55

        # 3. Touch-to-chassis mechanical recoil audit
        if len(touches) >= 3 and len(accel) >= 15:
            high_p_touches = [t for t in touches if float(t.get("pressure", 0.0)) > 0.65]
            if len(high_p_touches) >= 2:
                # If courier made heavy presses, chassis must exhibit some micro-vibration
                std_z = float(np.std(az))
                if std_z < 0.003:  # impossible under real screen presses
                    flags.append("unphysical_touch_without_imu_recoil")
                    if attack_detected == "none":
                        attack_detected = "synthetic_touch_injection"
                    score -= 0.45

        authenticity_score = round(float(np.clip(score, 0.0, 1.0)), 4)
        is_authentic = authenticity_score >= 0.50 and len(flags) == 0

        return {
            "is_authentic": is_authentic,
            "authenticity_score": authenticity_score,
            "attack_detected": attack_detected,
            "flags": flags,
            "entropy_bits": round(mean_entropy, 3),
            "max_autocorr": round(max_autocorr, 3),
        }


GLOBAL_SENSOR_AUTHENTICITY_DETECTOR = SensorAuthenticityDetector()


def verify_sensor_authenticity(session: dict[str, Any]) -> dict[str, Any]:
    """Convenience helper to audit sensor authenticity of a session."""
    return GLOBAL_SENSOR_AUTHENTICITY_DETECTOR.verify_session(session)

