# AsliKaun — Features

**v1** — 2026-11-05. What the product does, how each piece was built, and how to exercise it yourself. Written from a direct audit of the code, not from memory of what was planned. The API (backend + ML) is the product being marketed; the mobile app is a demo of an integration, and the admin dashboard is a reference implementation proving the API works — see `CONTEXT.md` for the positioning note and full fix history.

---

## 1. Core idea

A driver/rider account can be handed off mid-shift to someone else (rented, shared, or stolen accounts). AsliKaun scores every delivery session on two axes — **context continuity** (same device/IP/zone) and **behavioral continuity** (same person's motion, touch, timing patterns) — and only escalates to a driver-facing identity challenge when both look wrong together, not on a single noisy signal.

---

## 2. Session scoring pipeline

**Entry point:** `POST /v1/sessions/ingest` (`backend/app/main.py`)

1. The mobile app batches sensor telemetry and POSTs it here (also queued durably via `backend/app/ingest_queue.py` → Redis Streams when `REDIS_URL` is set, otherwise synchronous).
2. First session for a driver establishes a baseline (`decision: "baseline_established"`), no verdict yet.
3. Every later session is scored by whichever evaluator applies:
   - **`evaluate_session_with_real_models`** (`backend/app/ml_bridge.py`) — the real trained pipeline. Needs ≥15 stored raw sessions to fit a per-driver `RiderModelBundle` (`ml/inference/rider_model_bundle.py`). Bundles are cached per driver and only refit every 5 new sessions, not on every request.
   - **`evaluate_session_ml`** — a heuristic fallback (mean-vector anomaly scoring) used before enough history exists or if the real pipeline errors.
   - A final mock fallback if neither ML module imports at all.
4. Two more layers run regardless of which evaluator produced the base verdict:
   - **`DriverTimeSeriesProfiler`** (`ml/timeseries/driver_timeseries.py`) — online drift tracking. Distinguishes legitimate gradual drift (habituation, fatigue) which it silently assimilates into the baseline, from a "boiling-frog" slow-poisoning attack which it caps and forces a challenge on, from a sudden abrupt step-change (likely handoff), from a diurnal bimodal split (likely split-shift sharing, flagged for audit).
   - **`FrozenAnchorDetector`** (`ml/redteam/detectors.py`, persisted via `driver_anchor_state` table) — a simpler, older cumulative-drift-vs-frozen-baseline check. **Runs alongside the profiler above — see CONTEXT.md's "overlap" note; this is redundant, not a second opinion by design.**
5. **Per-signal models** (`ml/models/*.py`, `ml/features/*.py`):
   - Touch — GRU triplet-loss encoder, trained on H-MOG, beats classical baseline on held-out data.
   - Motion (accelerometer) — GRU triplet-loss encoder, same training approach, the strongest single signal.
   - GPS — tries a triplet encoder fed by live stop-segmentation (detects delivery stops from the raw point stream to reconstruct ODIDMob-style route legs); falls back to a simpler 4-feature classical extractor per-driver if too few stops are detected.
   - Operational (accept latency, time-of-day) — classical IsolationForest, no deep model needed.
6. **Fusion**: per-signal conformal p-values combined via **Fisher's method** (`ml/calibration/fusion.py`), not a naive average — requires multiple signals to independently look anomalous before escalating.
7. **Decision**: `ml/combiner/two_axis.py`'s 2×2 matrix (`stable` / `legit_change` / `handoff_signature` / `ambiguous`) → backend decision vocabulary (`continue` / `rebaseline` / `challenge_at_safe_pause` / `step_up_check_at_safe_pause`).

**Try it:** seed ~15+ sessions for a driver via repeated `POST /v1/sessions/ingest` calls, then check `model_status` in the response — it reads `ml_real_trained_models` once the real pipeline activates, `ml_two_axis_fusion` before that.

---

## 3. Mid-trip safe-pause challenge (selfie step-up)

**The feature:** when a session escalates to `challenge_at_safe_pause` / `step_up_check_at_safe_pause`, the driver app is told to ask for a live selfie, checked against an enrolled reference photo. A clear match auto-clears the escalation in real time; anything else (no face detected, no match, no enrollment on file) is left for a human reviewer — the system never auto-bans on a failed/inconclusive match.

**Backend (`backend/app/main.py`, `backend/app/ml_bridge.py`):**
- `GET /v1/drivers/{id}/challenge-status` — polled by the driver app. Returns `challenge_pending: bool`, gated on three things: the decision is actually escalated, the driver hasn't hit the **challenge fatigue cap** (3 challenges/24h — beyond that it stops prompting the driver and goes straight to priority human review instead, so repeated step-ups don't push an honest driver off the platform), and `safe_pause_info.safe_to_prompt` (the vehicle isn't moving — see §4).
- `POST /v1/drivers/{id}/challenge/respond` — accepts a base64 selfie, embeds it via `ml/models/face_verification.py` (MTCNN + FaceNet/InceptionResnetV1, pretrained on VGGFace2), compares against the enrolled embedding (cosine similarity, threshold 0.6). `outcome: "cleared"` auto-resolves the review queue entry and resets the frozen-anchor/drift state; anything else returns `outcome: "human_review"`.
- `POST /v1/drivers/{id}/face-enroll` — admin-gated, stores a driver's reference face embedding.

**Frontend (`frontend/mobile-app/src/App.tsx`, `telemetry.ts`):**
- Polls `getChallengeStatus()` every 15s while online; auto-navigates to the verification screen when a challenge is pending.
- Captures a **live** selfie via `getUserMedia` (not a file picker), draws it to a canvas, sends it through `respondToChallenge()`.
- `stage === "safe"` → camera capture → `stage === "progress"` → `"success"` / `"review"` / `"failed"` depending on outcome.

**Fixed in v1** (was: silently disabled on real-device/LAN testing — see `CONTEXT.md` for the root-cause chain). `telemetry.ts` now also recognizes private-LAN hostnames for the non-secret demo token fallback, and a config problem (missing token / non-HTTPS) now surfaces as a distinct `config_error` outcome instead of being indistinguishable from an actual verification failure. A recoverable bad photo (`no_face_detected`) now offers an immediate retake instead of a dead-end "under review" screen.

---

## 4. Pause-aware safety timing

A challenge is never shown mid-drive. `main.py`'s ingest flow computes `safe_pause_info` once, from `body.vehicle_speed_mph`:
- Moving (>2 mph): `safe_to_prompt: false`, `status: "deferred_vehicle_moving"` — challenge queued but not shown.
- Stopped: `safe_to_prompt: true` — safe to prompt.

**Caveat, confirmed by reading the code:** the mobile app's telemetry payload always sends `vehicle_speed_mph: null`, so `vehicle_speed` defaults to `0.0` and `is_moving` is always `False` in practice right now. The safety gate exists and is correctly wired, but currently has no real speed signal to gate on — it's a no-op until GPS-derived or device speed is actually plumbed into the payload.

---

## 5. Driver consent and data retention

- `POST /v1/drivers/{id}/consent` / `/consent/revoke` / `GET .../consent` — explicit consent lifecycle for "precision mode" (raw GPS points + full touch gesture paths instead of just coarse zone + tap summaries). Declining keeps the driver on standard coarse-only telemetry; nothing is blocked.
- Raw session payloads are purged after a configurable window (`ASLIKAUN_RAW_RETENTION_HOURS`, default 48h per `ARCHITECTURE_GAP_STATUS.md` — note this superseded an earlier 30-day default). Scored summaries (decision, quadrant, scores) are kept indefinitely for admin/graph history.

---

## 6. Split-rental detection (on-demand audit)

`GET /v1/admin/drivers/{id}/split-rental-check` (admin-gated) — fits a 2-component Gaussian mixture on a driver's operational+touch history; flags `split_rental_suspected: true` when two clusters fit meaningfully better than one AND correlate with time of day (e.g. a consistent morning-driver/evening-driver split). Needs ≥20 sessions. Live-verified: correctly flags a synthetic bimodal driver, correctly clears an honest single-pattern driver.

---

## 7. Outbound ops webhook

`ASLIKAUN_OPS_WEBHOOK_URL` (or legacy `TRUST_JUGGLER_OPS_WEBHOOK_URL`) env var — when set, every high-risk escalation is POSTed to it (Slack/PagerDuty/generic) instead of relying on someone watching the dashboard. `GET /v1/admin/webhook-status` / `POST /v1/admin/webhook-test` let an admin verify the integration. Fire-and-forget — a failing webhook never blocks ingest.

---

## 8. A second, parallel verification system (exists, not wired to the frontend)

`POST /v1/drivers/{id}/verification`, `GET /v1/drivers/{id}/verification/{challenge_id}`, `POST /v1/admin/drivers/{id}/verification/{challenge_id}` — a `verification_requests`-table-backed flow explicitly designed to **never store or auto-match face images**; it logs that a capture happened and waits for an admin or external liveness provider to decide. This looks like the intended privacy-conscious replacement for §3's automated face-match flow, but **no frontend code calls it** — confirmed by a repo-wide search. See the error report.

---

## 9. Device identity (Ed25519 enrollment)

`backend/app/device_auth.py` + `POST /v1/admin/drivers/{id}/device-keys` / `.../revoke` — Ed25519 keypair enrollment per device, canonical-payload signature verification. This is the real beginning of "stop trusting client-supplied device IDs." Not yet the default enforced path for `/v1/sessions/ingest` — verify current enforcement state before relying on it as a hard guarantee.

---

## 10. Infrastructure layer

- `backend/app/storage.py` — pluggable cache (Redis, in-memory fallback) and time-series store (ClickHouse, SQLite WAL fallback).
- `backend/app/ingest_queue.py` — Redis Streams durable queue for async ingestion; `GET /v1/sessions/jobs/{job_id}` to poll a queued job.
- `backend/app/database.py` — Postgres-or-SQLite driver selection via `DATABASE_URL`.
- `backend/app/tenant_context.py` — a `ContextVar`-based tenant id, present but per `ARCHITECTURE_GAP_STATUS.md`'s own admission, not yet enforced as real row-level isolation anywhere in the core tables.

These are real, running code — not stubs — but per the project's own `ARCHITECTURE_GAP_STATUS.md`, they're explicitly flagged as not yet load-bearing for a true multi-tenant production deployment. Trust that document's self-assessment over any claim that these alone make the system "production scale."

---

## 11. Frontend applications

Three separate frontend projects exist under `frontend/`:
- **`frontend/admin-operations/`** — **confirmed live**: `frontend/fleet-dashboard.html`'s script tag loads `/admin-operations/src/main.tsx` directly. This is the actual admin dashboard source, built via the root `frontend/` project into `frontend/dist/`, which `backend/app/main.py` serves. Single dark theme only as of v1 (the light-mode toggle was removed — see `CONTEXT.md`).
- **`frontend/mobile-app/`** — the live driver phone app (React + Vite), covered in §3. Builds to its own `dist/`, runs on port 8443.
- **`frontend/fleet-dashboard/`** — a separate subproject with its own `src/`. **Still not confirmed to be wired into what `main.py` actually serves** — verify before assuming it's live.

---

## 12. How to run and test locally

```powershell
. "C:\Users\Dell\anaconda3\shell\condabin\conda-hook.ps1"; conda activate base
cd C:\Users\Dell\OneDrive\Documents\Siya\hackforge
python -m pytest backend/tests/ -q
```

Run pytest **from the repo root**, not from `backend/` — the project's `pytest.ini` (`pythonpath = .`) makes this work from either location now.

**One command, everything live:**
```powershell
.\start-dev.ps1
```
Starts the backend (`:8000`), the driver mobile app (`:8443`), and the admin dashboard (`:3000`) together. Previously this script never started the mobile app, so the dashboard's "Driver app" button opened a dead port — fixed in v1.

Or individually:
```powershell
$env:KMP_DUPLICATE_LIB_OK="TRUE"
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Then `npm --prefix frontend run dev` (admin dashboard) and/or `npm --prefix frontend/mobile-app run dev` (driver app).

---

## 13. Seed / demo data (documented, v1)

`backend/app/main.py`'s `seed_demo_fleet()` creates exactly **4 drivers** on first startup (only if the `drivers` table is empty). The admin dashboard's hardcoded decorative fallback data (`INITIAL_DRIVERS`/`INITIAL_CASES` in `frontend/admin-operations/src/App.tsx`) is kept in sync with these same 4 IDs — previously it had 5 additional fictional drivers with no backend counterpart; those were removed in v1 (see `CONTEXT.md`).

| Driver ID | Story | Context score | Behavior score | Quadrant | Decision |
|---|---|---|---|---|---|
| `rider-001` | Stable, normal route/behavior | 0.94 | 0.92 | `stable` | `continue` |
| `rider-014` | Legit device upgrade, same person | 0.28 | 0.89 | `legit_change` | `rebaseline` |
| `rider-042` | Same device, sudden high tap pressure/jerk — handoff | 0.92 | 0.31 | `handoff_signature` | `challenge_at_safe_pause` |
| `rider-088` | Both IP and touch velocity changed — ambiguous | 0.35 | 0.42 | `ambiguous` | `step_up_check_at_safe_pause` |

If you add or change seeded drivers, update **both** `seed_demo_fleet()` in `backend/app/main.py` and `INITIAL_DRIVERS`/`INITIAL_CASES`/`SEEDED_DRIVER_IDS` in `frontend/admin-operations/src/App.tsx` together — keeping them in sync is what makes the dashboard's narrative (driver names, device stories, reasons) consistent with what the backend actually computes, instead of drifting into fiction again.

Everything else visible in the dashboard beyond these 4 drivers (e.g. `sim-*` IDs) comes from genuinely running the Simulator page's scenario cards, or from real `/v1/sessions/ingest` calls — not from additional hardcoded fiction.
