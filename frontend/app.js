// Trust Juggler Frontend Dashboard Application
const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? (window.location.port === '8000' ? '' : 'http://127.0.0.1:8000')
  : '';

// App State
const state = {
  activeTab: 'quadrant-tab',
  backendConnected: false,
  drivers: [],
  selectedDriver: null,
  reviewQueue: [],
  timelineSessions: [],
  adminToken: null,
};

// Initial Seed Fleet for demonstration
const SEED_DRIVERS = [
  { driver_id: 'rider-001', name: 'Rohan Sharma', zone: 'Andheri West', phone: 'phone-A', ctx: 0.94, beh: 0.92, quad: 'stable', dec: 'continue', signals: { op: 0.08, touch: 0.11, motion: 0.09 }, rv: 'Habitual route and normal motor gestures verified.' },
  { driver_id: 'rider-014', name: 'Aarav Mehta', zone: 'Bandra West', phone: 'phone-B-new', ctx: 0.28, beh: 0.89, quad: 'legit_change', dec: 'rebaseline', signals: { op: 0.12, touch: 0.14, motion: 0.11 }, rv: 'Legitimate device upgrade from iPhone 12 to 15. Biometrics match owner.' },
  { driver_id: 'rider-042', name: 'Vikram Joshi', zone: 'Dadar Central', phone: 'dev-042', ctx: 0.92, beh: 0.31, quad: 'handoff_signature', dec: 'challenge_at_safe_pause', signals: { op: 0.68, touch: 0.79, motion: 0.85 }, rv: 'Same phone, but sudden high tap pressure and rough throttle jerk. Potential account rental.' },
  { driver_id: 'rider-088', name: 'Kavita Patel', zone: 'Powai Tech', phone: 'dev-088', ctx: 0.35, beh: 0.42, quad: 'ambiguous', dec: 'step_up_check_at_safe_pause', signals: { op: 0.55, touch: 0.62, motion: 0.58 }, rv: 'Both network IP and touch velocity changed. Lightweight selfie verification recommended.' },
  { driver_id: 'rider-103', name: 'Sameer Khan', zone: 'Thane West', phone: 'phone-S1', ctx: 0.88, beh: 0.85, quad: 'stable', dec: 'continue', signals: { op: 0.15, touch: 0.12, motion: 0.18 }, rv: 'Consistent operational acceptance speed and cadence.' },
  { driver_id: 'rider-129', name: 'Pooja Nair', zone: 'Navi Mumbai', phone: 'phone-P4', ctx: 0.91, beh: 0.79, quad: 'stable', dec: 'continue', signals: { op: 0.20, touch: 0.19, motion: 0.22 }, rv: 'Night delivery shift matches historical seasonal profile.' },
  { driver_id: 'rider-160', name: 'Deepak Varma', zone: 'Andheri East', phone: 'phone-D8', ctx: 0.89, beh: 0.29, quad: 'handoff_signature', dec: 'challenge_at_safe_pause', signals: { op: 0.82, touch: 0.71, motion: 0.75 }, rv: 'Shift handover suspected. Order acceptance delay tripled and grip angle deviated.' },
  { driver_id: 'rider-205', name: 'Ananya Rao', zone: 'Bandra Kurla', phone: 'phone-AR', ctx: 0.15, beh: 0.87, quad: 'legit_change', dec: 'rebaseline', signals: { op: 0.10, touch: 0.16, motion: 0.13 }, rv: 'Rider relocated delivery base to BKC. Motor biometric continuity 87%.' },
];

