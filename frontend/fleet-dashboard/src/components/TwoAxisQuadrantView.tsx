import React, { useState } from 'react';
import { 
  ShieldCheck, 
  RefreshCw, 
  AlertTriangle, 
  Smartphone, 
  HelpCircle,
  Eye,
  Crosshair,
  UserCheck,
  CheckCircle2
} from 'lucide-react';
import { DriverRecord } from '../types/fleet';

interface TwoAxisQuadrantViewProps {
  drivers: DriverRecord[];
  onSelectDriver: (driver: DriverRecord) => void;
  selectedDriverId?: string | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const TwoAxisQuadrantView: React.FC<TwoAxisQuadrantViewProps> = ({
  drivers,
  onSelectDriver,
  selectedDriverId,
  onRefresh,
  isRefreshing = false,
}) => {
  const [filterQuadrant, setFilterQuadrant] = useState<'all' | 'stable' | 'legit_change' | 'handoff_signature' | 'ambiguous'>('all');
  const [hoveredDriver, setHoveredDriver] = useState<DriverRecord | null>(null);

  // Group counts by quadrant
  const counts = {
    stable: drivers.filter((d) => (d.contextScore >= 60 && d.behavioralScore >= 60)).length,
    legit_change: drivers.filter((d) => (d.contextScore < 60 && d.behavioralScore >= 60)).length,
    handoff_signature: drivers.filter((d) => (d.contextScore >= 60 && d.behavioralScore < 60)).length,
    ambiguous: drivers.filter((d) => (d.contextScore < 60 && d.behavioralScore < 60)).length,
  };

  const filteredDrivers = drivers.filter((d) => {
    if (filterQuadrant === 'all') return true;
    if (filterQuadrant === 'stable') return d.contextScore >= 60 && d.behavioralScore >= 60;
    if (filterQuadrant === 'legit_change') return d.contextScore < 60 && d.behavioralScore >= 60;
    if (filterQuadrant === 'handoff_signature') return d.contextScore >= 60 && d.behavioralScore < 60;
    if (filterQuadrant === 'ambiguous') return d.contextScore < 60 && d.behavioralScore < 60;
    return true;
  });

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-2xs flex flex-col justify-between">
      {/* Header with Title and Quadrant Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0058be] bg-[#eff4ff] px-2 py-0.5 rounded">
              Two-Axis Continuous Verification
            </span>
            <span className="text-xs text-[#727785]">·</span>
            <span className="text-xs text-[#565e74] font-medium">Context vs. Behavioral Biometrics</span>
          </div>
          <h2 className="text-lg font-bold text-[#0b1c30] mt-1">Trust Juggler Decision Quadrant</h2>
          <p className="text-xs text-[#565e74] mt-0.5 max-w-xl">
            Live evaluation plane plotting fleet scores from the ML fusion engine. Proves account rental separation (same context with anomalous motor gestures) vs. authentic device upgrades.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1.5 text-[#565e74] hover:text-[#0b1c30] hover:bg-[#f8f9ff] rounded-md transition-colors cursor-pointer"
              title="Refresh quadrant telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#0058be]' : ''}`} />
            </button>
          )}
          <div className="flex items-center bg-[#f8f9ff] p-1 rounded-lg border border-[#e2e8f0] text-[11px] font-semibold">
            <button
              onClick={() => setFilterQuadrant('all')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                filterQuadrant === 'all' ? 'bg-white text-[#0b1c30] shadow-2xs font-bold' : 'text-[#565e74] hover:text-[#0b1c30]'
              }`}
            >
              All ({drivers.length})
            </button>
            <button
              onClick={() => setFilterQuadrant('handoff_signature')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                filterQuadrant === 'handoff_signature' ? 'bg-[#ffdad6] text-[#ba1a1a] font-bold' : 'text-[#ba1a1a] hover:bg-[#fee2e2]'
              }`}
            >
              Handoffs ({counts.handoff_signature})
            </button>
            <button
              onClick={() => setFilterQuadrant('legit_change')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                filterQuadrant === 'legit_change' ? 'bg-[#eff4ff] text-[#0058be] font-bold' : 'text-[#0058be] hover:bg-[#dce9ff]'
              }`}
            >
              Legit Swap ({counts.legit_change})
            </button>
            <button
              onClick={() => setFilterQuadrant('stable')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                filterQuadrant === 'stable' ? 'bg-[#e8f5e9] text-[#006947] font-bold' : 'text-[#006947] hover:bg-[#c8e6c9]'
              }`}
            >
              Stable ({counts.stable})
            </button>
          </div>
        </div>
      </div>

      {/* 2D Interactive Plane Container */}
      <div className="relative w-full h-80 sm:h-96 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0] overflow-hidden select-none">
        {/* Background Quadrant Grids */}
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
          {/* Top-Left Quadrant: Legitimate Change (Rebaseline) */}
          <div className="p-3 border-r border-b border-dashed border-[#cbd5e1] bg-[#eff4ff]/30 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#0058be] bg-white/80 px-2 py-0.5 rounded shadow-2xs">
                <Smartphone className="w-3 h-3" />
                Legit Change · Silent Rebaseline
              </span>
              <span className="text-[10px] font-mono font-bold text-[#0058be]">{counts.legit_change} active</span>
            </div>
            <div className="text-[10px] text-[#565e74] leading-tight">
              New phone/zone, verified behavior.<br />
              <strong className="text-[#0058be]">Zero false challenges.</strong>
            </div>
          </div>

          {/* Top-Right Quadrant: Stable (Continue) */}
          <div className="p-3 border-b border-dashed border-[#cbd5e1] bg-[#e8f5e9]/30 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#006947] bg-white/80 px-2 py-0.5 rounded shadow-2xs">
                <ShieldCheck className="w-3 h-3" />
                Stable · Verified Continue
              </span>
              <span className="text-[10px] font-mono font-bold text-[#006947]">{counts.stable} active</span>
            </div>
            <div className="text-[10px] text-[#565e74] leading-tight text-right">
              Verified device & biometric habits.<br />
              <strong className="text-[#006947]">Frictionless shift.</strong>
            </div>
          </div>

          {/* Bottom-Left Quadrant: Ambiguous (Step-Up Check) */}
          <div className="p-3 border-r border-dashed border-[#cbd5e1] bg-[#fef3c7]/30 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#b45309] bg-white/80 px-2 py-0.5 rounded shadow-2xs">
                <HelpCircle className="w-3 h-3" />
                Ambiguous · Safe Step-Up Check
              </span>
              <span className="text-[10px] font-mono font-bold text-[#b45309]">{counts.ambiguous} active</span>
            </div>
            <div className="text-[10px] text-[#565e74] leading-tight">
              Context and motor rhythm both shifted.<br />
              <strong className="text-[#b45309]">Step-up selfie at safe stop.</strong>
            </div>
          </div>

          {/* Bottom-Right Quadrant: Handoff Signature (Escalate Challenge) */}
          <div className="p-3 bg-[#fee2e2]/30 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#ba1a1a] bg-white/80 px-2 py-0.5 rounded shadow-2xs">
                <AlertTriangle className="w-3 h-3" />
                Handoff Signature · Escalated Challenge
              </span>
              <span className="text-[10px] font-mono font-bold text-[#ba1a1a]">{counts.handoff_signature} active</span>
            </div>
            <div className="text-[10px] text-[#ba1a1a] leading-tight text-right">
              Known hardware, anomalous physical operator.<br />
              <strong>Account Rental Signature!</strong>
            </div>
          </div>
        </div>

        {/* Center Threshold Axis Marks (0.6 Thresholds) */}
        <div className="absolute left-[60%] top-0 bottom-0 w-0.5 bg-[#0058be]/40 pointer-events-none">
          <span className="absolute top-1 left-1.5 text-[9px] font-mono font-bold text-[#0058be] bg-white/90 px-1 py-0.5 rounded">
            Context Threshold 0.60
          </span>
        </div>
        <div className="absolute top-[40%] left-0 right-0 h-0.5 bg-[#0058be]/40 pointer-events-none">
          <span className="absolute left-1.5 bottom-1 text-[9px] font-mono font-bold text-[#0058be] bg-white/90 px-1 py-0.5 rounded">
            Behavior Alpha 0.60 (or 0.29 Conformal)
          </span>
        </div>

        {/* Driver Plot Points */}
        {filteredDrivers.map((driver) => {
          // Normalize coordinates to percentage: Context (0 - 100) -> left %, Behavior (0 - 100) -> bottom %
          const leftPct = Math.min(94, Math.max(6, driver.contextScore));
          const bottomPct = Math.min(94, Math.max(6, driver.behavioralScore));
          const isSelected = selectedDriverId === driver.id;
          const isHandoff = driver.contextScore >= 60 && driver.behavioralScore < 60;
          const isLegit = driver.contextScore < 60 && driver.behavioralScore >= 60;
          const isAmbiguous = driver.contextScore < 60 && driver.behavioralScore < 60;

          const dotColor = isHandoff
            ? 'bg-[#ba1a1a] text-white ring-4 ring-[#ffdad6]'
            : isLegit
            ? 'bg-[#0058be] text-white ring-4 ring-[#dce9ff]'
            : isAmbiguous
            ? 'bg-[#d97706] text-white ring-4 ring-[#fef3c7]'
            : 'bg-[#00855b] text-white ring-4 ring-[#c8e6c9]';

          return (
            <div
              key={driver.id}
              style={{ left: `${leftPct}%`, bottom: `${bottomPct}%` }}
              className={`absolute -translate-x-1/2 translate-y-1/2 cursor-pointer z-20 group transition-transform ${
                isSelected ? 'scale-125 z-30' : 'hover:scale-115'
              }`}
              onClick={() => onSelectDriver(driver)}
              onMouseEnter={() => setHoveredDriver(driver)}
              onMouseLeave={() => setHoveredDriver(null)}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shadow-md ${dotColor}`}>
                {driver.id.slice(-2)}
              </div>
              <span className="hidden group-hover:block absolute top-8 left-1/2 -translate-x-1/2 bg-[#0b1c30] text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap shadow-lg z-40 font-mono">
                {driver.name} (#{driver.id})
              </span>
            </div>
          );
        })}

        {/* Axis Labels */}
        <div className="absolute bottom-1 right-2 text-[10px] font-bold text-[#565e74] bg-white/90 px-2 py-0.5 rounded border border-[#e2e8f0]">
          Context Continuity → (0.0 to 1.0)
        </div>
        <div className="absolute top-2 left-2 text-[10px] font-bold text-[#565e74] bg-white/90 px-2 py-0.5 rounded border border-[#e2e8f0]">
          ↑ Behavioral Continuity (0.0 to 1.0)
        </div>
      </div>

      {/* Selected / Hovered Driver Info Footer */}
      <div className="mt-4 pt-3 border-t border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {hoveredDriver ? (
          <div className="flex items-center gap-3">
            <span className="font-bold text-[#0b1c30]">{hoveredDriver.name}</span>
            <span className="font-mono text-[11px] text-[#565e74]">#{hoveredDriver.id}</span>
            <span className="text-[#727785]">·</span>
            <span>Context: <strong className="font-mono font-bold text-[#0058be]">{(hoveredDriver.contextScore / 100).toFixed(2)}</strong></span>
            <span>Behavior: <strong className="font-mono font-bold text-[#0058be]">{(hoveredDriver.behavioralScore / 100).toFixed(2)}</strong></span>
            <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
              hoveredDriver.riskCategory === 'High Risk' ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#e8f5e9] text-[#006947]'
            }`}>
              {hoveredDriver.riskCategory}
            </span>
          </div>
        ) : (
          <div className="text-[#565e74] text-[11px] flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5 text-[#0058be]" />
            <span>Hover or click any driver node on the 2D plane to inspect their live multi-modal score vector.</span>
          </div>
        )}

        <div className="flex items-center gap-4 text-[11px] text-[#727785]">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#00855b]" />
            <span>Stable</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#0058be]" />
            <span>Legit Change</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#ba1a1a]" />
            <span>Handoff</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#d97706]" />
            <span>Ambiguous</span>
          </div>
        </div>
      </div>
    </div>
  );
};
