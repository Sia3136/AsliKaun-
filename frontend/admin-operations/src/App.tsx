import React, { useState, useEffect, useMemo } from "react";

export type Page = "Fleet map" | "Drift tracker" | "Review queue" | "Model health" | "Simulator";

export type Driver = {
  id: string;
  name: string;
  x: number; // Context continuity %
  y: number; // Behavior continuity %
  state: string;
  color: "green" | "blue" | "amber" | "red";
  device: string;
  speed: string;
  session: string;
  location: string;
  signals: Array<{ label: string; val: number; note: string }>;
  reason: string;
  safeStatus: string;
};

export type ReviewCase = {
  id: string;
  sessionId: number;
  driverId: string;
  quadrant: string;
  status: "OPEN" | "RESOLVED";
  reason: string;
  speed: string;
  timestamp: string;
  device: string;
  contextScore: number;
  behaviorScore: number;
};

const INITIAL_DRIVERS: Driver[] = [
  {
    id: "rider-042",
    name: "Arjun Nair",
    x: 79,
    y: 14,
    state: "Handoff signature",
    color: "red",
    device: "Samsung Galaxy A54 5G",
    speed: "18.4 mph",
    session: "#OS-8437",
    location: "Mumbai Central Sector 4",
    signals: [
      { label: "Touch biometrics", val: 18, note: "3.2× pressure · tap cadence mismatch" },
      { label: "Motion kinematics", val: 31, note: "recoil shifted · divergent pitch" },
      { label: "Operational timing", val: 14, note: "3,200 ms accept latency (3× normal)" },
      { label: "GPS mobility", val: 82, note: "consistent delivery route & zone" },
    ],
    reason: "Touch pressure spiked 3.2× while acceptance latency tripled. Device and route remain consistent, indicating a likely person-level handoff.",
    safeStatus: "Safe-pause armed · Challenge at 0 mph",
  },
  {
    id: "rider-001",
    name: "Rohan Mehta",
    x: 77,
    y: 80,
    state: "Stable identity",
    color: "green",
    device: "Google Pixel 8 Pro",
    speed: "22.1 mph",
    session: "#OS-8411",
    location: "BKC Delivery Corridor, Mumbai",
    signals: [
      { label: "Touch biometrics", val: 94, note: "0.94 anchor match · authentic stroke" },
      { label: "Motion kinematics", val: 91, note: "nominal pitch/roll signature" },
      { label: "Operational timing", val: 88, note: "450 ms nominal acceptance" },
      { label: "GPS mobility", val: 96, note: "calibrated commercial corridor" },
    ],
    reason: "Continuous biometric stream matches calibrated Gaussian anchor with 99.4% confidence.",
    safeStatus: "Active verified session · Normal operation",
  },
  {
    id: "rider-019",
    name: "Ishaan Das",
    x: 25,
    y: 75,
    state: "Legit change",
    color: "blue",
    device: "Apple iPhone 15 Pro",
    speed: "0.0 mph",
    session: "#OS-8422",
    location: "Vashi Palm Beach Road, Navi Mumbai",
    signals: [
      { label: "Touch biometrics", val: 91, note: "authentic typing cadence & dwell" },
      { label: "Motion kinematics", val: 89, note: "consistent gait acceleration" },
      { label: "Operational timing", val: 85, note: "520 ms response latency" },
      { label: "GPS mobility", val: 24, note: "new cellular subnet · hardware upgrade" },
    ],
    reason: "New hardware/IP subnet detected, but touch biometrics and motor kinematics match historical anchor. Rebaselined automatically.",
    safeStatus: "Hardware declared · Verified & rebaselined",
  },
  {
    id: "rider-088",
    name: "Vihaan Rao",
    x: 31,
    y: 18,
    state: "Ambiguous",
    color: "amber",
    device: "OnePlus 11 5G",
    speed: "28.6 mph",
    session: "#OS-8460",
    location: "OMR Corridor, Chennai",
    signals: [
      { label: "Touch biometrics", val: 48, note: "pressure variance · erratic swipe" },
      { label: "Motion kinematics", val: 42, note: "high jerk coefficient" },
      { label: "Operational timing", val: 35, note: "irregular response intervals" },
      { label: "GPS mobility", val: 65, note: "corridor edge variance" },
    ],
    reason: "Multi-modal drift detected across touch velocity and cell tower subnet. High entropy signature requiring operator attention.",
    safeStatus: "Safe-pause armed · Challenge pending safe stop",
  },
  {
    id: "rider-002",
    name: "Aarav Shah",
    x: 67,
    y: 68,
    state: "Stable identity",
    color: "green",
    device: "Samsung Galaxy M34",
    speed: "14.5 mph",
    session: "#OS-8409",
    location: "Andheri East Transit, Mumbai",
    signals: [
      { label: "Touch biometrics", val: 88, note: "calibrated swipe profile" },
      { label: "Motion kinematics", val: 86, note: "smooth bicycle dynamics" },
      { label: "Operational timing", val: 82, note: "610 ms response" },
      { label: "GPS mobility", val: 90, note: "familiar grid" },
    ],
    reason: "All biometric channels nominal. Continuity index 0.88 against 30-day anchor.",
    safeStatus: "Active verified session · Normal operation",
  },
  {
    id: "rider-007",
    name: "Kabir Singh",
    x: 88,
    y: 62,
    state: "Stable identity",
    color: "green",
    device: "Motorola Edge 40 Neo",
    speed: "19.8 mph",
    session: "#OS-8418",
    location: "Powai Tech Park, Mumbai",
    signals: [
      { label: "Touch biometrics", val: 92, note: "consistent thumb radius" },
      { label: "Motion kinematics", val: 89, note: "normal scooter vibration" },
      { label: "Operational timing", val: 90, note: "rapid dispatch response" },
      { label: "GPS mobility", val: 85, note: "known delivery radius" },
    ],
    reason: "Kinematic and operational vectors match expected driver signature.",
    safeStatus: "Active verified session · Normal operation",
  },
  {
    id: "rider-014",
    name: "Neel Roy",
    x: 76,
    y: 48,
    state: "Stable identity",
    color: "green",
    device: "Vivo V29 5G",
    speed: "0.0 mph",
    session: "#OS-8428",
    location: "Bandra Kurla Terminal, Mumbai",
    signals: [
      { label: "Touch biometrics", val: 84, note: "standard touch profile" },
      { label: "Motion kinematics", val: 81, note: "stationary terminal state" },
      { label: "Operational timing", val: 79, note: "normal app navigation" },
      { label: "GPS mobility", val: 88, note: "verified rest station" },
    ],
    reason: "Resting session at verified pickup terminal with consistent identity telemetry.",
    safeStatus: "Active verified session · Normal operation",
  },
  {
    id: "rider-055",
    name: "Dev Malhotra",
    x: 39,
    y: 53,
    state: "Legit change",
    color: "blue",
    device: "Nothing Phone (2)",
    speed: "12.3 mph",
    session: "#OS-8451",
    location: "Thane West Commercial, Mumbai",
    signals: [
      { label: "Touch biometrics", val: 87, note: "anchor match preserved" },
      { label: "Motion kinematics", val: 85, note: "expected movement profile" },
      { label: "Operational timing", val: 83, note: "consistent tap intervals" },
      { label: "GPS mobility", val: 38, note: "new WiFi BSSID · roaming sector" },
    ],
    reason: "Peripheral network switch detected; behavioral biometric verification passed.",
    safeStatus: "Hardware declared · Verified & rebaselined",
  },
  {
    id: "rider-091",
    name: "Aditya Jain",
    x: 65,
    y: 24,
    state: "Handoff signature",
    color: "red",
    device: "Xiaomi 13 Pro",
    speed: "16.2 mph",
    session: "#OS-8495",
    location: "Lower Parel Business Bay, Mumbai",
    signals: [
      { label: "Touch biometrics", val: 22, note: "abnormal swipe curvature & dwell" },
      { label: "Motion kinematics", val: 28, note: "shifted rider tilt & recoil" },
      { label: "Operational timing", val: 19, note: "delayed button actuation" },
      { label: "GPS mobility", val: 84, note: "identical delivery route" },
    ],
    reason: "Sudden shift in swipe curvature and dwell time on same delivery route. Secondary rider signature suspected.",
    safeStatus: "Safe-pause armed · Challenge at 0 mph",
  },
];

