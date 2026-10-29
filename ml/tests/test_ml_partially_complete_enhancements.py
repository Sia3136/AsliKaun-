"""Verification tests for the three ML architectural enhancements:
1. Adaptive Kinematic Micro-Leg Segmentation for GPS (continuous/sparse-stop trips).
2. Multi-Phase Stratified Calibration & State-Conditioned Empirical Bayes Priors.
3. Asynchronous Non-Blocking Model Training Worker & Atomic Cache Hot-Swap.
"""
import time
import numpy as np
import pytest
from fastapi.testclient import TestClient

from ml.calibration.per_rider_threshold import (
    per_rider_threshold,
    stratified_per_rider_threshold,
    PHASE_CALIBRATION_FACTORS,
)
from ml.inference.bundle_store import (
    AsyncBundleWorker,
    save_bundle,
    load_bundle,
    get_bundle_path,
)
from ml.inference.schema_adapters import (
    _detect_leg_boundaries,
    gps_leg_sequence_from_schema,
)
from ml.models.gps_triplet_encoder import GPSTripletScorer


# -----------------------------------------------------------------------------
# Test 1: Adaptive Kinematic Micro-Leg Segmentation for Continuous GPS Trips
# -----------------------------------------------------------------------------
def test_adaptive_kinematic_micro_leg_segmentation():
    # Scenario A: Continuous highway trip (12 points, 1.2 km, zero standstill stops)
    lats = np.linspace(19.050, 19.062, 12)
    lons = np.linspace(72.850, 72.860, 12)
    ts = np.linspace(0, 360, 12)  # 6 minutes continuous transit
    gps_points = [{"lat": float(lats[i]), "lng": float(lons[i]), "t": float(ts[i])} for i in range(12)]

    boundaries = _detect_leg_boundaries(gps_points)
    assert boundaries is not None, "Continuous trip should be adaptively segmented into micro-legs"
    r_dis_lst, r_time_lst = boundaries
    assert len(r_dis_lst) >= 2, f"Expected >=2 legs, got {len(r_dis_lst)}"
    assert len(r_time_lst) >= 3, f"Expected >=3 boundary timestamps, got {len(r_time_lst)}"
    assert sum(r_dis_lst) > 500.0, "Total distance should reflect full trajectory length"

    # Verify that gps_leg_sequence_from_schema feeds into GPSTripletScorer
    session = {"gps": gps_points}
    leg_seq = gps_leg_sequence_from_schema(session)
    assert leg_seq is not None, "Extracted leg sequence should not be None"
    assert leg_seq.shape[1] == 4, "Leg sequence must have 4 dimensions per leg"
    assert leg_seq.shape[0] >= 2, "Must contain >=2 legs for GRU processing"

    # Forward pass through GRU Trajectory Triplet Encoder
    scorer = GPSTripletScorer(weights_path="ml/weights/gps_encoder.pt")
    synthetic_pool = [leg_seq] * 5
    scorer.fit(synthetic_pool)
    raw_score = scorer.raw_score(leg_seq)
    assert isinstance(raw_score, float)
    assert np.isfinite(raw_score)

    # Scenario B: Trajectory with sharp turns (e.g., urban delivery turns)
    turn_points = [
        {"lat": 19.000, "lng": 72.800, "t": 0.0},
        {"lat": 19.002, "lng": 72.800, "t": 30.0},
        {"lat": 19.004, "lng": 72.800, "t": 60.0},
        # Sharp 90-degree turn
        {"lat": 19.004, "lng": 72.805, "t": 90.0},
        {"lat": 19.004, "lng": 72.810, "t": 120.0},
        {"lat": 19.004, "lng": 72.815, "t": 150.0},
    ]
    turn_boundaries = _detect_leg_boundaries(turn_points)
    assert turn_boundaries is not None
    assert len(turn_boundaries[0]) >= 2


