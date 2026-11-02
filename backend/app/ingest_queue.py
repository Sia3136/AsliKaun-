"""Redis Streams transport for durable asynchronous telemetry ingestion."""
from __future__ import annotations

import json
import os
import socket
import uuid
from datetime import datetime, timezone
from typing import Any

STREAM_NAME = os.getenv("ASLIKAUN_INGEST_STREAM", "aslikaun:telemetry")
CONSUMER_GROUP = os.getenv("ASLIKAUN_INGEST_CONSUMER_GROUP", "aslikaun-workers")


def _redis():
    url = os.getenv("REDIS_URL", "").strip()
    if not url:
        raise RuntimeError("REDIS_URL is required for asynchronous ingestion")
    import redis

    client = redis.Redis.from_url(url, decode_responses=True)
    client.ping()
    return client


def enqueue_job(driver_id: str, batch_id: str, payload: dict[str, Any]) -> str:
    from backend.app import database

    job_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()
    with database.connect() as con:
        existing = con.execute(
            "SELECT job_id FROM telemetry_batches WHERE batch_id=? AND driver_id=?",
            (batch_id, driver_id),
        ).fetchone()
        if existing and existing["job_id"]:
            return str(existing["job_id"])
        con.execute(
            """INSERT INTO telemetry_jobs
               (job_id, driver_id, batch_id, payload_json, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, 'queued', ?, ?)""",
            (job_id, driver_id, batch_id, json.dumps(payload), timestamp, timestamp),
        )
        con.execute(
            """INSERT INTO telemetry_batches
               (batch_id, driver_id, response_json, status, job_id, created_at)
               VALUES (?, ?, NULL, 'queued', ?, ?)
               ON CONFLICT(batch_id) DO NOTHING""",
            (batch_id, driver_id, job_id, timestamp),
        )
    try:
        client = _redis()
        client.xgroup_create(STREAM_NAME, CONSUMER_GROUP, id="0", mkstream=True)
    except Exception as exc:
        if "BUSYGROUP" not in str(exc):
            _mark_failed(job_id, f"Redis stream unavailable: {exc}")
            raise
    _redis().xadd(
        STREAM_NAME,
        {"job_id": job_id, "driver_id": driver_id, "batch_id": batch_id},
        maxlen=100000,
        approximate=True,
    )
    return job_id


def read_job(job_id: str) -> dict[str, Any] | None:
    from backend.app import database

    with database.connect() as con:
        row = con.execute(
            """SELECT job_id, driver_id, batch_id, status, attempts, error,
                      result_json, created_at, updated_at
               FROM telemetry_jobs WHERE job_id = ?""",
            (job_id,),
        ).fetchone()
    return dict(row) if row else None


def _mark_failed(job_id: str, error: str) -> None:
    from backend.app import database

    timestamp = datetime.now(timezone.utc).isoformat()
    with database.connect() as con:
        con.execute(
            "UPDATE telemetry_jobs SET status='failed', error=?, updated_at=? WHERE job_id=?",
            (error[:1000], timestamp, job_id),
        )


def run_worker(process_job, *, once: bool = False, consumer: str | None = None) -> None:
    client = _redis()
    consumer_name = consumer or f"{socket.gethostname()}-{os.getpid()}"
    try:
        client.xgroup_create(STREAM_NAME, CONSUMER_GROUP, id="0", mkstream=True)
    except Exception as exc:
        if "BUSYGROUP" not in str(exc):
            raise

    while True:
        messages = client.xreadgroup(
            CONSUMER_GROUP,
            consumer_name,
            {STREAM_NAME: ">"},
            count=1,
            block=5000,
        )
        if not messages:
            if once:
                return
            continue
        for _, entries in messages:
            for message_id, fields in entries:
                job_id = fields["job_id"]
                from backend.app import database

                with database.connect() as con:
                    row = con.execute(
                        "SELECT payload_json, attempts FROM telemetry_jobs WHERE job_id=?",
                        (job_id,),
                    ).fetchone()
                    if row:
                        con.execute(
                            "UPDATE telemetry_jobs SET status='processing', attempts=?, updated_at=? WHERE job_id=?",
                            (int(row["attempts"]) + 1, datetime.now(timezone.utc).isoformat(), job_id),
                        )
                try:
                    result = process_job(json.loads(row["payload_json"]))
                    timestamp = datetime.now(timezone.utc).isoformat()
                    with database.connect() as con:
                        con.execute(
                            """UPDATE telemetry_jobs
                               SET status='completed', result_json=?, updated_at=?
                               WHERE job_id=?""",
                            (json.dumps(result), timestamp, job_id),
                        )
                        con.execute(
                            """UPDATE telemetry_batches
                               SET status='completed', response_json=?
                               WHERE batch_id=?""",
                            (json.dumps(result), fields["batch_id"]),
                        )
                    client.xack(STREAM_NAME, CONSUMER_GROUP, message_id)
                except Exception as exc:
                    _mark_failed(job_id, str(exc))
                    client.xack(STREAM_NAME, CONSUMER_GROUP, message_id)
        if once:
            return
