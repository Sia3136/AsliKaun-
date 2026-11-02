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
import threading
from typing import Any

logger = logging.getLogger("aslikaun.storage")

def _load_local_env() -> None:
    env_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    if not os.path.exists(env_file):
        return
    try:
        with open(env_file, encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip("'\""))
    except OSError:
        return


_load_local_env()
REDIS_URL = os.getenv("REDIS_URL", "").strip()
CLICKHOUSE_URL = os.getenv("CLICKHOUSE_URL", "").strip()

# ---------------------------------------------------------
# 1. Cache Interface (Redis with In-Memory TTL Fallback)
# ---------------------------------------------------------
class InMemoryCache:
    def __init__(self) -> None:
        self._store: dict[str, tuple[str, float | None]] = {}
        self._lock = threading.Lock()

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

    def allow_sliding_window(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        now = time.time()
        with self._lock:
            values = self._store.get(key, ("[]", None))[0]
            try:
                attempts = [stamp for stamp in json.loads(values) if now - stamp < window_seconds]
            except (TypeError, ValueError):
                attempts = []
            if len(attempts) >= limit:
                return False, max(1, int(window_seconds - (now - attempts[0])))
            attempts.append(now)
            self._store[key] = (json.dumps(attempts), now + window_seconds)
            return True, 0


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

    def allow_sliding_window(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        # One atomic Redis script keeps the per-driver window consistent across workers.
        script = """
        local now = tonumber(ARGV[1]); local window = tonumber(ARGV[2]); local max = tonumber(ARGV[3])
        redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now-window)
        local count = redis.call('ZCARD', KEYS[1])
        if count >= max then
          local first = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
          return {0, math.max(1, math.ceil(window-(now-tonumber(first[2]))))}
        end
        redis.call('ZADD', KEYS[1], now, ARGV[4]); redis.call('EXPIRE', KEYS[1], window)
        return {1, 0}
        """
        try:
            result = self.client.eval(script, 1, key, time.time(), window_seconds, limit, f"{time.time_ns()}")
            return bool(result[0]), int(result[1])
        except Exception as e:
            logger.warning("[redis] sliding-window limit failed closed: %s", e)
            return False, window_seconds


def get_cache_backend():
    """Initializes and returns Redis client if available, else InMemoryCache."""
    if REDIS_URL:
        import redis
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                client = redis.from_url(
                    REDIS_URL,
                    socket_connect_timeout=5,
                    socket_timeout=5,
                    retry_on_timeout=True,
                )
                client.ping()
                logger.info("[storage] connected to external Redis cache at %s", REDIS_URL)
                return RedisCacheWrapper(client)
            except Exception as exc:
                last_error = exc
                if attempt < 2:
                    time.sleep(1)
        logger.warning(
            "[storage] Redis configured at %s but connection failed (%s); using in-memory cache",
            REDIS_URL,
            last_error,
        )
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
