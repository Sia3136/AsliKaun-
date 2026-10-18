import React from 'react';
import { Smartphone, Check, X, Shield, ArrowRight } from 'lucide-react';
import { DriverRecord } from '../../types/fleet';

interface ReviewQueueScreenProps {
  drivers: DriverRecord[];
  onReviewImei: (driver: DriverRecord) => void;
}

export const ReviewQueueScreen: React.FC<ReviewQueueScreenProps> = ({
  drivers,
  onReviewImei,
}) => {
  const hardwareQueue = drivers.filter(
    (d) => d.lineageType === 'swap' || d.lineageStatusType === 'declared'
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#727785]">
          DEVICE LIFECYCLE / HARDWARE ENROLLMENT
        </div>
        <h1 className="text-2xl font-bold text-[#0b1c30] mt-1">Hardware Review & RMA Queue</h1>
        <p className="text-xs text-[#565e74] mt-1">
          Approve or reject commercial driver mobile swaps, temporary spares, and depot hardware attestations.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs divide-y divide-[#e2e8f0]">
        {hardwareQueue.map((driver) => (
          <div key={driver.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#eff4ff] text-[#0058be] flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-[#0b1c30]">{driver.name}</span>
                  <span className="font-mono text-xs font-semibold text-[#565e74] bg-[#eff4ff] px-2 py-0.5 rounded">
                    #{driver.id}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#0b1c30] mt-1">
                  <span>{driver.hardwareFrom || 'Legacy Terminal'}</span>
                  <span className="text-[#0058be]">→</span>
                  <span className="font-bold text-[#0058be]">{driver.hardwareTo}</span>
                </div>
                <p className="text-[11px] text-[#565e74] mt-0.5">
                  Status: <strong>{driver.lineageStatusText}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onReviewImei(driver)}
                className="px-4 py-2 bg-[#0058be] hover:bg-[#0047a0] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>Inspect Attestation Certificate</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
