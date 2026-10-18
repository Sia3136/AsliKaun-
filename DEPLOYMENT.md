# Render Deployment

This service must be deployed from the repository root, not from `backend/`. The FastAPI app imports the sibling `ml/` package and serves the production build in `frontend/dist/` at `/dashboard/`.

## Render service settings

Create a new **Web Service** from this repository with:

- Runtime: `Python 3`
- Root directory: repository root (leave blank)
- Build command: `pip install -r requirements.txt && npm ci --prefix frontend && npm run build --prefix frontend`
- Start command: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
- Health check path: `/health`

Do not use the Windows virtual environment from `trust_juggler_backend/.venv`; Render creates its own Linux environment from `requirements.txt`.

No `render.yaml` is included. The database storage decision requires an explicit Render plan and disk choice, so the dashboard configuration is safer for this repository.

## Environment variables

Set these in Render. Use real values only in Render's environment settings, never in Git:

- `TRUST_JUGGLER_FRONTEND_ORIGIN`: the exact deployed Vercel origin, for example `https://your-app.vercel.app`. For more than one origin, provide a comma-separated list.
- `TRUST_JUGGLER_TOKEN_SECRET`: a long random secret used to sign admin bearer tokens.
- `TRUST_JUGGLER_ADMIN_USERNAME`: the initial admin username.
- `TRUST_JUGGLER_ADMIN_PASSWORD`: the initial admin password; it must be at least 12 characters.
- `TRUST_JUGGLER_DB`: set to `/var/data/trust_juggler.db` when using a Render persistent disk mounted at `/var/data`. If omitted, the service writes `trust_juggler.db` under the repository root.
- `ANTHROPIC_API_KEY`: optional. Without it, escalated sessions use the clearly labeled deterministic reason-vector fallback.
- `REASON_VECTOR_MODEL`: optional model name used with `ANTHROPIC_API_KEY`.

The repository's `.env.example` contains placeholders only. Do not upload `.env`, the local SQLite database, or the Windows `.venv`.

## Storage limitation

The current implementation uses SQLite for drivers, sessions, events, admin users, driver tokens, and the review queue. Render's ordinary service filesystem is ephemeral, so data can be lost on restart or redeploy. For a short-lived demo, the default local path is acceptable. For persistent operation, attach a Render persistent disk mounted at `/var/data` and set `TRUST_JUGGLER_DB=/var/data/trust_juggler.db`. A multi-instance deployment requires migrating this SQLite layer to an external database such as Render Postgres; SQLite should not be shared between instances.

Startup initializes the schema and seeds the configured admin account. The demo fleet is only inserted when the database has no drivers. The first successful session for a driver establishes its multi-modal baseline.

## ML and asset checks

The deployed request path imports `backend.app.ml_bridge`, `ml.combiner.two_axis`, `ml.calibration.fusion`, and the reason-vector module. The root requirements include the runtime dependencies (`numpy`, `scipy`, FastAPI, Uvicorn, Pydantic, and optional `anthropic`). The request path performs the existing feature extraction and two-axis scoring; it does not require the ignored training datasets or the empty `ml/weights/` directory.

The repository does not currently ship trained `.pt` weights, and `main.py` does not invoke `RiderModelBundle`. Do not describe this deployment as serving the separate trained encoder bundle unless those weights and a wiring change are added deliberately. The live API reports `model_status: ml_two_axis_fusion` when the bridge loads successfully.

## Deploy and verify

1. Push the source changes to the Git provider used by Render. Do not commit `.env`, `.venv`, `trust_juggler.db`, or secrets.
2. Create the Web Service with the settings above.
3. Add the environment variables above and deploy.
4. Open `https://YOUR-RENDER-SERVICE.onrender.com/health`; expect `{"status":"ok","service":"trust-juggler-api"}`.
5. Open `/dashboard/index.html` and confirm the built dashboard loads. Its HTML should reference `/dashboard/assets/...`, not `/src/main.tsx`.
6. Open `/docs` and confirm Swagger loads.
7. Confirm CORS with the browser frontend origin. Requests from an origin not listed in `TRUST_JUGGLER_FRONTEND_ORIGIN` should not receive an allowed CORS response.
8. Log in with `POST /v1/admin/login` using the configured admin credentials and use the returned bearer token for `/v1/fleet/scores`.
9. Use the provisioned driver token in `X-Driver-Token` and submit a test `POST /v1/sessions/ingest`. The first request should return `baseline_established`; a later request for the same driver should be scored.
10. Confirm the review flow with an escalated test session if needed: `GET /v1/review-queue` and `POST /v1/review-queue/{session_id}/resolve` with the admin bearer token.

Local regression check:

```powershell
python -m pytest -q backend/tests
```

## Connect the Vercel frontend

In the Vercel project settings, add these build-time variables and redeploy:

- `VITE_TRUSTMESH_API_URL=https://YOUR-RENDER-SERVICE.onrender.com`
- `VITE_TRUSTMESH_DRIVER_ID=the-driver-id-provisioned-by-the-backend`
- `VITE_TRUSTMESH_DRIVER_TOKEN=the-driver-token-issued-by-the-admin-endpoint`

The Vite telemetry client sends `POST /v1/sessions/ingest` with `X-Driver-Token`, JSON sensor summaries, a coarse zone, and the driver ID. Never put an admin bearer token or an Anthropic API key in a `VITE_` variable; Vite exposes those values to browser users.
