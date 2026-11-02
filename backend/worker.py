"""Run the Redis Streams telemetry worker.

Usage:
    python -m backend.worker
"""
from __future__ import annotations

import asyncio
import os

from backend.app.ingest_queue import run_worker
from backend.app.main import SessionIngest, ingest_session


def process_job(payload: dict):
    body = SessionIngest.model_validate(payload["body"])
    return ingest_session(
        body,
        x_driver_token=payload.get("driver_token"),
        x_telemetry_batch_id=payload.get("batch_id"),
        x_internal_worker=True,
    )


if __name__ == "__main__":
    run_worker(process_job)