// DOM Elements
const elements = {
  navItems: document.querySelectorAll('.nav-item'),
  tabPanes: document.querySelectorAll('.tab-pane'),
  canvas: document.getElementById('quadrant-canvas'),
  tooltip: document.getElementById('quadrant-tooltip'),
  statusIndicator: document.getElementById('backend-status-indicator'),
  statusText: document.getElementById('backend-status-text'),
  activeCount: document.getElementById('stat-active-riders'),
  flaggedCount: document.getElementById('stat-flagged-riders'),
  legitCount: document.getElementById('stat-legit-shifts'),
  reviewBadge: document.getElementById('review-count-badge'),
  inspectorEmpty: document.getElementById('inspector-empty'),
  inspectorDetails: document.getElementById('inspector-details'),
  insDriverId: document.getElementById('ins-driver-id'),
  insZone: document.getElementById('ins-zone'),
  insContextScore: document.getElementById('ins-context-score'),
  insBehaviorScore: document.getElementById('ins-behavior-score'),
  insDecision: document.getElementById('ins-decision'),
  insQuadrantBadge: document.getElementById('inspector-quadrant-badge'),
  insTouchBar: document.getElementById('ins-touch-bar'),
  insMotionBar: document.getElementById('ins-motion-bar'),
  insOpBar: document.getElementById('ins-op-bar'),
  insTouchVal: document.getElementById('ins-touch-val'),
  insMotionVal: document.getElementById('ins-motion-val'),
  insOpVal: document.getElementById('ins-op-val'),
  insReasonText: document.getElementById('ins-reason-text'),
  timelineCanvas: document.getElementById('timeline-canvas'),
  timelineTableBody: document.getElementById('timeline-table-body'),
  timelineDriverSelect: document.getElementById('timeline-driver-select'),
  reviewTableBody: document.getElementById('review-table-body'),
  simTerminal: document.getElementById('sim-terminal'),
  modal: document.getElementById('review-modal'),
  modalClose: document.getElementById('btn-modal-close'),
  modalCancel: document.getElementById('btn-modal-cancel'),
  modalSubmit: document.getElementById('btn-modal-submit'),
  modalMeta: document.getElementById('modal-meta-box'),
  reviewerNotes: document.getElementById('reviewer-notes'),
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  initQuadrantCanvas();
  setupSimulationHandlers();
  setupModalHandlers();
  checkBackendHealth();
  populateSeedData();
  renderCohortFairnessChart();

  // Polling loop for live sync
  setInterval(() => {
    checkBackendHealth();
  }, 8000);
});

// Navigation Handling
function setupNavigation() {
  elements.navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');
      elements.navItems.forEach(n => n.classList.remove('active'));
      elements.tabPanes.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
      state.activeTab = targetTab;

      if (targetTab === 'quadrant-tab') drawQuadrant();
      if (targetTab === 'timeline-tab') renderTimeline(elements.timelineDriverSelect.value);
      if (targetTab === 'reviews-tab') renderReviewQueue();
      if (targetTab === 'fairness-tab') renderCohortFairnessChart();
    });
  });

  elements.timelineDriverSelect.addEventListener('change', (e) => {
    renderTimeline(e.target.value);
  });

  document.getElementById('btn-quick-ingest').addEventListener('click', () => {
    triggerQuickRandomSession();
  });
}

// Backend Health & Data Sync
async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
    if (res.ok) {
      state.backendConnected = true;
      elements.statusIndicator.className = 'status-indicator online';
      elements.statusText.textContent = 'Backend Connected';
      document.getElementById('backend-mode-text').textContent = 'FastAPI + ML Bridge';
      syncFleetFromBackend();
    } else {
      setFallbackState();
    }
  } catch (err) {
    setFallbackState();
  }
}

function setFallbackState() {
  state.backendConnected = false;
  elements.statusIndicator.className = 'status-indicator online';
  elements.statusIndicator.style.background = '#00e5ff';
  elements.statusIndicator.style.boxShadow = '0 0 10px #00e5ff';
  elements.statusText.textContent = 'Local ML Demo Engine';
  document.getElementById('backend-mode-text').textContent = 'Two-Axis Standalone';
}