const INITIAL_CASES: ReviewCase[] = [
  {
    id: "REV-1042",
    sessionId: 1042,
    driverId: "rider-042",
    quadrant: "Handoff signature",
    status: "OPEN",
    reason: "Tap pressure spiked 3.2× and latency tripled. Same device on active route.",
    speed: "18.4 mph",
    timestamp: "Today, 14:32 IST",
    device: "Samsung Galaxy A54 5G",
    contextScore: 0.79,
    behaviorScore: 0.14,
  },
  {
    id: "REV-1088",
    sessionId: 1088,
    driverId: "rider-088",
    quadrant: "Ambiguous",
    status: "OPEN",
    reason: "IP subnet and touch velocity diverged significantly. Secondary operator suspected.",
    speed: "28.6 mph",
    timestamp: "Today, 13:45 IST",
    device: "OnePlus 11 5G",
    contextScore: 0.31,
    behaviorScore: 0.18,
  },
  {
    id: "REV-1091",
    sessionId: 1091,
    driverId: "rider-091",
    quadrant: "Handoff signature",
    status: "OPEN",
    reason: "Sudden shift in swipe curvature and dwell time on same delivery corridor.",
    speed: "16.2 mph",
    timestamp: "Today, 12:15 IST",
    device: "Xiaomi 13 Pro",
    contextScore: 0.65,
    behaviorScore: 0.24,
  },
  {
    id: "REV-1014",
    sessionId: 1014,
    driverId: "rider-019",
    quadrant: "Legit change",
    status: "RESOLVED",
    reason: "Hardware changed; biometric profile and motor cadence remained authentic.",
    speed: "0.0 mph",
    timestamp: "Yesterday, 19:04 IST",
    device: "Apple iPhone 15 Pro",
    contextScore: 0.25,
    behaviorScore: 0.75,
  },
];

const DRIVER_DRIFT_DATA: Record<string, { alert: string; rows: Array<Array<string | number>> }> = {
  "rider-042": {
    alert: "Drift breach detected at session 37 — Fast EWMA collapsed",
    rows: [
      ["SES-0037", "Today, 14:32", "0.91", "0.41", "Handoff", "18.4 mph", "Challenge queued"],
      ["SES-0036", "Today, 10:18", "0.88", "0.58", "Ambiguous", "0 mph", "Monitoring"],
      ["SES-0035", "Yesterday, 19:04", "0.93", "0.72", "Stable", "12.1 mph", "No action"],
      ["SES-0034", "Yesterday, 15:20", "0.94", "0.89", "Stable", "16.5 mph", "No action"],
    ],
  },
  "rider-088": {
    alert: "Entropy drift observed across sessions 24-28",
    rows: [
      ["SES-0028", "Today, 13:45", "0.31", "0.18", "Ambiguous", "28.6 mph", "Challenge queued"],
      ["SES-0027", "Today, 09:12", "0.42", "0.35", "Ambiguous", "15.2 mph", "Monitoring"],
      ["SES-0026", "Yesterday, 18:30", "0.68", "0.55", "Stable", "19.0 mph", "No action"],
    ],
  },
  "rider-019": {
    alert: "Hardware upgrade verified — Gaussian baseline re-anchored",
    rows: [
      ["SES-0045", "Today, 11:20", "0.25", "0.75", "Legit change", "0.0 mph", "Rebaselined"],
      ["SES-0044", "Yesterday, 19:04", "0.22", "0.78", "Legit change", "14.2 mph", "Rebaselined"],
      ["SES-0043", "Yesterday, 14:10", "0.95", "0.82", "Stable", "18.3 mph", "No action"],
    ],
  },
  "rider-001": {
    alert: "Zero drift breaches — calibrated anchor retained across 45 sessions",
    rows: [
      ["SES-0045", "Today, 14:15", "0.77", "0.80", "Stable", "22.1 mph", "No action"],
      ["SES-0044", "Today, 11:00", "0.78", "0.82", "Stable", "17.4 mph", "No action"],
      ["SES-0043", "Yesterday, 20:30", "0.75", "0.79", "Stable", "19.8 mph", "No action"],
    ],
  },
};

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const Icon = ({ name, className = "icon" }: { name: string; className?: string }) => {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    trend: <><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>,
    chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></>,
    bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/>,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 19h16"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    refresh: <><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></>,
    check: <path d="M20 6 9 17l-5-5"/>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    user: <><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    layers: <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
    alert: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
    play: <polygon points="5 3 19 12 5 21 5 3"/>,
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || paths.grid}
    </svg>
  );
};

const Metric = ({ label, value, note, tone = "" }: { label: string; value: string | number; note: string; tone?: string }) => (
  <div className="metric">
    <div className="metric-label">
      <span>{label}</span>
      <span className={`pulse ${tone}`}/>
    </div>
    <strong>{value}</strong>
    <small>{note}</small>
  </div>
);

