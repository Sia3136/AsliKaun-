import React from 'react';
import { Cpu, Activity, CheckCircle2, TrendingUp, AlertCircle, BarChart3 } from 'lucide-react';

export const ModelPerformanceScreen: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#727785]">
          MODEL OBSERVABILITY / DRIFT & INFERENCE TELEMETRY
        </div>
        <h1 className="text-2xl font-bold text-[#0b1c30] mt-1">ML Inference Engine Health</h1>
        <p className="text-xs text-[#565e74] mt-1">
          Real-time metrics on the TrustMesh neural classifier, biometric autoencoders, and geospatial edge anomaly gates.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-[#727785]">Model Uptime</span>
          <div className="text-2xl font-bold text-[#006947] mt-1 tabular-nums">99.98%</div>
          <span className="text-[10px] text-[#006947] font-semibold">Zero failovers in 48h</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-[#727785]">Mean Latency</span>
          <div className="text-2xl font-bold text-[#0b1c30] mt-1 tabular-nums">14.2ms</div>
          <span className="text-[10px] text-[#565e74]">p99: 28.6ms</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-[#727785]">False Positive Rate</span>
          <div className="text-2xl font-bold text-[#0b1c30] mt-1 tabular-nums">0.024%</div>
          <span className="text-[10px] text-[#006947] font-semibold">Exceeds SOC SLA target</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-[#727785]">Biometric Confidence</span>
          <div className="text-2xl font-bold text-[#0058be] mt-1 tabular-nums">99.88%</div>
          <span className="text-[10px] text-[#565e74]">Face mesh + Keystroke</span>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] shadow-2xs">
        <h2 className="text-sm font-bold text-[#0b1c30] mb-4">Production Model Registry</h2>
        <div className="divide-y divide-[#f1f5f9] text-xs">
          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-bold text-[#0b1c30]">Incongruity-Engine-v3.4-prod</p>
              <p className="text-[11px] text-[#565e74]">Transformer model for temporal trajectory and cell-tower delta analysis</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#e8f5e9] text-[#006947]">
              Active · Serving
            </span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-bold text-[#0b1c30]">Biomechanical-Cadence-Net-v2.9</p>
              <p className="text-[11px] text-[#565e74]">Recurrent neural net for keystroke dwell times and steering angular jerk</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#e8f5e9] text-[#006947]">
              Active · Serving
            </span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-bold text-[#0b1c30]">Geofence-Jump-Sieve-v1.8</p>
              <p className="text-[11px] text-[#565e74]">Sub-millisecond edge filter for synthetic NMEA sentence rejection</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#e8f5e9] text-[#006947]">
              Active · Serving
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
