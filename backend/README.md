# Trust Juggler — FastAPI backend starter

This is a hackathon prototype scaffold for the Trust Juggler two-axis model:
- **Context continuity:** device, IP subnet, zone.
- **Behavioral continuity:** multi-modal derived motion, touch, and operational biometrics via `ml_bridge`.
- **Decision quadrant:** `stable` (continue) / `legit_change` (re-baseline) / `handoff_signature` (challenge at safe pause) / `ambiguous` (step-up check).
- **Dual baselines:** a slowly adapting fast baseline and a frozen identity anchor.
- **Reason Vector:** Plain-language, rider-facing explanations powered by Claude (or fallback template).
- **Admin Review Queue & Auth:** Token-based admin authentication and human review resolution workflow.

## 1. Setup (Windows PowerShell)

```powershell
# From the repository root
python -m pip install -r requirements.txt
python -m uvicorn backend.app.main:app --reload --port 8000
```

- API Docs: `http://127.0.0.1:8000/docs`
- Interactive Dashboard: `http://127.0.0.1:8000/dashboard/`
- SQLite database `trust_juggler.db` is initialized automatically.

## 2. First request — establish a baseline

In Swagger, open `POST /v1/sessions/ingest` and use:

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

The first session only establishes a baseline. It does **not** issue a risk verdict.

## 3. Try a stable session

Send another session with the same context and similar behavior values. Expected direction: stable context + stable behavior → `continue`.

## 4. Try a context change

Send a session with a different `device_id` and `zone`, but similar behavior values. Expected direction: changed context + stable behavior → `rebaseline` (no challenge).

## 5. Try a behavior change

Keep device/IP/zone the same but change behavior features substantially, e.g. `accel: [2.0, 2.5, 2.2]`, `gyro: [1.5, 1.8]`, `touch_events` with many more items, and `accept_latency_ms: 3500`. Expected direction: stable context + changed behavior → `challenge_at_safe_pause`.

Thresholds are initial demo rules and must be tested/tuned against synthetic scenarios. A real mobile SDK should send derived features rather than raw sensor streams; this prototype accepts arrays only to make testing easy.

## Endpoints

- `GET /health`
- `POST /v1/sessions/ingest`
- `GET /v1/drivers/{driver_id}/score`
- `GET /v1/fleet/scores`
- `POST /v1/drivers/{driver_id}/declare-change`
- `GET /v1/drivers/{driver_id}/events`

The optional outbound webhook is not included yet; add it only after the core ingest/scoring loop works.