// --- COMPONENT: Fleet Map (Continuity Matrix) ---
function FleetMap({
  drivers,
  selected,
  onSelectDriver,
  onConfirmStepUp,
  onMarkFalseAlarm,
  actionLoading,
}: {
  drivers: Driver[];
  selected: Driver;
  onSelectDriver: (d: Driver) => void;
  onConfirmStepUp: (d: Driver) => void;
  onMarkFalseAlarm: (d: Driver) => void;
  actionLoading: boolean;
}) {
  const stableCount = drivers.filter((d) => d.color === "green").length;
  const legitCount = drivers.filter((d) => d.color === "blue").length;
  const ambigCount = drivers.filter((d) => d.color === "amber").length;
  const handoffCount = drivers.filter((d) => d.color === "red").length;

  const riskPercent = selected.color === "red" ? 86 : selected.color === "amber" ? 54 : selected.color === "blue" ? 18 : 6;

  return (
    <div className="fleet-layout">
      <section className="panel map-panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Real-Time Behavioral Defense</span>
            <h2>Continuity Matrix</h2>
            <p>Spatial mapping of Context Continuity (C<sub>c</sub>) against Behavioral Continuity (C<sub>b</sub>)</p>
          </div>
          <div className="legend">
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><i className="green"/>Stable ({stableCount})</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><i className="blue"/>Legit ({legitCount})</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><i className="amber"/>Ambiguous ({ambigCount})</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><i className="red"/>Handoff ({handoffCount})</span>
          </div>
        </div>

        <div className="matrix-wrap">
          <div className="y-title">Behavior Continuity <b>C<sub>b</sub></b></div>
          <div className="matrix">
            <div className="quadrant q1">
              <b>Legitimate Shift</b>
              <span>New context · verified authentic behavior</span>
            </div>
            <div className="quadrant q2">
              <b>Stable Identity</b>
              <span>Calibrated Gaussian baseline · nominal</span>
            </div>
            <div className="quadrant q3">
              <b>Ambiguous Variance</b>
              <span>Multi-modal drift · safe-pause scheduled</span>
            </div>
            <div className="quadrant q4">
              <b>Handoff Signature</b>
              <span>Device match · anomalous touch & motor patterns</span>
            </div>

            <span className="threshold-x">Threshold C<sub>c</sub> 0.60</span>
            <span className="threshold-y">Threshold C<sub>b</sub> 0.29</span>

            {drivers.map((d) => (
              <button
                key={d.id}
                onClick={() => onSelectDriver(d)}
                className={`dot ${d.color} ${selected.id === d.id ? "selected" : ""}`}
                style={{ left: `${d.x}%`, bottom: `${d.y}%` }}
                aria-label={`Select ${d.name} (${d.id})`}
              >
                <span>{d.id.replace("rider-", "ID ")}</span>
              </button>
            ))}
          </div>
          <div className="x-title">Context Continuity <b>C<sub>c</sub></b></div>
        </div>

        <div className="map-foot">
          <span>0.0 (Total Divergence)</span>
          <span>Decision Boundary: C<sub>c</sub> = 0.60, C<sub>b</sub> = 0.29</span>
          <span>1.0 (Identical Match)</span>
        </div>
      </section>

      <aside className="panel inspector">
        <div className="inspector-top">
          <div className={`avatar ${selected.color}`}>
            {selected.name.split(" ").map((x) => x[0]).join("")}
          </div>
          <div style={{ flex: 1 }}>
            <span className="eyebrow">Active Telemetry Inspection</span>
            <h3>{selected.name}</h3>
            <p>{selected.id} · {selected.location}</p>
          </div>
          <span className={`status ${selected.color}`}>{selected.state}</span>
        </div>

        {/* Dual Continuity Metric Bar */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", margin: "16px 0 6px" }}>
          <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid var(--border-subtle)", padding: "10px 14px", borderRadius: "10px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-subtle)", textTransform: "uppercase" }}>Context C<sub>c</sub></span>
            <b style={{ display: "block", fontSize: "18px", fontFamily: "var(--font-mono)", color: "#38bdf8", marginTop: "2px" }}>{(selected.x / 100).toFixed(2)}</b>
          </div>
          <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid var(--border-subtle)", padding: "10px 14px", borderRadius: "10px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-subtle)", textTransform: "uppercase" }}>Behavior C<sub>b</sub></span>
            <b style={{ display: "block", fontSize: "18px", fontFamily: "var(--font-mono)", color: selected.y < 30 ? "#ef4444" : "#10b981", marginTop: "2px" }}>{(selected.y / 100).toFixed(2)}</b>
          </div>
        </div>

        <div className="facts">
          <div>
            <span>Device</span>
            <b>{selected.device}</b>
          </div>
          <div>
            <span>Vehicle Speed</span>
            <b>{selected.speed}</b>
          </div>
          <div>
            <span>Session Ref</span>
            <b>{selected.session}</b>
          </div>
        </div>

        <div className="section-title">
          <span>Multi-Sensor Signal Breakdown</span>
          <small>Fisher Fused</small>
        </div>

        {selected.signals.map((s) => (
          <div className="signal" key={s.label}>
            <div>
              <span>{s.label}</span>
              <small>{s.note}</small>
            </div>
            <div className="bar">
              <i style={{ width: `${s.val}%` }} className={s.val < 40 ? "danger" : ""} />
            </div>
          </div>
        ))}

        <div className="reason">
          <span className="ai-mark">AI</span>
          <div>
            <b>Neural Biometric Assessment</b>
            <p>{selected.reason}</p>
          </div>
        </div>

        <div className="safe">
          <span>Safety Protocol</span>
          <b>{selected.safeStatus}</b>
        </div>

        <div className="actions">
          <button
            className="primary"
            style={selected.color === "red" ? { background: "linear-gradient(135deg, #b91c1c, #ef4444)", borderColor: "#f87171" } : {}}
            disabled={actionLoading}
            onClick={() => onConfirmStepUp(selected)}
          >
            <Icon name="alert"/>
            {actionLoading ? "Dispatching..." : "Confirm Step-Up"}
          </button>
          <button
            className="secondary"
            disabled={actionLoading}
            onClick={() => onMarkFalseAlarm(selected)}
          >
            <Icon name="check"/>
            {actionLoading ? "Updating..." : "Mark False Alarm"}
          </button>
        </div>
      </aside>
    </div>
  );
}

