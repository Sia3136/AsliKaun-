"""Regression tests for the Trust Juggler FastAPI prototype.

Run from the backend project root after installing pytest and httpx:
    python -m pytest -q tests

The suite uses a temporary SQLite database and never touches the normal dev DB.
"""
from __future__ import annotations

import importlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ADMIN_USERNAME = "test-admin"
ADMIN_PASSWORD = "test-password-long-enough-123"


@pytest.fixture(scope="module")
def client(tmp_path_factory: pytest.TempPathFactory):
    db_path = tmp_path_factory.mktemp("trust_juggler_tests") / "test.db"
    import os

    os.environ["TRUST_JUGGLER_DB"] = str(db_path)
    os.environ["TRUST_JUGGLER_ADMIN_USERNAME"] = ADMIN_USERNAME
    os.environ["TRUST_JUGGLER_ADMIN_PASSWORD"] = ADMIN_PASSWORD
    os.environ["TRUST_JUGGLER_TOKEN_SECRET"] = "test-only-secret-that-is-long-enough-for-regression-tests"

    import app.main as main

    main = importlib.reload(main)  # Read test-only environment before DB_PATH is set.
    with TestClient(main.app) as test_client:
        yield test_client


def admin_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/v1/admin/login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def session_payload(driver_id: str, **overrides) -> dict:
    payload = {
        "driver_id": driver_id,
        "device_id": "phone-A",
        "ip_subnet": "192.168.1.0/24",
        "zone": "zone-1",
        "accel": [0.2, 0.3, 0.25, 0.22],
        "gyro": [0.1, 0.12, 0.11],
        "touch_events": [{"type": "tap"}, {"type": "swipe"}, {"type": "tap"}],
        "accept_latency_ms": 820,
        "timestamp": "2026-10-17T10:00:00Z",
    }
    payload.update(overrides)
    return payload


def establish_baseline(client: TestClient, driver_id: str) -> dict:
    response = client.post("/v1/sessions/ingest", json=session_payload(driver_id))
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["decision"] == "baseline_established"
    assert result["context_axis"] == "insufficient_evidence"
    assert result["behavior_axis"] == "insufficient_evidence"
    return result


def test_health_endpoint(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_first_session_establishes_baseline_and_stable_session_continues(client: TestClient):
    driver_id = "test-stable-driver"
    establish_baseline(client, driver_id)

    response = client.post(
        "/v1/sessions/ingest",
        json=session_payload(driver_id, timestamp="2026-10-17T10:05:00Z"),
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["context_axis"] == "stable"
    assert result["behavior_axis"] == "stable"
    assert result["decision"] == "continue"


def test_context_change_with_stable_behavior_rebaselines(client: TestClient):
    driver_id = "test-context-change-driver"
    establish_baseline(client, driver_id)

    response = client.post(
        "/v1/sessions/ingest",
        json=session_payload(
            driver_id,
            device_id="phone-B",
            zone="zone-2",
            timestamp="2026-10-17T10:05:00Z",
        ),
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["context_axis"] == "changed"
    assert result["behavior_axis"] == "stable"
    assert result["decision"] == "rebaseline"


def test_behavior_change_queues_review_and_admin_can_resolve(client: TestClient):
    driver_id = "test-behavior-change-driver"
    establish_baseline(client, driver_id)

    response = client.post(
        "/v1/sessions/ingest",
        json=session_payload(
            driver_id,
            accel=[2.0, 2.5, 2.2],
            gyro=[1.5, 1.8],
            touch_events=[{"type": "tap"}] * 12,
            accept_latency_ms=3500,
            timestamp="2026-10-17T10:05:00Z",
        ),
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["context_axis"] == "stable"
    assert result["behavior_axis"] == "changed"
    assert result["decision"] == "challenge_at_safe_pause"

    headers = admin_headers(client)
    queue_response = client.get(
        "/v1/review-queue", headers=headers, params={"driver_id": driver_id}
    )
    assert queue_response.status_code == 200, queue_response.text
    queue = queue_response.json()
    assert queue["count"] == 1
    session_id = queue["reviews"][0]["session_id"]

    resolve_response = client.post(
        f"/v1/review-queue/{session_id}/resolve",
        headers=headers,
        json={"resolution": "needs_follow_up", "reviewer_note": "Regression test resolution"},
    )
    assert resolve_response.status_code == 200, resolve_response.text

    resolved_queue = client.get(
        "/v1/review-queue",
        headers=headers,
        params={"status": "resolved", "driver_id": driver_id},
    )
    assert resolved_queue.status_code == 200
    assert resolved_queue.json()["count"] == 1
    assert resolved_queue.json()["reviews"][0]["resolution"] == "needs_follow_up"


def test_admin_routes_reject_missing_token(client: TestClient):
    response = client.get("/v1/fleet/scores")
    assert response.status_code == 401


def test_driver_declaration_requires_token_and_matches_next_session(client: TestClient):
    driver_id = "test-declaration-driver"
    establish_baseline(client, driver_id)
    headers = admin_headers(client)

    token_response = client.post(
        f"/v1/admin/drivers/{driver_id}/driver-token", headers=headers
    )
    assert token_response.status_code == 200, token_response.text
    driver_token = token_response.json()["driver_token"]

    declaration_body = {
        "device_id": "phone-B",
        "ip_subnet": "10.0.0",
        "zone": "zone-2",
        "reason": "New phone and work area",
    }
    unauthorized = client.post(
        f"/v1/drivers/{driver_id}/declare-change", json=declaration_body
    )
    assert unauthorized.status_code == 401

    declared = client.post(
        f"/v1/drivers/{driver_id}/declare-change",
        headers={"X-Driver-Token": driver_token},
        json=declaration_body,
    )
    assert declared.status_code == 200, declared.text
    assert declared.json()["status"] == "pending"

    next_session = client.post(
        "/v1/sessions/ingest",
        json=session_payload(
            driver_id,
            device_id="phone-B",
            ip_subnet="10.0.0",
            zone="zone-2",
            timestamp="2026-10-17T10:05:00Z",
        ),
    )
    assert next_session.status_code == 200, next_session.text

    history = client.get(
        f"/v1/admin/drivers/{driver_id}/declarations", headers=headers
    )
    assert history.status_code == 200, history.text
    declaration = history.json()["declarations"][0]
    assert declaration["status"] == "matched"
    assert declaration["matched_session_id"] is not None

    events = client.get(f"/v1/drivers/{driver_id}/events", headers=headers)
    assert events.status_code == 200, events.text
    event_types = [event["event_type"] for event in events.json()["events"]]
    assert "context_change_declared" in event_types
    assert "context_change_declaration_checked" in event_types
