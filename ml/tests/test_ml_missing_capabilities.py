"""Tests for the three previously missing Machine Learning capabilities:
1. 3D Anti-Spoofing & Passive Liveness Detection in FaceStepUpVerifier & API.
2. Adversarial Sensor Injection & Telemetry Replay Detection.
3. Bounded Concept Drift Feedback Loop & Self-Supervised Re-Anchoring.
"""
import base64
import io
import numpy as np
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from ml.models.face_verification import (
    FaceStepUpVerifier,
    check_face_liveness,
    embed_face,
)
from ml.models.sensor_authenticity import (
    SensorAuthenticityDetector,
    verify_sensor_authenticity,
)
from ml.timeseries.driver_timeseries import DriverTimeSeriesProfiler


def _create_synthetic_face(kind: str = "live") -> Image.Image:
    w, h = 160, 160
    x, y = np.meshgrid(np.linspace(-1, 1, w), np.linspace(-1, 1, h))

    # Base realistic skin tone gradient
    r = np.clip(180 - 45 * (x**2 + y**2) + np.random.normal(0, 5, (h, w)), 0, 255)
    g = np.clip(130 - 40 * (x**2 + y**2) + np.random.normal(0, 5, (h, w)), 0, 255)
    b = np.clip(110 - 35 * (x**2 + y**2) + np.random.normal(0, 5, (h, w)), 0, 255)

    if kind == "live":
        return Image.fromarray(np.stack([r, g, b], axis=-1).astype(np.uint8))
    elif kind == "screen_replay":
        # Screen replay exhibits high-frequency sub-pixel moiré mesh and glass specular glare
        screen_r = r + 35 * np.sin(x * 65.0)
        screen_g = g + 35 * np.sin(y * 65.0)
        screen_b = b + 35 * np.sin((x + y) * 65.0)
        # Specular reflection hotspot from glass screen
        screen_r[70:85, 70:85] = 255
        screen_g[70:85, 70:85] = 255
        screen_b[70:85, 70:85] = 255
        return Image.fromarray(np.clip(np.stack([screen_r, screen_g, screen_b], axis=-1), 0, 255).astype(np.uint8))
    elif kind == "printed_blur":
        # Printed paper lacking natural focus depth
        blur_r = np.clip(180 - 45 * (x**2 + y**2), 0, 255)
        blur_g = np.clip(130 - 40 * (x**2 + y**2), 0, 255)
        blur_b = np.clip(110 - 35 * (x**2 + y**2), 0, 255)
        return Image.fromarray(np.stack([blur_r, blur_g, blur_b], axis=-1).astype(np.uint8))
    else:
        raise ValueError(f"Unknown kind: {kind}")


# -----------------------------------------------------------------------------
# Test 1: Face Anti-Spoofing & Liveness Detection
# -----------------------------------------------------------------------------
def test_face_anti_spoofing_liveness():
    live_face = _create_synthetic_face("live")
    screen_replay = _create_synthetic_face("screen_replay")
    printed_blur = _create_synthetic_face("printed_blur")

    # 1. Live face verification
    live_res = check_face_liveness(live_face)
    assert live_res["is_live"] is True, f"Live face failed liveness check: {live_res}"
    assert live_res["liveness_score"] >= 0.50
    assert live_res["attack_type"] == "none"

    # 2. Digital screen replay presentation attack
    screen_res = check_face_liveness(screen_replay)
    assert screen_res["is_live"] is False, "Screen replay attack must be rejected"
    assert screen_res["liveness_score"] < 0.50
    assert "screen_replay" in screen_res["attack_type"]
    assert screen_res["metrics"]["moire_peak_ratio"] > 5.0

    # 3. Printed photo / flat blur attack
    blur_res = check_face_liveness(printed_blur)
    assert blur_res["is_live"] is False, "Printed flat blur must be rejected"
    assert "printed_photo_blur" in blur_res["attack_type"]

    # 4. End-to-End API endpoint test with presentation attack rejection
    from backend.app.main import app
    client = TestClient(app)

    driver_id = "test-driver-spoof-liveness"
    # Enroll verified face
    buf_enroll = io.BytesIO()
    live_face.save(buf_enroll, format="JPEG")
    b64_enroll = base64.b64encode(buf_enroll.getvalue()).decode("ascii")

    enroll_resp = client.post(f"/v1/drivers/{driver_id}/enroll/face", json={"image_base64": b64_enroll})
    # If MTCNN detects synthetic face or bypasses
    if enroll_resp.status_code == 200:
        # Submit spoofed screen replay challenge
        buf_spoof = io.BytesIO()
        screen_replay.save(buf_spoof, format="JPEG")
        b64_spoof = base64.b64encode(buf_spoof.getvalue()).decode("ascii")

        challenge_resp = client.post(f"/v1/drivers/{driver_id}/challenge/face", json={"image_base64": b64_spoof})
        assert challenge_resp.status_code == 200
        ch_data = challenge_resp.json()
        assert ch_data["outcome"] == "spoof_rejected"
        assert ch_data["is_live"] is False


