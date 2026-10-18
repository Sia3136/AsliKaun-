import React, { useState, useEffect } from 'react';
import { Search, ShieldAlert, Cpu, Activity, ArrowRight, X, Terminal } from 'lucide-react';
import { DriverRecord, TabKey } from '../../types/fleet';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  drivers: DriverRecord[];
  onSelectDriver: (driver: DriverRecord) => void;
  onNavigateTab: (tab: TabKey) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  drivers,
  onSelectDriver,
  onNavigateTab,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredDrivers = drivers.filter(
    (d) =>
      d.name.toLowerCase().includes(query.toLowerCase()) ||
      d.id.toLowerCase().includes(query.toLowerCase()) ||
      d.imei.includes(query) ||
      d.plate.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      <div onClick={onClose} className="fixed inset-0 bg-[#0b1c30]/50 backdrop-blur-xs" />

      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-[#e2e8f0] overflow-hidden z-10 animate-in zoom-in-95 duration-100">
        {/* Search bar */}
        <div className="p-3 border-b border-[#e2e8f0] flex items-center gap-3">
          <Search className="w-5 h-5 text-[#727785]" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a driver name, #DRV ID, IMEI, or command..."
            className="flex-1 text-sm bg-transparent border-none outline-hidden text-[#0b1c30] placeholder-[#727785]"
          />
          <kbd className="text-[10px] bg-[#f8f9ff] text-[#727785] border border-[#e2e8f0] px-1.5 py-0.5 rounded font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-[#f1f5f9] text-xs">
          {/* Quick Screen Navigations if query is empty or matches */}
          {!query && (
            <div className="py-2 px-2 text-[#727785] text-[11px] font-semibold uppercase tracking-wider">
              Navigation Shortcuts
            </div>
          )}
          {(!query || 'fleet monitor'.includes(query.toLowerCase())) && (
            <div
              onClick={() => {
                onNavigateTab('fleet-monitor');
                onClose();
              }}
              className="p-2.5 rounded-lg hover:bg-[#eff4ff] cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-2 text-[#0b1c30] font-medium">
                <Terminal className="w-4 h-4 text-[#0058be]" />
                <span>Jump to Fleet Monitor Core Grid</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#727785] group-hover:text-[#0058be]" />
            </div>
          )}
          {(!query || 'scenario simulator'.includes(query.toLowerCase())) && (
            <div
              onClick={() => {
                onNavigateTab('scenario-simulator');
                onClose();
              }}
              className="p-2.5 rounded-lg hover:bg-[#eff4ff] cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-2 text-[#0b1c30] font-medium">
                <Activity className="w-4 h-4 text-[#0058be]" />
                <span>Open Advanced Scenario Simulator</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#727785] group-hover:text-[#0058be]" />
            </div>
          )}

          {/* Matched Drivers */}
          <div className="py-2 px-2 text-[#727785] text-[11px] font-semibold uppercase tracking-wider">
            Matching Drivers ({filteredDrivers.length})
          </div>
          {filteredDrivers.map((driver) => (
            <div
              key={driver.id}
              onClick={() => {
                onSelectDriver(driver);
                onClose();
              }}
              className="p-2.5 rounded-lg hover:bg-[#f8f9ff] cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${driver.riskCategory === 'High Risk' ? 'bg-[#ba1a1a]' : 'bg-[#00855b]'}`} />
                <div>
                  <div className="font-semibold text-[#0b1c30] flex items-center gap-1.5">
                    <span>{driver.name}</span>
                    <span className="font-mono text-[10px] text-[#565e74]">#{driver.id}</span>
                  </div>
                  <div className="text-[11px] text-[#727785]">
                    {driver.vehicle} · {driver.riskReason}
                  </div>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                driver.riskCategory === 'High Risk' ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#e8f5e9] text-[#006947]'
              }`}>
                Score: {driver.riskScore}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
