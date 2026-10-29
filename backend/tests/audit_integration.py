"""
Comprehensive End-to-End Integration & Architectural Audit Suite
Verifies all 7 phases and components implemented for AsliKaun.
"""
from pathlib import Path
import os
import json
import pytest
from fastapi.testclient import TestClient

ADMIN_USER = "audit-admin"
ADMIN_PASS = "audit-password-12345"

@pytest.fixture(scope="module")
def audit_client(tmp_path_factory):
    db_path = tmp_path_factory.mktemp("aslikaun_audit") / "audit.db"
    os.environ["ASLIKAUN_DB"] = str(db_path)
    os.environ["ASLIKAUN_ADMIN_USERNAME"] = ADMIN_USER
    os.environ["ASLIKAUN_ADMIN_PASSWORD"] = ADMIN_PASS
    os.environ["ASLIKAUN_TOKEN_SECRET"] = "audit-test-secret-key-at-least-32-chars-long"

    import backend.app.main as main
    import importlib
    main = importlib.reload(main)

    with TestClient(main.app) as c:
        yield c, main

def test_audit_all_phases(audit_client):
    client, main = audit_client

    # 1. Verify Lifespan was registered
    assert main.app.router.lifespan_context is not None, "Lifespan context manager must be attached"

    # 2. Verify Health
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    # 3. Verify Admin Authentication
    admin_login = client.post("/v1/admin/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
    assert admin_login.status_code == 200
    token = admin_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 4. Phase 5: 2-Minute Onboarding Calibration
    driver_id = "audit-driver-1"
    calib_payload = {
        "driver_id": driver_id,
        "device_id": "phone-audit-1",
        "touch_samples": [
            {"pressure": 0.55, "area": 320, "duration_ms": 115},
            {"pressure": 0.58, "area": 340, "duration_ms": 120},
        ],
        "accel_samples": [0.1, 0.12],
        "order_acceptance_latency_ms": 780.0,
        "zone": "Audit Zone A"
    }
    calib_res = client.post("/v1/drivers/calibrate", json=calib_payload)
    assert calib_res.status_code == 200
    assert calib_res.json()["status"] == "calibrated"
    assert calib_res.json()["baseline_established"] is True

    # 5. Phase 2 & 3: Touch area proxy & GPS speed integration in ingest
    session_payload = {
        "driver_id": driver_id,
        "device_id": "phone-audit-1",
        "zone": "Audit Zone A",
        "vehicle_speed_mph": 22.4, # In motion
        "touch_events": [
            {"type": "swipe", "area": 580, "duration_ms": 350, "path": [{"x": 10, "y": 20, "t": 0}, {"x": 50, "y": 80, "t": 100}]}
        ],
        "accel": [2.5, 3.1, 2.8],
        "gyro": [1.4, 1.6],
        "accept_latency_ms": 3200
    }
    ingest_res = client.post("/v1/sessions/ingest", json=session_payload)
    assert ingest_res.status_code == 200
    ingest_data = ingest_res.json()
    assert "safe_pause_info" in ingest_data
    sp_info = ingest_data["safe_pause_info"]
    assert sp_info["is_moving"] is True
    assert sp_info["vehicle_speed_mph"] == 22.4
    assert sp_info["safe_to_prompt"] is False

    # 6. Verify Safe-Pause Suppression Gate on Challenge Status Endpoint
    challenge_status = client.get(f"/v1/drivers/{driver_id}/challenge-status")
    assert challenge_status.status_code == 200
    cs_data = challenge_status.json()
    assert cs_data["challenge_pending"] is False, "Interactive challenge must be suppressed while vehicle is moving at 22.4 mph"
    assert cs_data["safe_pause_info"]["status"] == "deferred_vehicle_moving"

    # 7. Driver comes to a complete standstill (0.0 mph)
    session_payload["vehicle_speed_mph"] = 0.0
    ingest_res_stopped = client.post("/v1/sessions/ingest", json=session_payload)
    assert ingest_res_stopped.status_code == 200
    stopped_sp = ingest_res_stopped.json()["safe_pause_info"]
    assert stopped_sp["is_moving"] is False
    assert stopped_sp["safe_to_prompt"] is True

    challenge_status_stopped = client.get(f"/v1/drivers/{driver_id}/challenge-status")
    assert challenge_status_stopped.status_code == 200
    assert challenge_status_stopped.json()["challenge_pending"] is True, "Challenge must be active once vehicle is stopped"

    # 8. Phase 4: Driver refuses / times out on challenge
    refusal_res = client.post(
        f"/v1/driver/challenge/refuse-or-timeout?driver_id={driver_id}",
        json={"reason": "audit_timeout_test", "vehicle_speed_mph": 0.0}
    )
    assert refusal_res.status_code == 200
    assert refusal_res.json()["status"] == "dispatch_suspended"

    # 9. Phase 6: Continuous Simulator Toggle
    sim_on = client.post("/v1/fleet/simulator/auto-toggle?enable=true")
    assert sim_on.status_code == 200
    sim_status = client.get("/v1/fleet/simulator/status")
    assert sim_status.status_code == 200
    assert sim_status.json()["active"] is True
    sim_off = client.post("/v1/fleet/simulator/auto-toggle?enable=false")
    assert sim_off.status_code == 200
    assert client.get("/v1/fleet/simulator/status").json()["active"] is False

    # 10. Phase 7: Pluggable Storage & Fleet Scores
    fleet = client.get("/v1/fleet/scores", headers=headers)
    assert fleet.status_code == 200
    assert fleet.json()["count"] >= 1
    scored_driver = next(d for d in fleet.json()["drivers"] if d["driver_id"] == driver_id)
    assert "safe_pause_info" in scored_driver
    assert scored_driver["safe_pause_info"] is not None

    print("\n--- ALL 7 PHASES AUDITED AND INTEGRATED SUCCESSFULLY ---")

