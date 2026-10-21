import React, { useState } from 'react';
import { 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  ArrowRight, 
  Clock, 
  Cpu, 
  Lock, 
  Smartphone, 
  Fingerprint, 
  FileCheck,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { DriverRecord } from '../../types/fleet';

export interface ReviewItem {
  review_id: number;
  session_id: number;
  driver_id: string;
  decision: string;
  status: 'open' | 'resolved';
  created_at: string;
  resolved_at?: string | null;
  resolution?: string | null;
  reviewer_id?: string | null;
  reviewer_note?: string | null;
  context_score?: number | null;
  behavior_score?: number | null;
  context_axis?: string;
  behavior_axis?: string;
  quadrant?: string;
  reasons: string[];
  safe_pause_info?: { is_moving?: boolean; speed_mph?: number | null; safe_pause_scheduled?: boolean; scheduled_state?: string };
}

interface ReviewQueueScreenProps {
  drivers: DriverRecord[];
  reviewItems: ReviewItem[];
  onReviewImei: (driver: DriverRecord) => void;
  onResolveReview: (sessionId: number, resolution: 'cleared' | 'confirmed_handoff' | 'needs_follow_up', note?: string) => Promise<void>;
  onRefresh?: () => void;
}

export const ReviewQueueScreen: React.FC<ReviewQueueScreenProps> = ({
  drivers,
  reviewItems,
  onReviewImei,
  onResolveReview,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'open' | 'resolved' | 'hardware'>('open');
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState<{ [key: number]: string }>({});

  // Sort reviews ordered by risk: challenge_at_safe_pause first, then step_up_check, then date
  const openReviews = [...reviewItems]
    .filter((r) => r.status === 'open')
    .sort((a, b) => {
      const riskOrder = (d: string) => (d.includes('challenge') ? 1 : d.includes('step_up') ? 2 : 3);
      if (riskOrder(a.decision) !== riskOrder(b.decision)) {
        return riskOrder(a.decision) - riskOrder(b.decision);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const resolvedReviews = reviewItems.filter((r) => r.status === 'resolved');

  const hardwareQueue = drivers.filter(
    (d) => d.lineageType === 'swap' || d.lineageStatusType === 'declared'
  );

  const handleAction = async (
    sessionId: number,
    resolution: 'cleared' | 'confirmed_handoff' | 'needs_follow_up'
  ) => {
    setResolvingId(sessionId);
    setActionError(null);
    try {
      const note = resolutionNote[sessionId] || `Resolved via Operations Console as ${resolution}`;
      await onResolveReview(sessionId, resolution, note);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to save review resolution.');
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#727785]">
            AUDIT & ESCALATION / HUMAN-IN-THE-LOOP (HITL)
          </div>
          <h1 className="text-2xl font-bold text-[#0b1c30] mt-1">Review & Safety Pause Queue</h1>
          <p className="text-xs text-[#565e74] mt-1">
            Cases ordered by risk from GET /v1/review-queue. Inspect telemetry evidence, two-axis continuous verification scores, and record audit resolution.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-[#f8f9ff] p-1 rounded-lg border border-[#e2e8f0]">
          <button
            onClick={() => setActiveTab('open')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'open' ? 'bg-[#0058be] text-white shadow-2xs' : 'text-[#565e74] hover:text-[#0b1c30]'
            }`}
          >
            <span>Open Cases</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'open' ? 'bg-white/20 text-white' : 'bg-[#e2e8f0] text-[#0b1c30]'
            }`}>
              {openReviews.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('resolved')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'resolved' ? 'bg-[#0058be] text-white shadow-2xs' : 'text-[#565e74] hover:text-[#0b1c30]'
            }`}
          >
            <span>Resolved History</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#e2e8f0] text-[#0b1c30] font-bold">
              {resolvedReviews.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('hardware')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'hardware' ? 'bg-[#0058be] text-white shadow-2xs' : 'text-[#565e74] hover:text-[#0b1c30]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Hardware Swaps ({hardwareQueue.length})</span>
          </button>
        </div>
      </div>

      {/* Main Review Cases View */}
      {activeTab === 'open' && (
        <div className="space-y-4">
          {actionError && <div role="alert" className="p-3 rounded-lg bg-[#ffdad6] text-[#ba1a1a] text-xs">{actionError}</div>}
          {openReviews.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-12 text-center shadow-2xs">
              <CheckCircle2 className="w-10 h-10 text-[#006947] mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#0b1c30]">Review Queue is Clear</h3>
              <p className="text-xs text-[#565e74] mt-1 max-w-md mx-auto">
                No active safety-pause challenges pending operator review. New escalations from the two-axis fusion engine will automatically appear here.
              </p>
            </div>
          ) : (
            openReviews.map((item, idx) => {
              const isHandoff = item.decision.includes('challenge');
              const ctxScore = item.context_score;
              const behScore = item.behavior_score;
              const isResolving = resolvingId === item.session_id;

              return (
                <div
                  key={item.session_id}
                  className="bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-2xs space-y-4"
                >
                  {/* Top Bar: Driver ID, Risk Priority Badge, Timestamp */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#f1f5f9] pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isHandoff ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#fef3c7] text-[#b45309]'
                      }`}>
                        Priority #{idx + 1} · {isHandoff ? 'CRITICAL RISK / CHALLENGE' : 'STEP-UP CHECK'}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#0b1c30]">
                        Driver #{item.driver_id}
                      </span>
                      <span className="text-[#727785]">·</span>
                      <span className="font-mono text-xs text-[#565e74]">
                        Session #{item.session_id}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[#727785]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(item.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Evidence Grid: Scores, Quadrant, Decision */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
                      <span className="text-[10px] font-bold uppercase text-[#727785] block">CONTEXT CONTINUITY</span>
                      <div className="text-xl font-bold text-[#0b1c30] mt-0.5 tabular-nums">
                        {ctxScore == null ? 'N/A' : `${(ctxScore * 100).toFixed(0)}%`}
                      </div>
                      <span className="text-[10px] font-medium text-[#565e74]">
                        {ctxScore == null ? 'No score recorded' : ctxScore >= 0.6 ? 'Stable hardware lineage' : 'Altered device / zone'}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
                      <span className="text-[10px] font-bold uppercase text-[#727785] block">BEHAVIORAL CONTINUITY</span>
                      <div className={`text-xl font-bold mt-0.5 tabular-nums ${
                        behScore == null || behScore < 0.6 ? 'text-[#ba1a1a]' : 'text-[#006947]'
                      }`}>
                        {behScore == null ? 'N/A' : `${(behScore * 100).toFixed(0)}%`}
                      </div>
                      <span className="text-[10px] font-medium text-[#ba1a1a]">
                        {behScore == null ? 'No score recorded' : behScore < 0.6 ? 'Behavior changed' : 'Behavior stable'}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
                      <span className="text-[10px] font-bold uppercase text-[#727785] block">DECISION QUADRANT</span>
                      <div className="text-sm font-bold text-[#0058be] mt-1 font-mono uppercase">
                        {item.quadrant || 'unknown'}
                      </div>
                      <span className="text-[10px] text-[#565e74]">Two-Axis classification</span>
                    </div>

                    <div className="p-3 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
                      <span className="text-[10px] font-bold uppercase text-[#727785] block">SAFETY TIMING GATE</span>
                      <div className="text-xs font-bold text-[#006947] mt-1 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" />
                        <span>{item.safe_pause_info?.safe_pause_scheduled ? 'Challenge queued until stop' : item.safe_pause_info?.scheduled_state === 'safe_stop_confirmed' ? 'Safe stop confirmed' : 'Safe pause state unknown'}</span>
                      </div>
                      <span className="text-[10px] text-[#565e74]">{item.safe_pause_info?.speed_mph == null ? 'No speed telemetry recorded' : `Observed speed ${item.safe_pause_info.speed_mph} mph`}</span>
                    </div>
                  </div>

                  {/* Reason Vector & Evidence List */}
                  <div className="bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg p-3 text-xs space-y-1.5">
                    <span className="font-bold text-[#0b1c30] block text-[11px] uppercase tracking-wider">
                      Explainable Reason Vector & Incongruity Evidence:
                    </span>
                    <ul className="space-y-1 text-[#424754]">
                      {item.reasons.map((r, rIdx) => (
                        <li key={rIdx} className="flex items-start gap-2">
                          <span className="text-[#ba1a1a] font-bold">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Resolution Input & Actions */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <input
                      type="text"
                      placeholder="Add reviewer audit note (optional)..."
                      value={resolutionNote[item.session_id] || ''}
                      onChange={(e) =>
                        setResolutionNote({ ...resolutionNote, [item.session_id]: e.target.value })
                      }
                      className="px-3 py-2 bg-white rounded-lg border border-[#e2e8f0] text-xs flex-1 max-w-md focus:outline-none focus:border-[#0058be]"
                    />

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleAction(item.session_id, 'cleared')}
                        disabled={isResolving}
                        className="px-3 py-2 rounded-lg bg-[#e8f5e9] hover:bg-[#c8e6c9] text-[#006947] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Clear (Verified)</span>
                      </button>

                      <button
                        onClick={() => handleAction(item.session_id, 'needs_follow_up')}
                        disabled={isResolving}
                        className="px-3 py-2 rounded-lg bg-[#fef3c7] hover:bg-[#fde68a] text-[#b45309] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Step-Up Challenge</span>
                      </button>

                      <button
                        onClick={() => handleAction(item.session_id, 'confirmed_handoff')}
                        disabled={isResolving}
                        className="px-3 py-2 rounded-lg bg-[#ba1a1a] hover:bg-[#93000a] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Confirm Handoff (Lock)</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Resolved History */}
      {activeTab === 'resolved' && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs divide-y divide-[#e2e8f0]">
          {resolvedReviews.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#565e74]">
              No resolved cases yet. Completed investigations are audited here.
            </div>
          ) : (
            resolvedReviews.map((r) => (
              <div key={r.session_id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#0b1c30]">Driver #{r.driver_id}</span>
                    <span className="font-mono text-[#565e74]">Session #{r.session_id}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.resolution === 'confirmed_handoff' ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#e8f5e9] text-[#006947]'
                    }`}>
                      {r.resolution?.toUpperCase() || 'RESOLVED'}
                    </span>
                  </div>
                  <p className="text-[#565e74] mt-1">
                    Auditor: <strong>{r.reviewer_id || 'admin@aslikaun.ai'}</strong> · {r.reviewer_note || 'Resolved via console'}
                  </p>
                </div>
                <div className="text-[11px] text-[#727785]">
                  Resolved at {r.resolved_at ? new Date(r.resolved_at).toLocaleString() : 'Recently'}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Hardware Swaps */}
      {activeTab === 'hardware' && (
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

              <button
                onClick={() => onReviewImei(driver)}
                className="px-4 py-2 bg-[#0058be] hover:bg-[#0047a0] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs self-start md:self-auto"
              >
                <span>Inspect Attestation Certificate</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
