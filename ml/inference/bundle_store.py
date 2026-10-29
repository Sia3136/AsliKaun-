"""Disk persistence, background asynchronous worker, and cache management for RiderModelBundle instances.

Ensures trained per-driver bundles survive server restarts, eliminates
redundant refits on every ingestion request, and offloads heavy retraining
to background worker threads so API request loops never block.
"""
from __future__ import annotations

import concurrent.futures
import logging
import os
import pickle
import time
from pathlib import Path
from typing import Any, Callable

logger = logging.getLogger("aslikaun.bundle_store")

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


class AsyncBundleWorker:
    """Threadpool manager for background model bundle fitting and non-blocking hot swaps."""

    def __init__(self, max_workers: int = 2):
        self._executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=max_workers,
            thread_name_prefix="aslikaun-bundle-worker",
        )
        self._active_tasks: dict[str, concurrent.futures.Future] = {}
        self._task_metadata: dict[str, dict] = {}

    def is_training(self, driver_id: str) -> bool:
        future = self._active_tasks.get(driver_id)
        if future is None:
            return False
        if future.done():
            self._active_tasks.pop(driver_id, None)
            self._task_metadata.pop(driver_id, None)
            return False
        return True

    def get_status(self, driver_id: str) -> dict:
        if self.is_training(driver_id):
            meta = self._task_metadata.get(driver_id, {})
            return {
                "driver_id": driver_id,
                "status": "training",
                "started_at": meta.get("started_at"),
                "n_sessions": meta.get("n_sessions", 0),
            }
        return {"driver_id": driver_id, "status": "idle"}

    def submit_fit(
        self,
        driver_id: str,
        enroll_sessions: list[dict],
        calib_sessions: list[dict],
        on_complete: Callable[[str, Any, int], None] | None = None,
    ) -> concurrent.futures.Future | None:
        """Dispatches bundle fitting to the background worker pool without blocking callers."""
        if self.is_training(driver_id):
            logger.info("Driver %s bundle fit already in progress; skipping redundant request", driver_id)
            return self._active_tasks.get(driver_id)

        n_sessions = len(enroll_sessions) + len(calib_sessions)
        self._task_metadata[driver_id] = {
            "started_at": time.time(),
            "n_sessions": n_sessions,
        }

        def _worker_task():
            from ml.inference.rider_model_bundle import RiderModelBundle

            t0 = time.time()
            try:
                bundle = RiderModelBundle.fit(enroll_sessions, calib_sessions)
                duration_ms = (time.time() - t0) * 1000.0
                save_bundle(
                    driver_id,
                    bundle,
                    n_sessions,
                    {
                        "fitted_at": time.time(),
                        "fit_duration_ms": round(duration_ms, 2),
                        "async_worker": True,
                    },
                )
                logger.info("Background bundle fit complete for driver %s (%.1f ms)", driver_id, duration_ms)
                if on_complete:
                    try:
                        on_complete(driver_id, bundle, n_sessions)
                    except Exception as cb_err:
                        logger.warning("on_complete callback failed for %s: %s", driver_id, cb_err)
                return bundle
            except Exception as e:
                logger.error("Background bundle fit failed for %s: %s", driver_id, e)
                raise
            finally:
                self._active_tasks.pop(driver_id, None)
                self._task_metadata.pop(driver_id, None)

        future = self._executor.submit(_worker_task)
        self._active_tasks[driver_id] = future
        return future


GLOBAL_BUNDLE_WORKER = AsyncBundleWorker(max_workers=2)
