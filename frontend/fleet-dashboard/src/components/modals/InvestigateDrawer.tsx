import React, { useState } from 'react';
import { 
  X, 
  ShieldAlert, 
  Cpu, 
  Activity, 
  MapPin, 
  Radio, 
  Lock, 
  Fingerprint, 
  AlertTriangle, 
  CheckCircle2, 
  History, 
  Smartphone,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { DriverRecord } from '../../types/fleet';
import { DriverAvatar } from '../DriverAvatar';

interface InvestigateDrawerProps {
  driver: DriverRecord | null;
  onClose: () => void;
  onFreezeSession: (driver: DriverRecord) => void;
  onTriggerLiveness: (driver: DriverRecord) => void;
}

export const InvestigateDrawer: React.FC<InvestigateDrawerProps> = ({
  driver,
  onClose,
  onFreezeSession,
  onTriggerLiveness,
}) => {
  const [activeTab, setActiveTab] = useState<'score' | 'lineage' | 'sensors' | 'biometrics' | 'history'>('score');
  const [scoreData, setScoreData] = useState<any>(null);
  const [isLoadingScore, setIsLoadingScore] = useState(false);
  const [operatorNote, setOperatorNote] = useState('');
  const [notesList, setNotesList] = useState<string[]>([
    'Flagged for immediate review following cell tower divergence from route manifest on Western Express Highway.',
    'Mumbai BKC depot dispatcher notified of unaccounted MAC address handshake.',
  ]);

  React.useEffect(() => {
    if (!driver) return;
    setIsLoadingScore(true);
    const token = sessionStorage.getItem('tm-auth-token') || 'demo-admin-session-token';
    fetch(`/v1/drivers/${driver.id}/score`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setScoreData(data))
      .catch(() => setScoreData(null))
      .finally(() => setIsLoadingScore(false));
  }, [driver?.id]);

  if (!driver) return null;


  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorNote.trim()) return;
    setNotesList([operatorNote.trim(), ...notesList]);
    setOperatorNote('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-[#0b1c30]/40 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col z-10 overflow-hidden border-l border-[#e2e8f0] animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e2e8f0] bg-[#f8f9ff] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DriverAvatar id={driver.id} name={driver.name} statusDot={driver.riskCategory === 'High Risk' ? 'red' : 'green'} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#0b1c30]">{driver.name}</h2>
                <span className="font-mono text-xs font-semibold text-[#0058be] bg-[#eff4ff] border border-[#d3e4fe] px-2 py-0.5 rounded">
                  #{driver.id}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  driver.riskCategory === 'High Risk' ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#e8f5e9] text-[#006947]'
                }`}>
                  {driver.riskCategory} · {driver.riskScore}
                </span>
              </div>
              <p className="text-xs text-[#565e74] mt-0.5">
                {driver.vehicle} · <span className="font-mono">{driver.plate}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#727785] hover:text-[#0b1c30] hover:bg-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Actions Bar */}
        <div className="px-6 py-2.5 bg-white border-b border-[#f1f5f9] flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onFreezeSession(driver)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                driver.sessionFrozen
                  ? 'bg-[#ba1a1a] text-white'
                  : 'bg-[#eff4ff] text-[#ba1a1a] hover:bg-[#fee2e2]'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              {driver.sessionFrozen ? 'Session Frozen' : 'Emergency Freeze'}
            </button>
            <button
              onClick={() => onTriggerLiveness(driver)}
              className="px-3 py-1.5 rounded-md bg-[#0058be] hover:bg-[#0047a0] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Fingerprint className="w-3.5 h-3.5" />
              Dispatch Liveness Challenge
            </button>
          </div>
          <span className="text-xs text-[#565e74] font-medium shrink-0">
            Current Shift: <strong>{driver.shiftDuration}</strong>
          </span>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-[#e2e8f0] flex items-center gap-4 text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setActiveTab('score')}
            className={`py-3 border-b-2 font-semibold cursor-pointer shrink-0 ${
              activeTab === 'score'
                ? 'border-[#0058be] text-[#0058be]'
                : 'border-transparent text-[#565e74] hover:text-[#0b1c30]'
            }`}
          >
            Two-Axis Trust &amp; Reason Vector
          </button>
          <button
            onClick={() => setActiveTab('lineage')}
            className={`py-3 border-b-2 font-semibold cursor-pointer shrink-0 ${
              activeTab === 'lineage'
                ? 'border-[#0058be] text-[#0058be]'
                : 'border-transparent text-[#565e74] hover:text-[#0b1c30]'
            }`}
          >
            Hardware Lineage
          </button>
          <button
            onClick={() => setActiveTab('sensors')}
            className={`py-3 border-b-2 font-semibold cursor-pointer shrink-0 ${
              activeTab === 'sensors'
                ? 'border-[#0058be] text-[#0058be]'
                : 'border-transparent text-[#565e74] hover:text-[#0b1c30]'
            }`}
          >
            Inertial &amp; G-Force
          </button>
          <button
            onClick={() => setActiveTab('biometrics')}
            className={`py-3 border-b-2 font-semibold cursor-pointer shrink-0 ${
              activeTab === 'biometrics'
                ? 'border-[#0058be] text-[#0058be]'
                : 'border-transparent text-[#565e74] hover:text-[#0b1c30]'
            }`}
          >
            Biomechanical Cadence
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 border-b-2 font-semibold cursor-pointer shrink-0 ${
              activeTab === 'history'
                ? 'border-[#0058be] text-[#0058be]'
                : 'border-transparent text-[#565e74] hover:text-[#0b1c30]'
            }`}
          >
            SOC Runbook Notes
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'score' && (
            <div className="space-y-4">
              {isLoadingScore ? (
                <div className="py-8 text-center text-xs text-[#565e74] space-y-2">
                  <div className="w-5 h-5 border-2 border-[#0058be] border-t-transparent rounded-full animate-spin mx-auto" />
                  <span>Loading live score dossier from GET /v1/drivers/{driver.id}/score...</span>
                </div>
              ) : (
                <>
                  {/* Two-Axis Verdict Card */}
                  <div className="p-4 rounded-xl border border-[#e2e8f0] bg-[#f8f9ff] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#727785]">
                        TWO-AXIS ML CLASSIFICATION
                      </span>
                      <span className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono uppercase ${
                        (scoreData?.decision || '').includes('challenge')
                          ? 'bg-[#ba1a1a] text-white'
                          : scoreData?.quadrant === 'legit_change'
                          ? 'bg-[#0058be] text-white'
                          : 'bg-[#006947] text-white'
                      }`}>
                        {scoreData?.decision?.toUpperCase() || driver.riskCategory.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-white rounded-lg border border-[#e2e8f0]">
                        <span className="text-[10px] font-semibold text-[#727785] block">CONTEXT CONTINUITY</span>
                        <div className="text-xl font-bold text-[#0b1c30] mt-0.5 tabular-nums">
                          {scoreData?.context_score !== undefined && scoreData?.context_score !== null
                            ? `${(scoreData.context_score * 100).toFixed(0)}%`
                            : `${driver.contextScore}%`}
                        </div>
                        <span className="text-[10px] text-[#565e74]">
                          Axis: <strong className="font-mono text-[#0058be]">{scoreData?.context_axis || (driver.contextScore >= 60 ? 'stable' : 'changed')}</strong>
                        </span>
                      </div>

                      <div className="p-3 bg-white rounded-lg border border-[#e2e8f0]">
                        <span className="text-[10px] font-semibold text-[#727785] block">BEHAVIORAL CONTINUITY</span>
                        <div className="text-xl font-bold text-[#0b1c30] mt-0.5 tabular-nums">
                          {scoreData?.behavior_score !== undefined && scoreData?.behavior_score !== null
                            ? `${(scoreData.behavior_score * 100).toFixed(0)}%`
                            : `${driver.behavioralScore}%`}
                        </div>
                        <span className="text-[10px] text-[#565e74]">
                          Axis: <strong className="font-mono text-[#0058be]">{scoreData?.behavior_axis || (driver.behavioralScore >= 60 ? 'stable' : 'changed')}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-[#565e74] flex items-center justify-between pt-1">
                      <span>Assigned Quadrant: <strong className="font-mono text-[#0058be]">{scoreData?.quadrant || (driver.contextScore >= 60 ? (driver.behavioralScore >= 60 ? 'stable' : 'handoff_signature') : (driver.behavioralScore >= 60 ? 'legit_change' : 'ambiguous'))}</strong></span>
                      <span className="text-[10px] text-[#006947] font-semibold">Model: {scoreData?.model_status || 'ml_two_axis_fusion'}</span>
                    </div>
                  </div>

                  {/* Pause-Aware Timing Banner */}
                  <div className="p-3 rounded-lg bg-[#e8f5e9] border border-[#c8e6c9] flex items-start gap-2.5 text-xs text-[#006947]">
                    <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <strong>Pause-Aware Challenge Verification:</strong>
                      <p className="text-[11px] mt-0.5 text-[#004d34]">
                        {driver.location.speedMph > 2
                          ? `Vehicle in active transit (${driver.location.speedMph} mph). Safety timing gate will defer verification until verified 0 mph stop.`
                          : `Vehicle at standstill (0 mph). Safe pause condition satisfied; operator verification permitted.`}
                      </p>
                    </div>
                  </div>

                  {/* AI Explainability Reason Vector */}
                  <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-2 text-xs">
                    <span className="font-bold text-[#0b1c30] block uppercase tracking-wider text-[11px]">
                      AI Reason Vector &amp; Incongruity Explanation
                    </span>
                    <div className="p-3 rounded-lg bg-[#eff4ff] text-[#0047a0] text-xs leading-relaxed border border-[#d3e4fe]">
                      {scoreData?.reason_vector?.explanation ||
                        (scoreData?.reasons && scoreData.reasons.length > 0 ? scoreData.reasons.join(' | ') : driver.riskReason)}
                    </div>

                    {/* Multi-Signal Anomalies Breakdown */}
                    {scoreData?.signals && Object.keys(scoreData.signals).length > 0 && (
                      <div className="pt-2">
                        <span className="text-[10px] font-bold uppercase text-[#727785] block mb-1.5">
                          Signal Anomaly Deltas [0.0 = Baseline, 1.0 = Max Divergence]:
                        </span>
                        <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                          {Object.entries(scoreData.signals).map(([sig, val]: [string, any]) => (
                            <div key={sig} className="p-2 rounded bg-[#f8f9ff] border border-[#e2e8f0]">
                              <span className="text-[10px] uppercase text-[#727785] font-semibold block">{sig}</span>
                              <span className={`font-mono font-bold ${val > 0.4 ? 'text-[#ba1a1a]' : 'text-[#006947]'}`}>
                                {(val * 100).toFixed(0)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Session History Dossier */}
                  <div className="space-y-2">
                    <span className="font-bold text-[#0b1c30] block uppercase tracking-wider text-[11px]">
                      Session Score History (Past 10 Telemetry Ingests)
                    </span>
                    {scoreData?.history && scoreData.history.length > 0 ? (
                      <div className="border border-[#e2e8f0] rounded-xl overflow-hidden shadow-2xs divide-y divide-[#f1f5f9] text-xs">
                        {scoreData.history.map((s: any) => (
                          <div key={s.session_id} className="p-3 bg-white flex items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-[#0b1c30]">Session #{s.session_id}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  s.decision.includes('challenge')
                                    ? 'bg-[#ffdad6] text-[#ba1a1a]'
                                    : s.quadrant === 'legit_change'
                                    ? 'bg-[#eff4ff] text-[#0058be]'
                                    : 'bg-[#e8f5e9] text-[#006947]'
                                }`}>
                                  {s.decision}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#565e74] mt-0.5 truncate max-w-sm">
                                {s.reasons?.[0] || 'Continuous verification logged'}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-mono text-xs">
                                C: <strong>{s.context_score !== null ? (s.context_score * 100).toFixed(0) : '—'}%</strong> | B: <strong>{s.behavior_score !== null ? (s.behavior_score * 100).toFixed(0) : '—'}%</strong>
                              </div>
                              <span className="text-[10px] text-[#727785]">
                                {new Date(s.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg bg-[#f8f9ff] text-center text-xs text-[#565e74] border border-[#e2e8f0]">
                        No prior session history rows recorded yet for this driver.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Anomaly Alerts Box if High Risk */}
          {driver.anomalyFlags.length > 0 && (
            <div className="bg-[#ffdad6]/40 border border-[#ffdad6] rounded-lg p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[#ba1a1a] mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span>ACTIVE ANOMALY INDICATORS ({driver.anomalyFlags.length})</span>
              </div>
              <ul className="space-y-1.5 text-xs text-[#424754]">
                {driver.anomalyFlags.map((flag, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#ba1a1a] font-bold">•</span>
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === 'lineage' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#727785]">
                Cryptographic Hardware Attestation
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-[#e2e8f0] bg-[#f8f9ff]">
                  <span className="text-[10px] text-[#727785] font-semibold block">PRIMARY IMEI</span>
                  <span className="font-mono font-bold text-[#0b1c30] text-sm">{driver.imei}</span>
                </div>
                <div className="p-3 rounded-lg border border-[#e2e8f0] bg-[#f8f9ff]">
                  <span className="text-[10px] text-[#727785] font-semibold block">BLUETOOTH / MAC</span>
                  <span className="font-mono font-bold text-[#0b1c30] text-sm">{driver.macAddress}</span>
                </div>
                <div className="p-3 rounded-lg border border-[#e2e8f0] bg-[#f8f9ff]">
                  <span className="text-[10px] text-[#727785] font-semibold block">CARRIER NETWORK</span>
                  <span className="font-medium text-[#0b1c30]">{driver.carrier}</span>
                </div>
                <div className="p-3 rounded-lg border border-[#e2e8f0] bg-[#f8f9ff]">
                  <span className="text-[10px] text-[#727785] font-semibold block">SIM SERIAL (ICCID)</span>
                  <span className="font-mono text-[#0b1c30]">{driver.simSerial}</span>
                </div>
              </div>

              {/* Hardware Timeline */}
              <div className="border border-[#e2e8f0] rounded-lg p-4">
                <h4 className="text-xs font-semibold text-[#0b1c30] mb-3">Device Lineage Progression</h4>
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#e2e8f0]">
                  <div className="relative">
                    <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#00855b] border-2 border-white" />
                    <p className="text-xs font-semibold text-[#0b1c30]">Shift Initialized via Knox Attestation</p>
                    <p className="text-[11px] text-[#565e74]">Original enrolled unit: {driver.hardwareFrom || driver.hardwareTo}</p>
                    <span className="text-[10px] text-[#727785]">Today at 06:14:02 IST</span>
                  </div>
                  {driver.hardwareFrom && (
                    <div className="relative">
                      <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#ba1a1a] border-2 border-white animate-pulse" />
                      <p className="text-xs font-semibold text-[#ba1a1a]">Unpaired Hardware Transition Detected</p>
                      <p className="text-[11px] text-[#565e74]">Swapped to: {driver.hardwareTo} without portal biometric pre-clearance</p>
                      <span className="text-[10px] text-[#727785]">Today at 10:32:15 IST</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sensors' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#727785]">
                  Live G-Force & Inertial Telemetry
                </h3>
                <span className="text-[11px] text-[#006947] font-semibold">100Hz Sensor Stream</span>
              </div>

              {/* Sensor Chart Visualization */}
              <div className="h-44 bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[11px] text-[#565e74]">
                  <span>Lateral Acceleration (X/Y)</span>
                  <span className="font-mono text-[#ba1a1a] font-bold">Peak: 1.84g</span>
                </div>
                {/* SVG waveform */}
                <svg viewBox="0 0 500 100" className="w-full h-24">
                  <path
                    d="M 0 50 Q 50 20, 100 50 T 200 50 T 300 80 T 380 10 T 420 90 T 500 50"
                    fill="none"
                    stroke="#0058be"
                    strokeWidth="2"
                  />
                  <path
                    d="M 0 50 Q 60 70, 120 40 T 240 60 T 340 30 T 400 95 T 500 50"
                    fill="none"
                    stroke="#ba1a1a"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                </svg>
                <div className="flex items-center justify-between text-[10px] text-[#727785]">
                  <span>Baseline Driver Model (Blue)</span>
                  <span className="text-[#ba1a1a] font-semibold">Current Session Vector (Red)</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-white border border-[#e2e8f0] rounded-lg">
                  <span className="text-[10px] text-[#727785] font-semibold">HARD BRAKING</span>
                  <div className="text-base font-bold text-[#ba1a1a]">7 events</div>
                  <span className="text-[10px] text-[#ba1a1a]">Threshold +400%</span>
                </div>
                <div className="p-3 bg-white border border-[#e2e8f0] rounded-lg">
                  <span className="text-[10px] text-[#727785] font-semibold">CORNERING DELTA</span>
                  <div className="text-base font-bold text-[#d97706]">0.72 rad/s</div>
                  <span className="text-[10px] text-[#d97706]">Moderate drift</span>
                </div>
                <div className="p-3 bg-white border border-[#e2e8f0] rounded-lg">
                  <span className="text-[10px] text-[#727785] font-semibold">IDLE SENSOR NOISE</span>
                  <div className="text-base font-bold text-[#006947]">0.02g</div>
                  <span className="text-[10px] text-[#006947]">Normal</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'biometrics' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#727785]">
                Biomechanical Fingerprint Matching
              </h3>

              <div className="border border-[#e2e8f0] rounded-lg p-4 space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#0b1c30] font-medium">Touch Dwell & Keystroke Rhythm</span>
                    <span className="font-bold text-[#ba1a1a]">22% Match</span>
                  </div>
                  <div className="w-full bg-[#e2e8f0] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#ba1a1a] h-full" style={{ width: '22%' }} />
                  </div>
                  <span className="text-[10px] text-[#727785]">Historical baseline: 88-96ms mean keystroke latency</span>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#0b1c30] font-medium">Capacitive Grip Pressure Profile</span>
                    <span className="font-bold text-[#d97706]">48% Match</span>
                  </div>
                  <div className="w-full bg-[#e2e8f0] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#d97706] h-full" style={{ width: '48%' }} />
                  </div>
                  <span className="text-[10px] text-[#727785]">Hand posture indicates non-primary operator hand holding unit</span>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#0b1c30] font-medium">Route Recognition & Habits</span>
                    <span className="font-bold text-[#006947]">91% Match</span>
                  </div>
                  <div className="w-full bg-[#e2e8f0] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#00855b] h-full" style={{ width: '91%' }} />
                  </div>
                  <span className="text-[10px] text-[#727785]">Vehicle is following standard scheduled dispatch manifest</span>
                </div>
              </div>

              <div className="bg-[#eff4ff] border border-[#d3e4fe] p-3 rounded-lg text-xs text-[#0058be]">
                <strong>SOC Assessment:</strong> Physical vehicle navigation is on schedule, but handheld device input and Bluetooth presence indicates a second passenger or unauthorized replacement driver behind the wheel.
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#727785]">
                Operator Notes & Triage Dossier
              </h3>

              <form onSubmit={handleAddNote} className="space-y-2">
                <textarea
                  value={operatorNote}
                  onChange={(e) => setOperatorNote(e.target.value)}
                  placeholder="Record SOC observation, call transcript, or operational override..."
                  className="w-full p-2.5 text-xs text-[#0b1c30] border border-[#e2e8f0] rounded-lg focus:outline-hidden focus:border-[#0058be]"
                  rows={3}
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#0058be] text-white text-xs font-semibold rounded-md hover:bg-[#0047a0] transition-colors cursor-pointer"
                >
                  Save Note to Immutable Audit Trail
                </button>
              </form>

              <div className="divide-y divide-[#f1f5f9] border border-[#e2e8f0] rounded-lg">
                {notesList.map((note, idx) => (
                  <div key={idx} className="p-3 text-xs">
                    <div className="flex items-center justify-between text-[10px] text-[#727785] mb-1">
                      <span className="font-semibold text-[#0b1c30]">Elena Vance (Threat Ops Lead)</span>
                      <span>Just now</span>
                    </div>
                    <p className="text-[#424754]">{note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#e2e8f0] bg-[#f8f9ff] flex items-center justify-between text-xs text-[#727785]">
          <span>Audit Record: <strong>SEC-COR-882194</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-[#e2e8f0] text-[#0b1c30] font-semibold rounded-md hover:bg-[#f1f5f9] cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
