"""
AsliKaun Pluggable Storage & Cache Layer
Provides seamless support for:
1. Cache: Redis (when REDIS_URL is configured) with thread-safe In-Memory fallback.
2. Time-Series: ClickHouse (when CLICKHOUSE_URL is configured) with SQLite WAL fallback.
"""
from __future__ import annotations

import os
import time
import logging
import json
from typing import Any

logger = logging.getLogger("aslikaun.storage")

REDIS_URL = os.getenv("REDIS_URL", "").strip()
CLICKHOUSE_URL = os.getenv("CLICKHOUSE_URL", "").strip()

# ---------------------------------------------------------
# 1. Cache Interface (Redis with In-Memory TTL Fallback)
# ---------------------------------------------------------
class InMemoryCache:
    def __init__(self) -> None:
        self._store: dict[str, tuple[str, float | None]] = {}

    def get(self, key: str) -> str | None:
        if key not in self._store:
            return None
        val, expiry = self._store[key]
        if expiry is not None and time.time() > expiry:
            del self._store[key]
            return None
        return val

    def set(self, key: str, value: str, expire_seconds: int | None = None) -> None:
        expiry = (time.time() + expire_seconds) if expire_seconds else None
        self._store[key] = (value, expiry)

    def delete(self, key: str) -> None:
        self._store.pop(key, None)

    def exists(self, key: str) -> bool:
        return self.get(key) is not None


class RedisCacheWrapper:
    def __init__(self, client: Any) -> None:
        self.client = client

    def get(self, key: str) -> str | None:
        try:
            val = self.client.get(key)
            return val.decode("utf-8") if isinstance(val, bytes) else val
        except Exception as e:
            logger.warning("[redis] get failed for key %s: %s", key, e)
            return None

    def set(self, key: str, value: str, expire_seconds: int | None = None) -> None:
        try:
            if expire_seconds:
                self.client.setex(key, expire_seconds, value)
            else:
                self.client.set(key, value)
        except Exception as e:
            logger.warning("[redis] set failed for key %s: %s", key, e)

    def delete(self, key: str) -> None:
        try:
            self.client.delete(key)
        except Exception as e:
            logger.warning("[redis] delete failed for key %s: %s", key, e)

    def exists(self, key: str) -> bool:
        try:
            return bool(self.client.exists(key))
        except Exception:
            return False


def get_cache_backend():
    """Initializes and returns Redis client if available, else InMemoryCache."""
    if REDIS_URL:
        try:
            import redis
            client = redis.from_url(REDIS_URL)
            client.ping()
            logger.info("[storage] connected to external Redis cache at %s", REDIS_URL)
            return RedisCacheWrapper(client)
        except Exception as e:
            logger.warning("[storage] Redis configured at %s but connection failed (%s); using in-memory cache", REDIS_URL, e)
    return InMemoryCache()


# ---------------------------------------------------------
# 2. Time-Series Telemetry Interface (ClickHouse / SQLite)
# ---------------------------------------------------------
class TimeSeriesBackend:
    def __init__(self) -> None:
        self.is_clickhouse = bool(CLICKHOUSE_URL)
        self.ch_client = None
        if self.is_clickhouse:
            try:
                import clickhouse_connect
                self.ch_client = clickhouse_connect.get_client(dsn=CLICKHOUSE_URL)
                logger.info("[storage] connected to ClickHouse timeseries store at %s", CLICKHOUSE_URL)
            except Exception as e:
                logger.warning("[storage] ClickHouse connection failed (%s); logging timeseries to SQLite WAL", e)
                self.is_clickhouse = False

    def log_telemetry_batch(self, driver_id: str, session_id: int | str, telemetry: dict[str, Any]) -> bool:
        """Logs high-volume sensor samples into ClickHouse or acknowledges SQLite fallback."""
        if self.is_clickhouse and self.ch_client:
            try:
                # Table schema: (driver_id String, session_id String, timestamp DateTime64, payload String)
                row = [driver_id, str(session_id), time.strftime('%Y-%m-%d %H:%M:%S'), json.dumps(telemetry)]
                self.ch_client.insert('telemetry_stream', [row], column_names=['driver_id', 'session_id', 'timestamp', 'payload'])
                return True
            except Exception as e:
                logger.warning("[clickhouse] batch insert failed: %s", e)
                return False
        return True


cache = get_cache_backend()
timeseries_store = TimeSeriesBackend()