async function syncFleetFromBackend() {
  try {
    const res = await fetch(`${API_BASE}/v1/fleet/scores`);
    if (res.ok) {
      const data = await res.json();
      if (data.drivers && data.drivers.length > 0) {
        // Merge with existing
        data.drivers.forEach(d => {
          const idx = state.drivers.findIndex(x => x.driver_id === d.driver_id);
          const formatted = {
            driver_id: d.driver_id,
            name: d.driver_id.replace('-', ' ').toUpperCase(),
            zone: 'Mumbai Core',
            phone: 'dev-client',
            ctx: d.context_score ?? 1.0,
            beh: d.behavior_score ?? 0.85,
            quad: d.quadrant ?? 'stable',
            dec: d.decision ?? 'continue',
            signals: { op: 0.15, touch: 0.12, motion: 0.18 },
            rv: 'Session verified via Two-Axis ML Combiner.',
          };
          if (idx >= 0) state.drivers[idx] = formatted;
          else state.drivers.push(formatted);
        });
        updateDashboardCounters();
        drawQuadrant();
      }
    }
  } catch (e) {
    // Graceful offline fallback
  }
}

function populateSeedData() {
  state.drivers = [...SEED_DRIVERS];
  state.reviewQueue = [
    {
      session_id: 1042,
      driver_id: 'rider-042',
      decision: 'challenge_at_safe_pause',
      ctx: 0.92,
      beh: 0.31,
      rv: 'Context stable (1.00) while behavioral continuity fell to 0.31. Extreme touch pressure and motion jerk shift. Unauthorized rental challenge required.',
      timestamp: '2026-10-18T00:45:12Z',
      status: 'open',
    },
    {
      session_id: 1088,
      driver_id: 'rider-088',
      decision: 'step_up_check_at_safe_pause',
      ctx: 0.35,
      beh: 0.42,
      rv: 'Both context (new IP/zone) and motor gesture cadence shifted. Step-up selfie check recommended.',
      timestamp: '2026-10-18T01:10:05Z',
      status: 'open',
    },
    {
      session_id: 1160,
      driver_id: 'rider-160',
      decision: 'challenge_at_safe_pause',
      ctx: 0.89,
      beh: 0.29,
      rv: 'Acceptance delay spike (+2400ms) and swipe velocity discrepancy indicate a different operator.',
      timestamp: '2026-10-18T01:25:40Z',
      status: 'open',
    }
  ];

  updateDashboardCounters();
  drawQuadrant();
  selectDriver(state.drivers[0]);
}

function updateDashboardCounters() {
  const active = state.drivers.length;
  const flagged = state.drivers.filter(d => d.dec.includes('challenge') || d.dec.includes('step_up')).length;
  const legit = state.drivers.filter(d => d.quad === 'legit_change').length;

  elements.activeCount.textContent = active;
  elements.flaggedCount.textContent = flagged;
  elements.legitCount.textContent = legit;
  elements.reviewBadge.textContent = state.reviewQueue.filter(r => r.status === 'open').length;
}

// 2D Quadrant Canvas Engine
function initQuadrantCanvas() {
  const container = document.getElementById('quadrant-container');
  const canvas = elements.canvas;

  function resize() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    drawQuadrant();
  }

  window.addEventListener('resize', resize);
  resize();

  // Mouse hover interaction
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hovered = findDriverAt(x, y);
    if (hovered) {
      canvas.style.cursor = 'pointer';
      showTooltip(hovered, e.clientX, e.clientY);
    } else {
      canvas.style.cursor = 'crosshair';
      hideTooltip();
    }
  });

  // Click interaction
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clicked = findDriverAt(x, y);
    if (clicked) {
      selectDriver(clicked);
    }
  });
}

function toCanvasCoords(ctxScore, behScore) {
  const w = elements.canvas.width;
  const h = elements.canvas.height;
  const pad = 40;
  // X: 0 to 1 -> pad to w - pad
  const cx = pad + ctxScore * (w - 2 * pad);
  // Y: 0 to 1 -> h - pad to pad (invert Y)
  const cy = (h - pad) - behScore * (h - 2 * pad);
  return { x: cx, y: cy };
}

