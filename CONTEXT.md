# AsliKaun — Project Context

**v2** — 2026-11-05. Honest state-of-the-project, written from direct code audits and live testing across four passes the same day. See `FEATURES.md` for what each piece does and the documented seed dataset; this is about how well the whole thing hangs together and what's been fixed vs. still open.

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

## Round 4 (this pass) — fixed and verified

10. **Redundant drift detector removed.** `FrozenAnchorDetector` and `DriverTimeSeriesProfiler` were both running on every ingest, doing overlapping slow-drift detection — architectural debt that was explicitly flagged in `ARCHITECTURE_GAP_STATUS.md`. `FrozenAnchorDetector` was the simpler, older cumulative check; `DriverTimeSeriesProfiler` is strictly more capable (also distinguishes diurnal splits, slow-poisoning attacks, and legitimate habituation). Removed `FrozenAnchorDetector`, keeping the more capable one. **Verified**: 32/32 ML tests still green after removal.

11. **Dead `verificationState.ts` deleted.** `frontend/mobile-app/src/verificationState.ts` was never imported anywhere in the project — confirmed by a repo-wide search. Dead file removed. No test or build impact.

12. **`vehicle_speed_mph` now real (Geolocation API).** The mobile telemetry payload was always sending `vehicle_speed_mph: null`, making the pause-aware safe-stop gate a permanent no-op (a challenge could never be surfaced mid-drive vs. at-standstill because the gate never saw a real speed). `frontend/mobile-app/src/telemetry.ts` now reads `GeolocationPosition.coords.speed` (m/s → mph) from the Geolocation API's speed field, which browsers populate when available. Falls back to `null` on browsers or permissions that don't expose it — no regression in that case, same behavior as before.

13. **Redundant admin verification endpoint removed.** Two competing verification endpoints existed: the automated face-match flow (`/challenge/respond`, wired to the frontend) and a `verification_requests`-table-backed privacy-conscious flow that was unreachable — no frontend caller, no mobile caller, nothing. Rather than deciding between them, the unreachable duplicate was removed. The working face-match flow remains unchanged.

14. **Login page (admin console) rewritten.** One primary action, no redundant buttons. Shared design tokens from the landing page (orange `#f97316`-ish, purple `#7c3aed`-ish, serif headline) instead of three generations of mismatched invented gradients. Also tightened a real auth-bypass bug in the fallback login path.

15. **Admin dashboard reskinned with shared brand tokens.** Nav active-tab, avatar, primary buttons, driver-inspector accent bar now use the shared brand tokens. Semantic status colors (stable/legit/ambiguous/handoff) deliberately left untouched — they carry data meaning, not brand styling.

16. **`frontend/fleet-dashboard/` confirmed dead code.** This sub-directory exists but is a parallel prototype that was never wired up. Specifically: it has no `package.json`, no Vite config of its own, and is **not** referenced from the root `frontend/` Vite build. The entry point `frontend/fleet-dashboard.html` loads `/admin-operations/src/main.tsx`, not anything from `fleet-dashboard/src/`. `frontend/fleet-dashboard/src/` is never built or served. Status: **dead code, not deleted** (preserves the work in case the team decides to wire it up), but clearly documented here as unserved.

17. **Mobile-app CSS confirmed clean.** A sweep of `frontend/mobile-app/src/index.css` and `App.tsx` found no hardcoded hex colors escaping the CSS variable system, no old-palette gradients, and no mismatched brand colors. The mobile app already used `var(--orange)`, `var(--orange-active)`, `Newsreader` serif headline, and kept semantic status colors (`var(--green)`, `var(--red)`, `var(--amber)`) intact. No changes needed.

All of the above verified via: 32/32 ML tests + 16/16 backend tests passing, clean TypeScript compiles and production builds for both `frontend/` and `frontend/mobile-app`.

---

## Still open (deliberately out of scope — not lower-quality, just lower-priority)

- **Several real backend/ML capabilities have no admin UI at all**: split-rental detection, ops webhook config, device-key enrollment, driver consent lifecycle, declaration history. All real, working, API-only. Lower priority if the API itself is the product.
- **SQLite / single-process limits**: `backend/app/storage.py` has Redis and ClickHouse pluggable backends, but the default dev path is SQLite + in-memory. Fine for a demo / hackathon; not production scale. `ARCHITECTURE_GAP_STATUS.md` documents this honestly.
- **`frontend/fleet-dashboard/src/`** exists as a richer prototype (SSE-wired, GeoTelemetryCorridor, TwoAxisQuadrantView, CommandPalette) — if the team decides to properly build and serve it, it needs its own `package.json`, Vite config, and an entry in the root `vite.config.ts`'s `rollupOptions.input`.
