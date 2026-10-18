import React, { useState } from 'react';
import { Layers, Maximize2, Navigation, Radio, ShieldAlert } from 'lucide-react';
import { DriverRecord } from '../types/fleet';

interface GeoTelemetryCorridorProps {
  onSelectDriver: (driver: DriverRecord) => void;
  drivers: DriverRecord[];
}

export const GeoTelemetryCorridor: React.FC<GeoTelemetryCorridorProps> = ({
  onSelectDriver,
  drivers,
}) => {
  const [activeLayer, setActiveLayer] = useState<'all' | 'geofence' | 'nodes'>('all');
  const [hoveredDriver, setHoveredDriver] = useState<DriverRecord | null>(null);

  // Map nodes representation in Indian fleet corridors
  const nodes = [
    { id: 'DRV-9042', x: 280, y: 140, driver: drivers.find(d => d.id === 'DRV-9042'), flagged: true, label: 'Marcus Vance · Mumbai BKC' },
    { id: 'DRV-3319', x: 490, y: 75, driver: drivers.find(d => d.id === 'DRV-3319'), flagged: true, label: 'Tariq · Delhi NH-48' },
    { id: 'DRV-6621', x: 170, y: 165, driver: drivers.find(d => d.id === 'DRV-6621'), flagged: true, label: 'Elena · Chennai OMR' },
    { id: 'DRV-4112', x: 390, y: 190, driver: drivers.find(d => d.id === 'DRV-4112'), flagged: false, label: 'Sophia · Bengaluru ORR' },
    { id: 'DRV-7890', x: 120, y: 90, driver: drivers.find(d => d.id === 'DRV-7890'), flagged: false, label: 'David · Hyderabad HITEC' },
  ];

  return (
    <div className="bg-white rounded-lg border border-[#e2e8f0] p-4 shadow-2xs flex flex-col justify-between">
      {/* Card Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-bold text-[#0b1c30]">
            Active Geo-Telemetry Corridor (India-Fleet)
          </h3>
          <p className="text-xs text-[#565e74] mt-0.5">
            Real-time edge clustering across Delhi-NCR, Mumbai-Pune, Bengaluru &amp; Hyderabad corridors
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#eff4ff] text-[#0058be] border border-[#dce9ff]">
            <span className="w-2 h-2 rounded-full bg-[#00855b] animate-pulse" />
            Live Map Overlay
          </span>
        </div>
      </div>

      {/* Map Graphic Canvas / SVG */}
      <div className="relative w-full h-56 bg-[#eff4ff]/60 rounded-lg border border-[#dce9ff] overflow-hidden group">
        {/* Pinned Alert Badge */}
        <div className="absolute top-3 left-3 z-10">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/95 backdrop-blur-xs rounded-md shadow-xs border border-[#ffdad6] text-xs font-semibold text-[#ba1a1a]">
            <span className="w-2 h-2 rounded-full bg-[#ba1a1a] animate-ping" />
            <span>3 Active Geofence Velocity Flags</span>
          </div>
        </div>

        {/* Map Layers Toggle */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-xs p-1 rounded-md border border-[#e2e8f0] shadow-2xs">
          <button
            onClick={() => setActiveLayer(activeLayer === 'all' ? 'geofence' : 'all')}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded cursor-pointer ${
              activeLayer === 'all'
                ? 'bg-[#0058be] text-white'
                : 'text-[#565e74] hover:text-[#0b1c30]'
            }`}
          >
            All Corridors
          </button>
          <button
            onClick={() => setActiveLayer('geofence')}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded cursor-pointer ${
              activeLayer === 'geofence'
                ? 'bg-[#0058be] text-white'
                : 'text-[#565e74] hover:text-[#0b1c30]'
            }`}
          >
            Geofence Risk
          </button>
        </div>

        {/* SVG Topography & Corridors */}
        <svg
          viewBox="0 0 600 240"
          className="w-full h-full object-cover"
          preserveAspectRatio="none"
        >
          {/* Subtle Grid Lines */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d3e4fe" strokeWidth="0.8" strokeDasharray="3 3" />
            </pattern>
            {/* Pulsing Red Glow */}
            <radialGradient id="redGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ba1a1a" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ba1a1a" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect width="600" height="240" fill="url(#grid)" />

          {/* Regional Highway Arterials (Golden Quadrilateral & Expressways) */}
          <path
            d="M 20 200 C 140 180, 220 150, 320 120 C 420 90, 520 80, 590 50"
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M 20 200 C 140 180, 220 150, 320 120 C 420 90, 520 80, 590 50"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Secondary Expressway (NH-48 / Mumbai-Pune Expressway) */}
          <path
            d="M 100 20 C 180 80, 280 140, 400 180 C 480 200, 540 220, 580 230"
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M 100 20 C 180 80, 280 140, 400 180 C 480 200, 540 220, 580 230"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Geofence Perimeter Polygon (Warning Area) */}
          {(activeLayer === 'all' || activeLayer === 'geofence') && (
            <g>
              <polygon
                points="240,90 350,70 380,170 230,165"
                fill="#fee2e2"
                fillOpacity="0.5"
                stroke="#ba1a1a"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              <text x="245" y="85" fill="#ba1a1a" fontSize="8.5" fontWeight="700">
                ZONE BENGALURU-ORR RESTRICTED GEOFENCE
              </text>
            </g>
          )}

          {/* Telemetry Velocity Vector Arrow (Tariq - 840km/h spoof on Delhi-Jaipur NH-48) */}
          <path
            d="M 490 75 L 560 30"
            stroke="#ba1a1a"
            strokeWidth="2"
            strokeDasharray="3 2"
          />
          <polygon points="560,30 545,32 555,42" fill="#ba1a1a" />

          {/* Markers */}
          {nodes.map((node) => {
            const isHovered = hoveredDriver?.id === node.id;
            return (
              <g
                key={node.id}
                className="cursor-pointer transition-transform"
                onClick={() => node.driver && onSelectDriver(node.driver)}
                onMouseEnter={() => node.driver && setHoveredDriver(node.driver)}
                onMouseLeave={() => setHoveredDriver(null)}
              >
                {node.flagged ? (
                  <>
                    {/* Pulsing ring */}
                    <circle cx={node.x} cy={node.y} r="14" fill="url(#redGlow)" className="animate-pulse" />
                    <circle cx={node.x} cy={node.y} r="6" fill="#ba1a1a" stroke="#ffffff" strokeWidth="2" />
                    {/* Marker Pin Icon */}
                    <circle cx={node.x} cy={node.y} r="2" fill="#ffffff" />
                  </>
                ) : (
                  <>
                    <circle cx={node.x} cy={node.y} r="5" fill="#00855b" stroke="#ffffff" strokeWidth="2" />
                  </>
                )}

                {/* Node Label on Hover or for High Risk */}
                {(isHovered || node.flagged) && (
                  <g transform={`translate(${node.x - 30}, ${node.y - 18})`}>
                    <rect
                      width="80"
                      height="15"
                      rx="3"
                      fill={node.flagged ? '#ba1a1a' : '#0b1c30'}
                      opacity="0.9"
                    />
                    <text
                      x="40"
                      y="11"
                      fill="#ffffff"
                      fontSize="8"
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {node.id}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip when hovering a driver node */}
        {hoveredDriver && (
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs p-2.5 rounded-lg border border-[#e2e8f0] shadow-md z-20 text-xs max-w-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-1.5 font-bold text-[#0b1c30]">
              <ShieldAlert className="w-3.5 h-3.5 text-[#ba1a1a]" />
              <span>{hoveredDriver.name}</span>
              <span className="font-mono text-[10px] text-[#565e74]">#{hoveredDriver.id}</span>
            </div>
            <p className="text-[11px] text-[#565e74] mt-0.5">{hoveredDriver.location.corridor}</p>
            <div className="mt-1 flex items-center justify-between text-[10px] text-[#727785]">
              <span>Speed: <strong>{hoveredDriver.location.speedMph} mph</strong></span>
              <span className="text-[#ba1a1a] font-semibold">{hoveredDriver.riskReason}</span>
            </div>
          </div>
        )}
      </div>

      {/* Gateway Telemetry Footer */}
      <div className="mt-3 pt-3 border-t border-[#f1f5f9] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#565e74]">
        <div>
          India-South (Bengaluru) Edge Gateway:{' '}
          <span className="font-semibold text-[#006947]">99.992% uptime</span>
        </div>
        <div>
          Gateway Latency:{' '}
          <span className="font-mono font-semibold text-[#0b1c30]">11.2ms</span>
        </div>
        <div>
          Inter-Node Cryptographic Sync:{' '}
          <span className="font-semibold text-[#006947]">Enforced (BOM / BLR / DEL / HYD)</span>
        </div>
      </div>
    </div>
  );
};
