/** TrustMesh browser telemetry. Collects only after explicit in-app consent and while online. */
type TouchEventSummary = {
  type: "tap" | "swipe";
  duration_ms: number;
  distance_px: number;
  interval_ms: number | null;
  t_offset_ms: number;
  pressure?: number;
};
type IngestResponse = { driver_id?: string; decision?: string; quadrant?: string; model_status?: string; [key: string]: unknown };
const API_BASE = (
  import.meta.env.VITE_TRUSTMESH_API_URL ||
  (typeof window !== "undefined" && window.location.origin ? window.location.origin : "http://127.0.0.1:8000")
).replace(/\/$/, "");
const DRIVER_ID = import.meta.env.VITE_TRUSTMESH_DRIVER_ID || "rider-001";
const DRIVER_TOKEN = import.meta.env.VITE_TRUSTMESH_DRIVER_TOKEN || "demo-driver-token-2026";
const ZONE_STORAGE_KEY = "trustmesh_coarse_zone_v1";
const state = {
  online: false, listenersStarted: false, accel: [] as number[], gyro: [] as number[], touches: [] as TouchEventSummary[],
  pointerStart: null as { at: number; x: number; y: number; pressure: number } | null,
  lastTouchAt: null as number | null, sessionStartedAt: Date.now(), offerAt: null as number | null,
  acceptLatencyMs: null as number | null, zone: "zone-unavailable", watchId: null as number | null,
  heartbeat: null as ReturnType<typeof setInterval> | null,
};
function status(signal: string, available: boolean, detail?: string) {
  window.dispatchEvent(new CustomEvent("trustmesh:signal-status", { detail: { signal, available, detail } }));
}
function pushLimited(list: number[], value: number, max = 120) { if (Number.isFinite(value)) { list.push(Number(value.toFixed(3))); if (list.length > max) list.shift(); } }
function makeDeviceId() {
  const key = "trustmesh_device_id_v1"; let id = localStorage.getItem(key);
  if (!id) { id = `web-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`; localStorage.setItem(key, id); }
  return id;
}
// Rounded to ~1 km-ish grid; exact coordinates never leave the browser.
function coarseZone(latitude: number, longitude: number) { return `grid-${latitude.toFixed(2)}-${longitude.toFixed(2)}`; }
async function requestMotionPermission() {
  const motion = DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<"granted" | "denied"> };
  if (typeof DeviceMotionEvent === "undefined") { status("motion", false, "Device motion is not supported in this browser."); return; }
  try {
    if (typeof motion.requestPermission === "function") {
      const result = await motion.requestPermission();
      if (result !== "granted") { status("motion", false, "Motion permission was not granted."); return; }
    }
    status("motion", true, "Motion collection enabled where sensor data is available.");
  } catch { status("motion", false, "Motion permission was unavailable or denied."); }
}
function startLocation() {
  if (!navigator.geolocation) { status("gps", false, "Geolocation is unsupported."); return; }
  if (state.watchId !== null) navigator.geolocation.clearWatch(state.watchId);
  state.watchId = navigator.geolocation.watchPosition((position) => {
    const nextZone = coarseZone(position.coords.latitude, position.coords.longitude);
    const changed = nextZone !== state.zone;
    state.zone = nextZone; localStorage.setItem(ZONE_STORAGE_KEY, state.zone);
    status("gps", true, `Coarse zone updated${position.coords.accuracy ? ` (accuracy reported: ~${Math.round(position.coords.accuracy)} m)` : ""}. Exact coordinates are not uploaded.`);
    if (changed && state.online) void sendSession();
  }, (error) => {
    state.zone = localStorage.getItem(ZONE_STORAGE_KEY) || "zone-unavailable";
    status("gps", false, error.code === 1 ? "Location permission denied; GPS zone unavailable." : "Location unavailable; GPS zone unavailable.");
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
}
function startListeners() {
  if (state.listenersStarted || typeof window === "undefined") return;
  state.listenersStarted = true;
  window.addEventListener("devicemotion", (event) => {
    if (!state.online || !event.accelerationIncludingGravity) return;
    const a = event.accelerationIncludingGravity; if (a.x == null || a.y == null || a.z == null) return;
    pushLimited(state.accel, Math.sqrt(a.x ** 2 + a.y ** 2 + a.z ** 2)); status("motion", true, "Accelerometer samples received.");
  }, { passive: true });
  window.addEventListener("deviceorientation", (event) => {
    if (!state.online || event.beta == null || event.gamma == null) return;
    pushLimited(state.gyro, (Math.abs(event.beta) + Math.abs(event.gamma)) / 180);
  }, { passive: true });
  // PointerEvent exposes pressure (0..1) on supported touch hardware. Mouse pressure is not treated as biometric evidence.
  window.addEventListener("pointerdown", (event) => {
    if (!state.online || event.pointerType !== "touch") return;
    state.pointerStart = { at: performance.now(), x: event.clientX, y: event.clientY, pressure: event.pressure || 0 };
  }, { passive: true });
  window.addEventListener("pointerup", (event) => {
    if (!state.online || event.pointerType !== "touch" || !state.pointerStart) return;
    const start = state.pointerStart; const duration = Math.max(1, performance.now() - start.at);
    const distance = Math.round(Math.hypot(event.clientX - start.x, event.clientY - start.y)); const endedAt = Date.now();
    const pressureValues = [start.pressure, event.pressure].filter((p) => Number.isFinite(p) && p > 0);
    const item: TouchEventSummary = { type: distance > 15 ? "swipe" : "tap", duration_ms: Math.round(duration), distance_px: distance,
      interval_ms: state.lastTouchAt == null ? null : endedAt - state.lastTouchAt,
      t_offset_ms: Math.max(0, endedAt - state.sessionStartedAt) };
    if (pressureValues.length) item.pressure = Number((pressureValues.reduce((a, b) => a + b, 0) / pressureValues.length).toFixed(3));
    state.touches.push(item); if (state.touches.length > 80) state.touches.shift(); state.lastTouchAt = endedAt; state.pointerStart = null;
    status("touch", true, `Touch gesture recorded${item.pressure !== undefined ? " with supported pressure data" : "; pressure not exposed by this device/browser"}.`);
  }, { passive: true });
  window.addEventListener("pointercancel", () => { state.pointerStart = null; }, { passive: true });
}
export function recordOrderOffer() { state.offerAt = Date.now(); }
export function recordOrderAccept() {
  if (state.offerAt != null) { state.acceptLatencyMs = Math.max(0, Date.now() - state.offerAt); state.offerAt = null; }
  return sendSession();
}
export async function goOnlineAndIngest(): Promise<IngestResponse | null> {
  // Called from the driver's explicit Go Online action so browser permission prompts can appear.
  await requestMotionPermission(); startLocation(); startListeners(); state.online = true;
  if (state.heartbeat) clearInterval(state.heartbeat);
  state.heartbeat = setInterval(() => { if (state.online) void sendSession(); }, 30000);
  return sendSession();
}
export function goOffline() {
  state.online = false; if (state.watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(state.watchId);
  state.watchId = null; if (state.heartbeat) clearInterval(state.heartbeat); state.heartbeat = null;
  status("collection", false, "Telemetry paused while offline.");
}
export async function sendSession(): Promise<IngestResponse | null> {
  const payload = { driver_id: DRIVER_ID, device_id: makeDeviceId(),
    // Public IP/subnet must be derived server-side behind trusted proxy configuration; browser code cannot know it reliably.
    ip_subnet: null, zone: state.zone, accel: [...state.accel], gyro: [...state.gyro], touch_events: [...state.touches],
    accept_latency_ms: state.acceptLatencyMs, timestamp: new Date().toISOString() };
  try {
    const response = await fetch(`${API_BASE}/v1/sessions/ingest`, { method: "POST", headers: { "Content-Type": "application/json", "X-Driver-Token": DRIVER_TOKEN }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`API ${response.status}: ${(await response.text()) || response.statusText}`);
    const result = await response.json() as IngestResponse;
    state.accel = []; state.gyro = []; state.touches = []; state.acceptLatencyMs = null; state.sessionStartedAt = Date.now(); state.lastTouchAt = null;
    window.dispatchEvent(new CustomEvent("aslikaun:ingest-success", { detail: result }));
    status("api", true, `Session sent successfully${result.model_status ? `; scorer: ${result.model_status}` : ""}.`);
    console.info("[AsliKaun] Session ingested", { driverId: DRIVER_ID, modelStatus: result.model_status }); return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingestion error";
    window.dispatchEvent(new CustomEvent("aslikaun:ingest-error", { detail: message })); status("api", false, message);
    console.error("[AsliKaun] Session ingestion failed", error); return null;
  }
}