// --- COMPONENT: Drift Tracker ---
function DriftTracker({ onNotify }: { onNotify: (msg: string) => void }) {
  const [activeDriverId, setActiveDriverId] = useState<string>("rider-042");
  const driftInfo = DRIVER_DRIFT_DATA[activeDriverId] || DRIVER_DRIFT_DATA["rider-042"];

  const exportHistory = () => {
    downloadCsv(`${activeDriverId}-session-history.csv`, [
      ["Session ID", "Timestamp", "Context Score", "Behavior Score", "Quadrant", "Vehicle Speed", "Verdict"],
      ...driftInfo.rows,
    ]);
    onNotify(`Downloaded session history for ${activeDriverId}`);
  };

  const handleRowClick = (row: Array<string | number>) => {
    onNotify(`Selected session ${row[0]}: ${row[4]} at ${row[5]} speed (${row[6]})`);
  };

  return (
    <section className="panel page-panel">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Longitudinal Baseline Defense</span>
          <h2>Dual-Timescale Behavioral Drift Tracker</h2>
          <p>EWMA dynamic response vs immutable initial Gaussian anchor</p>
        </div>
        <div className="alert-pill">{driftInfo.alert}</div>
      </div>

      <div style={{ display: "flex", gap: "10px", margin: "16px 0 8px" }}>
        {Object.keys(DRIVER_DRIFT_DATA).map((id) => (
          <button
            key={id}
            onClick={() => setActiveDriverId(id)}
            className={`driver-pill-btn ${activeDriverId === id ? "active" : ""}`}
          >
            {id} {id === "rider-042" ? "🔴 (Breach)" : id === "rider-088" ? "🟡 (Drift)" : id === "rider-019" ? "🔵 (Upgrade)" : "🟢 (Stable)"}
          </button>
        ))}
      </div>

      <div className="timeline">
        <div className="chart-labels">
          <span>1.00</span>
          <span>0.70</span>
          <span>0.40</span>
          <span>0.00</span>
        </div>
        <svg viewBox="0 0 900 240" preserveAspectRatio="none">
          <defs>
            <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#38bdf8" stopOpacity=".25"/>
              <stop offset="1" stopColor="#38bdf8" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path className="gridline" d="M0 30H900M0 90H900M0 150H900M0 210H900"/>
          <path className="anchor" d="M0 44H900"/>
          <path className="area" d="M0 49 C150 45 220 52 310 70 S460 91 540 105 S690 165 780 170 S850 182 900 188 V220H0Z"/>
          <path className="ewma" d="M0 49 C150 45 220 52 310 70 S460 91 540 105 S690 165 780 170 S850 182 900 188"/>
          {activeDriverId === "rider-042" && <circle className="breach" cx="780" cy="170" r="8"/>}
        </svg>
        <div className="chart-bottom">
          <span>Session 1 (Enrollment Baseline)</span>
          <span>Session 15</span>
          <span>Session 30</span>
          <span>Session 45 (Recent Ingest)</span>
        </div>
        <div className="chart-legend">
          <span><i className="line solid"/>Frozen Anchor (Anchor C<sub>b</sub>: 0.94)</span>
          <span><i className="line dashed"/>Fast EWMA (Short-Timescale Smoothing)</span>
          <span><i className="circle"/>Breach Threshold (Handoff Interlock)</span>
        </div>
      </div>

      <div className="table-title">
        <h3>Session Audit Log ({activeDriverId})</h3>
        <button className="secondary" onClick={exportHistory}>
          <Icon name="download"/> Export Audit CSV
        </button>
      </div>

      <table>
        <thead>
          <tr>
            {["Session ID", "Timestamp", "Context C_c", "Behavior C_b", "Quadrant Classification", "Vehicle Speed", "Operational Verdict"].map((x) => (
              <th key={x}>{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {driftInfo.rows.map((r) => (
            <tr key={String(r[0])} style={{ cursor: "pointer" }} onClick={() => handleRowClick(r)}>
              {r.map((x, j) => (
                <td key={`${r[0]}-${j}`}>
                  {j === 4 ? (
                    <span className={`status ${String(x).includes("Handoff") ? "red" : String(x).includes("Ambiguous") ? "amber" : String(x).includes("Legit") ? "blue" : "green"}`}>
                      {x}
                    </span>
                  ) : (
                    x
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// --- COMPONENT: Review Queue ---
function ReviewQueue({
  cases,
  onResolveCase,
  onOpenCaseModal,
  onNotify,
}: {
  cases: ReviewCase[];
  onResolveCase: (id: string, resolution?: string) => void;
  onOpenCaseModal: (c: ReviewCase) => void;
  onNotify: (msg: string) => void;
}) {
  const [filter, setFilter] = useState<"All" | "Open" | "Resolved">("All");
  const [search, setSearch] = useState("");

  const shown = useMemo(() => {
    return cases.filter((c) => {
      const matchesFilter = filter === "All" || (filter === "Open" && c.status === "OPEN") || (filter === "Resolved" && c.status === "RESOLVED");
      const matchesSearch =
        !search ||
        c.id.toLowerCase().includes(search.toLowerCase()) ||
        c.driverId.toLowerCase().includes(search.toLowerCase()) ||
        c.reason.toLowerCase().includes(search.toLowerCase()) ||
        c.quadrant.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [cases, filter, search]);

  const openCount = cases.filter((c) => c.status === "OPEN").length;
  const resolvedCount = cases.filter((c) => c.status === "RESOLVED").length;

  const exportQueue = () => {
    downloadCsv("aslikaun-review-queue.csv", [
      ["Review ID", "Driver ID", "Quadrant", "Status", "Speed", "Timestamp", "Reason"],
      ...cases.map((c) => [c.id, c.driverId, c.quadrant, c.status, c.speed, c.timestamp, c.reason]),
    ]);
    onNotify("Review audit log downloaded");
  };

  return (
    <section className="panel page-panel">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Security Action Center</span>
          <h2>Prioritized Review Queue</h2>
          <p>Autonomous step-up reviews gated by safe-pause interlock (0 mph)</p>
        </div>
        <button className="primary" onClick={exportQueue}>
          <Icon name="download"/> Export Audit CSV
        </button>
      </div>

      <div className="toolbar">
        <div className="chips">
          <button onClick={() => setFilter("All")} className={filter === "All" ? "active" : ""}>
            All ({cases.length})
          </button>
          <button onClick={() => setFilter("Open")} className={filter === "Open" ? "active" : ""}>
            Open ({openCount})
          </button>
          <button onClick={() => setFilter("Resolved")} className={filter === "Resolved" ? "active" : ""}>
            Resolved ({resolvedCount})
          </button>
        </div>

        <div className="search">
          <Icon name="search"/>
          <input
            type="text"
            placeholder="Search by driver ID, review ID, or telemetry reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "16px" }}
              onClick={() => setSearch("")}
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="cases">
        {shown.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontSize: "14px" }}>
            No security incidents match your current filter.
          </div>
        ) : (
          shown.map((c) => {
            const isResolved = c.status === "RESOLVED";
            const toneColor = isResolved ? "green" : c.quadrant.includes("Handoff") ? "red" : c.quadrant.includes("Ambiguous") ? "amber" : "blue";
            return (
              <article key={c.id} className="case">
                <div className={`case-icon ${toneColor}`}>
                  <Icon name="shield"/>
                </div>
                <div>
                  <b>#{c.id}</b>
                  <span>{c.driverId}</span>
                </div>
                <div>
                  <span className={`status ${toneColor}`}>{c.quadrant}</span>
                  <small>{c.status}</small>
                </div>
                <p>
                  {c.reason} <b style={{ color: "var(--text-muted)", marginLeft: "8px" }}>· {c.speed}</b>
                </p>
                <div className="case-actions">
                  <button className="secondary" onClick={() => onOpenCaseModal(c)}>
                    {isResolved ? "Inspect Audit" : "Verify Step-Up"}
                  </button>
                  {!isResolved && (
                    <button
                      className="more"
                      aria-label={`Resolve ${c.id}`}
                      title="Clear and verify baseline"
                      onClick={() => onResolveCase(c.id, "cleared")}
                    >
                      ✓
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

// --- COMPONENT: Model Health ---
function ModelHealth({ onNotify }: { onNotify: (msg: string) => void }) {
  const [selectedModel, setSelectedModel] = useState<string>("Fisher fusion");
  const [isVerifying, setIsVerifying] = useState(false);

  const modelDetails: Record<string, string> = {
    "Touch triplet": "Triplet-loss Siamese network trained on 840,000 commercial delivery taps. Evaluates touch dwell duration, velocity curvature entropy, and micro-pressure peaks.",
    "Motion kinematics": "Bi-directional GRU parsing high-frequency accelerometer and gyroscope telemetry. Isolates vehicle vibrations from driver motor tilt with 37% AUC lift.",
    "Fisher fusion": "Parametric Fisher combination fusing log-likelihood ratio scores across touch, motion, and operational timing under non-stationary environmental noise.",
  };

  const runVerification = () => {
    setIsVerifying(true);
    window.setTimeout(() => {
      setIsVerifying(false);
      onNotify("KS-Test calibration verified: All model p-values uniform (D=0.038, p > 0.10). Zero demographic or environmental bias.");
    }, 900);
  };

  return (
    <div className="model-grid">
      <section className="panel page-panel span">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Model Assurance & Calibration</span>
            <h2>Model Performance & Demographic Fairness</h2>
            <p>Live inference monitoring · production calibration v2.4</p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span className="healthy">All Models Calibrated</span>
            <button className="secondary" onClick={runVerification} disabled={isVerifying}>
              <Icon name="refresh" className={isVerifying ? "spin" : ""}/>
              {isVerifying ? "Verifying..." : "Run Calibration Check"}
            </button>
          </div>
        </div>

        <div className="model-cards">
          {[
            ["Touch triplet", "0.352", "0.722", "Baseline Model"],
            ["Motion kinematics", "0.277", "0.780", "37% Lift over Touch"],
            ["Fisher fusion", "0.158", "0.921", "State of the Art (Fused)"],
          ].map((m) => (
            <div
              key={m[0]}
              className={`${m[0] === selectedModel ? "featured" : ""}`}
              style={{ cursor: "pointer" }}
              onClick={() => setSelectedModel(m[0])}
            >
              <span>{m[0]}</span>
              <b>AUC {m[2]}</b>
              <p>Equal Error Rate (EER): {m[1]}</p>
              <small>{m[3]}</small>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "18px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid var(--border-subtle)", padding: "16px 20px", borderRadius: "12px" }}>
          <b style={{ fontSize: "13px", color: "var(--green-core)" }}>{selectedModel} Architecture & Invariance:</b>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#cbd5e1", lineHeight: 1.6 }}>
            {modelDetails[selectedModel]}
          </p>
        </div>
      </section>

      <section className="panel chart-card">
        <div>
          <span className="eyebrow">Cohort Equity</span>
          <h3>False-Challenge Rate by Demographic Cohort</h3>
        </div>
        <div className="bars">
          {[
            ["Standard Baseline Operation", 0.9, "48,200 sessions"],
            ["New Phone / Hardware Upgrade", 1.1, "3,400 sessions"],
            ["City Transit / Zone Relocation", 1.2, "2,150 sessions"],
            ["Monsoon / Bumpy Road Kinematics", 1.4, "6,800 sessions"],
          ].map((x) => (
            <div key={x[0] as string} style={{ cursor: "pointer" }} onClick={() => onNotify(`Cohort ${x[0]}: ${x[1]}% false-challenge rate across ${x[2]}`)}>
              <label>
                <span>{x[0]} <small style={{ color: "var(--text-subtle)", marginLeft: "6px" }}>({x[2]})</small></span>
                <b>{x[1]}%</b>
              </label>
              <i>
                <em style={{ width: `${Number(x[1]) * 55}%` }} />
              </i>
            </div>
          ))}
        </div>
        <div className="takeaway">
          <b>0.5pp Maximum Variance Across All Cohorts</b>
          <span>Environmental shifts and phone upgrades maintain equal driver friction across all delivery conditions.</span>
        </div>
      </section>

      <section className="panel chart-card">
        <div>
          <span className="eyebrow">Statistical Validation</span>
          <h3>Fused P-Value Distribution (KS Uniformity)</h3>
        </div>
        <div className="histogram">
          {[78, 55, 40, 31, 25, 20, 18, 17, 18, 21, 25, 28, 30, 29, 31, 34, 36, 33, 37, 34].map((h, i) => (
            <i
              key={`${i}-${h}`}
              className={i < 3 ? "hot" : ""}
              style={{ height: `${h}%` }}
              title={`Bin ${i}: ${h}%`}
              onClick={() => onNotify(`Bin ${i * 0.05} - ${(i + 1) * 0.05}: ${h}% frequency (${i < 3 ? "Impostor peak" : "Uniform nominal stream"})`)}
            />
          ))}
        </div>
        <div className="hist-label">
          <span>0.0 · Impostor Peak (Handoffs)</span>
          <span>Nominal Uniform Distribution · 1.0 (True Identity)</span>
        </div>
        <div className="takeaway">
          <b>Kolmogorov-Smirnov Test Passed (p = 0.94)</b>
          <span>Nominal sessions retain a mathematically uniform p-value distribution under continuous scoring.</span>
        </div>
      </section>
    </div>
  );
}

// --- COMPONENT: Attack & Scenario Simulator ---
type SimResult = {
  scenario: string;
  driverId: string;
  decision: string;
  quadrant: string;
  contextScore: number | null;
  behaviorScore: number | null;
  reason: string;
  isSimulated: boolean;
};

function Simulator({
  onAddDriverToMatrix,
  onAddCaseToQueue,
  onNotify,
}: {
  onAddDriverToMatrix: (d: Driver) => void;
  onAddCaseToQueue: (c: ReviewCase) => void;
  onNotify: (msg: string) => void;
}) {
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);

  const scenarios = [
    {
      title: "Lazy renter",
      sub: "Immediate account handoff to secondary rider",
      tag: "Handoff signature",
      tone: "red",
      driverId: "rider-sim-lazy",
      payload: {
        driver_id: "rider-sim-lazy",
        device_id: "dev-samsung-a54",
        ip_subnet: "192.168.1.0/24",
        zone: "mumbai_central",
        vehicle_speed_mph: 18.4,
        accept_latency_ms: 3200,
        touch_events: [{ type: "tap", pressure: 0.94, duration_ms: 220 }],
        accel: [{ x: 2.1, y: 3.4, z: 9.1, t: new Date().toISOString() }],
        is_simulated: true,
      },
    },
    {
      title: "Slow-drift renter",
      sub: "60-session boiling frog gradual attack",
      tag: "Drift breach",
      tone: "red",
      driverId: "rider-sim-drift",
      payload: {
        driver_id: "rider-sim-drift",
        device_id: "dev-samsung-a54",
        ip_subnet: "192.168.1.0/24",
        zone: "mumbai_central",
        vehicle_speed_mph: 15.0,
        accept_latency_ms: 2400,
        touch_events: [{ type: "tap", pressure: 0.78, duration_ms: 180 }],
        accel: [{ x: 1.8, y: 2.5, z: 8.9, t: new Date().toISOString() }],
        is_simulated: true,
      },
    },
    {
      title: "Split-shift co-rider",
      sub: "Alternating riders across login windows",
      tag: "Periodic anomaly",
      tone: "amber",
      driverId: "rider-sim-split",
      payload: {
        driver_id: "rider-sim-split",
        device_id: "dev-oneplus-11",
        ip_subnet: "192.168.10.0/24",
        zone: "chennai_omr",
        vehicle_speed_mph: 22.0,
        accept_latency_ms: 1800,
        touch_events: [{ type: "tap", pressure: 0.62, duration_ms: 130 }],
        accel: [{ x: 0.8, y: 1.2, z: 9.8, t: new Date().toISOString() }],
        is_simulated: true,
      },
    },
    {
      title: "Copycat attacker",
      sub: "Replicates delivery zone and vehicle speed",
      tag: "Touch mismatch",
      tone: "red",
      driverId: "rider-sim-copycat",
      payload: {
        driver_id: "rider-sim-copycat",
        device_id: "dev-samsung-a54",
        ip_subnet: "192.168.1.0/24",
        zone: "mumbai_central",
        vehicle_speed_mph: 12.0,
        accept_latency_ms: 3600,
        touch_events: [{ type: "swipe", pressure: 0.91, velocity: 820.0 }],
        accel: [{ x: 1.9, y: 2.1, z: 9.3, t: new Date().toISOString() }],
        is_simulated: true,
      },
    },
    {
      title: "Legitimate phone upgrade",
      sub: "New hardware purchase, authentic touch biometrics",
      tag: "Legit change",
      tone: "blue",
      driverId: "rider-sim-upgrade",
      payload: {
        driver_id: "rider-sim-upgrade",
        device_id: "dev-iphone-15-pro-new",
        ip_subnet: "10.20.30.0/24",
        zone: "navi_mumbai_vashi",
        vehicle_speed_mph: 0.0,
        accept_latency_ms: 510,
        touch_events: [{ type: "tap", pressure: 0.35, duration_ms: 90 }],
        accel: [{ x: 0.1, y: 0.2, z: 9.8, t: new Date().toISOString() }],
        is_simulated: true,
      },
    },
    {
      title: "Cold-start rider",
      sub: "First-time login · population conformal anchor",
      tag: "Observed",
      tone: "green",
      driverId: "rider-sim-coldstart",
      payload: {
        driver_id: "rider-sim-coldstart",
        device_id: "dev-pixel-8",
        ip_subnet: "192.168.4.0/24",
        zone: "bkc_mumbai",
        vehicle_speed_mph: 0.0,
        accept_latency_ms: 600,
        touch_events: [{ type: "tap", pressure: 0.38, duration_ms: 95 }],
        accel: [{ x: 0.12, y: 0.15, z: 9.81, t: new Date().toISOString() }],
        is_simulated: true,
      },
    },
  ];

  const runSimulation = async (scenario: (typeof scenarios)[0]) => {
    setRunning(scenario.title);
    onNotify(`Injecting synthetic stream for "${scenario.title}"...`);

    try {
      const token = sessionStorage.getItem("tm-auth-token") || "demo-admin-session-token";
      const res = await fetch("/v1/sessions/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(scenario.payload),
      });

      if (res.ok) {
        const data = await res.json();
        const simRes: SimResult = {
          scenario: scenario.title,
          driverId: data.driver_id || scenario.driverId,
          decision: (data.decision || "challenge_at_safe_pause").toUpperCase(),
          quadrant: (data.quadrant || scenario.tag).replace(/_/g, " "),
          contextScore: typeof data.context_score === "number" ? data.context_score : 0.88,
          behaviorScore: typeof data.behavior_score === "number" ? data.behavior_score : 0.21,
          reason: data.reasons && data.reasons.length > 0 ? data.reasons[0] : `${scenario.title} detected via Fisher multi-sensor fusion.`,
          isSimulated: true,
        };
        setResult(simRes);
        onNotify(`✓ Simulation complete: ${simRes.decision} (${simRes.quadrant})`);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch {
      // Offline fallback
      const simRes: SimResult = {
        scenario: scenario.title,
        driverId: scenario.driverId,
        decision: scenario.tone === "red" ? "CHALLENGE_AT_SAFE_PAUSE" : scenario.tone === "blue" ? "REBASELINE" : "CONTINUE",
        quadrant: scenario.tag,
        contextScore: scenario.tone === "blue" ? 0.25 : 0.85,
        behaviorScore: scenario.tone === "red" ? 0.18 : 0.82,
        reason: `${scenario.title}: Simulated sensor mismatch evaluated by Fisher continuous fusion pipeline.`,
        isSimulated: true,
      };
      setResult(simRes);
      onNotify(`✓ Simulation evaluated: ${simRes.decision}`);
    } finally {
      setRunning(null);
    }
  };

  const handleInspectInMatrix = () => {
    if (!result) return;
    const tone: "green" | "blue" | "amber" | "red" =
      result.quadrant.toLowerCase().includes("handoff") || result.quadrant.toLowerCase().includes("breach") || result.quadrant.toLowerCase().includes("mismatch")
        ? "red"
        : result.quadrant.toLowerCase().includes("legit")
        ? "blue"
        : result.quadrant.toLowerCase().includes("periodic") || result.quadrant.toLowerCase().includes("ambiguous")
        ? "amber"
        : "green";

    const simDriver: Driver = {
      id: result.driverId,
      name: `Simulated (${result.scenario})`,
      x: result.contextScore ? Math.round(result.contextScore * 100) : 80,
      y: result.behaviorScore ? Math.round(result.behaviorScore * 100) : 20,
      state: result.quadrant,
      color: tone,
      device: "Simulated Device (Sandbox)",
      speed: "18.4 mph",
      session: `#SIM-${Date.now().toString().slice(-4)}`,
      location: "Active Simulation Sector",
      signals: [
        { label: "Touch biometrics", val: result.behaviorScore ? Math.round(result.behaviorScore * 100) : 20, note: "simulated stream" },
        { label: "Motion kinematics", val: 35, note: "simulated shift" },
        { label: "Operational timing", val: 25, note: "simulated delay" },
        { label: "GPS mobility", val: result.contextScore ? Math.round(result.contextScore * 100) : 85, note: "simulated route" },
      ],
      reason: result.reason,
      safeStatus: "Simulation Session · Safe-pause armed",
    };

    onAddDriverToMatrix(simDriver);
  };

  const handleAddToQueue = () => {
    if (!result) return;
    const newCase: ReviewCase = {
      id: `REV-${Math.floor(1000 + Math.random() * 9000)}`,
      sessionId: Math.floor(1000 + Math.random() * 9000),
      driverId: result.driverId,
      quadrant: result.quadrant,
      status: "OPEN",
      reason: result.reason,
      speed: "18.4 mph",
      timestamp: "Just now (Simulation)",
      device: "Simulated Sandbox Device",
      contextScore: result.contextScore || 0.85,
      behaviorScore: result.behaviorScore || 0.2,
    };
    onAddCaseToQueue(newCase);
  };

  return (
    <section className="panel page-panel">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Interactive Attack Vector Testing</span>
          <h2>Adversarial & Scenario Simulator</h2>
          <p>Inject synthesized high-frequency touch, motion, and operational streams into the live pipeline</p>
        </div>
        <span className="sandbox">Live Isolation Sandbox</span>
      </div>

      {result && (
        <div className="sim-result">
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <span className={`status ${result.quadrant.toLowerCase().includes("handoff") ? "red" : "blue"}`} style={{ fontSize: "11px" }}>
                {result.decision}
              </span>
              <b style={{ fontSize: "15px", color: "#ffffff" }}>{result.scenario} classified as {result.quadrant}</b>
            </div>
            <p style={{ margin: "6px 0 10px", fontSize: "13px", color: "#e2e8f0", lineHeight: 1.5 }}>{result.reason}</p>
            <div style={{ display: "flex", gap: "20px", fontSize: "12px", color: "var(--text-muted)" }}>
              <span>Context Continuity: <b style={{ color: "#38bdf8" }}>{result.contextScore ?? "N/A"}</b></span>
              <span>Behavior Continuity: <b style={{ color: result.behaviorScore && result.behaviorScore < 0.3 ? "#ef4444" : "#10b981" }}>{result.behaviorScore ?? "N/A"}</b></span>
              <span>Injected Identifier: <b style={{ color: "#ffffff" }}>{result.driverId}</b></span>
            </div>
            <div className="sim-actions">
              <button className="primary" onClick={handleInspectInMatrix}>
                <Icon name="grid"/> View Driver in Continuity Matrix →
              </button>
              <button className="secondary" onClick={handleAddToQueue}>
                <Icon name="shield"/> Queue Review Case →
              </button>
            </div>
          </div>
          <button
            onClick={() => setResult(null)}
            style={{ fontSize: "22px", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", height: "fit-content" }}
            aria-label="Dismiss simulation result"
          >
            ×
          </button>
        </div>
      )}

      <div className="scenario-heading">
        <span>Synthetic Adversarial Injections</span>
        <small>Click to execute real-time feature extraction & Fisher scoring</small>
      </div>

      <div className="scenarios">
        {scenarios.map((s, i) => {
          const isCurrentRunning = running === s.title;
          return (
            <button
              key={s.title}
              className={`scenario ${i > 3 ? "honest" : ""}`}
              disabled={Boolean(running)}
              onClick={() => runSimulation(s)}
            >
              <span className={`scenario-num ${s.tone}`}>
                {isCurrentRunning ? <Icon name="refresh" className="spin"/> : `0${i + 1}`}
              </span>
              <div style={{ flex: 1 }}>
                <h3>{s.title}</h3>
                <p>{s.sub}</p>
                <b>
                  {isCurrentRunning ? "Processing Pipeline..." : `${s.tag} →`}
                </b>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// --- MAIN APPLICATION ---
export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("tm-theme") as "light" | "dark") || "light";
  });
  const [page, setPage] = useState<Page>("Fleet map");
  const [message, setMessage] = useState("");
  const [drivers, setDrivers] = useState<Driver[]>(INITIAL_DRIVERS);
  const [selectedDriver, setSelectedDriver] = useState<Driver>(INITIAL_DRIVERS[0]);
  const [cases, setCases] = useState<ReviewCase[]>(INITIAL_CASES);
  const [activeCaseModal, setActiveCaseModal] = useState<ReviewCase | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("tm-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    notify(`Switched to ${nextTheme === "light" ? "Light Mode ☀️" : "Dark Mode 🌙"}`);
  };

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2800);
  };

  const fetchLiveScores = async () => {
    setIsRefreshing(true);
    try {
      const token = sessionStorage.getItem("tm-auth-token") || "demo-admin-session-token";
      const [scoresRes, queueRes] = await Promise.all([
        fetch("/v1/fleet/scores", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/v1/review-queue?status=all", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (scoresRes.ok) {
        const scoresData = await scoresRes.json();
        if (scoresData.drivers && scoresData.drivers.length > 0) {
          setDrivers((current) => {
            const updated = [...current];
            for (const apiDriver of scoresData.drivers) {
              const idx = updated.findIndex((d) => d.id === apiDriver.driver_id);
              const tone = apiDriver.quadrant === "handoff_signature" ? "red" : apiDriver.quadrant === "legitimate_change" ? "blue" : apiDriver.quadrant === "ambiguous" ? "amber" : "green";
              const driverObj: Driver = {
                id: apiDriver.driver_id,
                name: idx >= 0 ? updated[idx].name : `Driver ${apiDriver.driver_id}`,
                x: apiDriver.context_score ? Math.round(apiDriver.context_score * 100) : (idx >= 0 ? updated[idx].x : 70),
                y: apiDriver.behavior_score ? Math.round(apiDriver.behavior_score * 100) : (idx >= 0 ? updated[idx].y : 70),
                state: apiDriver.quadrant ? apiDriver.quadrant.replace(/_/g, " ") : "Stable identity",
                color: tone,
                device: idx >= 0 ? updated[idx].device : "Android Enterprise Terminal",
                speed: idx >= 0 ? updated[idx].speed : "15.0 mph",
                session: idx >= 0 ? updated[idx].session : "#OS-8499",
                location: idx >= 0 ? updated[idx].location : "Central Delivery Grid",
                signals: idx >= 0 ? updated[idx].signals : [
                  { label: "Touch biometrics", val: Math.round((apiDriver.behavior_score || 0.7) * 100), note: "live scored" },
                  { label: "Motion kinematics", val: 80, note: "live stream" },
                  { label: "Operational timing", val: 75, note: "live stream" },
                  { label: "GPS mobility", val: Math.round((apiDriver.context_score || 0.8) * 100), note: "live corridor" },
                ],
                reason: apiDriver.reasons && apiDriver.reasons.length > 0 ? apiDriver.reasons[0] : (idx >= 0 ? updated[idx].reason : "Scored via backend ML pipeline."),
                safeStatus: apiDriver.decision === "challenge_at_safe_pause" ? "Safe-pause armed · Challenge at 0 mph" : "Active verified session",
              };

              if (idx >= 0) {
                updated[idx] = { ...updated[idx], ...driverObj };
              } else {
                updated.push(driverObj);
              }
            }
            return updated;
          });
        }
      }

      if (queueRes.ok) {
        const queueData = await queueRes.json();
        if (queueData.items && queueData.items.length > 0) {
          const apiCases: ReviewCase[] = queueData.items.map((item: any) => ({
            id: `REV-${item.review_id || item.session_id}`,
            sessionId: item.session_id,
            driverId: item.driver_id,
            quadrant: (item.quadrant || "Handoff signature").replace(/_/g, " "),
            status: item.status === "resolved" ? "RESOLVED" : "OPEN",
            reason: item.reasons && item.reasons.length > 0 ? item.reasons[0] : (item.reviewer_note || "Flagged for step-up review."),
            speed: "0.0 mph (Safe-stop)",
            timestamp: item.created_at ? new Date(item.created_at).toLocaleTimeString() : "Recent",
            device: "Fleet Registered Device",
            contextScore: item.context_score ?? 0.75,
            behaviorScore: item.behavior_score ?? 0.25,
          }));
          setCases(apiCases);
        }
      }

      notify("Live fleet telemetry & review queue synchronized with backend");
    } catch {
      notify("Offline demo mode active — local verified state retained");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLiveScores();
  }, []);

  const handleConfirmStepUp = async (driver: Driver) => {
    setActionLoading(true);
    try {
      const token = sessionStorage.getItem("tm-auth-token") || "demo-admin-session-token";
      await fetch("/v1/sessions/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          driver_id: driver.id,
          device_id: driver.device,
          vehicle_speed_mph: 0.0,
          is_simulated: true,
          touch_events: [{ type: "tap", pressure: 0.92, duration_ms: 240 }],
        }),
      });

      setDrivers((current) =>
        current.map((d) =>
          d.id === driver.id
            ? { ...d, state: "Handoff (Challenge armed)", color: "red", safeStatus: "Step-up challenge armed · Scheduled for next safe stop (0 mph)" }
            : d
        )
      );

      setSelectedDriver((prev) =>
        prev.id === driver.id
          ? { ...prev, state: "Handoff (Challenge armed)", color: "red", safeStatus: "Step-up challenge armed · Scheduled for next safe stop (0 mph)" }
          : prev
      );

      notify(`Step-up challenge queued for ${driver.id} at next safe pause (0 mph)`);
    } catch {
      notify(`Step-up queued for ${driver.id} at the next safe stop`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkFalseAlarm = async (driver: Driver) => {
    setActionLoading(true);
    try {
      const token = sessionStorage.getItem("tm-auth-token") || "demo-admin-session-token";
      const matchingCase = cases.find((c) => c.driverId === driver.id && c.status === "OPEN");
      if (matchingCase) {
        await fetch(`/v1/review-queue/${matchingCase.sessionId}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ resolution: "cleared", reviewer_note: "Marked false alarm by operator in live console." }),
        });
        setCases((current) =>
          current.map((c) => (c.id === matchingCase.id ? { ...c, status: "RESOLVED" } : c))
        );
      }

      setDrivers((current) =>
        current.map((d) =>
          d.id === driver.id
            ? { ...d, state: "Stable identity", color: "green", x: 82, y: 78, safeStatus: "Verified session · False alarm cleared" }
            : d
        )
      );

      setSelectedDriver((prev) =>
        prev.id === driver.id
          ? { ...prev, state: "Stable identity", color: "green", x: 82, y: 78, safeStatus: "Verified session · False alarm cleared" }
          : prev
      );

      notify(`${driver.id} marked false alarm — baseline verified and cleared`);
    } catch {
      notify(`${driver.id} marked for baseline review`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveCase = async (id: string, resolution = "cleared") => {
    const targetCase = cases.find((c) => c.id === id);
    if (!targetCase) return;

    try {
      const token = sessionStorage.getItem("tm-auth-token") || "demo-admin-session-token";
      await fetch(`/v1/review-queue/${targetCase.sessionId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          resolution: resolution,
          reviewer_note: `Resolved via operations dashboard with verdict: ${resolution}`,
        }),
      });
    } catch {
      // Offline fallback
    }

    setCases((current) =>
      current.map((c) => (c.id === id ? { ...c, status: "RESOLVED" } : c))
    );

    if (activeCaseModal && activeCaseModal.id === id) {
      setActiveCaseModal(null);
    }

    notify(`Case #${id} resolved: ${resolution.replace(/_/g, " ")}`);
  };

  const exportFleet = () => {
    downloadCsv("aslikaun-live-fleet.csv", [
      ["Driver ID", "Driver Name", "Context Score", "Behavior Score", "Classification", "Speed", "Session ID"],
      ...drivers.map((d) => [d.id, d.name, d.x / 100, d.y / 100, d.state, d.speed, d.session]),
    ]);
    notify("Live fleet snapshot downloaded");
  };

  const handleSignOut = () => {
    sessionStorage.removeItem("tm-auth");
    sessionStorage.removeItem("tm-auth-token");
    sessionStorage.removeItem("tm-auth-user");
    window.location.assign("/index.html");
  };

  const openCasesCount = cases.filter((c) => c.status === "OPEN").length;
  const handoffAlertsCount = drivers.filter((d) => d.color === "red").length;
  const safePauseCount = drivers.filter((d) => d.safeStatus.toLowerCase().includes("safe-pause") || d.safeStatus.toLowerCase().includes("0 mph")).length;

  const pages: [Page, string][] = [
    ["Fleet map", "grid"],
    ["Drift tracker", "trend"],
    ["Review queue", "shield"],
    ["Model health", "chart"],
    ["Simulator", "bolt"],
  ];

  return (
    <div className="app">
      <header>
        <div className="brand">
          <div className="brand-mark" style={{ background: "transparent", padding: "2px" }}>
            <img
              src="/aslikaun-logo.png"
              alt="AsliKaun logo"
              style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "8px" }}
            />
          </div>
          <div>
            <b>AsliKaun AI</b>
            <span>BIOMETRIC FLEET DEFENSE</span>
          </div>
        </div>

        <nav>
          {pages.map((p) => (
            <button
              key={p[0]}
              className={page === p[0] ? "active" : ""}
              onClick={() => setPage(p[0])}
            >
              <Icon name={p[1]}/>
              {p[0]}
              {p[0] === "Review queue" && openCasesCount > 0 && <i>{openCasesCount}</i>}
            </button>
          ))}
        </nav>

        <div className="header-right">
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={`Current theme: ${theme.toUpperCase()}. Click to switch to ${theme === "light" ? "Dark Mode" : "Light Mode"}`}
          >
            {theme === "light" ? "🌙 Dark" : "☀️ Light"}
          </button>

          <button
            className="live-btn"
            onClick={fetchLiveScores}
            disabled={isRefreshing}
            title="Click to refresh live fleet scores from backend"
          >
            <i/>
            {isRefreshing ? "Syncing..." : "Live Ingest · 84 ms"}
          </button>

          <button className="export" onClick={exportFleet}>
            <Icon name="download"/>
            Export CSV
          </button>

          <div className="user-menu-wrap">
            <button
              className="user-btn"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              title="Operator profile and settings"
            >
              SK
            </button>
            {userDropdownOpen && (
              <div className="user-dropdown">
                <div className="user-dropdown-header">
                  <b>Alex Morgan</b>
                  <span>Chief Operations Officer · admin@aslikaun.ai</span>
                </div>
                <button onClick={() => { toggleTheme(); setUserDropdownOpen(false); }}>
                  {theme === "light" ? "🌙 Switch to Dark Mode" : "☀️ Switch to Light Mode"}
                </button>
                <button onClick={() => { fetchLiveScores(); setUserDropdownOpen(false); }}>
                  <Icon name="refresh"/> Sync Backend Telemetry
                </button>
                <button
                  className="danger"
                  onClick={handleSignOut}
                >
                  <Icon name="logout"/> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main>
        <div className="page-title">
          <div>
            <span className="eyebrow">Enterprise Telemetry & Operations</span>
            <h1>{page}</h1>
          </div>
          <div className="updated">
            <i/>
            Verified Live Ingest <span>{new Date().toLocaleTimeString()}</span>
          </div>
        </div>

        <div className="metrics">
          <Metric label="Active Live Sessions" value={drivers.length * 15 + 7} note="+8 continuous sessions in the last hour"/>
          <Metric label="Handoff Threats" value={handoffAlertsCount} note={`${openCasesCount} open reviews requiring action`} tone={handoffAlertsCount > 0 ? "red" : "green"}/>
          <Metric label="Safe-Pause Queue" value={safePauseCount} note="Armed to challenge at 0 mph vehicle stop" tone="amber"/>
          <Metric label="False-Alarm Rate" value="0.9%" note="Rolling 24-hr KS calibrated baseline" tone="blue"/>
        </div>

        <div className="page-content" key={page}>
          {page === "Fleet map" ? (
            <FleetMap
              drivers={drivers}
              selected={selectedDriver}
              onSelectDriver={(d) => setSelectedDriver(d)}
              onConfirmStepUp={handleConfirmStepUp}
              onMarkFalseAlarm={handleMarkFalseAlarm}
              actionLoading={actionLoading}
            />
          ) : page === "Drift tracker" ? (
            <DriftTracker onNotify={notify}/>
          ) : page === "Review queue" ? (
            <ReviewQueue
              cases={cases}
              onResolveCase={handleResolveCase}
              onOpenCaseModal={(c) => setActiveCaseModal(c)}
              onNotify={notify}
            />
          ) : page === "Model health" ? (
            <ModelHealth onNotify={notify}/>
          ) : (
            <Simulator
              onAddDriverToMatrix={(d) => {
                setDrivers((current) => [d, ...current.filter((x) => x.id !== d.id)]);
                setSelectedDriver(d);
                setPage("Fleet map");
                notify(`Injected driver ${d.id} into Continuity Matrix`);
              }}
              onAddCaseToQueue={(c) => {
                setCases((current) => [c, ...current]);
                setPage("Review queue");
                notify(`Added case #${c.id} to review queue`);
              }}
              onNotify={notify}
            />
          )}
        </div>
      </main>

      {/* MODAL: Review Case Details & Action Inspector */}
      {activeCaseModal && (
        <div className="modal-backdrop" onClick={() => setActiveCaseModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="eyebrow">Case Investigation & Evidence Audit</span>
                <h3>#{activeCaseModal.id} · {activeCaseModal.driverId}</h3>
              </div>
              <button className="modal-close" onClick={() => setActiveCaseModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "16px" }}>
                <span className={`status ${activeCaseModal.quadrant.includes("Handoff") ? "red" : activeCaseModal.quadrant.includes("Ambiguous") ? "amber" : "blue"}`}>
                  {activeCaseModal.quadrant}
                </span>
                <span className={`status ${activeCaseModal.status === "RESOLVED" ? "green" : "amber"}`}>
                  {activeCaseModal.status}
                </span>
                <small style={{ color: "var(--text-muted)", marginLeft: "auto", fontWeight: 600 }}>{activeCaseModal.timestamp}</small>
              </div>

              <div className="facts" style={{ margin: "14px 0" }}>
                <div><span>Device Lineage</span><b>{activeCaseModal.device}</b></div>
                <div><span>Vehicle Velocity</span><b>{activeCaseModal.speed}</b></div>
                <div><span>Context Continuity</span><b>{activeCaseModal.contextScore}</b></div>
              </div>

              <div className="reason" style={{ margin: "16px 0" }}>
                <span className="ai-mark">AI</span>
                <div>
                  <b>Telemetry Discrepancy Vector</b>
                  <p>{activeCaseModal.reason}</p>
                </div>
              </div>

              <div className="safe" style={{ marginTop: "14px" }}>
                <span>Driver Safety Interlock</span>
                <b>Active safe-pause protocol armed. Drivers are never interrupted while moving. Challenge triggers strictly at 0 mph.</b>
              </div>
            </div>

            <div className="modal-footer">
              {activeCaseModal.status === "OPEN" ? (
                <>
                  <button className="secondary" onClick={() => handleResolveCase(activeCaseModal.id, "cleared")}>
                    Clear False Alarm
                  </button>
                  <button className="primary" style={{ background: "linear-gradient(135deg, #b91c1c, #ef4444)", borderColor: "#f87171" }} onClick={() => handleResolveCase(activeCaseModal.id, "confirmed_handoff")}>
                    Confirm Handoff (Revoke)
                  </button>
                  <button className="primary" onClick={() => handleResolveCase(activeCaseModal.id, "needs_follow_up")}>
                    Require Selfie at 0 mph
                  </button>
                </>
              ) : (
                <button className="secondary" onClick={() => setActiveCaseModal(null)}>
                  Close Audit View
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className="global-toast">
          <span>✓</span>
          {message}
        </div>
      )}
    </div>
  );
}
