import React, { useState } from 'react';
import { Play, RotateCcw, AlertTriangle, ShieldCheck, Zap, Radio, Cpu, CheckCircle2 } from 'lucide-react';

export const ScenarioSimulatorScreen: React.FC = () => {
  const [selectedScenario, setSelectedScenario] = useState<'teleport' | 'clone' | 'biometric' | 'replay'>('teleport');
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [detectionLatency, setDetectionLatency] = useState<number | null>(null);

  const scenarios = [
    {
      id: 'teleport',
      title: 'GPS Teleportation Injection (High Velocity Spike)',
      description: 'Simulate synthetic NMEA coordinates leaping 280km across sectors from Delhi DND to Jaipur within 12 seconds.',
      targetDriver: 'Tariq Al-Mansoor (#DRV-3319)',
      expectedOutcome: 'High Risk (Score: 89) -> Instant Freeze Trigger',
    },
    {
      id: 'clone',
      title: 'Unpaired MAC Address & Dual IMEI Collision',
      description: 'Emulate an unauthorized device clone transmitting simultaneous telemetry from a second Mumbai BKC cell tower.',
      targetDriver: 'Marcus Vance (#DRV-9042)',
      expectedOutcome: 'High Risk (Score: 94) -> Lineage Disconnect Alert',
    },
    {
      id: 'biometric',
      title: 'Biomechanical Rhythm Divergence (>80% Variance)',
      description: 'Simulate rapid shift in touch pressure, typing cadence, and steering micro-corrections on Chennai OMR.',
      targetDriver: 'Elena Rostova (#DRV-6621)',
      expectedOutcome: 'Liveness Gate Triggered -> Mandatory 3D Face Scan',
    },
    {
      id: 'replay',
      title: 'CANBus Speedometer Replay Packet Attack',
      description: 'Transmit looped OBD-II speed payloads while GPS speedometer registers stationary depot halt in Ahmedabad.',
      targetDriver: 'Carlos Mendez (#DRV-1984)',
      expectedOutcome: 'Corridor Incongruity Flagged -> SOC Queue Notification',
    },
  ];

  const handleRunSimulation = () => {
    setSimulationRunning(true);
    setSimLogs(['[0.00s] Initializing attack vector parameters in isolated edge sandbox...']);
    setDetectionLatency(null);

    setTimeout(() => {
      setSimLogs((prev) => [...prev, '[0.04s] Transmitting crafted anomaly payload to Incongruity Engine...']);
    }, 400);

    setTimeout(() => {
      setSimLogs((prev) => [...prev, '[0.09s] Edge Gateway India-West (Mumbai-Node-04) intercepted telemetry divergence.']);
    }, 800);

    setTimeout(() => {
      setSimLogs((prev) => [
        ...prev,
        '[0.14s] Threat Classifier calculated Anomaly Confidence: 99.82%.',
        '[0.16s] Automated Security Policy Applied: Threat classification escalated to High Risk.',
      ]);
      setDetectionLatency(14);
      setSimulationRunning(false);
    }, 1300);
  };

  const handleReset = () => {
    setSimLogs([]);
    setDetectionLatency(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#727785]">
          THREAT OPS LAB / SYNTHETIC ANOMALY INJECTION
        </div>
        <h1 className="text-2xl font-bold text-[#0b1c30] mt-1">Advanced Scenario Simulator</h1>
        <p className="text-xs text-[#565e74] mt-1 max-w-3xl">
          Stress-test the AsliKaun ML telemetry detection pipeline with synthetic attack vectors, GPS spoofing models, and hardware impersonation attempts.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Scenario Selection */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold text-[#0b1c30]">Select Attack Scenario</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {scenarios.map((sc) => {
              const isSelected = selectedScenario === sc.id;
              return (
                <div
                  key={sc.id}
                  onClick={() => setSelectedScenario(sc.id as any)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#0058be] bg-[#eff4ff]/50 shadow-xs'
                      : 'border-[#e2e8f0] bg-white hover:border-[#cbd5e1]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      isSelected ? 'bg-[#0058be] text-white' : 'bg-[#f1f5f9] text-[#727785]'
                    }`}>
                      {sc.id}
                    </span>
                    <Radio className={`w-4 h-4 ${isSelected ? 'text-[#0058be]' : 'text-[#c2c6d6]'}`} />
                  </div>
                  <h3 className="font-bold text-xs text-[#0b1c30] mt-2">{sc.title}</h3>
                  <p className="text-[11px] text-[#565e74] mt-1">{sc.description}</p>
                  <div className="mt-3 pt-2 border-t border-[#e2e8f0]/60 text-[10px] space-y-0.5">
                    <div className="text-[#727785]">Target: <strong className="text-[#0b1c30]">{sc.targetDriver}</strong></div>
                    <div className="text-[#0058be] font-semibold">{sc.expectedOutcome}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Trigger */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleRunSimulation}
              disabled={simulationRunning}
              className="px-5 py-2.5 rounded-lg bg-[#0058be] hover:bg-[#0047a0] text-white text-xs font-semibold flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-white" />
              {simulationRunning ? 'Simulating Vector Execution...' : 'Execute Scenario Attack'}
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2.5 rounded-lg border border-[#e2e8f0] bg-white text-[#565e74] hover:text-[#0b1c30] text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Terminal
            </button>
          </div>
        </div>

        {/* Right Col: Live Sandbox Output */}
        <div className="bg-[#0b1c30] rounded-xl p-5 text-white flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#38bdf8]" />
                <span className="text-xs font-mono font-bold">EDGE_SANDBOX_OUTPUT</span>
              </div>
              {detectionLatency !== null && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00855b] text-white font-bold">
                  INTERCEPTED IN {detectionLatency}ms
                </span>
              )}
            </div>

            <div className="space-y-2 font-mono text-[11px] text-slate-300 min-h-[180px]">
              {simLogs.length === 0 ? (
                <div className="text-slate-500 italic py-8 text-center">
                  Select a test scenario and press "Execute Scenario Attack" to observe telemetry anomaly classification.
                </div>
              ) : (
                simLogs.map((log, i) => (
                  <div key={i} className="animate-in fade-in duration-100">
                    <span className="text-[#38bdf8]">•</span> {log}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-white/10 pt-3 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Inference Node: india-south-blr-04</span>
            <span className="text-[#00855b] font-semibold">99.99% Precision</span>
          </div>
        </div>
      </div>
    </div>
  );
};
