from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

DB_PATH = os.getenv("TRUST_JUGGLER_DB", "trust_juggler.db")
app = FastAPI(
    title="Trust Juggler API",
    description="Hackathon prototype: two-axis context and behavioral continuity.",
    version="0.1.0",
)

# ---------- Request / response contracts ----------

class SessionIngest(BaseModel):
    driver_id: str = Field(min_length=1, max_length=100)
    device_id: str | None = None
    ip_subnet: str | None = None
    zone: str | None = None
    accel: list[float] = Field(default_factory=list, max_length=500)
    gyro: list[float] = Field(default_factory=list, max_length=500)
    touch_events: list[dict[str, Any]] = Field(default_factory=list, max_length=500)
    accept_latency_ms: float | None = Field(default=None, ge=0)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DeclareChange(BaseModel):
    device_id: str | None = None
    ip_subnet: str | None = None
    zone: str | None = None
    reason: str = Field(default="rider_declared_change", max_length=200)


# ---------- SQLite ----------

def connect() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def init_db() -> None:
    with connect() as con:
        con.executescript("""
        CREATE TABLE IF NOT EXISTS drivers (
            driver_id TEXT PRIMARY KEY,
            anchor_json TEXT NOT NULL DEFAULT '{}',
            fast_json TEXT NOT NULL DEFAULT '{}',
            latest_json TEXT NOT NULL DEFAULT '{}',
            latest_result_json TEXT NOT NULL DEFAULT '{}',
            updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            driver_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            context_score REAL,
            behavior_score REAL,
            context_axis TEXT NOT NULL,
            behavior_axis TEXT NOT NULL,
            quadrant TEXT NOT NULL,
            decision TEXT NOT NULL,
            reasons_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            driver_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            event_type TEXT NOT NULL,
            details_json TEXT NOT NULL
        );
        """)


@app.on_event("startup")
def startup() -> None:
    init_db()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def decode_json(value: str | None, default: Any) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


def write_event(con: sqlite3.Connection, driver_id: str, event_type: str, details: dict) -> None:
    con.execute(
        "INSERT INTO events(driver_id, timestamp, event_type, details_json) VALUES(?,?,?,?)",
        (driver_id, now_iso(), event_type, json.dumps(details)),
    )


def mean_abs(values: list[float]) -> float | None:
    if not values:
        return None
    return sum(abs(v) for v in values) / len(values)


def behavior_features(payload: SessionIngest) -> dict[str, float | None]:
    # Mock feature extraction only. Replace with ML scorer later.
    return {
        "accel_mean_abs": mean_abs(payload.accel),
        "gyro_mean_abs": mean_abs(payload.gyro),
        "touch_count": float(len(payload.touch_events)) if payload.touch_events else None,
        "accept_latency_ms": payload.accept_latency_ms,
    }


def compare_context(current: dict, previous: dict) -> tuple[float | None, str, list[str]]:
    fields = ["device_id", "ip_subnet", "zone"]
    available = [f for f in fields if current.get(f) is not None and previous.get(f) is not None]
    if not available:
        return None, "insufficient_evidence", ["Not enough context fields to compare"]

    changed = [f for f in available if current[f] != previous[f]]
    score = 1.0 - (len(changed) / len(available))  # continuity score: 1 = stable
    axis = "changed" if changed else "stable"
    reasons = [f"Context changed: {', '.join(changed)}"] if changed else ["Device, network and zone context are consistent"]
    return round(score, 3), axis, reasons


def mock_behavior_score(current: dict, baseline: dict) -> tuple[float | None, str, list[str]]:
    """
    Returns continuity score (1 = similar, 0 = very different).
    This intentionally simple heuristic is a MOCK, not a trained identity model.
    """
    compared = []
    for key in ("accel_mean_abs", "gyro_mean_abs", "touch_count", "accept_latency_ms"):
        a, b = current.get(key), baseline.get(key)
        if a is None or b is None:
            continue
        scale = max(abs(float(b)), 1.0)
        relative_difference = abs(float(a) - float(b)) / scale
        compared.append(min(relative_difference, 1.0))

    if not compared:
        return None, "insufficient_evidence", ["Motion, touch and operational features are missing"]

    anomaly = sum(compared) / len(compared)
    continuity = round(max(0.0, 1.0 - anomaly), 3)
    # Prototype threshold only. Tune using synthetic scenario tests; do not call this validated.
    axis = "changed" if anomaly >= 0.45 else "stable"
    reasons = [f"Mock behavioral anomaly={anomaly:.2f} (not a trained model)"]
    return continuity, axis, reasons