function drawQuadrant() {
  const canvas = elements.canvas;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const pad = 40;

  ctx.clearRect(0, 0, w, h);

  // Background subtle grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  const step = (w - 2 * pad) / 10;
  for (let i = 0; i <= 10; i++) {
    const x = pad + i * step;
    ctx.beginPath();
    ctx.moveTo(x, pad);
    ctx.lineTo(x, h - pad);
    ctx.stroke();

    const y = pad + i * ((h - 2 * pad) / 10);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w - pad, y);
    ctx.stroke();
  }

  // Threshold Dividers (at 0.6 continuity)
  const threshCoords = toCanvasCoords(0.6, 0.6);

  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
  ctx.lineWidth = 1.5;

  // Vertical threshold line
  ctx.beginPath();
  ctx.moveTo(threshCoords.x, pad);
  ctx.lineTo(threshCoords.x, h - pad);
  ctx.stroke();

  // Horizontal threshold line
  ctx.beginPath();
  ctx.moveTo(pad, threshCoords.y);
  ctx.lineTo(w - pad, threshCoords.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Plot Drivers
  state.drivers.forEach(d => {
    const pos = toCanvasCoords(d.ctx, d.beh);
    const isSelected = state.selectedDriver && state.selectedDriver.driver_id === d.driver_id;

    let fillColor = '#10b981';
    let glowColor = 'rgba(16, 185, 129, 0.4)';
    if (d.quad === 'legit_change') {
      fillColor = '#06b6d4';
      glowColor = 'rgba(6, 182, 212, 0.4)';
    } else if (d.quad === 'handoff_signature') {
      fillColor = '#ef4444';
      glowColor = 'rgba(239, 68, 68, 0.5)';
    } else if (d.quad === 'ambiguous') {
      fillColor = '#f59e0b';
      glowColor = 'rgba(245, 158, 11, 0.4)';
    }

    // Outer glow pulse
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, isSelected ? 16 : 10, 0, Math.PI * 2);
    ctx.fillStyle = glowColor;
    ctx.fill();

    // Node core
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, isSelected ? 8 : 6, 0, Math.PI * 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.stroke();

    // Rider Label
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(d.driver_id, pos.x + 10, pos.y - 6);
  });
}

function findDriverAt(x, y) {
  const pad = 40;
  for (const d of state.drivers) {
    const pos = toCanvasCoords(d.ctx, d.beh);
    const dist = Math.hypot(pos.x - x, pos.y - y);
    if (dist <= 14) return d;
  }
  return null;
}

function showTooltip(driver, clientX, clientY) {
  const tt = elements.tooltip;
  tt.style.left = `${clientX + 12}px`;
  tt.style.top = `${clientY + 12}px`;
  tt.style.opacity = '1';
  tt.innerHTML = `
    <strong>${driver.driver_id}</strong> (${driver.name})<br>
    Quadrant: <span style="color:#00e5ff">${driver.quad}</span><br>
    Context Score: ${driver.ctx.toFixed(2)} | Behavior: ${driver.beh.toFixed(2)}<br>
    Decision: <em>${driver.dec}</em>
  `;
}

function hideTooltip() {
  elements.tooltip.style.opacity = '0';
}

