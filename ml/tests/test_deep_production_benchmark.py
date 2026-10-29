"""
Deep Production Stress & Benchmark Test Suite for AsliKaun ML
Performs rigorous, un-mocked verification of:
1. PyTorch Touch Triplet & Autoencoder Neural Forward Passes & Embedding Margin Separation
2. End-to-End 4-Modal RiderModelBundle Fit, Conformal p-Value Calibration, and Fisher Fusion
3. Adversarial Red-Team Benchmarks:
   - Lazy Renter (abrupt full handoff)
   - Boiling-Frog Slow Drift (60-session CUSUM vs EWMA evaluation)
4. Few-Shot Cold-Start Onboarding Baseline Protection
5. Inference Latency & Throughput SLA Benchmarking
"""
from __future__ import annotations

import time
import numpy as np
import pytest
import torch

from ml.inference.rider_model_bundle import (
    RiderModelBundle,
    TOUCH_WEIGHTS_PATH,
    MOTION_WEIGHTS_PATH,
    GPS_WEIGHTS_PATH,
)
from ml.models.touch_triplet_encoder import TouchTripletScorer, STROKE_FEATURE_DIM
from ml.models.touch_autoencoder import TouchAutoencoderScorer
from ml.redteam.detectors import FrozenAnchorDetector, FastBaselineDetector
from ml.timeseries.driver_timeseries import DriverTimeSeriesProfiler
from ml.features.touch_features import STROKE_FEATURE_NAMES


