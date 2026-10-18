import React from 'react';
import { History, Shield, Lock, Fingerprint, CheckCircle2, User } from 'lucide-react';

export const AuditLogsScreen: React.FC = () => {
  const auditEntries = [
    {
      id: 'AUD-99120',
      timestamp: 'Today 18:44:12 IST',
      actor: 'Elena Vance (Threat Ops Lead)',
      action: 'Emergency Session Freeze',
      target: 'Tariq Al-Mansoor (#DRV-3319)',
      rationale: 'Impossible teleportation velocity (840km/h spoof payload on Delhi NH-48)',
      hash: 'sha256:4a8b...19e4',
    },
    {
      id: 'AUD-99119',
      timestamp: 'Today 18:32:05 IST',
      actor: 'Elena Vance (Threat Ops Lead)',
      action: 'Biometric Liveness Challenge Dispatched',
      target: 'Elena Rostova (#DRV-6621)',
      rationale: 'Touch rhythm variance > 84% on Chennai OMR IT Corridor',
      hash: 'sha256:7c11...9902',
    },
    {
      id: 'AUD-99118',
      timestamp: 'Today 18:14:49 IST',
      actor: 'Automated ML Policy Rule #841',
      action: 'Lineage Alert Flagged',
      target: 'Marcus Vance (#DRV-9042)',
      rationale: 'Unpaired MAC hardware swap in Mumbai BKC Hub',
      hash: 'sha256:0d24...cc81',
    },
    {
      id: 'AUD-99117',
      timestamp: 'Today 17:50:22 IST',
      actor: 'Devon Hayes (Fleet Supervisor)',
      action: 'Hardware Transition Approved',
      target: 'Sophia Chen (#DRV-4112)',
      rationale: 'Pre-declared portal swap validated with Airtel eSIM at Bengaluru Depot',
      hash: 'sha256:fa90...8115',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#727785]">
          COMPLIANCE & GOVERNANCE / IMMUTABLE SOC LOG
        </div>
        <h1 className="text-2xl font-bold text-[#0b1c30] mt-1">Audit Ledger & Chain of Custody</h1>
        <p className="text-xs text-[#565e74] mt-1">
          Cryptographically signed records of operator interventions, remote freezes, and biometric bypass overrides.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#f8f9ff] border-b border-[#e2e8f0] text-[11px] font-semibold uppercase tracking-wider text-[#727785]">
                <th className="py-3 px-4">TIMESTAMP</th>
                <th className="py-3 px-4">OPERATOR / ACTOR</th>
                <th className="py-3 px-4">ACTION TAKEN</th>
                <th className="py-3 px-4">TARGET DRIVER</th>
                <th className="py-3 px-4">RATIONALE</th>
                <th className="py-3 px-4">LEDGER HASH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {auditEntries.map((log) => (
                <tr key={log.id} className="hover:bg-[#f8f9ff] transition-colors">
                  <td className="py-3.5 px-4 font-mono text-[#565e74] whitespace-nowrap">
                    {log.timestamp}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-[#0b1c30]">
                    {log.actor}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#eff4ff] text-[#0058be]">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-[#0b1c30]">
                    {log.target}
                  </td>
                  <td className="py-3.5 px-4 text-[#565e74]">
                    {log.rationale}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[10px] text-[#727785]">
                    {log.hash}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
