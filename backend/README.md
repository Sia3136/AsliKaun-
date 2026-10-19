# AsliKaun — FastAPI Backend Service

This is the production-ready backend engine for the **AsliKaun** continuous identity intelligence platform:
- **Context continuity:** Device ID, IP subnet, and delivery zone verification.
- **Behavioral continuity:** Multi-modal derived motion, touch, GPS, and operational biometrics via `ml_bridge`.
- **Decision quadrant:** `stable` (continue) / `legit_change` (silent rebaseline) / `handoff_signature` (challenge at safe pause) / `ambiguous` (step-up check).
- **Dual baselines & Drift Tracking:** EWMA fast baseline, Frozen Identity Anchor, and time-series CUSUM drift detection.
- **Reason Vector:** Plain-language, auditor-verifiable explanations powered by Groq Cloud LLM (`qwen/qwen3.8-27b`) or structured fallback.
- **Safe-Pause Verification Gate:** Ensures verification challenges are only dispatched when the driver is at confirmed standstill ($v < 1.5\text{ m/s}$).
- **Admin Review Queue & RBAC:** Token-based admin authentication and human review resolution workflow.

## 1. Setup (Windows PowerShell)

```powershell
# From the repository root
python -m pip install -r requirements.txt
python -m uvicorn backend.app.main:app --reload --port 8000
```

- API Docs: `http://127.0.0.1:8000/docs`
- Interactive Dashboard: `http://127.0.0.1:8000/dashboard/`
- SQLite database `aslikaun.db` is initialized automatically with prewarmed model bundles.

## 2. Ingest Session

Open `POST /v1/sessions/ingest` in Swagger or curl:

```json
{
  "driver_id": "rider-001",
  "device_id": "phone-A",
  "ip_subnet": "192.168.1.0/24",
  "zone": "andheri-west",
  "accel": [0.2, 0.3, 0.25, 0.22],
  "gyro": [0.1, 0.12, 0.11],
  "touch_events": [{"type": "tap"}, {"type": "swipe"}, {"type": "tap"}],
  "accept_latency_ms": 820,
  "timestamp": "2026-10-17T10:00:00Z"
}
```

The first session establishes baseline centroids and calibration sets. Subsequent sessions yield real-time 4-quadrant scoring and continuity metrics.

## 3. Endpoints Overview

- `GET /health` — Service health and active database status.
- `POST /v1/sessions/ingest` — Ingest telemetry session and compute Two-Axis continuity.
- `GET /v1/drivers/{driver_id}/score` — Retrieve latest continuity scores and quadrant status.
- `GET /v1/fleet/scores` — Retrieve all active drivers for quadrant canvas visualization.
- `POST /v1/drivers/{driver_id}/declare-change` — Driver self-declared device or zone update.
- `GET /v1/drivers/{driver_id}/events` — Audit trail of session verdicts.
- `GET /v1/reviews/pending` — Escalated sessions awaiting human auditor review.
- `POST /v1/reviews/{review_id}/resolve` — Resolve review with verdict and notes.
