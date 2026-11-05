# AsliKaun — Project Context

Honest state-of-the-project as of 2026-11-05, written from a direct code audit. See `FEATURES.md` for what each piece does; this is about how well the whole thing hangs together.

**Update, same day:** items §1, §3, §6, §7 (partially) below were fixed and verified in a follow-up pass — see "Fixed this session" at the end. The original findings are kept as-written so the reasoning stays visible; don't re-fix what's already marked done.

---

## What's genuinely done and solid

- **The core ML signal science is real and validated**, not hand-waved: touch and motion triplet-loss encoders beat their classical baselines on held-out H-MOG data; Fisher fusion measurably outperforms single-signal scoring; conformal p-value calibration and per-rider thresholds are implemented correctly, not just claimed.
- **The two-axis decision model is principled** — it won't escalate on a single noisy signal, which is the right instinct for a system whose false positives directly harm honest drivers' livelihoods.
- **Fatigue capping and the auto-clear-on-match / human-review-on-anything-else asymmetry** are genuinely good product decisions, correctly implemented and tested — the system is structurally biased toward not harming honest drivers, not just biased toward catching fraud.
- **The retention/consent/webhook/split-rental/device-auth work is real, running code**, verified by this audit to actually execute, not just exist as unused functions.
- **The team has been honest with itself** — `ARCHITECTURE_GAP_STATUS.md` is an unusually candid self-assessment (explicitly disclaiming the "50,000 req/s" capacity claim, calling out SQLite's row-level-security limitation, naming what consent/compliance work is still missing). That document should be trusted over any more optimistic claim elsewhere.

---

## The bads — real problems found in this audit

### 1. The reported selfie-verification bug is real, root-caused, and not mysterious — FIXED
"Worked once, then stopped" had a concrete explanation, not a flaky-AI excuse:
- `DRIVER_TOKEN` in `frontend/mobile-app/src/telemetry.ts` only had a value on `localhost`/`127.0.0.1`/`*.localhost`. On any other host — including a phone on the same LAN, which is the only realistic way to test a camera/motion-sensor app — it was an empty string, so `getChallengeStatus()`/`respondToChallenge()` returned `null` without ever reaching the backend.
- **Fix:** `telemetry.ts` now also recognizes RFC1918 private-LAN hostnames (192.168.x.x, 10.x.x.x, 172.16-31.x.x) as local-dev for the purpose of the non-secret demo token fallback, with a console notice so it's not silent. The HTTPS requirement in `telemetryPolicy.ts` was left untouched — it's a real security boundary, not the bug.
- Also fixed: `respondToChallenge()`/`getChallengeStatus()` used to return `null` for a config problem (missing token/non-HTTPS) — indistinguishable from an actual verification failure. They now return a distinct `outcome: "config_error"` the UI can message correctly instead of dead-ending.

### 2. Two competing verification systems exist; only the older, flakier one is wired up — DOCUMENTED, NOT RESOLVED
- The automated face-embedding system (`/v1/drivers/{id}/challenge/respond`, MTCNN + FaceNet + texture-based liveness/anti-spoofing) is what the frontend calls.
- A second, newer `verification_requests`-backed system (`/v1/drivers/{id}/verification`) exists, explicitly designed to **never auto-match or even store the face image** — it logs the capture and waits for a human/external decision. This reads like the team's own correction of the first system's unreliability.
- No frontend code calls the second system. It's dead on the client side. **Deliberately not deleted or merged this session** — risk of destroying in-progress work without knowing the team's intent. Added a prominent code comment at the top of the unused endpoints pointing back here. Still needs a real decision from whoever built it.

### 3. MTCNN face detection is strict, and there was no retry path when it fails — FIXED
- The project's own E2E regression test failed because its synthetic "face" image (a soft gradient blob, no actual facial features) can't be detected by MTCNN — confirmed empirically (even a hand-drawn cartoon face with eyes/nose/mouth doesn't pass; MTCNN needs real photographic texture). This was the test fixture's fault, not a backend bug.
- **Fix:** the E2E test now mocks the identity-embedding step only (`backend.app.main.embed_face_image`), leaving the real, texture-based anti-spoofing/liveness check genuinely exercised against the synthetic "live" vs "screen_replay" fixtures (that check isn't MTCNN-dependent and does correctly tell them apart).
- Separately, a real numpy dtype-promotion bug surfaced while fixing this (`float32_array / np.sqrt(x)` silently upcasts to float64, corrupting a byte-level round-trip) — fixed and left as a commented warning in the test.
- **Frontend UX fix:** `no_face_detected` (a recoverable bad-photo outcome) now routes to a "Retake photo" screen instead of the old dead-end "your account is under review" screen with no way forward. Genuinely unrecoverable outcomes (`config_error`) now correctly do NOT offer a "Try again" that can't possibly succeed — they go straight to "Get help" instead.

### 4. Two slow-drift detectors run redundantly — NOT ADDRESSED
`FrozenAnchorDetector` (simple, older) and `DriverTimeSeriesProfiler` (newer, more sophisticated — distinguishes legitimate drift from attacks, sudden shifts, and split-shift patterns) both run on every ingested session and can both independently escalate a decision. Not a correctness bug, but architectural debt: redundant systems make "why did this driver get flagged" harder to answer, and the newer profiler appears to make the older detector largely obsolete. Still true as of this update.

### 5. Frontend structure is fragmented across (at least) three projects — RESOLVED (was a real open question, now answered)
`frontend/fleet-dashboard.html` loads `/admin-operations/src/main.tsx` directly — **confirmed**: `frontend/admin-operations/` IS the live source for the served admin dashboard, not a disconnected experiment as this doc originally speculated. `frontend/fleet-dashboard/` (a separate directory with its own `src/`) still has NOT been confirmed to be wired anywhere — don't assume it's live without checking the same way.

### 6. Test suite has a collection-breaking path bug — FIXED
Two newer test files imported `backend.app.X` as an absolute package path, which only resolved when pytest ran from the repo root; `cd backend && pytest` (the natural instinct, matching the older test file's own README) failed to collect them. **Fix:** added `pytest.ini` at the repo root with `pythonpath = .` and `testpaths = backend/tests`, which anchors pytest's rootdir at the repo root regardless of invocation directory. Verified: all 16 tests now collect and pass from both the repo root and from inside `backend/`.

### 7. Dead/orphaned code — PARTIALLY ADDRESSED
`frontend/mobile-app/src/verificationState.ts` is still fully written but never imported anywhere — not touched this session (low-risk cleanup, not urgent). The `verification_requests` backend endpoints (§2) are the bigger instance of this pattern and now have an explicit "not wired up" marker in code.

### 8. NEW: a systemic "missing CSS class" pattern in the admin dashboard, plus a theme-default bug
Found during a UI/UX audit (not in the original pass):
- The dashboard's theme state defaulted new visitors to `"light"` (`frontend/admin-operations/src/App.tsx`), but light mode was never fully re-themed after the team's documented switch to a unified dark "cyber-defense" theme — several components (`.metric` stat cards among them) only had dark styling under `[data-theme="dark"]` overrides and fell back to the old, abandoned light palette otherwise. Result: a jarring half-dark/half-washed-out-white page on first load. **Fixed**: default now resolves to `"dark"` unless a saved `"light"` preference exists.
- At least 9 component classes used in the live JSX (`.alert-pill`, `.driver-pill-btn`, `.sim-result`, `.sim-actions`, `.global-toast`, `.sandbox`, `.live-btn`/`.active-pulse`, `.hist-label`, `.takeaway`) and one whole feature area (`.user-menu-wrap`/`.user-btn`/`.user-dropdown`) had **zero matching CSS rules anywhere in the stylesheet** — they rendered as plain unstyled text/divs with no background, spacing, or visual hierarchy. The admin user-menu dropdown in particular rendered as raw floating text overlapping the page title, with no visible container. **Fixed**: added full dark-theme-consistent CSS for all of them, verified visually (drift-tracker driver pills, the alert badge, the simulator result card, and the user dropdown all now render correctly).
- A handful of inline styles (`backend/app/main.py` wasn't affected — this was `admin-operations/src/App.tsx` only) still had hardcoded hex colors from the old light palette (`#174b3a`, `#f8fbf9`, `#455952`, `#84928d`, etc.) sitting inside otherwise-dark-themed components, since inline `style={{}}` props don't get touched by a CSS-only theme migration. **Fixed**: replaced with the established dark-theme color tokens (`#10b981` emerald accent, `#94a3b8`/`#cbd5e1` muted/body text).
- **Worth doing, not done**: a repo-wide sweep of `frontend/mobile-app` and `frontend/fleet-dashboard` for the same two patterns (orphaned classes, hardcoded old-palette inline hex) wasn't performed — only `admin-operations` was audited this way. Given how many instances turned up in one file, it's reasonable to expect more elsewhere.

---

## What needs to happen next, roughly in priority order

1. ~~Fix the selfie-verification deployment gap~~ — done, see §1.
2. **Decide, explicitly, which verification system is canonical** (§2) and delete or finish the other one. Still open.
3. ~~Fix the error-path UX inversion~~ — done, see §3.
4. ~~Confirm which frontend build is actually deployed~~ — done, see §5 (it's `admin-operations/`).
5. ~~Fix the pytest path issue~~ — done, see §6.
6. **Run the same missing-CSS / hardcoded-old-palette sweep on `frontend/mobile-app` and `frontend/fleet-dashboard`** (§8's last bullet) — only `admin-operations` got this treatment so far.
7. Lower priority: collapse the two drift detectors into one (§4), decide the fate of `verificationState.ts` (§7), and wire a real `vehicle_speed_mph` source into the mobile telemetry payload so the pause-aware safety gate (`FEATURES.md` §4) stops being a permanent no-op.
