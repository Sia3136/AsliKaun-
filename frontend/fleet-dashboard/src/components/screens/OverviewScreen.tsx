import React from 'react';
import { 
  ShieldCheck, 
  AlertOctagon, 
  TrendingUp, 
  Activity, 
  MapPin, 
  Zap, 
  ArrowUpRight,
  Server
} from 'lucide-react';
import { DriverRecord } from '../../types/fleet';

interface OverviewScreenProps {
  onNavigateToFleet: () => void;
  drivers: DriverRecord[];
}

export const OverviewScreen: React.FC<OverviewScreenProps> = ({
  onNavigateToFleet,
  drivers,
}) => {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#727785]">
            EXECUTIVE INTEL / GLOBAL SECURITY OPERATIONS
          </div>
          <h1 className="text-2xl font-bold text-[#0b1c30] mt-1">Fleet Threat Operations Command</h1>
          <p className="text-xs text-[#565e74] mt-1">
            Aggregated situational awareness across 42,890 commercial fleet streams.
          </p>
        </div>
        <button
          onClick={onNavigateToFleet}
          className="px-4 py-2 bg-[#0058be] hover:bg-[#0047a0] text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <span>Open Real-Time Fleet Monitor</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Top Health Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[#565e74]">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Fleet Lineage Integrity</span>
            <ShieldCheck className="w-4 h-4 text-[#006947]" />
          </div>
          <div className="text-2xl font-bold text-[#0b1c30] mt-2 tabular-nums">98.53%</div>
          <p className="text-[11px] text-[#006947] mt-1 font-medium">Within nominal operating envelope</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[#565e74]">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Hourly Anomaly Influx</span>
            <AlertOctagon className="w-4 h-4 text-[#ba1a1a]" />
          </div>
          <div className="text-2xl font-bold text-[#ba1a1a] mt-2 tabular-nums">26 events/hr</div>
          <p className="text-[11px] text-[#565e74] mt-1">-14% lower than morning shift surge</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[#565e74]">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Global Edge Clusters</span>
            <Server className="w-4 h-4 text-[#0058be]" />
          </div>
          <div className="text-2xl font-bold text-[#0b1c30] mt-2 tabular-nums">18 / 18 Online</div>
          <p className="text-[11px] text-[#006947] mt-1 font-medium">Sub-15ms inference latency guaranteed</p>
        </div>
      </div>

      {/* Corridor Map Snapshot & Active Cases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] shadow-2xs">
          <h2 className="text-sm font-bold text-[#0b1c30] mb-3">Regional Risk Heatmap (India Fleet)</h2>
          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between font-medium mb-1">
                <span className="text-[#0b1c30]">Western Industrial Spine (Mumbai - Pune - Ahmedabad)</span>
                <span className="font-bold text-[#ba1a1a]">482 Anomalies</span>
              </div>
              <div className="w-full bg-[#e2e8f0] h-2 rounded-full overflow-hidden">
                <div className="bg-[#ba1a1a] h-full" style={{ width: '68%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-medium mb-1">
                <span className="text-[#0b1c30]">Southern Tech Belt (Bengaluru - Hyderabad - Chennai)</span>
                <span className="font-bold text-[#d97706]">114 Anomalies</span>
              </div>
              <div className="w-full bg-[#e2e8f0] h-2 rounded-full overflow-hidden">
                <div className="bg-[#d97706] h-full" style={{ width: '24%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-medium mb-1">
                <span className="text-[#0b1c30]">Northern Logistics Spine (Delhi NCR - Jaipur - Agra NH-48)</span>
                <span className="font-bold text-[#006947]">36 Anomalies</span>
              </div>
              <div className="w-full bg-[#e2e8f0] h-2 rounded-full overflow-hidden">
                <div className="bg-[#00855b] h-full" style={{ width: '8%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* High Priority Active Cases */}
        <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] shadow-2xs">
          <h2 className="text-sm font-bold text-[#0b1c30] mb-3">Priority Escalation Queue</h2>
          <div className="divide-y divide-[#f1f5f9] text-xs">
            {drivers.filter(d => d.riskCategory === 'High Risk').slice(0, 3).map((driver) => (
              <div key={driver.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-[#0b1c30] flex items-center gap-1.5">
                    <span>{driver.name}</span>
                    <span className="font-mono text-[10px] text-[#565e74]">#{driver.id}</span>
                  </div>
                  <div className="text-[11px] text-[#ba1a1a] font-medium mt-0.5">
                    {driver.riskReason}
                  </div>
                </div>
                <button
                  onClick={onNavigateToFleet}
                  className="px-2.5 py-1 text-xs rounded bg-[#eff4ff] text-[#0058be] font-semibold hover:bg-[#dce9ff] cursor-pointer"
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
