"""Disk persistence and cache management for RiderModelBundle instances.

Ensures trained per-driver bundles survive server restarts and eliminates
redundant refits on every ingestion request.
"""
from __future__ import annotations

import logging
import os
import pickle
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger("trust_juggler.bundle_store")

BUNDLES_DIR = Path(__file__).resolve().parents[1] / "weights" / "bundles"
BUNDLES_DIR.mkdir(parents=True, exist_ok=True)


def get_bundle_path(driver_id: str) -> Path:
    safe_id = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in driver_id)
    return BUNDLES_DIR / f"{safe_id}.pkl"


def has_persisted_bundle(driver_id: str) -> bool:
    return get_bundle_path(driver_id).exists()


def save_bundle(driver_id: str, bundle: Any, n_sessions: int, metadata: dict[str, Any] | None = None) -> Path:
    """Serializes a fitted RiderModelBundle and its metadata to disk."""
    path = get_bundle_path(driver_id)
    data = {
        "driver_id": driver_id,
        "n_sessions": n_sessions,
        "saved_at": time.time(),
        "bundle": bundle,
        "metadata": metadata or {},
    }
    tmp_path = path.with_suffix(".tmp")
    with open(tmp_path, "wb") as f:
        pickle.dump(data, f, protocol=pickle.HIGHEST_PROTOCOL)
    os.replace(tmp_path, path)
    logger.info("Persisted RiderModelBundle for driver %s (n=%d) to %s", driver_id, n_sessions, path)
    return path


def load_bundle(driver_id: str) -> tuple[int, Any, dict[str, Any]] | None:
    """Loads a persisted RiderModelBundle from disk.

    Returns:
        (n_sessions, bundle, metadata) if found and valid, else None.
    """
    path = get_bundle_path(driver_id)
    if not path.exists():
        return None
    try:
        with open(path, "rb") as f:
            data = pickle.load(f)
        return data["n_sessions"], data["bundle"], data.get("metadata", {})
    except Exception as e:
        logger.warning("Failed to load persisted bundle for driver %s: %s", driver_id, e)
        return None


def list_persisted_bundles() -> list[str]:
    """Returns list of driver_ids that have persisted bundles."""
    if not BUNDLES_DIR.exists():
        return []
    return [p.stem for p in BUNDLES_DIR.glob("*.pkl")]
