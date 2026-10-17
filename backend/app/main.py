from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

try:
    from backend.app.ml_bridge import evaluate_session_ml
except ImportError:
    try:
        from app.ml_bridge import evaluate_session_ml
    except ImportError:
        evaluate_session_ml = None

DB_PATH = os.getenv("TRUST_JUGGLER_DB", "trust_juggler.db")
app = FastAPI(
    title="Trust Juggler API",
    description="Hackathon prototype: two-axis context and behavioral continuity.",
    version="0.2.0",
)

# Enable CORS for local development and dashboard access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set TRUST_JUGGLER_TOKEN_SECRET to a long random value before deployment.
# This fallback is only for local development and must not be used in production.
TOKEN_SECRET = os.getenv(
    "TRUST_JUGGLER_TOKEN_SECRET",
    "local-development-only-change-this-secret-before-deployment",
).encode("utf-8")
TOKEN_TTL_SECONDS = 8 * 60 * 60
PASSWORD_HASH_ITERATIONS = 310_000
bearer_scheme = HTTPBearer(auto_error=False)

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


class ResolveReview(BaseModel):
    resolution: str = Field(
        pattern="^(cleared|confirmed_handoff|needs_follow_up)$"
    )
    reviewer_note: str | None = Field(default=None, max_length=1000)


