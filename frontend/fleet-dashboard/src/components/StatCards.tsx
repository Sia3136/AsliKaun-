import React from 'react';
import { 
  Car, 
  TrendingUp, 
  AlertTriangle, 
  Smartphone, 
  Fingerprint, 
  CheckCircle2, 
  RefreshCw 
} from 'lucide-react';

interface StatCardsProps {
  activeStreams: number;
  severeCount: number;
  newHardwareCount: number;
  livenessGateCount: number;
  onFilterClick?: (filter: 'all' | 'high-risk' | 'new-devices' | 'pending-liveness') => void;
}

export const StatCards: React.FC<StatCardsProps> = ({
  activeStreams = 42890,
  severeCount = 632,
  newHardwareCount = 1204,
  livenessGateCount = 43,
  onFilterClick,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. ACTIVE STREAM COUNT */}
      <div 
        onClick={() => onFilterClick && onFilterClick('all')}
        className="bg-white rounded-lg border border-[#e2e8f0] p-4 flex items-center justify-between shadow-2xs hover:border-[#cbd5e1] transition-all cursor-pointer group"
      >
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#565e74] block mb-1">
            ACTIVE STREAM COUNT
          </span>
          <div className="text-2xl font-bold text-[#0b1c30] tabular-nums tracking-tight">
            {activeStreams.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[#00855b] font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+342 vs last shift</span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-[#eff4ff] text-[#0058be] flex items-center justify-center shrink-0 group-hover:bg-[#dce9ff] transition-colors">
          <Car className="w-5 h-5 stroke-[2]" />
        </div>
      </div>

      {/* 2. SEVERE INCONGRUITY */}
      <div 
        onClick={() => onFilterClick && onFilterClick('high-risk')}
        className="bg-white rounded-lg border border-[#e2e8f0] p-4 flex items-center justify-between shadow-2xs hover:border-[#fca5a5] transition-all cursor-pointer group relative overflow-hidden"
      >
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#565e74] block mb-1">
            SEVERE INCONGRUITY
          </span>
          <div className="text-2xl font-bold text-[#ba1a1a] tabular-nums tracking-tight">
            {severeCount.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[#ba1a1a] font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Action required (1.47%)</span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-[#ffdad6]/60 text-[#ba1a1a] flex items-center justify-center shrink-0 group-hover:bg-[#ffdad6] transition-colors">
          <AlertTriangle className="w-5 h-5 stroke-[2]" />
        </div>
      </div>

      {/* 3. NEW HARDWARE SWAPS */}
      <div 
        onClick={() => onFilterClick && onFilterClick('new-devices')}
        className="bg-white rounded-lg border border-[#e2e8f0] p-4 flex items-center justify-between shadow-2xs hover:border-[#cbd5e1] transition-all cursor-pointer group"
      >
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#565e74] block mb-1">
            NEW HARDWARE SWAPS
          </span>
          <div className="text-2xl font-bold text-[#0b1c30] tabular-nums tracking-tight">
            {newHardwareCount.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[#565e74] font-medium">
            <Smartphone className="w-3.5 h-3.5 text-[#565e74]" />
            <span>Unverified IMEIs pending</span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-[#eff4ff] text-[#0058be] flex items-center justify-center shrink-0 group-hover:bg-[#dce9ff] transition-colors">
          <Smartphone className="w-5 h-5 stroke-[2]" />
        </div>
      </div>

      {/* 4. ACTIVE LIVENESS GATE */}
      <div 
        onClick={() => onFilterClick && onFilterClick('pending-liveness')}
        className="bg-white rounded-lg border border-[#e2e8f0] p-4 flex items-center justify-between shadow-2xs hover:border-[#cbd5e1] transition-all cursor-pointer group"
      >
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#565e74] block mb-1">
            ACTIVE LIVENESS GATE
          </span>
          <div className="text-2xl font-bold text-[#0058be] tabular-nums tracking-tight">
            {livenessGateCount.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[#00855b] font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>38 passed in last 10m</span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-[#eff4ff] text-[#0058be] flex items-center justify-center shrink-0 group-hover:bg-[#dce9ff] transition-colors">
          <Fingerprint className="w-5 h-5 stroke-[2]" />
        </div>
      </div>
    </div>
  );
};