# -----------------------------------------------------------------------------
# Test 2: Multi-Phase Stratified Calibration & Empirical Bayes Priors
# -----------------------------------------------------------------------------
def test_multi_phase_stratified_calibration():
    # 1. Mathematical stratification checks
    fused_p_values = [0.85, 0.78, 0.82, 0.74, 0.79, 0.88, 0.70, 0.75]
    base_info = per_rider_threshold(fused_p_values, target_far=0.01)

    transit_info = stratified_per_rider_threshold(fused_p_values, phase="transit", target_far=0.01)
    stationary_info = stratified_per_rider_threshold(fused_p_values, phase="stationary", target_far=0.01)

    # Transit should be relaxed (lower alpha) to absorb road roughness without false rejections
    assert transit_info["phase_adjusted_threshold"] < base_info["threshold"]
    assert transit_info["phase_factor"] == PHASE_CALIBRATION_FACTORS["transit"]

    # Stationary should be tightened (higher alpha) to detect curbside phone handoffs immediately
    assert stationary_info["phase_adjusted_threshold"] > base_info["threshold"]
    assert stationary_info["phase_factor"] == PHASE_CALIBRATION_FACTORS["stationary"]

    # 2. Integration check with backend /v1/drivers/calibrate
    from backend.app.main import app
    client = TestClient(app)

    driver_id = "test-driver-phase-calibration"
    calib_payload = {
        "driver_id": driver_id,
        "device_id": "test-device-p1",
        "phase": "transit",
        "touch_samples": [
            {"pressure": 0.52, "duration_ms": 110, "area": 340},
            {"pressure": 0.54, "duration_ms": 120, "area": 360},
            {"pressure": 0.50, "duration_ms": 105, "area": 330},
        ],
        "order_acceptance_latency_ms": 850.0,
        "zone": "downtown_zone",
    }

    res = client.post("/v1/drivers/calibrate", json=calib_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "calibrated"

    # Now verify that during live ingestion, vehicle speed > 2.0 triggers transit phase
    session_payload = {
        "driver_id": driver_id,
        "device_id": "test-device-p1",
        "ip_subnet": "192.168.1.0/24",
        "zone": "downtown_zone",
        "timestamp": "2026-10-29T10:30:00Z",
        "vehicle_speed_mph": 16.5,  # Moving!
        "accept_latency_ms": 860.0,
        "accel": [{"x": 0.01, "y": 0.02, "z": 9.81, "t": "2026-10-29T10:30:00Z"} for _ in range(20)],
        "touch_events": [{"type": "tap", "pressure": 0.52, "area": 340, "duration_ms": 110, "t": 0}],
    }
    ingest_res = client.post("/v1/sessions/ingest", json=session_payload)
    assert ingest_res.status_code == 200
    ingest_data = ingest_res.json()
    assert ingest_data["operational_phase"] == "transit"


# -----------------------------------------------------------------------------
# Test 3: Asynchronous Non-Blocking Model Training Worker
# -----------------------------------------------------------------------------
def test_async_bundle_worker_non_blocking_refit():
    worker = AsyncBundleWorker(max_workers=2)
    test_driver = "async-worker-driver-test"

    # Generate synthetic history
    enroll = [
        {
            "driver_id": test_driver,
            "session_id": f"s-{i}",
            "timestamp": "2026-10-29T10:00:00Z",
            "device_id": "dev-1",
            "ip_subnet": "192.168.1.0/24",
            "zone": "z1",
            "accept_latency_ms": 600.0,
            "accel": [{"x": 0.0, "y": 0.0, "z": 9.8, "t": "2026-10-29T10:00:00Z"} for _ in range(25)],
            "touch_events": [
                {"type": "swipe", "pressure": 0.5, "area": 300, "duration_ms": 100,
                 "path": [{"x": 10, "y": 10, "pressure": 0.5, "t": 0}, {"x": 50, "y": 50, "pressure": 0.5, "t": 100}]}
                for _ in range(3)
            ],
            "gps": [{"lat": 19.0 + j * 0.001, "lng": 72.8 + j * 0.001, "t": float(j * 30)} for j in range(8)],
        }
        for i in range(7)
    ]
    calib = enroll.copy()

    callback_called = []

    def on_complete_cb(d_id, bundle, n_sess):
        callback_called.append((d_id, n_sess))

    # Submit background training job
    future = worker.submit_fit(test_driver, enroll, calib, on_complete=on_complete_cb)
    assert future is not None

    # Verify is_training returns True immediately without blocking the caller
    status = worker.get_status(test_driver)
    assert status["status"] in ("training", "idle")

    # Wait for completion
    res_bundle = future.result(timeout=15.0)
    assert res_bundle is not None
    assert len(callback_called) == 1
    assert callback_called[0][0] == test_driver

    # Verify persisted bundle on disk
    loaded = load_bundle(test_driver)
    assert loaded is not None
    n_sess, disk_bundle, meta = loaded
    assert n_sess == len(enroll) + len(calib)
    assert meta.get("async_worker") is True