class AdminLogin(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=200)


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
        CREATE TABLE IF NOT EXISTS review_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL UNIQUE,
            driver_id TEXT NOT NULL,
            decision TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open',
            created_at TEXT NOT NULL,
            resolved_at TEXT,
            resolution TEXT,
            reviewer_id TEXT,
            reviewer_note TEXT
        );
        CREATE TABLE IF NOT EXISTS admin_users (
            username TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS driver_tokens (
            driver_id TEXT PRIMARY KEY,
            token_hash TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            rotated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS driver_change_declarations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            driver_id TEXT NOT NULL,
            device_id TEXT,
            ip_subnet TEXT,
            zone TEXT,
            reason TEXT NOT NULL,
            declared_at TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            checked_at TEXT,
            matched_session_id INTEGER,
            outcome_note TEXT
        );
        """)
        # Migrate databases created by earlier prototype versions.
        review_columns = {
            row["name"] for row in con.execute("PRAGMA table_info(review_queue)").fetchall()
        }
        if "reviewer_id" not in review_columns:
            con.execute("ALTER TABLE review_queue ADD COLUMN reviewer_id TEXT")
        if "reviewer_note" not in review_columns:
            con.execute("ALTER TABLE review_queue ADD COLUMN reviewer_note TEXT")


def hash_password(password: str, salt: bytes | None = None) -> str:
    """Return a salted PBKDF2-SHA256 password hash suitable for storage."""
    salt = salt or secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PASSWORD_HASH_ITERATIONS
    )
    return "pbkdf2_sha256${}${}${}".format(
        PASSWORD_HASH_ITERATIONS,
        base64.urlsafe_b64encode(salt).decode("ascii"),
        base64.urlsafe_b64encode(derived).decode("ascii"),
    )


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt_text, digest_text = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_text)
        salt = base64.urlsafe_b64decode(salt_text.encode("ascii"))
        expected = base64.urlsafe_b64decode(digest_text.encode("ascii"))
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt, iterations
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def b64url_decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def create_access_token(username: str) -> str:
    payload = {
        "sub": username,
        "exp": int(time.time()) + TOKEN_TTL_SECONDS,
    }
    encoded_payload = b64url_encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    )
    signature = hmac.new(
        TOKEN_SECRET, encoded_payload.encode("ascii"), hashlib.sha256
    ).digest()
    return f"{encoded_payload}.{b64url_encode(signature)}"


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        encoded_payload, encoded_signature = token.split(".", 1)
        expected_signature = hmac.new(
            TOKEN_SECRET, encoded_payload.encode("ascii"), hashlib.sha256
        ).digest()
        supplied_signature = b64url_decode(encoded_signature)
        if not hmac.compare_digest(expected_signature, supplied_signature):
            raise ValueError("Invalid token signature")
        payload = json.loads(b64url_decode(encoded_payload))
        if not isinstance(payload, dict) or not payload.get("sub"):
            raise ValueError("Invalid token payload")
        if int(payload.get("exp", 0)) <= int(time.time()):
            raise ValueError("Token expired")
        return payload
    except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired admin token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, str]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Admin authentication required. Log in to obtain a bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_payload = decode_access_token(credentials.credentials)
    username = str(token_payload["sub"])
    with connect() as con:
        admin = con.execute(
            "SELECT username, active FROM admin_users WHERE username = ?",
            (username,),
        ).fetchone()
    if admin is None or not admin["active"]:
        raise HTTPException(
            status_code=401,
            detail="Admin account is missing or disabled",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {"username": username}


def hash_driver_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def require_driver_token(driver_id: str, token: str | None) -> None:
    """Verify a provisioned driver token for this specific driver ID."""
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Driver token required in the X-Driver-Token header",
            headers={"WWW-Authenticate": "DriverToken"},
        )
    with connect() as con:
        row = con.execute(
            "SELECT token_hash, active FROM driver_tokens WHERE driver_id = ?",
            (driver_id,),
        ).fetchone()
    if (
        row is None
        or not row["active"]
        or not hmac.compare_digest(hash_driver_token(token), row["token_hash"])
    ):
        raise HTTPException(status_code=401, detail="Invalid or inactive driver token")


def seed_admin_from_env() -> None:
    """Create the first admin only when both credentials are configured."""
    username = os.getenv("TRUST_JUGGLER_ADMIN_USERNAME")
    password = os.getenv("TRUST_JUGGLER_ADMIN_PASSWORD")
    if not username and not password:
        print(
            "Trust Juggler admin login is not configured. Set "
            "TRUST_JUGGLER_ADMIN_USERNAME and TRUST_JUGGLER_ADMIN_PASSWORD."
        )
        return
    if not username or not password:
        raise RuntimeError(
            "Set both TRUST_JUGGLER_ADMIN_USERNAME and TRUST_JUGGLER_ADMIN_PASSWORD."
        )
    if len(password) < 12:
        raise RuntimeError("TRUST_JUGGLER_ADMIN_PASSWORD must be at least 12 characters.")
    with connect() as con:
        existing = con.execute(
            "SELECT username FROM admin_users WHERE username = ?", (username,)
        ).fetchone()
        if existing is None:
            con.execute(
                "INSERT INTO admin_users(username, password_hash, active, created_at) "
                "VALUES(?, ?, 1, ?)",
                (username, hash_password(password), now_iso()),
            )
            print(f"Created initial Trust Juggler admin account: {username}")


@app.on_event("startup")
def startup() -> None:
    init_db()
    seed_admin_from_env()


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


@app.post("/v1/admin/login")
def admin_login(body: AdminLogin) -> dict:
    """Authenticate an admin and return an expiring bearer token."""
    with connect() as con:
        admin = con.execute(
            "SELECT username, password_hash, active FROM admin_users WHERE username = ?",
            (body.username,),
        ).fetchone()

    if (
        admin is None
        or not admin["active"]
        or not verify_password(body.password, admin["password_hash"])
    ):
        # Keep the error generic so callers cannot distinguish unknown usernames.
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return {
        "access_token": create_access_token(admin["username"]),
        "token_type": "bearer",
        "expires_in": TOKEN_TTL_SECONDS,
    }


@app.get("/v1/admin/me")
def admin_me(admin: dict[str, str] = Depends(require_admin)) -> dict:
    return {"username": admin["username"], "role": "admin"}


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
            # First session establishes the starting baseline; no identity verdict yet.
            if evaluate_session_ml is not None:
                ml_eval = evaluate_session_ml(body, {})
                initial_behavior = ml_eval["current_behavior"]
                model_status = ml_eval["model_status"]
            else:
                initial_behavior = current_behavior
                model_status = "mock_behavior_scorer"

            con.execute(
                """INSERT INTO drivers(driver_id, anchor_json, fast_json, latest_json,
                   latest_result_json, updated_at) VALUES(?,?,?,?,?,?)""",
                (body.driver_id, json.dumps(initial_behavior), json.dumps(initial_behavior),
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
                "signals": {},
                "reasons": ["First session stored as multi-modal baseline; no risk verdict yet"],
                "model_status": model_status,
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

        # A pending declaration is supporting context only. It never bypasses scoring.
        pending_declaration = con.execute(
            """SELECT * FROM driver_change_declarations
               WHERE driver_id = ? AND status = 'pending'
               ORDER BY id DESC LIMIT 1""",
            (body.driver_id,),
        ).fetchone()

        declaration_reason: list[str] = []
        if pending_declaration is not None:
            declared_context = {
                "device_id": pending_declaration["device_id"],
                "ip_subnet": pending_declaration["ip_subnet"],
                "zone": pending_declaration["zone"],
            }
            declared_fields = {
                key: value for key, value in declared_context.items() if value is not None
            }
            declaration_matches = bool(declared_fields) and all(
                current_context.get(key) == value
                for key, value in declared_fields.items()
            )
            declaration_status = "matched" if declaration_matches else "not_matched"
            outcome_note = (
                "Declared context matched the observed session; declaration is not proof of identity."
                if declaration_matches
                else "Declared context did not fully match the observed session."
            )
            con.execute(
                """UPDATE driver_change_declarations
                   SET status = ?, checked_at = ?, matched_session_id = ?, outcome_note = ?
                   WHERE id = ? AND status = 'pending'""",
                (
                    declaration_status,
                    now_iso(),
                    None,  # Filled after the session row is inserted below.
                    outcome_note,
                    pending_declaration["id"],
                ),
            )
            declaration_reason.append(
                f"Driver declaration {declaration_status}: {outcome_note}"
            )

        previous_context = decode_json(driver["latest_json"], {})
        anchor_behavior = decode_json(driver["anchor_json"], {})
        fast_behavior = decode_json(driver["fast_json"], {})

        if evaluate_session_ml is not None:
            # Full ML Two-Axis evaluation with reason-vector explainability
            ml_eval = evaluate_session_ml(body, {
                "fast_behavior": fast_behavior,
                "anchor_behavior": anchor_behavior,
                "known_contexts": [previous_context],
            })
            context_score = ml_eval["context_score"]
            behavior_score = ml_eval["behavior_score"]
            context_axis = ml_eval["context_axis"]
            behavior_axis = ml_eval["behavior_axis"]
            quadrant = ml_eval["quadrant"]
            decision = ml_eval["decision"]
            reasons = ml_eval["reasons"] + declaration_reason
            signals = ml_eval["signals"]
            reason_vector = ml_eval.get("reason_vector")
            current_behavior = ml_eval["current_behavior"]
            model_status = ml_eval["model_status"]
        else:
            context_score, context_axis, context_reasons = compare_context(current_context, previous_context)
            fast_score, fast_axis, fast_reasons = mock_behavior_score(current_behavior, fast_behavior)
            anchor_score, anchor_axis, anchor_reasons = mock_behavior_score(current_behavior, anchor_behavior)
            available_scores = [s for s in (fast_score, anchor_score) if s is not None]
            behavior_score = min(available_scores) if available_scores else None
            if fast_axis == "insufficient_evidence" and anchor_axis == "insufficient_evidence":
                behavior_axis = "insufficient_evidence"
            elif "changed" in (fast_axis, anchor_axis):
                behavior_axis = "changed"
            else:
                behavior_axis = "stable"
            decision, quadrant = decide(context_axis, behavior_axis)
            reasons = (
                context_reasons
                + [f"Fast baseline: {r}" for r in fast_reasons]
                + [f"Frozen anchor: {r}" for r in anchor_reasons]
                + declaration_reason
            )
            signals = {}
            reason_vector = None
            model_status = "mock_behavior_scorer"

        # A declared or apparently legitimate context change with stable behavior gets
        # a context re-baseline. Keep the frozen anchor; update only the fast baseline.
        update_fast = decision in ("continue", "rebaseline")
        if update_fast:
            if isinstance(fast_behavior.get("operational"), dict):
                # Adaptive update for structured ML feature categories
                for cat in ("operational", "touch", "motion"):
                    cur_cat = current_behavior.get(cat, {})
                    fast_cat = fast_behavior.get(cat, {})
                    for k, val in cur_cat.items():
                        if val is not None and isinstance(val, (int, float)):
                            old_v = fast_cat.get(k)
                            fast_cat[k] = val if old_v is None else round(0.8 * float(old_v) + 0.2 * float(val), 4)
                    fast_behavior[cat] = fast_cat
            else:
                # Flat dictionary fallback
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
            "signals": signals,
            "reason_vector": reason_vector,
            "reasons": reasons,
            "model_status": model_status,
            "baseline_status": "fast_baseline_updated" if update_fast else "fast_baseline_frozen",
            "timestamp": body.timestamp.isoformat(),
        }

        session_cursor = con.execute(
            """INSERT INTO sessions(driver_id,timestamp,payload_json,context_score,
               behavior_score,context_axis,behavior_axis,quadrant,decision,reasons_json)
               VALUES(?,?,?,?,?,?,?,?,?,?)""",
            (body.driver_id, body.timestamp.isoformat(), json.dumps(payload_dict), context_score,
             behavior_score, context_axis, behavior_axis, quadrant, decision, json.dumps(reasons)),
        )
        session_id = session_cursor.lastrowid

        if pending_declaration is not None:
            con.execute(
                """UPDATE driver_change_declarations
                   SET matched_session_id = ?
                   WHERE id = ?""",
                (session_id, pending_declaration["id"]),
            )
            write_event(
                con,
                body.driver_id,
                "context_change_declaration_checked",
                {
                    "declaration_id": pending_declaration["id"],
                    "session_id": session_id,
                    "status": declaration_status,
                    "outcome_note": outcome_note,
                },
            )

        # Queue only decisions that require a human review.
        if decision in ("challenge_at_safe_pause", "step_up_check_at_safe_pause"):
            con.execute(
                """INSERT OR IGNORE INTO review_queue
                   (session_id, driver_id, decision, status, created_at)
                   VALUES (?, ?, ?, 'open', ?)""",
                (session_id, body.driver_id, decision, now_iso()),
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
def driver_score(
    driver_id: str, admin: dict[str, str] = Depends(require_admin)
) -> dict:
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
def fleet_scores(admin: dict[str, str] = Depends(require_admin)) -> dict:
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
def declare_change(
    driver_id: str,
    body: DeclareChange,
    x_driver_token: str | None = Header(default=None, alias="X-Driver-Token"),
) -> dict:
    """Record a driver's declared context change for comparison with the next session."""
    require_driver_token(driver_id, x_driver_token)

    declared_context = {
        key: value
        for key, value in {
            "device_id": body.device_id,
            "ip_subnet": body.ip_subnet,
            "zone": body.zone,
        }.items()
        if value is not None
    }
    if not declared_context:
        raise HTTPException(
            status_code=422,
            detail="Provide at least one of device_id, ip_subnet, or zone.",
        )

    with connect() as con:
        row = con.execute(
            "SELECT driver_id FROM drivers WHERE driver_id = ?", (driver_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Driver not found")

        # Supersede an older pending declaration so only the newest one is evaluated.
        con.execute(
            """UPDATE driver_change_declarations
               SET status = 'superseded', checked_at = ?,
                   outcome_note = 'Superseded by a newer declaration.'
               WHERE driver_id = ? AND status = 'pending'""",
            (now_iso(), driver_id),
        )
        cursor = con.execute(
            """INSERT INTO driver_change_declarations(
                   driver_id, device_id, ip_subnet, zone, reason, declared_at, status
               ) VALUES(?, ?, ?, ?, ?, ?, 'pending')""",
            (
                driver_id,
                body.device_id,
                body.ip_subnet,
                body.zone,
                body.reason,
                now_iso(),
            ),
        )
        declaration_id = cursor.lastrowid
        write_event(
            con,
            driver_id,
            "context_change_declared",
            {
                "declaration_id": declaration_id,
                "reason": body.reason,
                "declared_context": declared_context,
                "status": "pending",
            },
        )

    return {
        "driver_id": driver_id,
        "declaration_id": declaration_id,
        "status": "pending",
        "declared_context": declared_context,
        "note": (
            "Declaration recorded. The next observed session will be compared against it; "
            "the declaration does not change the stored observed context or prove identity."
        ),
    }


@app.post("/v1/admin/drivers/{driver_id}/driver-token")
def issue_driver_token(
    driver_id: str,
    admin: dict[str, str] = Depends(require_admin),
) -> dict:
    """Create or rotate a driver token. The raw token is shown only once."""
    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_driver_token(raw_token)
    timestamp = now_iso()

    with connect() as con:
        driver = con.execute(
            "SELECT driver_id FROM drivers WHERE driver_id = ?", (driver_id,)
        ).fetchone()
        if driver is None:
            # Admin provisioning is the trust boundary: create the driver record before
            # issuing a token, so unauthenticated clients cannot claim a new driver ID.
            con.execute(
                """INSERT INTO drivers(driver_id, anchor_json, fast_json, latest_json,
                   latest_result_json, updated_at) VALUES(?, '{}', '{}', '{}', '{}', ?)""",
                (driver_id, timestamp),
            )

        existing = con.execute(
            "SELECT driver_id FROM driver_tokens WHERE driver_id = ?", (driver_id,)
        ).fetchone()
        if existing is None:
            con.execute(
                """INSERT INTO driver_tokens(
                       driver_id, token_hash, active, created_at, rotated_at
                   ) VALUES(?, ?, 1, ?, NULL)""",
                (driver_id, token_hash, timestamp),
            )
            action = "driver_token_created"
        else:
            con.execute(
                """UPDATE driver_tokens
                   SET token_hash = ?, active = 1, rotated_at = ?
                   WHERE driver_id = ?""",
                (token_hash, timestamp, driver_id),
            )
            action = "driver_token_rotated"

        write_event(
            con,
            driver_id,
            action,
            {"admin_username": admin["username"], "timestamp": timestamp},
        )

    return {
        "driver_id": driver_id,
        "driver_token": raw_token,
        "header_name": "X-Driver-Token",
        "note": "Copy this token now. It is stored as a hash and cannot be retrieved later.",
    }


@app.get("/v1/admin/drivers/{driver_id}/declarations")
def list_driver_declarations(
    driver_id: str,
    limit: int = 100,
    admin: dict[str, str] = Depends(require_admin),
) -> dict:
    """Admin-only history of driver context declarations and their outcomes."""
    limit = max(1, min(limit, 500))
    with connect() as con:
        exists = con.execute(
            "SELECT 1 FROM drivers WHERE driver_id = ?", (driver_id,)
        ).fetchone()
        if exists is None:
            raise HTTPException(status_code=404, detail="Driver not found")
        rows = con.execute(
            """SELECT id AS declaration_id, driver_id, device_id, ip_subnet, zone,
                      reason, declared_at, status, checked_at, matched_session_id,
                      outcome_note
               FROM driver_change_declarations
               WHERE driver_id = ? ORDER BY id DESC LIMIT ?""",
            (driver_id, limit),
        ).fetchall()
    return {"driver_id": driver_id, "count": len(rows), "declarations": [dict(r) for r in rows]}


@app.get("/v1/drivers/{driver_id}/events")
def driver_events(
    driver_id: str, admin: dict[str, str] = Depends(require_admin)
) -> dict:
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


# ---------- Admin review workflow (authentication-protected) ----------

@app.get("/v1/review-queue")
def get_review_queue(
    status: str = "open",
    limit: int = 100,
    driver_id: str | None = None,
    admin: dict[str, str] = Depends(require_admin),
) -> dict:
    """List review items. Supports status=open|resolved|all and optional driver_id."""
    if status not in ("open", "resolved", "all"):
        raise HTTPException(
            status_code=400,
            detail="status must be open, resolved, or all",
        )

    limit = max(1, min(limit, 500))
    query = """SELECT q.id AS review_id, q.session_id, q.driver_id, q.decision,
                      q.status, q.created_at, q.resolved_at, q.resolution,
                      q.reviewer_id, q.reviewer_note,
                      s.timestamp AS session_timestamp, s.context_score,
                      s.behavior_score, s.context_axis, s.behavior_axis,
                      s.quadrant, s.reasons_json
               FROM review_queue q
               JOIN sessions s ON s.id = q.session_id"""
    clauses = []
    params: list[Any] = []

    if status != "all":
        clauses.append("q.status = ?")
        params.append(status)
    if driver_id:
        clauses.append("q.driver_id = ?")
        params.append(driver_id)
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY q.created_at DESC LIMIT ?"
    params.append(limit)

    with connect() as con:
        rows = con.execute(query, tuple(params)).fetchall()

    reviews = []
    for row in rows:
        item = dict(row)
        item["reasons"] = decode_json(item.pop("reasons_json"), [])
        reviews.append(item)

    return {"count": len(reviews), "reviews": reviews}


@app.get("/v1/review-queue/{session_id}")
def get_review_details(
    session_id: int, admin: dict[str, str] = Depends(require_admin)
) -> dict:
    """Return the review item and associated session evidence for admin inspection."""
    with connect() as con:
        row = con.execute(
            """SELECT q.id AS review_id, q.session_id, q.driver_id, q.decision,
                      q.status, q.created_at, q.resolved_at, q.resolution,
                      q.reviewer_id, q.reviewer_note,
                      s.timestamp AS session_timestamp, s.payload_json,
                      s.context_score, s.behavior_score, s.context_axis,
                      s.behavior_axis, s.quadrant, s.reasons_json
               FROM review_queue q
               JOIN sessions s ON s.id = q.session_id
               WHERE q.session_id = ?""",
            (session_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Review item not found")

    item = dict(row)
    item["reasons"] = decode_json(item.pop("reasons_json"), [])
    item["session_payload"] = decode_json(item.pop("payload_json"), {})
    return item


@app.post("/v1/review-queue/{session_id}/resolve")
def resolve_review(
    session_id: int,
    body: ResolveReview,
    admin: dict[str, str] = Depends(require_admin),
) -> dict:
    """Resolve an open review and write an audit event."""
    with connect() as con:
        review = con.execute(
            "SELECT * FROM review_queue WHERE session_id = ?",
            (session_id,),
        ).fetchone()

        if review is None:
            raise HTTPException(status_code=404, detail="Review item not found")
        if review["status"] == "resolved":
            raise HTTPException(status_code=409, detail="Review item is already resolved")

        resolved_at = now_iso()
        con.execute(
            """UPDATE review_queue
               SET status='resolved', resolved_at=?, resolution=?,
                   reviewer_id=?, reviewer_note=?
               WHERE session_id=? AND status='open'""",
            (
                resolved_at,
                body.resolution,
                admin["username"],
                body.reviewer_note,
                session_id,
            ),
        )
        write_event(
            con,
            review["driver_id"],
            "review_resolved",
            {
                "session_id": session_id,
                "original_decision": review["decision"],
                "resolution": body.resolution,
                "reviewer_id": admin["username"],
                "reviewer_note": body.reviewer_note,
                "resolved_at": resolved_at,
            },
        )

    return {
        "session_id": session_id,
        "driver_id": review["driver_id"],
        "status": "resolved",
        "resolution": body.resolution,
        "reviewer_id": admin["username"],
        "resolved_at": resolved_at,
    }


# ---------- Frontend Dashboard Static Mount ----------
_FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
if _FRONTEND_DIR.exists():
    app.mount("/dashboard", StaticFiles(directory=str(_FRONTEND_DIR), html=True), name="dashboard")


@app.get("/", include_in_schema=False)
def root_redirect() -> Any:
    if _FRONTEND_DIR.exists():
        return RedirectResponse(url="/dashboard/")
    return {"message": "Trust Juggler API is running. Visit /docs for OpenAPI specs."}