def decide(context_axis: str, behavior_axis: str) -> tuple[str, str]:
    if "insufficient_evidence" in (context_axis, behavior_axis):
        return "insufficient_evidence", "Insufficient evidence"
    if context_axis == "stable" and behavior_axis == "stable":
        return "continue", "Stable context + stable behavior"
    if context_axis == "changed" and behavior_axis == "stable":
        return "rebaseline", "Context changed while behavior stayed stable"
    if context_axis == "stable" and behavior_axis == "changed":
        return "challenge_at_safe_pause", "Context stable but behavior changed"
    return "step_up_check_at_safe_pause", "Context and behavior both changed"


def public_result(row: sqlite3.Row) -> dict:
    result = decode_json(row["latest_result_json"], {})
    return result


# ---------- Routes ----------

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "trust-juggler-api"}


@app.post("/v1/sessions/ingest")
def ingest_session(body: SessionIngest) -> dict:
    current_context = {
        "device_id": body.device_id,
        "ip_subnet": body.ip_subnet,
        "zone": body.zone,
    }
    current_behavior = behavior_features(body)
    payload_dict = body.model_dump(mode="json")

    with connect() as con:
        driver = con.execute(
            "SELECT * FROM drivers WHERE driver_id = ?", (body.driver_id,)
        ).fetchone()

        if driver is None:
            # First session establishes the starting baseline; no identity verdict.
            con.execute(
                """INSERT INTO drivers(driver_id, anchor_json, fast_json, latest_json,
                   latest_result_json, updated_at) VALUES(?,?,?,?,?,?)""",
                (body.driver_id, json.dumps(current_behavior), json.dumps(current_behavior),
                 json.dumps(current_context), "{}", now_iso()),
            )
            result = {
                "driver_id": body.driver_id,
                "context_score": None,
                "behavior_score": None,
                "context_axis": "insufficient_evidence",
                "behavior_axis": "insufficient_evidence",
                "quadrant": "baseline_established",
                "decision": "baseline_established",
                "reasons": ["First session stored as baseline; no risk verdict yet"],
                "model_status": "mock_behavior_scorer",
                "timestamp": body.timestamp.isoformat(),
            }
            con.execute(
                """INSERT INTO sessions(driver_id,timestamp,payload_json,context_score,
                   behavior_score,context_axis,behavior_axis,quadrant,decision,reasons_json)
                   VALUES(?,?,?,?,?,?,?,?,?,?)""",
                (body.driver_id, body.timestamp.isoformat(), json.dumps(payload_dict), None, None,
                 "insufficient_evidence", "insufficient_evidence", "baseline_established",
                 "baseline_established", json.dumps(result["reasons"])),
            )
            con.execute(
                "UPDATE drivers SET latest_result_json=?, updated_at=? WHERE driver_id=?",
                (json.dumps(result), now_iso(), body.driver_id),
            )
            write_event(con, body.driver_id, "baseline_established", {"context": current_context})
            return result

        previous_context = decode_json(driver["latest_json"], {})
        anchor_behavior = decode_json(driver["anchor_json"], {})
        fast_behavior = decode_json(driver["fast_json"], {})

        context_score, context_axis, context_reasons = compare_context(current_context, previous_context)
        fast_score, fast_axis, fast_reasons = mock_behavior_score(current_behavior, fast_behavior)
        anchor_score, anchor_axis, anchor_reasons = mock_behavior_score(current_behavior, anchor_behavior)

        # Dual timescale: fast baseline adapts to ordinary gradual changes; frozen anchor
        # remains unchanged and can expose slow drift. Use the more conservative continuity.
        available_scores = [s for s in (fast_score, anchor_score) if s is not None]
        behavior_score = min(available_scores) if available_scores else None
        if fast_axis == "insufficient_evidence" and anchor_axis == "insufficient_evidence":
            behavior_axis = "insufficient_evidence"
        elif "changed" in (fast_axis, anchor_axis):
            behavior_axis = "changed"
        else:
            behavior_axis = "stable"
        decision, quadrant = decide(context_axis, behavior_axis)
        reasons = context_reasons + [f"Fast baseline: {r}" for r in fast_reasons] + [f"Frozen anchor: {r}" for r in anchor_reasons]

        # A declared or apparently legitimate context change with stable behavior gets
        # a context re-baseline. Keep the frozen anchor; update only the fast baseline.
        update_fast = decision in ("continue", "rebaseline")
        if update_fast:
            # Slowly adapt the fast baseline, while anchor_behavior stays frozen.
            new_fast = {}
            for key, value in current_behavior.items():
                old = fast_behavior.get(key)
                if value is None:
                    new_fast[key] = old
                elif old is None:
                    new_fast[key] = value
                else:
                    new_fast[key] = 0.8 * float(old) + 0.2 * float(value)
            fast_behavior = new_fast

        result = {
            "driver_id": body.driver_id,
            "context_score": context_score,
            "behavior_score": behavior_score,
            "context_axis": context_axis,
            "behavior_axis": behavior_axis,
            "quadrant": quadrant,
            "decision": decision,
            "reasons": reasons,
            "model_status": "mock_behavior_scorer",
            "baseline_status": "fast_baseline_updated" if update_fast else "fast_baseline_frozen",
            "fast_behavior_score": fast_score,
            "anchor_behavior_score": anchor_score,
            "timestamp": body.timestamp.isoformat(),
        }

        con.execute(
            """INSERT INTO sessions(driver_id,timestamp,payload_json,context_score,
               behavior_score,context_axis,behavior_axis,quadrant,decision,reasons_json)
               VALUES(?,?,?,?,?,?,?,?,?,?)""",
            (body.driver_id, body.timestamp.isoformat(), json.dumps(payload_dict), context_score,
             behavior_score, context_axis, behavior_axis, quadrant, decision, json.dumps(reasons)),
        )
        con.execute(
            """UPDATE drivers SET fast_json=?, latest_json=?, latest_result_json=?, updated_at=?
               WHERE driver_id=?""",
            (json.dumps(fast_behavior), json.dumps(current_context), json.dumps(result),
             now_iso(), body.driver_id),
        )
        write_event(con, body.driver_id, "session_scored", result)

    return result


