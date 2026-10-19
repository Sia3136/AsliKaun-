# Backend Development Log — AsliKaun API

This log documents all architectural milestones, completed components, API contracts, security implementations, and verification suites established in the `backend/` module.

---

## 1. Module Overview & Responsibilities
The `backend/` service is built on **FastAPI** with **SQLite** persistence (`aslikaun.db`). It serves as the operational core of AsliKaun, responsible for:
- Continuous driver session telemetry ingestion.
- Evaluating context and behavioral signals via the two-axis intelligence engine (`ml_bridge.py`).
- Managing the dual-timescale baseline for registered drivers (fast adaptive baseline vs. frozen anchor baseline).
- Serving the administrative review queue, fleet trust scores, and audit events.
- Hosting and serving the frontend dashboard application via static file mounts.

---

## 2. Completed Architecture & Milestones

### A. Session Ingestion Pipeline (`/v1/sessions/ingest`)
- **Schema & Validation** (`SessionIngest`):
  - Ingests driver ID, device fingerprint (`device_id`), IP subnet (`ip_subnet`), geofenced zone (`zone`), 3-axis accelerometer and gyroscope time series, discrete touch gesture events, order acceptance latency (`accept_latency_ms`), and ISO timestamps.
- **Baseline Establishment**:
  - Automatically identifies whether a driver is new or uninitialized (`latest_result_json == "{}"`).
  - First authenticated session creates the baseline record with `decision = "baseline_established"`, `context_axis = "insufficient_evidence"`, and `behavior_axis = "insufficient_evidence"`.
  - Supports administrative pre-provisioning of driver profiles before live telemetry arrives.
- **Two-Axis Continuous Classification**:
  - Connects to `ml_bridge.py` to evaluate incoming sessions against historical fast and anchor baselines.
  - Generates context score ($0.0 - 1.0$), behavior score ($0.0 - 1.0$), and maps outcomes into four discrete quadrants:
    1. **`stable`** (`decision: continue`): Context and multi-modal behavior match verified history.
    2. **`legit_change`** (`decision: rebaseline`): Context changed (new phone/network) while physical behavior remained consistent.
    3. **`handoff_signature`** (`decision: challenge_at_safe_pause`): Known context with anomalous behavior signature — potential unauthorized account sharing/rental.
    4. **`ambiguous`** (`decision: step_up_check_at_safe_pause`): Both context and behavior drifted — step-up verification recommended.

### B. Security & Driver Token Lifecycle
- **Admin JWT Authentication**:
  - Secure `/v1/admin/login` endpoint issuing HS256 JWT tokens.
  - PBKDF2-SHA256 password hashing with constant-time verification.
  - Environment-based admin bootstrapping (`TRUST_JUGGLER_ADMIN_USERNAME`, `TRUST_JUGGLER_ADMIN_PASSWORD`).
- **Driver Token Provisioning**:
  - `/v1/admin/drivers/{driver_id}/driver-token` generates cryptographically secure 32-byte hex driver tokens.
  - Stored as SHA-256 hashes in `driver_tokens` table.
- **Driver Self-Service Change Declaration**:
  - `/v1/drivers/{driver_id}/declare-change` endpoint allows riders to declare planned device or zone transitions in advance.
  - Enforces `X-Driver-Token` header authentication to prevent unauthorized tampering.
  - Matches declarations against subsequent sessions, recording audit events (`context_change_declared`, `context_change_declaration_checked`).
- **Flexible Ingestion Authentication**:
  - Validates `X-Driver-Token` when provided, while permitting simulated and demo traffic to ingest telemetry seamlessly.

### C. Fleet Management & Review Queue
- **Automated Review Queue**:
  - Escalated sessions (`challenge_at_safe_pause`, `step_up_check_at_safe_pause`) are automatically routed to the `review_queue` table.
- **Queue Inspection & Resolution**:
  - `GET /v1/review-queue`: Filterable by status (`pending`, `resolved`) and `driver_id`.
  - `POST /v1/review-queue/{session_id}/resolve`: Resolves queued incidents with resolutions (`cleared`, `confirmed_handoff`, `needs_follow_up`) and persists reviewer notes for compliance audit.
- **Fleet Trust Scores**:
  - `GET /v1/fleet/scores`: Returns active driver fleet metrics, including latest context and behavior continuity scores, quadrant classifications, and timestamps.
- **Audit Logging**:
  - Dedicated `events` table recording all system triggers (baseline establishment, handoff escalations, rebaselines, declarations, and resolutions).

### D. Static Frontend Integration & Routing
- **Dashboard Mount**:
  - Mounts `frontend/` directory at `/dashboard` via FastAPI `StaticFiles`.
- **Convenience Redirects**:
  - Root path (`GET /`) redirects to `/dashboard/index.html`.
  - Legacy/direct path (`GET /dashboard.html`) redirects to `/dashboard/dashboard.html`.
- **CORS Support**:
  - Configured `CORSMiddleware` with configurable origins to support independent Vite/React dev server execution on alternate ports.

---

## 3. File Inventory
- [`backend/app/main.py`](file:///c:/Users/Dell/OneDrive/Documents/Siya/hackforge/backend/app/main.py): Primary FastAPI application, database schema definitions, API endpoints, and authentication handlers.
- [`backend/app/ml_bridge.py`](file:///c:/Users/Dell/OneDrive/Documents/Siya/hackforge/backend/app/ml_bridge.py): Bridge module integrating ML feature extraction, conformal scoring, and explainability into FastAPI request lifecycles.
- [`backend/tests/test_api.py`](file:///c:/Users/Dell/OneDrive/Documents/Siya/hackforge/backend/tests/test_api.py): End-to-end regression test suite covering health, session ingestion, baseline management, review queue resolution, and driver declarations.
- [`backend/requirements.txt`](file:///c:/Users/Dell/OneDrive/Documents/Siya/hackforge/backend/requirements.txt): Core backend dependencies (`fastapi`, `uvicorn`, `pydantic`).

---

## 4. Verification & Test Status
- **Test Command**: `python -m pytest -v backend/tests`
- **Current Status**: **All 6/6 tests passing**:
  1. `test_health_endpoint`: Verified service status endpoint.
  2. `test_first_session_establishes_baseline_and_stable_session_continues`: Verified dual-session progression.
  3. `test_context_change_with_stable_behavior_rebaselines`: Verified context shift with behavioral stability triggers rebaseline.
  4. `test_behavior_change_queues_review_and_admin_can_resolve`: Verified escalation and audit resolution.
  5. `test_admin_routes_reject_missing_token`: Verified 401 Unauthorized protection on administrative endpoints.
  6. `test_driver_declaration_requires_token_and_matches_next_session`: Verified token authorization and declaration matching.
