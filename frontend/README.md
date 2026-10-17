# Trust Juggler — Admin & Fleet Dashboard

The Trust Juggler Dashboard is an interactive administrative interface visualizing multi-modal rider biometric trust and account-sharing detection in real-time.

## Features Included

1. **Continuous Two-Axis Decision Matrix**:
   - Interactive 2D scatter plot: Context Continuity (0.0 to 1.0) vs. Behavioral Continuity (0.0 to 1.0).
   - Visual quadrants: `Stable` (Continue), `Legit Change` (Silent Rebaseline), `Handoff Signature` (Challenge at safe pause), `Ambiguous` (Lightweight check).
   - Clickable rider nodes with live biometric signal inspection (Touch, Motion, Operational).

2. **Per-Driver Trust Timeline**:
   - Compares the slowly adapting **Fast Baseline (EWMA)** against the **Frozen Identity Anchor**.
   - Proves how gradual multi-session slow drift is caught by the frozen anchor when naive moving averages fail.

3. **Escalation & Review Queue**:
   - Live queue of sessions flagged for step-up or audit.
   - Embeds the **Claude LLM Reason-Vector** explanation explaining why the session was flagged.
   - Audit resolution actions (`Cleared`, `Confirmed Handoff`, `Needs Follow-up`).

4. **Live Red-Team Scenario Suite**:
   - Launchpad for 6 attack & honest-rider scenarios:
     - *Lazy Renter*
     - *Slow-Drift Renter* (60-session ramp)
     - *Split-Shift Sharer* (dual identity morning/evening)
     - *Copycat Renter* (spoofed schedule, distinct touch/motion)
     - *Honest Phone & City Change* (verifies zero false accusation)
     - *Honest Illness / Rough Roads*
   - Live terminal log stream reacting to session outcomes.

5. **Cohort Fairness Panel**:
   - Monitors false-positive and anomaly distribution across Mumbai delivery hubs (Andheri, Bandra, Dadar, Powai, Thane, Navi Mumbai).

## How to Run

### Option A: Via FastAPI Backend (Integrated)
Start the backend from repository root:
```powershell
python -m uvicorn backend.app.main:app --reload --port 8000
```
Open your browser to:
- **`http://localhost:8000/dashboard/`** or simply **`http://localhost:8000/`** (automatically redirects to dashboard).

### Option B: Standalone Web Server
Run any lightweight static server inside `frontend/`:
```powershell
cd frontend
python -m http.server 3000
```
Open **`http://localhost:3000`** in your browser.
*(The frontend automatically connects to `http://localhost:8000` for live API operations, or runs in high-fidelity standalone demo mode if backend is offline!)*