@app.get("/v1/drivers/{driver_id}/score")
def driver_score(driver_id: str) -> dict:
    with connect() as con:
        row = con.execute("SELECT * FROM drivers WHERE driver_id=?", (driver_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Driver not found")
        result = public_result(row)
        sessions = con.execute(
            """SELECT id,timestamp,context_score,behavior_score,context_axis,
               behavior_axis,quadrant,decision,reasons_json
               FROM sessions WHERE driver_id=? ORDER BY id DESC LIMIT 10""",
            (driver_id,),
        ).fetchall()
        result["history"] = [
            {
                "session_id": s["id"], "timestamp": s["timestamp"],
                "context_score": s["context_score"], "behavior_score": s["behavior_score"],
                "context_axis": s["context_axis"], "behavior_axis": s["behavior_axis"],
                "quadrant": s["quadrant"], "decision": s["decision"],
                "reasons": decode_json(s["reasons_json"], []),
            } for s in sessions
        ]
        return result


@app.get("/v1/fleet/scores")
def fleet_scores() -> dict:
    with connect() as con:
        rows = con.execute(
            """SELECT driver_id, latest_result_json, updated_at FROM drivers
               ORDER BY updated_at DESC"""
        ).fetchall()
        drivers = []
        for row in rows:
            result = decode_json(row["latest_result_json"], {})
            drivers.append({
                "driver_id": row["driver_id"],
                "context_score": result.get("context_score"),
                "behavior_score": result.get("behavior_score"),
                "context_axis": result.get("context_axis", "insufficient_evidence"),
                "behavior_axis": result.get("behavior_axis", "insufficient_evidence"),
                "quadrant": result.get("quadrant", "unknown"),
                "decision": result.get("decision", "unknown"),
                "updated_at": row["updated_at"],
            })
        return {"count": len(drivers), "drivers": drivers}


@app.post("/v1/drivers/{driver_id}/declare-change")
def declare_change(driver_id: str, body: DeclareChange) -> dict:
    with connect() as con:
        row = con.execute("SELECT * FROM drivers WHERE driver_id=?", (driver_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Driver not found")

        latest_context = decode_json(row["latest_json"], {})
        declared = body.model_dump()
        # Only provided fields replace the current context; nulls are ignored.
        for key in ("device_id", "ip_subnet", "zone"):
            if declared.get(key) is not None:
                latest_context[key] = declared[key]

        con.execute(
            "UPDATE drivers SET latest_json=?, updated_at=? WHERE driver_id=?",
            (json.dumps(latest_context), now_iso(), driver_id),
        )
        write_event(con, driver_id, "context_change_declared", {
            "reason": body.reason,
            "new_context": latest_context,
        })
        return {
            "driver_id": driver_id,
            "status": "context_change_recorded",
            "context": latest_context,
            "note": "Next session will compare against the declared context; frozen identity anchor is unchanged.",
        }


@app.get("/v1/drivers/{driver_id}/events")
def driver_events(driver_id: str) -> dict:
    with connect() as con:
        exists = con.execute("SELECT 1 FROM drivers WHERE driver_id=?", (driver_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Driver not found")
        rows = con.execute(
            "SELECT timestamp,event_type,details_json FROM events WHERE driver_id=? ORDER BY id DESC LIMIT 50",
            (driver_id,),
        ).fetchall()
        return {"driver_id": driver_id, "events": [
            {"timestamp": r["timestamp"], "event_type": r["event_type"],
             "details": decode_json(r["details_json"], {})} for r in rows
        ]}
