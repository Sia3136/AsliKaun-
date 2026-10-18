import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, Shield, Smartphone, KeyRound, Check } from 'lucide-react';
import { DriverRecord } from '../../types/fleet';

interface ReviewImeiModalProps {
  driver: DriverRecord | null;
  onClose: () => void;
  onApprove: (driverId: string) => void;
}

export const ReviewImeiModal: React.FC<ReviewImeiModalProps> = ({
  driver,
  onClose,
  onApprove,
}) => {
  const [approved, setApproved] = useState(false);

  if (!driver) return null;

  const handleApprove = () => {
    setApproved(true);
    setTimeout(() => {
      onApprove(driver.id);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-[#0b1c30]/50 backdrop-blur-xs" />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-[#e2e8f0] overflow-hidden z-10 animate-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-[#f8f9ff] border-b border-[#e2e8f0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-[#0058be]" />
            <h3 className="font-bold text-[#0b1c30] text-base">Review Hardware Swap & IMEI Lineage</h3>
          </div>
          <button onClick={onClose} className="p-1 text-[#727785] hover:text-[#0b1c30] rounded cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div className="p-3 bg-[#eff4ff] border border-[#d3e4fe] rounded-lg">
            <p className="font-semibold text-[#0058be]">
              Driver: {driver.name} (#{driver.id})
            </p>
            <p className="text-[#565e74] mt-0.5">
              Assigned Vehicle: {driver.vehicle} ({driver.plate})
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border border-[#e2e8f0] rounded-lg bg-[#f8f9ff]">
              <span className="text-[10px] font-bold text-[#727785] uppercase">Previous Enrolled Hardware</span>
              <p className="font-mono font-bold text-[#0b1c30] mt-1">{driver.hardwareFrom || 'Legacy Terminal'}</p>
              <p className="text-[11px] text-[#727785]">Revoked token: TK-9941-8A</p>
            </div>
            <div className="p-3 border border-[#0058be]/30 rounded-lg bg-[#eff4ff]/40">
              <span className="text-[10px] font-bold text-[#0058be] uppercase">New Declared Hardware</span>
              <p className="font-mono font-bold text-[#0058be] mt-1">{driver.hardwareTo}</p>
              <p className="text-[11px] text-[#0058be]">Attestation: Android StrongBox</p>
            </div>
          </div>

          <div className="space-y-2 border-t border-[#f1f5f9] pt-3">
            <h4 className="font-semibold text-[#0b1c30]">Security Verification Checklist</h4>
            <div className="space-y-1.5 text-[#565e74]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#006947] shrink-0" />
                <span>Pre-declared ticket matched via Employee Self-Service Portal</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#006947] shrink-0" />
                <span>Carrier SIM IMSI binds to Jio / Airtel Enterprise fleet pool</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#006947] shrink-0" />
                <span>Zero blacklist hits on GSMA IMEI stolen terminal database</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-[#f8f9ff] border-t border-[#e2e8f0] flex items-center justify-end gap-2 text-xs">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[#e2e8f0] rounded-md text-[#565e74] hover:text-[#0b1c30] hover:bg-white cursor-pointer font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleApprove}
            disabled={approved}
            className="px-4 py-2 bg-[#0058be] hover:bg-[#0047a0] text-white rounded-md font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-80 shadow-xs"
          >
            {approved ? (
              <>
                <Check className="w-4 h-4" />
                Lineage Approved & Whitelisted
              </>
            ) : (
              'Approve Hardware Transition'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
