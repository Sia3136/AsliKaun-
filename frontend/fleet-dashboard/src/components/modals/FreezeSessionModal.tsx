import React, { useState } from 'react';
import { X, Lock, AlertTriangle, ShieldAlert, Radio } from 'lucide-react';
import { DriverRecord } from '../../types/fleet';

interface FreezeSessionModalProps {
  driver: DriverRecord | null;
  onClose: () => void;
  onConfirmFreeze: (driverId: string) => void;
}

export const FreezeSessionModal: React.FC<FreezeSessionModalProps> = ({
  driver,
  onClose,
  onConfirmFreeze,
}) => {
  const [reason, setReason] = useState('Impossible Teleportation Velocity / GPS Spoofing');

  if (!driver) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="fixed inset-0 bg-[#0b1c30]/60 backdrop-blur-xs" />

      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-[#ffdad6] overflow-hidden z-10 animate-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-[#ffdad6]/40 border-b border-[#ffdad6] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#ba1a1a]">
            <Lock className="w-5 h-5" />
            <h3 className="font-bold text-base">Emergency Fleet Session Freeze</h3>
          </div>
          <button onClick={onClose} className="p-1 text-[#727785] hover:text-[#0b1c30] rounded cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div className="flex items-start gap-3 p-3 bg-[#ffdad6]/20 border border-[#ffdad6] rounded-lg text-[#ba1a1a]">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">CRITICAL CONTAINMENT ACTION</p>
              <p className="text-[11px] text-[#424754] mt-0.5">
                Executing a Freeze immediately revokes MDT authentication tokens, cuts CANBus command dispatch, and alerts the regional dispatch supervisor.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-[#727785] uppercase">Target Entity</span>
            <div className="p-2.5 bg-[#f8f9ff] border border-[#e2e8f0] rounded-md font-medium text-[#0b1c30]">
              {driver.name} (#{driver.id}) · {driver.vehicle} ({driver.plate})
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[#727785] uppercase block">
              Containment Justification
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2 border border-[#e2e8f0] rounded-md bg-white text-xs text-[#0b1c30] focus:border-[#ba1a1a]"
            >
              <option>Impossible Teleportation Velocity / GPS Spoofing</option>
              <option>Unpaired Hardware Lineage & Unknown MAC Address</option>
              <option>Biometric Liveness Verification Timeout</option>
              <option>Suspected Commercial Driver Account Sharing / Handoff</option>
            </select>
          </div>
        </div>

        <div className="px-6 py-3 bg-[#f8f9ff] border-t border-[#e2e8f0] flex items-center justify-end gap-2 text-xs">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[#e2e8f0] rounded-md text-[#565e74] hover:text-[#0b1c30] hover:bg-white font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirmFreeze(driver.id);
              onClose();
            }}
            className="px-4 py-2 bg-[#ba1a1a] hover:bg-[#93000a] text-white font-bold rounded-md flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Lock className="w-3.5 h-3.5" />
            Confirm Lockdown
          </button>
        </div>
      </div>
    </div>
  );
};