# -----------------------------------------------------------------------------
# Test 2: Adversarial Sensor Injection & Telemetry Replay Detection
# -----------------------------------------------------------------------------
def test_adversarial_sensor_authenticity():
    detector = SensorAuthenticityDetector()

    # 1. Genuine physical MEMS telemetry (natural thermal Brownian motion)
    genuine_accel = [
        {"x": float(np.random.normal(0.0, 0.08)),
         "y": float(np.random.normal(0.0, 0.08)),
         "z": float(np.random.normal(9.81, 0.09)),
         "t": f"2026-10-29T10:00:{i:02d}Z"}
        for i in range(30)
    ]
    gen_session = {"accel": genuine_accel, "touch_events": []}
    gen_res = detector.verify_session(gen_session)
    assert gen_res["is_authentic"] is True
    assert gen_res["entropy_bits"] >= 1.2
    assert gen_res["attack_detected"] == "none"

    # 2. Synthetic flat / linear injection (e.g. injected via script / Frida hook)
    flat_accel = [
        {"x": 0.0, "y": 0.0, "z": 9.8, "t": f"2026-10-29T10:00:{i:02d}Z"}
        for i in range(30)
    ]
    flat_session = {"accel": flat_accel, "touch_events": []}
    flat_res = detector.verify_session(flat_session)
    assert flat_res["is_authentic"] is False
    assert flat_res["attack_detected"] == "synthetic_flat_or_linear_injection"
    assert flat_res["entropy_bits"] < 0.50

    # 3. Looped telemetry replay attack (repeating recorded 8-sample chunk across 3 axes)
    chunk_z = [float(np.random.normal(0, 0.5)) for _ in range(8)]
    chunk_x = [float(np.random.normal(0, 0.3)) for _ in range(8)]
    chunk_y = [float(np.random.normal(0, 0.3)) for _ in range(8)]
    replayed_z = (chunk_z * 4)[:32]
    replayed_x = (chunk_x * 4)[:32]
    replayed_y = (chunk_y * 4)[:32]
    replayed_accel = [
        {"x": replayed_x[i], "y": replayed_y[i], "z": 9.8 + replayed_z[i], "t": f"2026-10-29T10:00:{i:02d}Z"}
        for i in range(32)
    ]
    replay_session = {"accel": replayed_accel, "touch_events": []}
    replay_res = detector.verify_session(replay_session)
    assert replay_res["is_authentic"] is False
    assert replay_res["attack_detected"] == "replayed_loop_attack"
    assert replay_res["max_autocorr"] > 0.70


# -----------------------------------------------------------------------------
# Test 3: Bounded Concept Drift & Ground-Truth Verified Re-Anchoring
# -----------------------------------------------------------------------------
def test_bounded_concept_drift_and_reanchoring():
    driver_id = "test-driver-boiling-frog"
    profiler = DriverTimeSeriesProfiler(
        driver_id=driver_id,
        max_silent_drift_limit=0.20,
        drift_delta_threshold=0.15,
    )

    # 1. Warm-up baseline at 0.90
    for _ in range(5):
        profiler.update(0.90, 1.0, "stable", "continue")

    initial_anchor = profiler.initial_enrollment_anchor
    assert initial_anchor is not None
    assert round(initial_anchor, 2) == 0.90

    # 2. Attempt "Boiling-Frog" slow poisoning drift (0.90 down to 0.60)
    # The cumulative drift is |0.60 - 0.90| = 0.30, which exceeds max_silent_drift_limit (0.20)!
    blocked_by_guardrail = False
    for s in np.linspace(0.88, 0.60, 12):
        res = profiler.update(float(s), 1.0, "stable", "continue")
        if res.get("drift_state") == "drift_limit_exceeded_verification_required":
            blocked_by_guardrail = True
            assert res.get("action") == "challenge_recommended"

    assert blocked_by_guardrail is True, "CUSUM guardrail should halt silent rebaselining when cumulative drift limit is exceeded"

    # 3. Ground-truth identity verification checkpoint (e.g. face verification passed)
    # Safely absorbs verified ground-truth score, resets drift limit, and restores stability
    reanchor = profiler.assimilate_verified_challenge(0.92, method="face_step_up")
    assert reanchor["status"] == "reanchored"
    assert profiler.drift_state == "verified_reanchored"
    assert profiler.anchor_behavior > 0.80
    assert profiler.consecutive_stable == 5