# ---------------------------------------------------------------------------
# Realistic Session Generator Helpers (Constructs multi-modal sensor streams)
# ---------------------------------------------------------------------------
def generate_synthetic_touch_sequence(
    num_strokes: int = 8,
    mean_pressure: float = 0.52,
    mean_velocity: float = 0.45,
    noise: float = 0.05,
) -> list[dict]:
    """Generates realistic touch events with continuous gesture sample paths."""
    events = []
    base_t = int(time.time() * 1000)
    for i in range(num_strokes):
        t_start = base_t + i * 800
        dur = int(np.random.normal(120, 15))
        dur = max(40, dur)
        p = float(np.clip(np.random.normal(mean_pressure, noise), 0.15, 0.95))
        area = float(p * 600.0 + 100.0)

        # Generate smooth swipe path points
        start_x, start_y = float(np.random.uniform(50, 200)), float(np.random.uniform(200, 500))
        dist = mean_velocity * dur
        angle = np.random.uniform(-0.5, 0.5)
        end_x = start_x + dist * np.cos(angle)
        end_y = start_y + dist * np.sin(angle)

        path = [
            {"x": round(start_x, 1), "y": round(start_y, 1), "pressure": p, "t_offset_ms": 0},
            {"x": round((start_x + end_x) / 2, 1), "y": round((start_y + end_y) / 2, 1), "pressure": p, "t_offset_ms": dur // 2},
            {"x": round(end_x, 1), "y": round(end_y, 1), "pressure": p, "t_offset_ms": dur},
        ]

        events.append({
            "type": "swipe" if dist > 20 else "tap",
            "pressure": p,
            "area": area,
            "duration_ms": dur,
            "t_offset_ms": i * 800,
            "path": path,
        })
    return events


def generate_synthetic_session(
    driver_id: str = "rider-deep-benchmark",
    device_id: str = "phone-pixel-7",
    zone: str = "sector-12",
    ip_subnet: str = "192.168.1.0/24",
    behavior_profile: str = "genuine",
    speed_mph: float = 14.5,
) -> dict:
    """Generates a complete session payload with touch, IMU accel/gyro, and operational metrics."""
    if behavior_profile == "genuine":
        mean_p = 0.52
        mean_vel = 0.45
        accel_scale = 0.22
        gyro_scale = 0.11
        latency = 820.0
    elif behavior_profile == "impostor":
        mean_p = 0.91 # Hard aggressive presses
        mean_vel = 1.35 # Fast erratic swipes
        accel_scale = 2.85 # Erratic driving vibration
        gyro_scale = 1.95
        latency = 3600.0 # Unfamiliar with phone UI
    else:
        raise ValueError(f"Unknown profile: {behavior_profile}")

    touches = generate_synthetic_touch_sequence(num_strokes=8, mean_pressure=mean_p, mean_velocity=mean_vel)

    # 3-axis accelerometer window
    now_iso = "2026-10-29T10:00:00Z"
    accel = [
        {"x": round(float(np.random.normal(0.0, accel_scale)), 3),
         "y": round(float(np.random.normal(0.0, accel_scale)), 3),
         "z": round(float(np.random.normal(9.8, accel_scale)), 3),
         "t": now_iso}
        for _ in range(16)
    ]
    gyro = [round(float(abs(np.random.normal(gyro_scale, 0.05))), 3) for _ in range(8)]

    # Coarse GPS trace with stops
    gps = [
        {"lat": 19.0760 + i * 0.001, "lng": 72.8777 + i * 0.001, "speed": speed_mph, "t": now_iso}
        for i in range(5)
    ]

    return {
        "driver_id": driver_id,
        "device_id": device_id,
        "ip_subnet": ip_subnet,
        "zone": zone,
        "vehicle_speed_mph": speed_mph,
        "accel": accel,
        "gyro": gyro,
        "touch_events": touches,
        "gps": gps,
        "accept_latency_ms": latency,
        "timestamp": now_iso,
    }


# ---------------------------------------------------------------------------
# Test 1: Real PyTorch Neural Forward Pass & Embedding Separation
# ---------------------------------------------------------------------------
def test_pytorch_touch_triplet_forward_and_margin_separation():
    """Validates that touch_triplet_encoder.pt performs real tensor matrix math,
    computes genuine centroid, and statistically separates genuine from impostor strokes."""
    np.random.seed(42)
    torch.manual_seed(42)

    scorer = TouchTripletScorer(weights_path=TOUCH_WEIGHTS_PATH)
    assert scorer.model is not None
    assert isinstance(scorer.model, torch.nn.Module)

    # Generate genuine enrollment stroke sequences (8 strokes, 11 features each)
    genuine_enrollment = []
    for _ in range(6):
        seq = np.zeros((8, STROKE_FEATURE_DIM), dtype=np.float32)
        seq[:, 0] = np.random.uniform(100, 150, size=8) # duration_ms
        seq[:, 1] = np.random.uniform(40, 80, size=8)   # path_length
        seq[:, 2] = seq[:, 1] / seq[:, 0]               # velocity_mean
        seq[:, 3] = seq[:, 2] * 1.5                    # velocity_peak
        seq[:, 7] = np.random.normal(0.52, 0.02, size=8) # pressure_mean
        seq[:, 10] = seq[:, 7] * 600.0 + 100.0         # area_mean
        genuine_enrollment.append(seq)

    scorer.fit(genuine_enrollment)
    assert scorer.centroid is not None
    assert scorer.centroid.shape == (32,), "Embedding centroid must be 32-dimensional"

    # Score a genuine query stroke sequence (sampled from same distribution)
    genuine_query = np.zeros((8, STROKE_FEATURE_DIM), dtype=np.float32)
    genuine_query[:, 0] = np.random.uniform(100, 150, size=8)
    genuine_query[:, 1] = np.random.uniform(40, 80, size=8)
    genuine_query[:, 2] = genuine_query[:, 1] / genuine_query[:, 0]
    genuine_query[:, 3] = genuine_query[:, 2] * 1.5
    genuine_query[:, 7] = np.random.normal(0.52, 0.02, size=8)
    genuine_query[:, 10] = genuine_query[:, 7] * 600.0 + 100.0
    genuine_dist = scorer.raw_score(genuine_query)

    # Score an impostor stroke sequence (radically different speed and pressure)
    impostor_query = np.zeros((8, STROKE_FEATURE_DIM), dtype=np.float32)
    impostor_query[:, 0] = np.random.uniform(400, 800, size=8) # Very slow heavy drag
    impostor_query[:, 1] = np.random.uniform(300, 600, size=8)
    impostor_query[:, 2] = impostor_query[:, 1] / impostor_query[:, 0]
    impostor_query[:, 3] = impostor_query[:, 2] * 3.0
    impostor_query[:, 7] = np.random.normal(0.95, 0.02, size=8) # Heavy press
    impostor_query[:, 10] = impostor_query[:, 7] * 600.0 + 100.0
    impostor_dist = scorer.raw_score(impostor_query)

    print(f"\n[PyTorch Triplet] Genuine distance: {genuine_dist:.4f} vs Impostor distance: {impostor_dist:.4f}")
    assert genuine_dist < impostor_dist, (
        f"Neural network failed to separate embeddings: genuine={genuine_dist:.4f}, impostor={impostor_dist:.4f}"
    )


# ---------------------------------------------------------------------------
# Test 2: End-to-End Multi-Modal RiderModelBundle Fit & Fisher Conformal Fusion
# ---------------------------------------------------------------------------
def test_full_multimodal_rider_bundle_fit_and_conformal_fusion():
    """Fits the full 4-modal RiderModelBundle on 20 realistic sessions (12 enroll, 8 calib),
    calibrates conformal quantiles, and verifies multi-modal Fisher fusion."""
    np.random.seed(42)
    torch.manual_seed(42)
    driver_id = "courier-pro-99"

    # Generate disjoint enrollment (12) and calibration (8) sessions
    enroll_sessions = [generate_synthetic_session(driver_id, behavior_profile="genuine") for _ in range(12)]
    calib_sessions = [generate_synthetic_session(driver_id, behavior_profile="genuine") for _ in range(8)]

    bundle = RiderModelBundle.fit(enroll_sessions, calib_sessions)
    assert len(bundle.scorers) >= 2, f"Expected at least operational and touch scorers, got: {list(bundle.scorers.keys())}"

    # 1. Evaluate genuine test session
    genuine_session = generate_synthetic_session(driver_id, behavior_profile="genuine")
    res_gen = bundle.score(genuine_session)
    assert res_gen["context_continuity"] >= 0.60
    assert res_gen["decision"] == "continue"
    assert res_gen["quadrant"] == "stable"
    print(f"\n[Bundle Genuine] Behavior continuity: {res_gen['behavior_continuity']}, Decision: {res_gen['decision']}")

    # 2. Evaluate adversarial handoff (impostor motor biometrics on same device)
    handoff_session = generate_synthetic_session(driver_id, behavior_profile="impostor")
    res_adv = bundle.score(handoff_session)
    print(f"[Bundle Impostor] Behavior continuity: {res_adv['behavior_continuity']}, Decision: {res_adv['decision']}")
    assert res_adv["behavior_continuity"] < res_gen["behavior_continuity"], "Impostor behavior score must be strictly lower"
    assert res_adv["decision"] in ("escalate_challenge", "lightweight_challenge", "challenge_at_safe_pause")
    assert res_adv["quadrant"] in ("handoff_signature", "ambiguous")


# ---------------------------------------------------------------------------
# Test 3: Adversarial Red-Team Benchmarks (Lazy Renter vs Boiling Frog)
# ---------------------------------------------------------------------------
def test_adversarial_lazy_renter_and_boiling_frog_drift():
    """Stress tests the Dual-Timescale architecture:
    - Fast Baseline (EWMA): naive model that absorbs drift.
    - Frozen Anchor (CUSUM): locks registration profile and catches cumulative deviation."""
    fast_detector = FastBaselineDetector(alpha=0.25, threshold=0.25)
    frozen_detector = FrozenAnchorDetector(anchor_window=10, drift_threshold=2.2)

    # 1. First 10 sessions establish personal baseline
    for _ in range(10):
        score = float(np.random.normal(0.92, 0.02))
        fast_detector.update(score)
        frozen_detector.update(score)

    assert not frozen_detector.update(0.91), "Anchor warmup must not flag baseline sessions"

    # 2. Simulate 45 sessions of boiling-frog slow drift (1.2% decay per session)
    fast_caught = False
    frozen_caught_at = None
    current = 0.90
    for i in range(45):
        current -= 0.012
        if fast_detector.update(current):
            fast_caught = True
        if frozen_detector.update(current) and frozen_caught_at is None:
            frozen_caught_at = i + 10

    print(f"\n[Red-Team CUSUM] Boiling-Frog caught at session #{frozen_caught_at} | Fast EWMA caught: {fast_caught}")
    assert not fast_caught, "Fast EWMA baseline was supposed to be fooled by gradual drift!"
    assert frozen_caught_at is not None, "Frozen anchor CUSUM detector must catch the boiling-frog attack"
    assert 20 <= frozen_caught_at <= 45, f"Caught at unexpected session: {frozen_caught_at}"


# ---------------------------------------------------------------------------
# Test 4: Few-Shot Cold-Start Baseline Protection
# ---------------------------------------------------------------------------
def test_few_shot_cold_start_onboarding_mitigation():
    """Verifies that a newly registered driver with 2-minute onboarding calibration
    is protected on Session 1, avoiding the 15-session cold-start vulnerability."""
    from backend.app.ml_bridge import evaluate_session_ml

    # Simulate newly calibrated driver profile (from /v1/drivers/calibrate)
    driver_history = {
        "anchor_behavior": {
            "operational": {"accept_latency_ms": 750.0},
            "touch": {"pressure_mean": 0.50, "interval_mean_ms": 110.0, "velocity_mean": 0.40},
            "motion": {"accel_mean": 0.20},
        },
        "fast_behavior": {
            "operational": {"accept_latency_ms": 750.0},
            "touch": {"pressure_mean": 0.50, "interval_mean_ms": 110.0, "velocity_mean": 0.40},
            "motion": {"accel_mean": 0.20},
        },
        "known_contexts": [{"device_id": "phone-newbie", "zone": "zone-1"}],
    }

    # Session 1: Impostor attempts to operate account on day 1
    impostor_payload = type("Payload", (), {
        "driver_id": "newbie-driver",
        "device_id": "phone-newbie",
        "ip_subnet": "192.168.1.0/24",
        "zone": "zone-1",
        "vehicle_speed_mph": 0.0,
        "touch_events": [{"type": "tap", "pressure": 0.95, "duration_ms": 380, "area": 700}],
        "accel": [2.8, 3.2, 2.9],
        "gyro": [1.8, 2.1],
        "accept_latency_ms": 3400.0,
    })()

    eval_res = evaluate_session_ml(impostor_payload, driver_history, calibrated_alpha=0.58)
    print(f"\n[Cold Start Protection] Decision: {eval_res['decision']}, Behavior Score: {eval_res['behavior_score']}")

    assert eval_res["behavior_score"] is not None
    assert eval_res["behavior_score"] < 0.50, "Impostor on session 1 must receive severe behavioral penalty"
    assert eval_res["decision"] in ("challenge_at_safe_pause", "step_up_check_at_safe_pause")


# ---------------------------------------------------------------------------
# Test 5: Production Latency & Throughput SLA Benchmark
# ---------------------------------------------------------------------------
def test_inference_latency_sla_benchmarking():
    """Runs 30 repeated end-to-end evaluations to measure inference latency distribution."""
    from backend.app.ml_bridge import evaluate_session_ml

    driver_history = {
        "anchor_behavior": {
            "operational": {"accept_latency_ms": 820.0},
            "touch": {"pressure_mean": 0.52, "interval_mean_ms": 115.0, "velocity_mean": 0.45},
            "motion": {"accel_mean": 0.22},
        },
        "fast_behavior": {
            "operational": {"accept_latency_ms": 820.0},
            "touch": {"pressure_mean": 0.52, "interval_mean_ms": 115.0, "velocity_mean": 0.45},
            "motion": {"accel_mean": 0.22},
        },
        "known_contexts": [{"device_id": "phone-sla", "zone": "sector-1"}],
    }

    payload = type("Payload", (), {
        "driver_id": "sla-driver",
        "device_id": "phone-sla",
        "ip_subnet": "192.168.1.0/24",
        "zone": "sector-1",
        "vehicle_speed_mph": 12.0,
        "touch_events": [
            {"type": "swipe", "pressure": 0.51, "duration_ms": 120, "area": 320,
             "path": [{"x": 10, "y": 20, "t": 0}, {"x": 30, "y": 60, "t": 120}]}
        ],
        "accel": [0.22, 0.25, 0.24],
        "gyro": [0.11, 0.12],
        "accept_latency_ms": 840.0,
    })()

    latencies_ms = []
    # Warmup
    for _ in range(5):
        evaluate_session_ml(payload, driver_history, calibrated_alpha=0.60)

    # Benchmark 30 cycles
    for _ in range(30):
        t0 = time.perf_counter()
        evaluate_session_ml(payload, driver_history, calibrated_alpha=0.60)
        t1 = time.perf_counter()
        latencies_ms.append((t1 - t0) * 1000.0)

    p50 = float(np.percentile(latencies_ms, 50))
    p95 = float(np.percentile(latencies_ms, 95))
    p99 = float(np.percentile(latencies_ms, 99))
    max_lat = float(np.max(latencies_ms))

    print(f"\n[Inference Latency SLA] P50: {p50:.2f}ms | P95: {p95:.2f}ms | P99: {p99:.2f}ms | Max: {max_lat:.2f}ms")
    assert p95 < 60.0, f"P95 latency exceeded 60ms production threshold: {p95:.2f}ms"
