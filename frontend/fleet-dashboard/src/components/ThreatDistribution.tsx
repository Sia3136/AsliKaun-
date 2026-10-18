import React, { useState } from 'react';
import { RefreshCw, ArrowUpRight } from 'lucide-react';

interface ThreatDistributionProps {
  onOpenSimulator: () => void;
}

export const ThreatDistribution: React.FC<ThreatDistributionProps> = ({
  onOpenSimulator,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // Percentages from the screenshot:
  // Verified & Stable: 94.8%
  // Device Re-pairings: 3.7%
  // Severe Risk Anomaly: 1.5%

  const circumference = 2 * Math.PI * 40; // ~251.32
  const verifiedOffset = 0;
  const verifiedStroke = (94.8 / 100) * circumference;

  const repairOffset = verifiedStroke;
  const repairStroke = (3.7 / 100) * circumference;

  const severeOffset = verifiedStroke + repairStroke;
  const severeStroke = (1.5 / 100) * circumference;

  return (
    <div className="bg-white rounded-lg border border-[#e2e8f0] p-4 shadow-2xs flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-bold text-[#0b1c30]">Threat Distribution</h3>
          <p className="text-xs text-[#565e74] mt-0.5">
            Anomaly breakdown across last 24 hours of shifts
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-1.5 text-[#565e74] hover:text-[#0b1c30] hover:bg-[#f8f9ff] rounded-md transition-colors cursor-pointer"
          title="Refresh distribution statistics"
        >
          <RefreshCw
            className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#0058be]' : ''}`}
          />
        </button>
      </div>

      {/* Donut Chart Visual */}
      <div className="flex items-center justify-center py-2">
        <div className="relative w-40 h-40">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background ring */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="10"
            />
            {/* Verified & Stable (Emerald) */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#00855b"
              strokeWidth="10"
              strokeDasharray={`${verifiedStroke} ${circumference}`}
              strokeDashoffset={-verifiedOffset}
              className="transition-all duration-700 ease-out"
            />
            {/* Device Re-pairings (Slate Navy) */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#213145"
              strokeWidth="10"
              strokeDasharray={`${repairStroke} ${circumference}`}
              strokeDashoffset={-repairOffset}
              className="transition-all duration-700 ease-out"
            />
            {/* Severe Risk Anomaly (Crimson) */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#ba1a1a"
              strokeWidth="10"
              strokeDasharray={`${severeStroke} ${circumference}`}
              strokeDashoffset={-severeOffset}
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] uppercase font-semibold text-[#727785] tracking-wider">
              24H SHIFTS
            </span>
            <span className="text-xl font-bold text-[#0b1c30] tabular-nums">
              42.8k
            </span>
            <span className="text-[9px] text-[#006947] font-semibold">
              99.85% SLA
            </span>
          </div>
        </div>
      </div>

      {/* Legend Rows matching screenshot */}
      <div className="space-y-2 py-2 px-1 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#00855b] shrink-0" />
            <span className="text-[#0b1c30] font-medium">Verified & Stable</span>
          </div>
          <span className="font-bold text-[#0b1c30] tabular-nums">94.8%</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#213145] shrink-0" />
            <span className="text-[#0b1c30] font-medium">Device Re-pairings</span>
          </div>
          <span className="font-bold text-[#0b1c30] tabular-nums">3.7%</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#ba1a1a] shrink-0" />
            <span className="text-[#0b1c30] font-medium">Severe Risk Anomaly</span>
          </div>
          <span className="font-bold text-[#ba1a1a] tabular-nums">1.5%</span>
        </div>
      </div>

      {/* Button link to Simulator */}
      <div className="mt-2 pt-2 border-t border-[#f1f5f9]">
        <button
          onClick={onOpenSimulator}
          className="w-full py-2 px-4 rounded-md bg-[#eff4ff] hover:bg-[#dce9ff] text-[#0058be] font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>Open Advanced Scenario Simulator</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
