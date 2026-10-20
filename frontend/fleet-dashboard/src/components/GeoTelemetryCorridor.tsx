import React, { useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { DriverRecord } from '../types/fleet';

interface GeoTelemetryCorridorProps {
  onSelectDriver: (driver: DriverRecord) => void;
  drivers: DriverRecord[];
}

export const GeoTelemetryCorridor: React.FC<GeoTelemetryCorridorProps> = ({ onSelectDriver, drivers }) => {
  const [riskOnly, setRiskOnly] = useState(false);
  const [hoveredDriver, setHoveredDriver] = useState<DriverRecord | null>(null);
  const nodes = useMemo(() => {
    const located = drivers.filter((driver) => Number.isFinite(driver.location.lat) && Number.isFinite(driver.location.lng));
    if (!located.length) return [];
    const lats = located.map((driver) => driver.location.lat);
    const lngs = located.map((driver) => driver.location.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    return located.map((driver) => ({
      driver,
      x: 36 + ((driver.location.lng - minLng) / (maxLng - minLng || 1)) * 528,
      y: 28 + (1 - (driver.location.lat - minLat) / (maxLat - minLat || 1)) * 184,
      flagged: driver.riskCategory === 'High Risk',
    }));
  }, [drivers]);
  const shownNodes = riskOnly ? nodes.filter((node) => node.flagged) : nodes;
  const flaggedCount = nodes.filter((node) => node.flagged).length;

  return (
    <div className="bg-white rounded-lg border border-[#e2e8f0] p-4 shadow-2xs flex flex-col justify-between">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-bold text-[#0b1c30]">Fleet GPS telemetry</h3>
          <p className="text-xs text-[#565e74] mt-0.5">Markers use the latest GPS coordinates received from the backend.</p>
        </div>
        <span className="text-xs font-semibold text-[#565e74]">{nodes.length} located · {flaggedCount} high risk</span>
      </div>
      <div className="relative w-full h-56 bg-[#eff4ff]/60 rounded-lg border border-[#dce9ff] overflow-hidden">
        <div className="absolute top-3 left-3 z-10 rounded-md bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#0b1c30] border border-[#e2e8f0]">
          {flaggedCount} high risk of {nodes.length} located drivers
        </div>
        <button onClick={() => setRiskOnly((value) => !value)} className="absolute top-3 right-3 z-10 px-2 py-1 text-[10px] font-semibold rounded bg-white border border-[#e2e8f0]">
          {riskOnly ? 'Show all located' : 'High risk only'}
        </button>
        <svg viewBox="0 0 600 240" className="w-full h-full" preserveAspectRatio="none" aria-label="Latest driver GPS positions">
          <defs><pattern id="fleet-map-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d3e4fe" strokeWidth="0.8" strokeDasharray="3 3" /></pattern></defs>
          <rect width="600" height="240" fill="url(#fleet-map-grid)" />
          {shownNodes.map(({ driver, x, y, flagged }) => (
            <g key={driver.id} className="cursor-pointer" onClick={() => onSelectDriver(driver)} onMouseEnter={() => setHoveredDriver(driver)} onMouseLeave={() => setHoveredDriver(null)}>
              {flagged && <circle cx={x} cy={y} r="12" fill="#ba1a1a" opacity="0.18" />}
              <circle cx={x} cy={y} r="5" fill={flagged ? '#ba1a1a' : '#00855b'} stroke="white" strokeWidth="2" />
              {(hoveredDriver?.id === driver.id || flagged) && <text x={x + 8} y={y - 7} fill={flagged ? '#ba1a1a' : '#0b1c30'} fontSize="9" fontWeight="700">{driver.id}</text>}
            </g>
          ))}
        </svg>
        {!nodes.length && <div className="absolute inset-0 grid place-items-center text-sm text-[#565e74]">No GPS locations reported by the backend.</div>}
        {hoveredDriver && <div className="absolute bottom-3 left-3 bg-white/95 p-2.5 rounded-lg border border-[#e2e8f0] shadow-md text-xs max-w-xs">
          <div className="flex items-center gap-1.5 font-bold text-[#0b1c30]"><ShieldAlert className="w-3.5 h-3.5" /><span>{hoveredDriver.id}</span></div>
          <p className="text-[11px] text-[#565e74] mt-0.5">{hoveredDriver.location.corridor}</p>
          <div className="mt-1 text-[10px] text-[#727785]">Speed: {hoveredDriver.location.speedMph} mph · {hoveredDriver.riskCategory}</div>
        </div>}
      </div>
      <div className="mt-3 pt-3 border-t border-[#f1f5f9] flex items-center justify-between text-[11px] text-[#565e74]"><span>GPS data is from each driver’s latest ingested session.</span><span>{drivers.length - nodes.length} without coordinates</span></div>
    </div>
  );
};
