# AsliKaun driver telemetry integration

- Go Online requests location and motion permissions after the driver's explicit action.
- GPS uses watchPosition to refresh a coarse rounded zone; exact latitude/longitude is never uploaded unless precision mode is consented.
- Touch gestures use Pointer Events to record tap/swipe duration, distance, rhythm and pressure only where the touch device/browser exposes pressure.
- Accelerometer/orientation values are collected only while online and when supported.
- Sessions are ingested on going online, accepting an order, coarse-zone changes, and a 30-second heartbeat.
- Browser code cannot reliably read a public IP subnet; leave it null unless backend derives it from a correctly configured trusted proxy.

## Setup
1. Configure `VITE_ASLIKAUN_API_URL`, `VITE_ASLIKAUN_DRIVER_ID`, and `VITE_ASLIKAUN_DRIVER_TOKEN` (or legacy `VITE_TRUSTMESH_*`).
2. Run `npm install` then `npm run build`.
3. Deploy FastAPI separately from the Vercel static frontend; set CORS on the API for the deployed Vercel origin.

This is a browser-based prototype, not a native SDK. Sensor access differs by device/browser and is not guaranteed by a permission prompt alone. Use per-driver authentication instead of the demo token before production.