function selectDriver(driver) {
  state.selectedDriver = driver;
  drawQuadrant();

  elements.inspectorEmpty.classList.add('hidden');
  elements.inspectorDetails.classList.remove('hidden');

  elements.insDriverId.textContent = driver.driver_id;
  elements.insZone.textContent = `${driver.zone} • ${driver.phone}`;
  elements.insContextScore.textContent = driver.ctx.toFixed(2);
  elements.insBehaviorScore.textContent = driver.beh.toFixed(2);
  elements.insDecision.textContent = driver.dec;

  // Quadrant badge color
  elements.insQuadrantBadge.textContent = driver.quad.replace('_', ' ').toUpperCase();
  elements.insQuadrantBadge.className = 'badge';
  if (driver.quad === 'stable') elements.insQuadrantBadge.style.background = 'rgba(16, 185, 129, 0.2)';
  else if (driver.quad === 'legit_change') elements.insQuadrantBadge.style.background = 'rgba(6, 182, 212, 0.2)';
  else if (driver.quad === 'handoff_signature') elements.insQuadrantBadge.style.background = 'rgba(239, 68, 68, 0.2)';
  else elements.insQuadrantBadge.style.background = 'rgba(245, 158, 11, 0.2)';

  // Anomaly progress bars
  const sigs = driver.signals || { op: 0.15, touch: 0.15, motion: 0.15 };
  elements.insTouchVal.textContent = sigs.touch.toFixed(2);
  elements.insMotionVal.textContent = sigs.motion.toFixed(2);
  elements.insOpVal.textContent = sigs.op.toFixed(2);

  elements.insTouchBar.style.width = `${sigs.touch * 100}%`;
  elements.insMotionBar.style.width = `${sigs.motion * 100}%`;
  elements.insOpBar.style.width = `${sigs.op * 100}%`;

  elements.insTouchBar.className = `progress-fill ${sigs.touch > 0.45 ? 'red' : 'green'}`;
  elements.insMotionBar.className = `progress-fill ${sigs.motion > 0.45 ? 'red' : 'green'}`;
  elements.insOpBar.className = `progress-fill ${sigs.op > 0.45 ? 'red' : 'green'}`;

  elements.insReasonText.textContent = driver.rv || 'Habits correspond to normal personal pattern.';

  // Hook button to timeline
  document.getElementById('btn-view-timeline').onclick = () => {
    document.getElementById('nav-timeline').click();
    elements.timelineDriverSelect.value = driver.driver_id;
    renderTimeline(driver.driver_id);
  };
}

// Timeline Chart Rendering
function renderTimeline(driverId) {
  const canvas = elements.timelineCanvas;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const pad = 40;

  ctx.clearRect(0, 0, w, h);

  // Generate synthetic trajectory for the selected rider
  const nPoints = 25;
  const sessions = [];
  const isDrift = driverId === 'rider-drift' || driverId === 'rider-042';

  const anchorVal = 0.88;
  let fastVal = 0.88;

  for (let i = 0; i < nPoints; i++) {
    let sessionVal;
    if (isDrift) {
      // Linear drift downwards
      sessionVal = Math.max(0.2, anchorVal - (i / (nPoints - 1)) * 0.65 + (Math.random() - 0.5) * 0.08);
      fastVal = 0.7 * fastVal + 0.3 * sessionVal;
    } else {
      sessionVal = anchorVal + (Math.random() - 0.5) * 0.12;
      fastVal = 0.8 * fastVal + 0.2 * sessionVal;
    }

    sessions.push({
      session: i + 1,
      anchor: anchorVal,
      fast: fastVal,
      score: sessionVal,
      time: `Oct 17, ${10 + Math.floor(i / 2)}:${(i % 2) * 30 || '00'}`,
    });
  }

  // Draw axes
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, h - pad);
  ctx.lineTo(w - pad, h - pad);
  ctx.stroke();

  // Draw Frozen Anchor Line (Blue)
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  const anchorY = (h - pad) - (anchorVal) * (h - 2 * pad);
  ctx.beginPath();
  ctx.moveTo(pad, anchorY);
  ctx.lineTo(w - pad, anchorY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw Fast Baseline Line (Green)
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  sessions.forEach((s, i) => {
    const x = pad + (i / (nPoints - 1)) * (w - 2 * pad);
    const y = (h - pad) - (s.fast) * (h - 2 * pad);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Draw Ingested Session Points (Red/Scatter)
  sessions.forEach((s, i) => {
    const x = pad + (i / (nPoints - 1)) * (w - 2 * pad);
    const y = (h - pad) - (s.score) * (h - 2 * pad);

    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = s.score >= 0.6 ? '#10b981' : '#f87171';
    ctx.fill();
  });

  // Populate table
  elements.timelineTableBody.innerHTML = '';
  sessions.slice(-8).reverse().forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>sess-${s.session}</strong></td>
      <td>${s.time}</td>
      <td>0.95</td>
      <td><span style="color:${s.score >= 0.6 ? '#34d399' : '#f87171'}">${s.score.toFixed(2)}</span></td>
      <td>${s.score >= 0.6 ? 'stable' : 'handoff_signature'}</td>
      <td><span class="badge ${s.score >= 0.6 ? 'badge-success' : 'badge-danger'}">${s.score >= 0.6 ? 'continue' : 'challenge'}</span></td>
      <td>${s.score < 0.6 ? 'Cumulative drift from anchor exceeded 3.0&sigma;' : 'Normal session rhythm verified'}</td>
    `;
    elements.timelineTableBody.appendChild(tr);
  });
}

// Review Queue Rendering
function renderReviewQueue(filter = 'open') {
  const tbody = elements.reviewTableBody;
  tbody.innerHTML = '';

  const items = state.reviewQueue.filter(r => filter === 'all' || r.status === filter);

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--text-dim);">No review items in ${filter} queue.</td></tr>`;
    return;
  }

  items.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>#REV-${r.session_id}</strong></td>
      <td><span style="color:var(--accent-cyan)">${r.driver_id}</span></td>
      <td><span class="badge badge-danger">${r.decision}</span></td>
      <td>${r.ctx.toFixed(2)} / ${r.beh.toFixed(2)}</td>
      <td style="max-width: 320px; font-size: 0.8rem; line-height: 1.4;">${r.rv}</td>
      <td>${new Date(r.timestamp).toLocaleTimeString()}</td>
      <td><span class="badge ${r.status === 'open' ? 'badge-warning' : 'badge-success'}">${r.status.toUpperCase()}</span></td>
      <td>
        ${r.status === 'open'
          ? `<button class="btn btn-primary btn-sm btn-resolve" data-id="${r.session_id}">Resolve</button>`
          : `<span style="color:var(--text-dim)">Resolved (${r.resolution || 'cleared'})</span>`
        }
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Attach button listeners
  tbody.querySelectorAll('.btn-resolve').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.getAttribute('data-id'));
      openResolveModal(id);
    });
  });
}

