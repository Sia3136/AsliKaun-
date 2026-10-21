import React, { useState } from 'react';
import { 
  Play, 
  RotateCcw, 
  AlertTriangle, 
  ShieldCheck, 
  Zap, 
  Radio, 
  Cpu, 
  CheckCircle2, 
  Smartphone, 
  RefreshCw,
  TrendingDown,
  Layers
} from 'lucide-react';
import { DriverRecord } from '../../types/fleet';

interface ScenarioSimulatorScreenProps {
  drivers?: DriverRecord[];
  onRefreshFleet?: () => Promise<void>;
  onNavigateToFleet?: () => void;
}

export const ScenarioSimulatorScreen: React.FC<ScenarioSimulatorScreenProps> = ({
  drivers = [],
  onRefreshFleet,
  onNavigateToFleet,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<
    'handoff' | 'legit_change' | 'slow_drift' | 'split_shift' | 'teleport' | 'illness'
  >('handoff');
  const selectedDriverId = `rider-sim-console-${selectedScenario}`;
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<any>(null);
  const [detectionLatency, setDetectionLatency] = useState<number | null>(null);

  const scenarios = [
    {
      id: 'handoff',
      tag: 'ATTACKER · LAZY RENTER',
      title: 'Unauthorized Account Handoff / Rental',
      description: 'Device ID and location remain identical, while tap pressure and acceptance delay diverge sharply. Simulates sub-leasing account to an unverified operator.',
      expectedVerdict: 'handoff_signature → challenge_at_safe_pause',
      badgeClass: 'bg-[#ffdad6] text-[#ba1a1a]',
    },
    {
      id: 'legit_change',
      tag: 'HONEST RIDER · HARDWARE UPGRADE',
      title: 'Legitimate Phone and City Change',
      description: 'Rider upgrades to a new phone and relocates to a new delivery zone. Physical motor cadence and gesture biometrics remain consistent with verified owner.',
      expectedVerdict: 'legit_change → silent rebaseline (0 friction)',
      badgeClass: 'bg-[#eff4ff] text-[#0058be]',
    },
    {
      id: 'slow_drift',
      tag: 'ATTACKER · BOILING FROG',
      title: 'Slow Drift Renter (Cumulative Shift)',
      description: 'Impersonator gradually alters driving style over multiple sessions to fool adaptive moving averages. Tested against the dual-timescale frozen anchor.',
      expectedVerdict: 'Caught by Frozen Anchor baseline',
      badgeClass: 'bg-[#ffdad6] text-[#ba1a1a]',
    },
    {
      id: 'split_shift',
      tag: 'ATTACKER · SPLIT-SHIFT',
      title: 'Split-Shift Account Sharing',
      description: 'Account owner operates morning shifts while an unauthorized partner runs evening deliveries. Bimodal Gaussian Mixture Model clusters time-of-day divergence.',
      expectedVerdict: 'split_rental_suspected → mandatory review',
      badgeClass: 'bg-[#fef3c7] text-[#b45309]',
    },
    {
      id: 'teleport',
      tag: 'ATTACKER · GPS SPOOFING',
      title: 'Synthetic GPS Jump & Velocity Anomaly',
      description: 'Incongruent NMEA coordinate leaps across sectors in sub-minute intervals while cell-tower triangulation remains stationary.',
      expectedVerdict: 'High Risk Anomaly → Immediate Pause Challenge',
      badgeClass: 'bg-[#ffdad6] text-[#ba1a1a]',
    },
    {
      id: 'illness',
      tag: 'HONEST RIDER · TEMPORARY FATIGUE',
      title: 'Honest Fatigue / Mild Illness',
      description: 'Order acceptance latency temporarily slows (+900ms) with verified context and genuine motor signature. Proves graceful handling without false account lockout.',
      expectedVerdict: 'stable / minor drift → No punitive escalation',
      badgeClass: 'bg-[#e8f5e9] text-[#006947]',
    },
  ];

  const handleRunSimulation = async () => {
    setSimulationRunning(true);
    setLastResult(null);
    setSimLogs([]);
    const startTime = performance.now();

    const addLog = (msg: string) => {
      setSimLogs((prev) => [...prev, msg]);
    };

    addLog(`[0.00s] Initializing isolated synthetic profile #${selectedDriverId}...`);
    addLog(`[0.02s] Scenario: ${selectedScenario.toUpperCase()} [SIMULATED TELEMETRY]`);

    // Prepare synthetic session payload matching selected scenario
    const targetDriver = selectedDriverId;
    let payload: any = {
      driver_id: targetDriver,
      is_simulated: true,
      timestamp: new Date().toISOString(),
    };

    if (selectedScenario === 'handoff') {
      // Stable context, anomalous behavior
      payload = {
        ...payload,
        device_id: 'dev-samsung-a54',
        ip_subnet: '192.168.1.0/24',
        zone: 'mumbai_central',
        accept_latency_ms: 3150, // Massive latency spike
        vehicle_speed_mph: 0.0, // Safe pause timing ready
        accel: [
          { x: 1.8, y: 3.4, z: 8.2, t: new Date().toISOString() },
          { x: 2.1, y: 3.9, z: 7.9, t: new Date().toISOString() }
        ],
        touch_events: [
          {
            type: 'swipe',
            pressure: 0.94,
            duration_ms: 180,
            path: [
              { x: 120, y: 340, pressure: 0.92, t_offset_ms: 0 },
              { x: 180, y: 490, pressure: 0.96, t_offset_ms: 80 },
              { x: 240, y: 620, pressure: 0.94, t_offset_ms: 180 }
            ]
          }
        ],
        gps: [{ lat: 19.076, lng: 72.877, speed: 0.0, t: new Date().toISOString() }]
      };
    } else if (selectedScenario === 'legit_change') {
      // Changed context (new phone, new city), stable verified behavior
      payload = {
        ...payload,
        device_id: 'dev-iphone-16-pro-declared-upgrade',
        ip_subnet: '10.240.18.0/24',
        zone: 'navi_mumbai_depot',
        accept_latency_ms: 340, // Habitual normal latency
        vehicle_speed_mph: 0.0,
        accel: [
          { x: 0.1, y: 0.2, z: 9.8, t: new Date().toISOString() },
          { x: 0.12, y: 0.19, z: 9.81, t: new Date().toISOString() }
        ],
        touch_events: [
          {
            type: 'tap',
            pressure: 0.36,
            duration_ms: 85,
            path: [
              { x: 210, y: 400, pressure: 0.35, t_offset_ms: 0 },
              { x: 212, y: 402, pressure: 0.37, t_offset_ms: 45 },
              { x: 214, y: 403, pressure: 0.36, t_offset_ms: 85 }
            ]
          }
        ],
        gps: [{ lat: 19.033, lng: 73.029, speed: 0.0, t: new Date().toISOString() }]
      };
    } else if (selectedScenario === 'slow_drift') {
      // Drift test: high latency and moderate motor variance
      payload = {
        ...payload,
        device_id: 'dev-samsung-a54',
        ip_subnet: '192.168.1.0/24',
        zone: 'mumbai_central',
        accept_latency_ms: 1850,
        vehicle_speed_mph: 0.0,
        accel: [{ x: 0.8, y: 1.2, z: 9.2, t: new Date().toISOString() }],
        touch_events: [
          {
            type: 'swipe',
            pressure: 0.65,
            duration_ms: 120,
            path: [{ x: 150, y: 300, pressure: 0.65, t_offset_ms: 0 }, { x: 190, y: 420, pressure: 0.66, t_offset_ms: 120 }]
          }
        ]
      };
    } else if (selectedScenario === 'split_shift') {
      // Evening shift renter
      payload = {
        ...payload,
        device_id: 'dev-samsung-a54',
        ip_subnet: '192.168.1.0/24',
        zone: 'mumbai_central',
        accept_latency_ms: 2400,
        vehicle_speed_mph: 0.0,
        accel: [{ x: 1.5, y: 2.1, z: 8.8, t: new Date().toISOString() }],
        touch_events: [{ type: 'tap', pressure: 0.82, duration_ms: 140 }]
      };
    } else if (selectedScenario === 'teleport') {
      // GPS teleportation jump
      payload = {
        ...payload,
        device_id: 'dev-samsung-a54',
        ip_subnet: '192.168.1.0/24',
        zone: 'mumbai_central',
        accept_latency_ms: 450,
        vehicle_speed_mph: 92.4, // Impossible velocity jump
        accel: [{ x: 4.2, y: 6.1, z: 14.5, t: new Date().toISOString() }],
        gps: [
          { lat: 19.076, lng: 72.877, speed: 12.0, t: new Date().toISOString() },
          { lat: 28.704, lng: 77.102, speed: 850.0, t: new Date().toISOString() } // 1400km jump
        ]
      };
    } else {
      // Honest fatigue / recovery
      payload = {
        ...payload,
        device_id: 'dev-samsung-a54',
        ip_subnet: '192.168.1.0/24',
        zone: 'mumbai_central',
        accept_latency_ms: 1100, // Slower but authentic
        vehicle_speed_mph: 0.0,
        accel: [{ x: 0.15, y: 0.22, z: 9.78, t: new Date().toISOString() }],
        touch_events: [{ type: 'tap', pressure: 0.38, duration_ms: 95 }]
      };
    }

    addLog(`[0.05s] Dispatching POST /v1/sessions/ingest payload to backend...`);

    try {
      const token = sessionStorage.getItem('tm-auth-token') || 'demo-admin-session-token';
      const sequenceLength = selectedScenario === 'slow_drift' ? 12 : selectedScenario === 'split_shift' ? 20 : 1;
      let result: any = null;
      for (let index = 0; index < sequenceLength; index += 1) {
        const event = { ...payload, timestamp: new Date(Date.now() - (sequenceLength - index) * 60_000).toISOString() };
        if (selectedScenario === 'slow_drift') {
          event.accept_latency_ms = 350 + index * 145;
          event.touch_events = [{ type: 'swipe', pressure: 0.36 + index * 0.035, duration_ms: 85 + index * 7, area: 0.35 + index * 0.04, t_offset_ms: index * 100 }];
        }
        if (selectedScenario === 'split_shift') {
          const renter = index % 2 === 1;
          event.timestamp = new Date(Date.now() - (sequenceLength - index) * 60_000 + (renter ? 12 * 60 * 60 * 1000 : 0)).toISOString();
          event.accept_latency_ms = renter ? 2400 : 360;
          event.touch_events = [{ type: 'tap', pressure: renter ? 0.82 : 0.36, duration_ms: renter ? 140 : 85, area: renter ? 0.82 : 0.36, t_offset_ms: 100 }];
        }
        const response = await fetch('/v1/sessions/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(event)
        });
        if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}`);
        result = await response.json();
        if (sequenceLength > 1) addLog(`[Sequence] Session ${index + 1}/${sequenceLength} · ${result.decision}`);
      }

      const elapsed = Math.round(performance.now() - startTime);
      setDetectionLatency(elapsed);

      if (selectedScenario === 'split_shift') {
        const auditResponse = await fetch(`/v1/drivers/${encodeURIComponent(targetDriver)}/drift`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (auditResponse.ok) result.rental_audit = (await auditResponse.json()).rental_audit;
      }
      setLastResult(result);

      addLog(`[0.${elapsed}s] HTTP 200 OK — Backend ML fusion completed.`);
      addLog(`[Verdict] Decision: ${result.decision.toUpperCase()}`);
      addLog(`[Quadrant] Classified: ${result.quadrant.toUpperCase()}`);
      addLog(`[Context Score] ${result.context_score !== null ? result.context_score : 'N/A'}`);
      addLog(`[Behavior Score] ${result.behavior_score !== null ? result.behavior_score : 'N/A'}`);
      if (result.reasons && result.reasons.length > 0) {
        addLog(`[Reason Vector] ${result.reasons[0]}`);
      }
      if (result.safe_pause_info?.safe_pause_scheduled) {
        addLog(`[Safety Gate] Challenge scheduled for verified safe stop.`);
      }
      if (result.rental_audit) addLog(`[GMM Audit] ${result.rental_audit.status}: ${result.rental_audit.finding || result.rental_audit.note || 'No rental detected'}`);

      // Refresh dashboard live data
      if (onRefreshFleet) {
        addLog(`[Sync] Triggering live fleet score & review queue reload...`);
        await onRefreshFleet();
        addLog(`[Sync] Dashboard successfully updated from backend database.`);
      }
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - startTime);
      addLog(`[Error] Backend connection error: ${err.message}`);
      setLastResult(null);
    } finally {
      setSimulationRunning(false);
    }
  };

  const handleReset = () => {
    setSimLogs([]);
    setLastResult(null);
    setDetectionLatency(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#727785]">
            THREAT SIMULATION LAB / POST /v1/sessions/ingest
          </div>
          <h1 className="text-2xl font-bold text-[#0b1c30] mt-1">Live Telemetry Pipeline Simulator</h1>
          <p className="text-xs text-[#565e74] mt-1 max-w-3xl">
            Stress-test the end-to-end backend API with real synthetic telemetry payloads. Each simulation submits to <code className="font-mono text-[#0058be] bg-[#eff4ff] px-1.5 py-0.5 rounded">POST /v1/sessions/ingest</code>, runs the two-axis fusion models, and dynamically reloads the fleet dashboard.
          </p>
        </div>

        {onNavigateToFleet && (
          <button
            onClick={onNavigateToFleet}
            className="px-4 py-2 bg-white hover:bg-[#f8f9ff] text-[#0058be] border border-[#e2e8f0] rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            ← Back to Fleet Monitor
          </button>
        )}
      </div>

      {/* Grid: Scenario Selection & Real-Time Terminal Output */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Scenario Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0b1c30]">Select Test Scenario Vector</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#565e74]">Isolated test profile:</span>
              <span className="font-mono font-bold text-[#0b1c30]">{selectedDriverId}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {scenarios.map((sc) => {
              const isSelected = selectedScenario === sc.id;
              return (
                <div
                  key={sc.id}
                  onClick={() => setSelectedScenario(sc.id as any)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#0058be] bg-[#eff4ff]/40 shadow-xs ring-1 ring-[#0058be]'
                      : 'border-[#e2e8f0] bg-white hover:border-[#cbd5e1]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${sc.badgeClass}`}>
                        {sc.tag}
                      </span>
                      <Radio className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#0058be]' : 'text-[#c2c6d6]'}`} />
                    </div>
                    <h3 className="font-bold text-xs text-[#0b1c30] mt-2.5">{sc.title}</h3>
                    <p className="text-[11px] text-[#565e74] mt-1 leading-relaxed">{sc.description}</p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[#e2e8f0]/60 text-[10px]">
                    <span className="text-[#727785]">Expected Verdict: </span>
                    <strong className="text-[#0058be] font-mono">{sc.expectedVerdict}</strong>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Execution Controls */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleRunSimulation}
              disabled={simulationRunning}
              className="px-6 py-2.5 rounded-lg bg-[#0058be] hover:bg-[#0047a0] text-white text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{simulationRunning ? 'Submitting to POST /v1/sessions/ingest...' : 'Execute Live API Scenario'}</span>
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2.5 rounded-lg border border-[#e2e8f0] bg-white text-[#565e74] hover:text-[#0b1c30] text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear Console
            </button>
          </div>
        </div>

        {/* Right Col: Real-time Edge Terminal & Backend Ingest Results */}
        <div className="bg-[#0b1c30] rounded-xl p-5 text-white flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#38bdf8]" />
                <span className="text-xs font-mono font-bold">API_INGEST_TERMINAL</span>
              </div>
              {detectionLatency !== null && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00855b] text-white font-bold">
                  {detectionLatency}ms LATENCY
                </span>
              )}
            </div>

            <div className="space-y-1.5 font-mono text-[11px] text-slate-300 min-h-[220px] max-h-80 overflow-y-auto">
              {simLogs.length === 0 ? (
                <div className="text-slate-500 italic py-12 text-center text-xs">
                  Select a test scenario and click "Execute Live API Scenario" to transmit synthetic telemetry to POST /v1/sessions/ingest and observe live classifier output.
                </div>
              ) : (
                simLogs.map((log, i) => (
                  <div key={i} className="animate-in fade-in duration-100 break-words">
                    <span className="text-[#38bdf8]">◈</span> {log}
                  </div>
                ))
              )}
            </div>

            {/* Verdict Display Card */}
            {lastResult && (
              <div className="mt-4 p-3 rounded-lg bg-white/10 border border-white/15 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">LATEST RESULT VERDICT</span>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    lastResult.decision.includes('challenge')
                      ? 'bg-[#ba1a1a] text-white'
                      : lastResult.decision === 'rebaseline'
                      ? 'bg-[#0058be] text-white'
                      : 'bg-[#00855b] text-white'
                  }`}>
                    {lastResult.decision.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-slate-200">
                  Quadrant: <strong className="font-mono text-[#38bdf8]">{lastResult.quadrant}</strong>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-slate-300 font-mono">
                  <span>Context: {lastResult.context_score ?? 'N/A'}</span>
                  <span>Behavior: {lastResult.behavior_score ?? 'N/A'}</span>
                </div>
                <div className="text-[10px] text-slate-300">Model: <span className="font-mono">{lastResult.model_status || 'unreported'}</span></div>
                {Array.isArray(lastResult.reasons) && lastResult.reasons.length > 0 && <div className="text-[10px] text-slate-300">Explanation: {lastResult.reasons.join(' · ')}</div>}
                {lastResult.safe_pause_info && <div className="text-[10px] text-slate-300">Safe pause: {lastResult.safe_pause_info.safe_pause_scheduled ? 'scheduled' : lastResult.safe_pause_info.is_moving ? 'waiting for safe stop' : 'not required'}{lastResult.safe_pause_info.speed_mph != null ? ` · ${lastResult.safe_pause_info.speed_mph} mph` : ''}</div>}
                {lastResult.rental_audit && <div className="text-[10px] text-slate-300">GMM rental audit: {lastResult.rental_audit.status}{lastResult.rental_audit.split_rental_suspected === true ? ' · split shift suspected' : ''}</div>}
              </div>
            )}
          </div>

          <div className="border-t border-white/10 pt-3 mt-4 text-[10px] text-slate-400 flex items-center justify-between font-mono">
            <span>Target: {selectedDriverId}</span>
            <span className="text-[#38bdf8]">Tagged: [SIMULATED]</span>
          </div>
        </div>
      </div>
    </div>
  );
};
