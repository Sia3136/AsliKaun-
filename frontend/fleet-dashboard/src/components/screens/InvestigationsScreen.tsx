import React from 'react';
import { ShieldAlert, Clock, User, ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import { DriverRecord } from '../../types/fleet';

interface InvestigationsScreenProps {
  onInvestigateDriver: (driver: DriverRecord) => void;
  drivers: DriverRecord[];
}

export const InvestigationsScreen: React.FC<InvestigationsScreenProps> = ({
  onInvestigateDriver,
  drivers,
}) => {
  const highRiskDrivers = drivers.filter((d) => d.riskCategory === 'High Risk');

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#727785]">
          INCIDENT MANAGEMENT / SOC TRIAGE QUEUE
        </div>
        <h1 className="text-2xl font-bold text-[#0b1c30] mt-1">Open Triage Cases</h1>
        <p className="text-xs text-[#565e74] mt-1">
          Active driver sessions requiring manual chain-of-custody verification, device attestation, or fleet dispatch intervention.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs divide-y divide-[#e2e8f0]">
        {highRiskDrivers.map((driver) => (
          <div key={driver.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#f8f9ff] transition-colors">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-[#0b1c30]">{driver.name}</span>
                  <span className="font-mono text-xs font-semibold text-[#565e74] bg-[#eff4ff] px-2 py-0.5 rounded">
                    #{driver.id}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#ffdad6] text-[#ba1a1a]">
                    Threat Score: {driver.riskScore}
                  </span>
                </div>
                <p className="text-xs text-[#ba1a1a] font-semibold mt-1">
                  Primary Vector: {driver.riskReason}
                </p>
                <p className="text-[11px] text-[#565e74] mt-0.5">
                  Vehicle: {driver.vehicle} ({driver.plate}) · Hardware: {driver.hardwareTo}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
              {driver.sessionFrozen && (
                <span className="text-xs font-semibold text-[#ba1a1a] flex items-center gap-1 bg-[#ffdad6]/40 px-2.5 py-1 rounded">
                  <Lock className="w-3.5 h-3.5" />
                  Locked Down
                </span>
              )}
              <button
                onClick={() => onInvestigateDriver(driver)}
                className="px-4 py-2 bg-[#0058be] hover:bg-[#0047a0] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>Open Dossier & Telemetry</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
