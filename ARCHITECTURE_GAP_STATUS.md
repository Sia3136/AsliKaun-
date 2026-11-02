# Architecture gap status

This repository is a working prototype. The checklist below separates capabilities present in this checkout from production changes that need an infrastructure or native-client project. A 50,000 request/second capacity claim is not established by this codebase.

## Changes made in this checkout

- `/v1/sessions/ingest` now applies a per-driver sliding window (12 batches per minute by default), returns HTTP 429 with `Retry-After`, and uses the shared Redis cache when Redis is configured. The in-memory fallback is suitable only for a single process.
- Raw sensor payloads are now purged after 48 hours by default, configurable with `ASLIKAUN_RAW_RETENTION_HOURS`, with an hourly lifespan task as well as startup cleanup. Aggregated session scores remain.
- The mobile web client already has an encrypted IndexedDB outbox with retries, 50 Hz interpolation, reduced sampling when hidden/low battery, a verification screen, and challenge polling. The fleet investigation drawer already renders historical score trajectories.

## Still required before production

### Backend

- Ingestion still runs inference and state transitions in the HTTP request. Introduce a durable Kafka/Redis Streams queue, return 202 with a job ID, and move inference to independently scaled workers. Update the SDK to poll/stream job results before considering that queue end-to-end.
- `main.py` still performs core CRUD directly against SQLite. `storage.py` currently abstracts cache and telemetry writes only; `CLICKHOUSE_URL` does not switch driver/session/incident CRUD. Define complete repository interfaces and migrations before supporting `STORAGE_TYPE` switching. ClickHouse should not be used as the transactional state store for pause/challenge transitions.
- Tenant isolation is absent from core tables and token claims. Add tenant IDs, tenant-scoped foreign keys and queries, organization membership/roles, and database-level isolation in a database that supports row-level security. SQLite is not a row-level-security database.
- Device IDs remain client supplied. Add public-key enrollment and signature verification with canonical payloads, timestamps, nonce/replay protection, key rotation/revocation, and Android Keystore/iOS Secure Enclave signing before accepting production telemetry.
- Safe-pause transitions span multiple SQLite writes and are not protected by a distributed optimistic version check. Use a transactional state version and compare-and-swap update in the selected transactional database; test concurrent answer/movement/refusal paths.
- Redis rate limiting requires a reachable Redis service in a multi-worker deployment. Configure `REDIS_URL`, fail closed for production if unavailable, and add gateway body-size limits/WAF controls. The local fallback cannot coordinate across processes.
- The code retains face enrollment embeddings and biometric-derived signals. Obtain jurisdiction-specific privacy/legal review, record purpose-specific explicit consent and withdrawal, implement deletion/export workflows and retention controls for every biometric artifact, and ensure demo/training data is not mixed with production tenants. A 48-hour raw telemetry policy alone does not establish GDPR/BIPA compliance.

### Client and operations

- The current mobile app is a browser-based prototype. It cannot guarantee background collection or retries after OS suspension. Build and validate Android foreground-service and iOS native/background capability implementations; web behavior remains best effort.
- Adaptive sampling and interpolation exist in the web SDK, but device battery/thermal impact and OEM sample jitter have not been validated on a representative device lab.
- Deploy and load-test the queue, workers, Redis, transactional database, gateway, observability, and regional ingest routing. Measure end-to-end p95/p99 latency and recovery under worker/database outages before setting capacity targets.

## Configuration

- `ASLIKAUN_INGEST_LIMIT_PER_MINUTE` (default `12`)
- `ASLIKAUN_RAW_RETENTION_HOURS` (default `48`)
- `REDIS_URL` (shared limiter/cache in multi-process deployments)

These changes improve local protections and retention; they do not turn the current synchronous SQLite prototype into a distributed 50,000 request/second system.
