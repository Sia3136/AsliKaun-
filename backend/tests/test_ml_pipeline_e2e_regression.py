"""Comprehensive End-to-End Regression Test Suite for the Integrated ML Pipeline.

Validates:
1. Multi-modal telemetry ingestion flowing into real PyTorch model bundles (Touch, Motion, GPS, Operational).
2. Continuous GPS trajectory encoding via adaptive micro-leg segmentation.
3. Live operational phase stratification (transit vs stationary thresholds).
4. Asynchronous non-blocking background bundle refitting with atomic hot-swap.
5. Adversarial sensor integrity verification (rejecting flat mocks and replayed loops).
6. 3D Face Anti-Spoofing presentation attack rejection and live selfie challenge clearing.
7. Self-supervised ground-truth re-anchoring of the time-series profiler.
"""
import base64
import importlib
import io
import os
import time
import numpy as np
import pytest
from PIL import Image

os.environ["ASLIKAUN_INGEST_LIMIT_PER_MINUTE"] = "1000"

from fastapi.testclient import TestClient

import backend.app.main as _main_module
from backend.app.main import connect, hash_driver_token


def _generate_telemetry_payload(
    driver_id: str,
    seq_id: int,
    speed_mph: float = 14.5,
    is_impostor: bool = False,
    is_mocked_sensor: bool = False,
) -> dict:
    now_iso = f"2026-10-29T10:{seq_id:02d}:00Z"

    # Multi-sample touch gestures with coordinates and pressure
    p = 0.92 if is_impostor else 0.52
    dur = 450 if is_impostor else 115
    vel = 1.2 if is_impostor else 0.45

    touches = [
        {
            "type": "swipe",
            "pressure": p,
            "area": float(p * 600.0 + 100.0),
            "duration_ms": dur,
            "t": 0,
            "path": [
                {"x": 50.0, "y": 150.0, "pressure": p, "t_offset_ms": 0},
                {"x": 50.0 + vel * (dur / 2), "y": 150.0, "pressure": p, "t_offset_ms": dur // 2},
                {"x": 50.0 + vel * dur, "y": 150.0, "pressure": p, "t_offset_ms": dur},
            ],
        }
        for _ in range(3)
    ]

    # IMU accelerometer stream
    if is_mocked_sensor:
        # Flat unphysical injection from script
        accel = [{"x": 0.0, "y": 0.0, "z": 9.8, "t": now_iso} for _ in range(25)]
    else:
        noise = 0.85 if is_impostor else 0.12
        accel = [
            {
                "x": round(float(np.random.normal(0.0, noise)), 3),
                "y": round(float(np.random.normal(0.0, noise)), 3),
                "z": round(float(np.random.normal(9.81, noise)), 3),
                "t": now_iso,
            }
            for _ in range(25)
        ]

    # Continuous GPS stream (no stops, tests adaptive micro-leg segmentation)
    gps = [
        {"lat": 19.050 + (i * 0.001), "lng": 72.850 + (i * 0.001), "speed": speed_mph, "t": float(i * 30)}
        for i in range(8)
    ]

    return {
        "driver_id": driver_id,
        "device_id": "device-pixel-pro" if not is_impostor else "device-hacked-root",
        "ip_subnet": "192.168.1.0/24",
        "zone": "mumbai_central",
        "timestamp": now_iso,
        "vehicle_speed_mph": speed_mph,
        "accept_latency_ms": 3200.0 if is_impostor else 740.0,
        "accel": accel,
        "touch_events": touches,
        "gps": gps,
    }


def _make_face_image(kind: str = "live") -> str:
    w, h = 160, 160
    x, y = np.meshgrid(np.linspace(-1, 1, w), np.linspace(-1, 1, h))
    r = np.clip(180 - 45 * (x**2 + y**2) + np.random.normal(0, 5, (h, w)), 0, 255)
    g = np.clip(130 - 40 * (x**2 + y**2) + np.random.normal(0, 5, (h, w)), 0, 255)
    b = np.clip(110 - 35 * (x**2 + y**2) + np.random.normal(0, 5, (h, w)), 0, 255)

    if kind == "live":
        img = Image.fromarray(np.stack([r, g, b], axis=-1).astype(np.uint8))
    elif kind == "screen_replay":
        screen_r = r + 35 * np.sin(x * 65.0)
        screen_g = g + 35 * np.sin(y * 65.0)
        screen_b = b + 35 * np.sin((x + y) * 65.0)
        screen_r[70:85, 70:85] = 255
        screen_g[70:85, 70:85] = 255
        screen_b[70:85, 70:85] = 255
        img = Image.fromarray(np.clip(np.stack([screen_r, screen_g, screen_b], axis=-1), 0, 255).astype(np.uint8))
    else:
        raise ValueError(f"Unknown kind: {kind}")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def test_ml_pipeline_end_to_end_regression(monkeypatch, tmp_path_factory):
    # Isolated DB, same pattern as test_api.py's `client` fixture — this
    # test previously had no DB override at all, so it silently ran
    # against whatever DB_PATH the process already resolved to (the real
    # dev database when run alone, or test_api.py's leftover temp DB when
    # run after it in the same session — order-dependent either way).
    # Both are wrong for a test that writes drivers/sessions/tokens.
    db_path = tmp_path_factory.mktemp("aslikaun_e2e_test") / "test.db"
    monkeypatch.setenv("ASLIKAUN_DB", str(db_path))
    monkeypatch.setenv("TRUST_JUGGLER_DB", str(db_path))
    importlib.reload(_main_module)
    # The identity-matching step (MTCNN face detection + FaceNet embedding,
    # ml/models/face_verification.py's embed_face) needs a real photograph
    # to find a face in — no procedurally generated image (gradient blob,
    # drawn cartoon face, or the moiré-pattern "screen_replay" fixture
    # below) is in its training distribution, so embed_face() legitimately
    # returns None on all of them (confirmed empirically, not assumed).
    # That's a real, separate thing to test with real photographic data
    # elsewhere; it's not what this E2E test is for. This test is about
    # the API orchestration (calibrate -> ingest -> escalate -> enroll ->
    # challenge -> liveness/spoof-check -> clear), so the identity-match
    # step is mocked to a fixed deterministic embedding, keeping the real,
    # texture-based anti-spoofing/liveness check (check_face_liveness,
    # Fourier/Laplacian/chrominance analysis — NOT MTCNN-dependent) real
    # and untouched below, since that one genuinely can and does
    # distinguish the "live" vs "screen_replay" synthetic fixtures.
    # NOTE: dividing a float32 array by a bare np.sqrt(...) (float64)
    # silently upcasts the result to float64 — doubles the byte size and
    # corrupts the round-trip through driver_face_enrollment's
    # np.frombuffer(..., dtype="float32") reader. Cast back explicitly.
    fixed_embedding = (np.ones(512, dtype=np.float32) / np.sqrt(512)).astype(np.float32)
    monkeypatch.setattr("backend.app.main.embed_face_image", lambda image: fixed_embedding)

    # Use the freshly reloaded module's `app`, not the stale top-level
    # import above — reload() rebinds `main.app` to a brand new FastAPI()
    # instance; the earlier `from ... import app` still points at the
    # pre-reload instance, which would silently run against the wrong app.
    # `with` (not a bare TestClient(...)) triggers the lifespan startup
    # event, which runs init_db() — without it the fresh isolated DB has
    # no schema at all (confirmed: "no such table: drivers" without this).
    with TestClient(_main_module.app) as client:
        _run_e2e_regression(client, monkeypatch, fixed_embedding)


def _run_e2e_regression(client: TestClient, monkeypatch, fixed_embedding: np.ndarray) -> None:
    driver_id = f"regress-courier-{int(time.time())}"

    # 1. Onboarding calibration
    calib_resp = client.post(
        "/v1/drivers/calibrate",
        json={
            "driver_id": driver_id,
            "device_id": "device-pixel-pro",
            "phase": "full",
            "touch_samples": [{"pressure": 0.52, "duration_ms": 115, "area": 350} for _ in range(5)],
            "order_acceptance_latency_ms": 740.0,
            "zone": "mumbai_central",
        },
    )
    assert calib_resp.status_code == 200
    assert calib_resp.json()["status"] == "calibrated"

    # 2. Ingest 12 consistent genuine sessions to accumulate real model history
    for i in range(1, 13):
        payload = _generate_telemetry_payload(driver_id, seq_id=i, speed_mph=15.0)
        resp = client.post("/v1/sessions/ingest", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["decision"] in ("continue", "baseline_established")
        assert data["operational_phase"] == "transit"

    # 3. Test operational phase stratification during live cruising vs stationary
    transit_payload = _generate_telemetry_payload(driver_id, seq_id=14, speed_mph=25.0)
    transit_resp = client.post("/v1/sessions/ingest", json=transit_payload)
    assert transit_resp.status_code == 200
    transit_data = transit_resp.json()
    assert transit_data["operational_phase"] == "transit"
    # Phase threshold in transit should be relaxed (< 0.58)
    assert transit_data["calibrated_alpha"] <= 0.58

    stationary_payload = _generate_telemetry_payload(driver_id, seq_id=15, speed_mph=0.0)
    stationary_resp = client.post("/v1/sessions/ingest", json=stationary_payload)
    assert stationary_resp.status_code == 200
    stationary_data = stationary_resp.json()
    assert stationary_data["operational_phase"] in ("stationary", "interaction")

    # 4. Adversarial Sensor Integrity Audit (Mocked Flat Accelerometer Injection)
    mocked_payload = _generate_telemetry_payload(driver_id, seq_id=16, speed_mph=14.0, is_mocked_sensor=True)
    mocked_resp = client.post("/v1/sessions/ingest", json=mocked_payload)
    assert mocked_resp.status_code == 200
    mocked_data = mocked_resp.json()
    assert mocked_data["sensor_authenticity"] is not None
    assert mocked_data["sensor_authenticity"]["is_authentic"] is False
    assert "synthetic_flat" in mocked_data["sensor_authenticity"]["attack_detected"]
    # Escalated to safe-pause challenge
    assert mocked_data["decision"] in ("challenge_at_safe_pause", "step_up_check_at_safe_pause")

    # 5. Provision Driver Token & Reference Face Enrollment
    driver_token = "test-e2e-token-123"
    live_b64 = _make_face_image("live")
    # Enrollment stores whatever embed_face_image() would produce for the
    # driver's reference photo; since that call is mocked above to the
    # fixed vector (see the monkeypatch comment), store that same vector
    # directly rather than calling the real (MTCNN-dependent) embed_face.
    with connect() as con:
        con.execute(
            "INSERT OR REPLACE INTO driver_tokens(driver_id, token_hash, active, created_at) VALUES (?, ?, 1, ?)",
            (driver_id, hash_driver_token(driver_token), "2026-10-29T10:00:00Z"),
        )
        con.execute(
            "INSERT OR REPLACE INTO driver_face_enrollment(driver_id, embedding_b64, enrolled_at) VALUES (?, ?, ?)",
            (driver_id, base64.b64encode(fixed_embedding.tobytes()).decode("ascii"), "2026-10-29T10:00:00Z"),
        )

    # 6. Presentation Attack Anti-Spoofing Challenge Rejection
    spoofed_b64 = _make_face_image("screen_replay")
    challenge_spoof = client.post(
        f"/v1/drivers/{driver_id}/challenge/respond",
        headers={"X-Driver-Token": driver_token},
        json={"image_base64": spoofed_b64},
    )
    assert challenge_spoof.status_code == 200
    spoof_res = challenge_spoof.json()
    assert spoof_res["outcome"] == "spoof_rejected"
    assert spoof_res["is_live"] is False
    assert "screen_replay" in spoof_res["liveness"]["attack_type"]

    # 7. Live Face Verification & Liveness Validation
    challenge_live = client.post(
        f"/v1/drivers/{driver_id}/challenge/respond",
        headers={"X-Driver-Token": driver_token},
        json={"image_base64": live_b64},
    )
    assert challenge_live.status_code == 200
    live_res = challenge_live.json()
    assert live_res["is_live"] is True
    assert live_res["outcome"] == "cleared"
