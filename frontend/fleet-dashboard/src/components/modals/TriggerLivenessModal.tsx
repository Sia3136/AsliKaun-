import React, { useState, useEffect } from 'react';
import { X, Fingerprint, Eye, ShieldCheck, CheckCircle2, RefreshCw } from 'lucide-react';
import { DriverRecord } from '../../types/fleet';

interface TriggerLivenessModalProps {
  driver: DriverRecord | null;
  onClose: () => void;
  onSuccess: (driverId: string) => void;
}

export const TriggerLivenessModal: React.FC<TriggerLivenessModalProps> = ({
  driver,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<'prompting' | 'scanning' | 'passed'>('prompting');
  const [progress, setProgress] = useState(0);

  if (!driver) return null;

  const handleStartScan = () => {
    setStep('scanning');
    setProgress(15);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setStep('passed');
          setTimeout(() => {
            onSuccess(driver.id);
          }, 1200);
          return 100;
        }
        return prev + 25;
      });
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="fixed inset-0 bg-[#0b1c30]/50 backdrop-blur-xs" />

      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-[#e2e8f0] overflow-hidden z-10">
        <div className="px-6 py-4 bg-[#f8f9ff] border-b border-[#e2e8f0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-[#0058be]" />
            <h3 className="font-bold text-[#0b1c30] text-base">Biometric Liveness Gate</h3>
          </div>
          <button onClick={onClose} className="p-1 text-[#727785] hover:text-[#0b1c30] rounded cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 text-center space-y-4">
          {step === 'prompting' && (
            <>
              <div className="w-20 h-20 mx-auto rounded-full bg-[#eff4ff] text-[#0058be] flex items-center justify-center border-4 border-[#d3e4fe]">
                <Fingerprint className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#0b1c30]">
                  Dispatch Interactive Challenge to In-Cab MDT
                </h4>
                <p className="text-xs text-[#565e74] mt-1 max-w-xs mx-auto">
                  Target device for <strong>{driver.name}</strong> will present a high-frequency 3D face mesh scan and randomized blink challenge.
                </p>
              </div>
              <div className="bg-[#f8f9ff] p-3 rounded-lg border border-[#e2e8f0] text-left text-xs space-y-1">
                <div className="flex justify-between text-[#565e74]">
                  <span>Driver Target:</span>
                  <span className="font-semibold text-[#0b1c30]">{driver.name} (#{driver.id})</span>
                </div>
                <div className="flex justify-between text-[#565e74]">
                  <span>Channel:</span>
                  <span className="font-mono text-[#0058be]">FCM Push + Bluetooth Beacon</span>
                </div>
                <div className="flex justify-between text-[#565e74]">
                  <span>Timeout Window:</span>
                  <span className="font-semibold text-[#ba1a1a]">45 seconds before lockout</span>
                </div>
              </div>
              <button
                onClick={handleStartScan}
                className="w-full py-2.5 px-4 bg-[#0058be] hover:bg-[#0047a0] text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-colors"
              >
                Send Biometric Challenge Now
              </button>
            </>
          )}

          {step === 'scanning' && (
            <div className="py-6 space-y-4">
              <div className="relative w-24 h-24 mx-auto rounded-full border-4 border-[#0058be] border-t-transparent animate-spin flex items-center justify-center">
                <Eye className="w-8 h-8 text-[#0058be] animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#0b1c30]">Driver Responding to Challenge</h4>
                <p className="text-xs text-[#565e74] mt-1">Analyzing 3D depth map, iris reflections, and blood flow pulsation...</p>
              </div>
              <div className="w-full bg-[#e2e8f0] h-2 rounded-full overflow-hidden">
                <div className="bg-[#0058be] h-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {step === 'passed' && (
            <div className="py-6 space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#e8f5e9] text-[#006947] flex items-center justify-center border-4 border-[#a7f3d0]">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-[#006947]">Liveness Verified & Authenticated</h4>
              <p className="text-xs text-[#565e74] max-w-xs mx-auto">
                Driver identity confirmed with 99.94% confidence. Risk score calibrated downwards.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