// Modal Handlers
let currentResolvingId = null;

function setupModalHandlers() {
  elements.modalClose.onclick = () => elements.modal.classList.add('hidden');
  elements.modalCancel.onclick = () => elements.modal.classList.add('hidden');

  elements.modalSubmit.onclick = async () => {
    if (!currentResolvingId) return;
    const resolution = document.querySelector('input[name="resolution"]:checked').value;
    const note = elements.reviewerNotes.value;

    // Send to backend if available
    try {
      if (state.backendConnected) {
        await fetch(`${API_BASE}/v1/review-queue/${currentResolvingId}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolution, reviewer_note: note })
        });
      }
    } catch (e) {
      console.warn('Backend resolve error, updating locally', e);
    }

    // Local state update
    const item = state.reviewQueue.find(r => r.session_id === currentResolvingId);
    if (item) {
      item.status = 'resolved';
      item.resolution = resolution;
    }

    elements.modal.classList.add('hidden');
    updateDashboardCounters();
    renderReviewQueue();
    logTerminal(`[AUDIT] Resolved review #REV-${currentResolvingId}: ${resolution.toUpperCase()} (${note || 'No notes'})`, 'info');
  };
}

function openResolveModal(sessionId) {
  currentResolvingId = sessionId;
  const item = state.reviewQueue.find(r => r.session_id === sessionId);
  if (!item) return;

  elements.modalMeta.innerHTML = `
    <strong>Review ID:</strong> #REV-${item.session_id}<br>
    <strong>Rider:</strong> ${item.driver_id} | <strong>Trigger:</strong> ${item.decision}<br>
    <strong>Reason Vector:</strong> ${item.rv}
  `;
  elements.reviewerNotes.value = '';
  elements.modal.classList.remove('hidden');
}

// Red-Team Simulation Suite
function setupSimulationHandlers() {
  document.querySelectorAll('.btn-run-scenario').forEach(btn => {
    btn.addEventListener('click', () => {
      const scenario = btn.getAttribute('data-scenario');
      runRedTeamScenario(scenario);
    });
  });

  document.getElementById('btn-clear-sim-logs').onclick = () => {
    elements.simTerminal.innerHTML = '<div class="term-line info">[INFO] Terminal cleared. Ready.</div>';
  };
}

function logTerminal(text, type = 'info') {
  const line = document.createElement('div');
  line.className = `term-line ${type}`;
  line.textContent = `${new Date().toLocaleTimeString()} ${text}`;
  elements.simTerminal.appendChild(line);
  elements.simTerminal.scrollTop = elements.simTerminal.scrollHeight;
}

async function runRedTeamScenario(scenario) {
  logTerminal(`[START] Launching Red-Team scenario: ${scenario}...`, 'system');

  const configs = {
    lazy_renter: {
      name: 'Lazy Renter (Full Instant Handoff)',
      driver: 'rider-042',
      sessions: [
        { ctx: 0.95, beh: 0.28, quad: 'handoff_signature', dec: 'challenge_at_safe_pause', notes: 'Immediate drop in tap rhythm & throttle jerk' },
      ],
      alert: true,
    },
    slow_drift_renter: {
      name: 'Slow-Drift Renter (Boiling Frog 60 Sessions)',
      driver: 'rider-drift',
      sessions: [
        { ctx: 0.95, beh: 0.85, quad: 'stable', dec: 'continue', notes: 'Session 5: Minor shift absorbed by EWMA' },
        { ctx: 0.95, beh: 0.72, quad: 'stable', dec: 'continue', notes: 'Session 18: EWMA adapts smoothly (naive baseline blinded)' },
        { ctx: 0.95, beh: 0.54, quad: 'handoff_signature', dec: 'challenge_at_safe_pause', notes: 'Session 35: CUMULATIVE DRIFT FROM FROZEN ANCHOR EXCEEDED 3.0σ! Challenge triggered!' },
      ],
      alert: true,
    },
    split_shift_sharer: {
      name: 'Split-Shift Sharer (Morning Owner / Evening Renter)',
      driver: 'rider-split',
      sessions: [
        { ctx: 0.95, beh: 0.89, quad: 'stable', dec: 'continue', notes: '09:00 AM (Owner): Habitual latency 950ms' },
        { ctx: 0.95, beh: 0.44, quad: 'handoff_signature', dec: 'challenge_at_safe_pause', notes: '07:30 PM (Renter): GMM BIC -156 vs 174 -> 2 distinct behavioral clusters 14h apart detected!' },
      ],
      alert: true,
    },
    copycat_renter: {
      name: 'Copycat Renter (Spoofed Schedule)',
      driver: 'rider-copycat',
      sessions: [
        { ctx: 0.95, beh: 0.38, quad: 'handoff_signature', dec: 'challenge_at_safe_pause', notes: 'Operational latency matched, but motor tap pressure & tremor failed physical biometric verification' }
      ],
      alert: true,
    },
    honest_phone_and_city_change: {
      name: 'Honest Phone & City Change',
      driver: 'rider-014',
      sessions: [
        { ctx: 0.20, beh: 0.91, quad: 'legit_change', dec: 'rebaseline', notes: 'New Device (phone-15) & New Zone (Bandra). Motor biometrics 91% identical -> Silent rebaseline (No alarm)' }
      ],
      alert: false,
    },
    honest_illness_recovery: {
      name: 'Honest Illness / Fatigue Dip',
      driver: 'rider-illness',
      sessions: [
        { ctx: 0.95, beh: 0.65, quad: 'stable', dec: 'continue', notes: 'Temporary latency increase, same physical device. Safe-pause challenge bypassed.' }
      ],
      alert: false,
    }
  };

  const sc = configs[scenario];
  if (!sc) return;

  for (let idx = 0; idx < sc.sessions.length; idx++) {
    const s = sc.sessions[idx];
    await new Promise(r => setTimeout(r, 600));

    const logType = s.dec.includes('challenge') ? 'alert' : (s.dec === 'rebaseline' ? 'system' : 'info');
    logTerminal(`[${s.dec.toUpperCase()}] ${s.notes}`, logType);

    // Ingest into backend if online
    if (state.backendConnected) {
      try {
        await fetch(`${API_BASE}/v1/sessions/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driver_id: sc.driver,
            device_id: s.ctx < 0.5 ? 'new-phone-x' : 'dev-phone-01',
            zone: 'Andheri',
            accel: s.beh < 0.5 ? [2.5, 3.0, 2.8] : [0.5, 0.4, 0.6],
            touch_events: [{ type: 'tap', pressure: s.beh < 0.5 ? 0.95 : 0.5, t_offset_ms: 100 }],
            accept_latency_ms: s.beh < 0.5 ? 4200 : 1200,
          })
        });
      } catch (err) {}
    }

    // Update fleet representation
    const existing = state.drivers.find(d => d.driver_id === sc.driver);
    if (existing) {
      existing.ctx = s.ctx;
      existing.beh = s.beh;
      existing.quad = s.quad;
      existing.dec = s.dec;
    } else {
      state.drivers.push({
        driver_id: sc.driver,
        name: sc.name,
        zone: 'Mumbai Core',
        phone: 'phone-test',
        ctx: s.ctx,
        beh: s.beh,
        quad: s.quad,
        dec: s.dec,
        signals: { op: 1 - s.beh, touch: 1 - s.beh, motion: 1 - s.beh },
        rv: s.notes,
      });
    }

    if (s.dec.includes('challenge') || s.dec.includes('step_up')) {
      state.reviewQueue.unshift({
        session_id: Math.floor(Math.random() * 8000) + 2000,
        driver_id: sc.driver,
        decision: s.dec,
        ctx: s.ctx,
        beh: s.beh,
        rv: s.notes,
        timestamp: new Date().toISOString(),
        status: 'open',
      });
    }
  }

  updateDashboardCounters();
  drawQuadrant();
  renderReviewQueue();
  logTerminal(`[COMPLETE] Scenario ${sc.name} finished. Decision matrix updated.`, 'info');
}

function triggerQuickRandomSession() {
  const driver = state.drivers[Math.floor(Math.random() * state.drivers.length)];
  logTerminal(`[STREAM] Processing live inbound telemetry for ${driver.driver_id}...`, 'info');

  setTimeout(() => {
    driver.beh = Math.min(1.0, Math.max(0.2, driver.beh + (Math.random() - 0.5) * 0.08));
    drawQuadrant();
    logTerminal(`[VERDICT] ${driver.driver_id} scored: Behavior Continuity=${driver.beh.toFixed(2)} (${driver.dec})`, 'system');
  }, 400);
}

// Cohort Fairness Zone Chart
function renderCohortFairnessChart() {
  const canvas = document.getElementById('fairness-zone-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const pad = 40;

  ctx.clearRect(0, 0, w, h);

  const zones = [
    { name: 'Andheri', score: 0.14 },
    { name: 'Bandra', score: 0.16 },
    { name: 'Dadar', score: 0.15 },
    { name: 'Powai', score: 0.18 },
    { name: 'Thane', score: 0.17 },
    { name: 'Navi Mum', score: 0.19 },
  ];

  const maxVal = 0.30;
  const barWidth = 42;
  const spacing = (w - 2 * pad - (zones.length * barWidth)) / (zones.length - 1);

  // Axis
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.moveTo(pad, h - pad);
  ctx.lineTo(w - pad, h - pad);
  ctx.stroke();

  // Target parity threshold line
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
  ctx.setLineDash([4, 4]);
  const threshY = (h - pad) - (0.25 / maxVal) * (h - 2 * pad);
  ctx.beginPath();
  ctx.moveTo(pad, threshY);
  ctx.lineTo(w - pad, threshY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Bars
  zones.forEach((z, i) => {
    const x = pad + i * (barWidth + spacing);
    const barHeight = (z.score / maxVal) * (h - 2 * pad);
    const y = (h - pad) - barHeight;

    const grad = ctx.createLinearGradient(0, y, 0, h - pad);
    grad.addColorStop(0, '#00e5ff');
    grad.addColorStop(1, '#6366f1');

    ctx.fillStyle = grad;
    ctx.fillRect(x, y, barWidth, barHeight);

    // Label
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText(z.name, x + barWidth / 2, h - pad + 18);
    ctx.fillText(`${(z.score * 100).toFixed(0)}%`, x + barWidth / 2, y - 6);
  });
}
