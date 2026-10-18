import React from 'react';
import { 
  Cpu, 
  Activity, 
  CheckCircle2, 
  TrendingUp, 
  AlertCircle, 
  BarChart3, 
  ShieldCheck, 
  Scale, 
  Clock, 
  Layers, 
  Info,
  Lock
} from 'lucide-react';

export const ModelPerformanceScreen: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#727785]">
          MODEL OBSERVABILITY / SCIENTIFIC BENCHMARKS & FAIRNESS AUDIT
        </div>
        <h1 className="text-2xl font-bold text-[#0b1c30] mt-1">ML Evaluation & Cohort Fairness</h1>
        <p className="text-xs text-[#565e74] mt-1 max-w-4xl">
          Empirical evaluation results across the H-MOG and ODIDMob datasets. Reflects real measured EERs, statistical calibration limits, and pause-aware safety timing rather than idealized claims.
        </p>
      </div>

      {/* Top 4 Measured KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-[#727785]">Multi-Modal Fusion EER</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#e8f5e9] text-[#006947]">Measured</span>
          </div>
          <div className="text-2xl font-bold text-[#006947] mt-1 tabular-nums font-mono">15.8%</div>
          <div className="text-[11px] text-[#565e74] mt-0.5">
            Fisher p-value fusion (AUC: <strong className="text-[#0b1c30]">0.921</strong>)
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-[#727785]">Touch Triplet Holdout</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#eff4ff] text-[#0058be]">Validated</span>
          </div>
          <div className="text-2xl font-bold text-[#0058be] mt-1 tabular-nums font-mono">35.1%</div>
          <div className="text-[11px] text-[#565e74] mt-0.5">
            GRU Triplet vs 43.6% classical baseline
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-[#727785]">Detection Latency</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#f8f9ff] text-[#727785]">Benchmarked</span>
          </div>
          <div className="text-2xl font-bold text-[#0b1c30] mt-1 tabular-nums font-mono">0 sessions</div>
          <div className="text-[11px] text-[#565e74] mt-0.5">
            Instant for abrupt handoff; 37s for drift
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-[#727785]">1% False Challenge</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#fef3c7] text-[#b45309]">Target Goal</span>
          </div>
          <div className="text-2xl font-bold text-[#b45309] mt-1 tabular-nums font-mono">&lt; 1.0%</div>
          <div className="text-[11px] text-[#565e74] mt-0.5">
            Aspirational; requires ≥99 sessions/rider
          </div>
        </div>
      </div>

      {/* Cohort Fairness & Sample Size Transparency Box */}
      <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] shadow-2xs space-y-3">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-[#0058be]" />
          <h2 className="text-sm font-bold text-[#0b1c30]">Evaluation Cohorts & Sample Size Transparency</h2>
        </div>
        <p className="text-xs text-[#565e74] leading-relaxed">
          In continuous biometrics, claiming strict false-rejection rates without sufficient per-subject samples is statistically unsound. Antigravity and AsliKaun explicitly report cohort constraints and holdout evaluations:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 text-xs">
          <div className="p-3.5 rounded-lg border border-[#e2e8f0] bg-[#f8f9ff] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#0b1c30]">Touch Modality (H-MOG Dataset)</span>
              <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-[#e2e8f0]">8 Targets × 20 Holdout Impostors</span>
            </div>
            <p className="text-[11px] text-[#565e74]">
              Tested on fresh, non-overlapping users. Deep GRU triplet encoder consistently outperformed classical isolation forests (EER dropped from 0.408 to <strong>0.351</strong>; AUC 0.722).
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-[#e2e8f0] bg-[#f8f9ff] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#0b1c30]">GPS Modality (ODIDMob Routes)</span>
              <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-[#e2e8f0]">8 Couriers × 10 Impostors</span>
            </div>
            <p className="text-[11px] text-[#565e74]">
              Real delivery waves in Beijing. Triplet (0.372) vs Classical (0.427) flipped between cohorts. The gap is within statistical noise, so the classical model is retained on engineering-simplicity grounds.
            </p>
          </div>
        </div>

        {/* Statistical Note */}
        <div className="p-3 rounded-lg bg-[#eff4ff] border border-[#d3e4fe] flex items-start gap-2.5 text-xs text-[#0058be]">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong>Statistical Calibration Note regarding the 1% False Challenge Target:</strong>
            <p className="text-[11px] leading-relaxed text-[#0047a0]">
              To resolve an empirical 1% false challenge rate on an individual rider basis requires at least 1/0.01 = 99 calibration sessions for that specific driver. Current evaluation datasets contain 10–20 calibration sessions per rider. The system therefore uses a population-calibrated threshold (0.29) by default, and automatically sharpens to an individually-calibrated threshold as rider history accumulates.
            </p>
          </div>
        </div>
      </div>

      {/* Benchmarked Standalone Signal Models Table */}
      <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] shadow-2xs">
        <h2 className="text-sm font-bold text-[#0b1c30] mb-4">Signal Modality Benchmark Registry</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#e2e8f0] text-[10px] font-bold uppercase text-[#727785]">
                <th className="pb-2.5">Modality</th>
                <th className="pb-2.5">Benchmark Dataset</th>
                <th className="pb-2.5">Production Architecture</th>
                <th className="pb-2.5">Pooled EER</th>
                <th className="pb-2.5">Pooled AUC</th>
                <th className="pb-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              <tr>
                <td className="py-3 font-bold text-[#0b1c30]">Touch Gestures</td>
                <td className="py-3 text-[#565e74]">H-MOG Trajectories</td>
                <td className="py-3 font-mono text-[#0058be]">2-layer GRU Triplet Encoder</td>
                <td className="py-3 font-mono font-bold text-[#006947]">0.352</td>
                <td className="py-3 font-mono">0.722</td>
                <td className="py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#e8f5e9] text-[#006947]">Active · Winner</span></td>
              </tr>
              <tr>
                <td className="py-3 font-bold text-[#0b1c30]">Operational Cadence</td>
                <td className="py-3 text-[#565e74]">Accept Latency + Cyclical Hour</td>
                <td className="py-3 font-mono text-[#0058be]">Per-Rider Isolation Forest</td>
                <td className="py-3 font-mono font-bold text-[#006947]">0.256</td>
                <td className="py-3 font-mono">0.805</td>
                <td className="py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#e8f5e9] text-[#006947]">Active · Real-time</span></td>
              </tr>
              <tr>
                <td className="py-3 font-bold text-[#0b1c30]">GPS Trajectory</td>
                <td className="py-3 text-[#565e74]">ODIDMob Courier Routes</td>
                <td className="py-3 font-mono text-[#0058be]">Classical Isolation Forest</td>
                <td className="py-3 font-mono font-bold text-[#565e74]">0.397</td>
                <td className="py-3 font-mono">0.622</td>
                <td className="py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#eff4ff] text-[#0058be]">Active · Simplicity</span></td>
              </tr>
              <tr>
                <td className="py-3 font-bold text-[#0b1c30]">Motion Dynamics</td>
                <td className="py-3 text-[#565e74]">H-MOG Tri-axial Accel / Jerk</td>
                <td className="py-3 font-mono text-[#0058be]">Time/Freq Windowed Isolation Forest</td>
                <td className="py-3 font-mono font-bold text-[#565e74]">0.440</td>
                <td className="py-3 font-mono">0.570</td>
                <td className="py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#eff4ff] text-[#0058be]">Active · Inertial</span></td>
              </tr>
              <tr className="bg-[#f8f9ff] font-bold">
                <td className="py-3 text-[#0058be]">Fused Multi-Modal</td>
                <td className="py-3 text-[#0b1c30]">Combined Biometric Stream</td>
                <td className="py-3 font-mono text-[#0058be]">Fisher's Omnibus P-Value Fusion</td>
                <td className="py-3 font-mono text-[#006947]">0.158</td>
                <td className="py-3 font-mono text-[#006947]">0.921</td>
                <td className="py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#e8f5e9] text-[#006947]">Two-Axis Production</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Pause-Aware Timing Gate & Safety Policy */}
      <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#e8f5e9] text-[#006947] flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0b1c30]">Pause-Aware Safety Challenge Timing Policy</h3>
            <p className="text-xs text-[#565e74] mt-0.5 max-w-2xl leading-relaxed">
              Delivery platform safety requires that continuous identity challenges <strong>never interrupt active vehicle transit</strong>. If anomalous telemetry is detected at highway or corridor speeds (&gt; 2 mph), the decision engine records <code className="font-mono text-[#006947] bg-[#e8f5e9] px-1 rounded">safe_pause_scheduled: true</code> and defers the selfie/liveness step-up check until a verified stop light, depot halt, or shift drop-off (0 mph).
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#e8f5e9] text-[#006947] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Pause Timing Enforced</span>
          </span>
        </div>
      </div>
    </div>
  );
};
