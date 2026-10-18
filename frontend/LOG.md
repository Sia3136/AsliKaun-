# Frontend Development Log — Trust Juggler & AsliKaun UI

This log documents all visual interfaces, WebGL shaders, client-side state engines, dashboard capabilities, and API integrations established in the `frontend/` module.

---

## 1. Module Overview & Responsibilities
The `frontend/` module delivers the user experience for Trust Juggler across two primary interfaces:
1. **AsliKaun Landing Platform** (`frontend/index.html`): High-impact product showcase, biometric continuity explainer, interactive driver portal, and scenario simulation trigger.
2. **Fleet Operations Dashboard** (`frontend/dashboard.html`): Real-time operations center for trust operations teams, displaying two-axis fleet distributions, live sensor telemetry, driver review queues, and incident resolution workflows.

---

## 2. Completed Architecture & Milestones

### A. High-Performance WebGL Background (`index.html`)
- **GPU-Accelerated Mesh Gradient**:
  - Implemented custom GLSL vertex and fragment shaders rendered via HTML5 `<canvas id="webgl-canvas">`.
  - Multi-octave chromatic noise algorithm with smooth looping time-frequency modulation and spatial dithering to eliminate color banding.
  - Full-bleed fixed canvas positioned beneath glassmorphic UI elements with isolated CSS stacking context (`z-index: 0`).
  - Graceful degradation: includes hardware capability check with fallback to gradient backdrop if WebGL is unsupported.

### B. AsliKaun Landing Interface (`index.html`)
- **Continuous Identity Intelligence Hero**:
  - Narrative framing: *"The account stays the same. But does the person? Trust the behavior. Detect the handoff."*
  - Dual-perspective interactive portrait reveal contrasting verified registered couriers against unauthorized account renters.
- **Biometric Continuity Concept Cards**:
  - Visual breakdown of the four distinct continuous signals: Operational Cadence, Gesture & Motor Biometrics, Device & Environmental Network, and Trajectory Geometry.
  - Interactive radar-style signal integrity charts with dynamic visual weighting.
- **Driver Portal Simulation Modal**:
  - In-browser driver mobile emulator demonstrating background telemetry capture.
  - Allows visitors to test three real-time scenarios:
    1. *Normal Delivery Wave* (Honest driver continuation).
    2. *Unauthorized Handoff* (Account sharing anomaly).
    3. *Device Upgrade / City Move* (Legitimate context shift).

### C. Fleet Operations Dashboard (`dashboard.html`)
- **Two-Axis Scatter Matrix**:
  - Real-time 2D Cartesian plane plotting Context Continuity Score ($X$-axis, $0.0 - 1.0$) against Behavioral Continuity Score ($Y$-axis, $0.0 - 1.0$).
  - Clear quadrant delineation with distinct contextual color codes:
    - 🟢 **Top-Right (Stable)**: Normal delivery operations (`continue`).
    - 🔵 **Top-Left (Legitimate Change)**: Declared or legitimate device/network switch (`rebaseline`).
    - 🔴 **Bottom-Right (Handoff Signature)**: Known phone with anomalous biometrics (`challenge_at_safe_pause`).
    - 🟡 **Bottom-Left (Ambiguous)**: Multi-factor drift (`step_up_check_at_safe_pause`).
  - Interactive point selection displaying driver identity cards and real-time biometric metrics.
- **Multi-Modal Telemetry Inspector**:
  - Visual breakdown of sensor streams: Accelerometer variance, Gyroscope angular rate, Touch gesture dynamics, and Order Acceptance latency.
  - Direct display of the ML Explainability Reason Vector generated for flagged drivers.
- **Driver Review Queue & Incident Resolution**:
  - Tabular review queue tracking flagged sessions.
  - Status filters (`all`, `pending`, `resolved`) with priority badges.
  - Resolution modal with action buttons (`Clear Flag`, `Confirm Handoff`, `Request Follow-Up`) and audit note persistence.

### D. Client Application Engine (`app.js`)
- **Intelligent API Base URL Detection**:
  - Dynamically detects runtime host:
    - If served via FastAPI on port 8000: uses relative paths (`''`).
    - If served via standalone dev server (e.g. port 3000/5173): routes to `http://127.0.0.1:8000`.
- **Automatic Admin Authentication**:
  - Authenticates against `/v1/admin/login` on initial page load to acquire the Bearer token needed for fleet endpoints.
- **Dual-Mode Data Layer (Live + Seed Fallback)**:
  - Fetches live data from `/v1/fleet/scores` and `/v1/review-queue`.
  - Seamlessly falls back to rich built-in `SEED_DRIVERS` data when operating offline or disconnected, ensuring zero UI breakage during presentations.
- **Live Session Dispatcher**:
  - Dispatches simulated test sessions directly to `/v1/sessions/ingest` and dynamically reloads fleet scores and review items upon completion.

### E. Design System & Styling (`style.css`)
- **Theme & Tokens**:
  - Curated dark-mode palette using HSL variables: Deep Ink (`#06192f`), Electric Blue (`#1169dc`), Emerald Success (`#059669`), Amber Warning (`#d97706`), Rose Escalation (`#e11d48`).
  - Glassmorphic panels with backdrop blur filters and subtle border lighting.
- **Typography & Responsive Layout**:
  - Modern font stack via Google Fonts: Inter (body text), Outfit (headings), and JetBrains Mono (telemetry and code metrics).
  - Responsive flexbox/grid layout optimized for both desktop operations dashboards and mobile presentation viewports.

---

## 3. File Inventory
- [`frontend/index.html`](file:///c:/Users/Dell/OneDrive/Documents/Siya/hackforge/frontend/index.html): Landing page, WebGL mesh gradient shader, continuous identity showcase, and driver portal.
- [`frontend/dashboard.html`](file:///c:/Users/Dell/OneDrive/Documents/Siya/hackforge/frontend/dashboard.html): Fleet operations dashboard with quadrant plane, telemetry viewer, and review queue.
- [`frontend/app.js`](file:///c:/Users/Dell/OneDrive/Documents/Siya/hackforge/frontend/app.js): Application logic, API integration, state management, and real-time simulator dispatchers.
- [`frontend/style.css`](file:///c:/Users/Dell/OneDrive/Documents/Siya/hackforge/frontend/style.css): Unified design system, tokens, layout, and component styling.
- [`frontend/package.json`](file:///c:/Users/Dell/OneDrive/Documents/Siya/hackforge/frontend/package.json): Workspace configuration and dev dependencies for Vite/React previewing.

---

## 4. Verification & Browser Integration Status
- **Backend Mount**: Accessible directly at `http://127.0.0.1:8000/dashboard/index.html` and `http://127.0.0.1:8000/dashboard/dashboard.html`.
- **HTTP Verification**: Static assets (`index.html`, `dashboard.html`, `app.js`, `style.css`) return HTTP 200 via FastAPI `StaticFiles`.
- **API Endpoints Connected**:
  - `GET /health` &rarr; Online status indicator active.
  - `POST /v1/admin/login` &rarr; Authenticated session active.
  - `GET /v1/fleet/scores` &rarr; Scatter plot and fleet table populated.
  - `GET /v1/review-queue` &rarr; Review queue populated.
  - `POST /v1/review-queue/{session_id}/resolve` &rarr; Resolutions submitted and synced.
  - `POST /v1/sessions/ingest` &rarr; Live scenario telemetry ingested and evaluated.
