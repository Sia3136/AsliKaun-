# AsliKaun — Project Context

**v1** — 2026-11-05. Honest state-of-the-project, written from direct code audits and live testing across three passes the same day. See `FEATURES.md` for what each piece does and the documented seed dataset; this is about how well the whole thing hangs together and what's been fixed vs. still open.

**Positioning note:** the API (backend + ML pipeline) is the product being marketed. The mobile app is a demo of what a real integration looks like, not a deliverable itself. The admin dashboard's job is to be a credible, honest reference implementation proving the API works — not to look impressive with fabricated numbers. That framing drove most of this round's fixes.

---

## What's genuinely done and solid

- **The core ML signal science is real and validated**, not hand-waved: touch and motion triplet-loss encoders beat their classical baselines on held-out H-MOG data; Fisher fusion measurably outperforms single-signal scoring; conformal p-value calibration and per-rider thresholds are implemented correctly, not just claimed.
- **The two-axis decision model is principled** — it won't escalate on a single noisy signal, which is the right instinct for a system whose false positives directly harm honest drivers' livelihoods.
- **Fatigue capping and the auto-clear-on-match / human-review-on-anything-else asymmetry** are genuinely good product decisions, correctly implemented and tested.
- **The retention/consent/webhook/split-rental/device-auth work is real, running code**, verified to actually execute — though most of it has no admin UI yet (see "still open" below).
- **The team has been honest with itself** — `ARCHITECTURE_GAP_STATUS.md` is an unusually candid self-assessment. Trust it over any more optimistic claim elsewhere.
- **As of this pass, the admin dashboard no longer shows fabricated data as if it were live** (see below) — a real credibility gap for an API-first product, now closed for the panels that mattered most.

---

## Round 3 (this pass) — fixed and verified

1. **Dead SSE live-stream route, removed.** `/v1/events/stream` was defined twice; the first (admin-token-gated) always won and silently 401'd every connection attempt, since a browser `EventSource` can't send auth headers. The second, fully-wired pub/sub stream (real events: `session_scored`, `review_resolved`, `fleet_update`, etc.) was completely unreachable. Removed the dead duplicate. **Verified live**: `new EventSource("/v1/events/stream")` now connects successfully (previously always errored). The dashboard genuinely auto-updates now.
2. **Driver app wasn't auto-started.** `start-dev.ps1` only launched the backend and admin dashboard. Now also launches `frontend/mobile-app` (port 8443) so the dashboard's "Driver app" button has something to open. The app itself was never broken — confirmed it loads, logs in, and proxies to the backend correctly once running.
3. **Nav bar decluttered.** Removed the theme toggle (see #4) and moved "Stream Live Telemetry" (the auto-simulator toggle — a dev/demo tool) out of the global header into the Simulator page where it belongs, next to the scenario cards. "Live Ingest" shrank to an icon-only manual-refresh button now that live push (#1) keeps data current automatically.
4. **Light theme removed.** It was a half-finished leftover: three duplicate `[data-theme="light"] header` CSS blocks and two duplicate `.export` blocks had accumulated from past edits, and newer classes (`.live-btn` etc.) had no light variant at all — low-contrast, hard-to-read controls, confirmed visually. Dark is now the only theme; the toggle button and its state were deleted rather than patched (the team had already decided on one unified dark theme).
5. **Phantom drivers/cases removed.** `INITIAL_DRIVERS` had 9 hardcoded entries; only 4 (`rider-001`, `014`, `042`, `088`) match what the backend actually seeds. The other 5 (`rider-019`, `002`, `007`, `055`, `091`) were pure frontend fiction, permanently merged into the live Continuity Matrix and Review Queue with no backend counterpart ever able to correct them. Removed. See `FEATURES.md` for the exact, documented seed dataset.
6. **Drift tracker was 100% fake, wired to real data.** The entire page — chart, alert banner, driver pills, session table — read from a hardcoded `DRIVER_DRIFT_DATA` constant and never called the real, working `/v1/drivers/{id}/drift` endpoint. Now fetches real per-session data per driver. **Verified live**: shows actual stored sessions (e.g. real `SES-0250`/`SES-0429` rows for rider-042 from this session's own testing), not fabricated `SES-0037` fiction.
7. **Model health partially wired, and a real pre-existing crash fixed along the way.** The AUC/EER model cards are real, validated offline research numbers (genuinely measured during training) — now clearly labeled "offline validation snapshot, not live-computed" rather than implying a live test just ran. The page now also fetches `/v1/ml/models/health` for real runtime stats (sample count, calibration status) alongside them. **While wiring this up, found and fixed a real backend bug**: that endpoint crashed with `AttributeError` on any session with `threshold_info: None` (a `.get(key, {})` only falls back when the key is *missing*, not when it's present-and-`None`) — this endpoint had never actually been called by any frontend before, so the bug was latent. Fixed; verified live (340 real scored sessions, `conformal_active`).
8. **Fake "Run calibration check" button, fixed.** Previously: `setTimeout` + a hardcoded canned success message ("D=0.038, p > 0.10, Zero cohort bias"), regardless of anything. Now calls the real `/v1/ml/models/health` endpoint and reports its actual response.
9. **Fabricated cohort-fairness and p-value-histogram numbers, relabeled honestly.** "48,200 sessions" and similar implied a production scale that doesn't exist. These two panels now say "illustrative example" explicitly, with a note that real reporting needs session volume this demo doesn't have yet. Not deleted — they still demonstrate the real capability — just no longer presented as live production evidence.

All of the above verified via: 16/16 backend tests passing (`pytest backend/tests/`), clean TypeScript compiles and production builds for both `frontend/` and `frontend/mobile-app`, and live manual testing against a running backend (real HTTP calls, real SSE connection, real screenshots) — not just "it builds."

---

## Still open (not touched this round — out of scope or lower priority)

- **Two competing verification systems.** The automated face-match flow (`/challenge/respond`) is what's wired to the frontend; a second, more privacy-conscious `verification_requests` system exists with zero frontend callers. Still needs a real decision from whoever built it — not resolved, deliberately not deleted.
- **Several real backend/ML capabilities have no admin UI at all**: split-rental detection, ops webhook config, device-key enrollment, driver consent lifecycle, declaration history. All real, working, API-only. Lower priority if the API itself is the product, but worth it if the dashboard should demonstrate every differentiator.
- **Two slow-drift detectors run redundantly** (`FrozenAnchorDetector` + `DriverTimeSeriesProfiler`) — architectural debt, not a correctness bug.
- `frontend/mobile-app/src/verificationState.ts` — still dead code, never imported.
- `frontend/fleet-dashboard/` (a separate directory from `frontend/admin-operations/`, which is the one that's actually live) — still not confirmed wired anywhere; don't assume it's live.
- The mobile telemetry payload still always sends `vehicle_speed_mph: null`, so the pause-aware safe-stop gate has no real speed signal to act on yet.
- A repo-wide sweep for the same "missing CSS class" / hardcoded-old-palette-inline-color pattern on `frontend/mobile-app` and `frontend/fleet-dashboard` — only `frontend/admin-operations` got this treatment.
