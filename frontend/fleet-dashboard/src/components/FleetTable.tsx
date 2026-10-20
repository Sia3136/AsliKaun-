import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Clock, 
  ArrowRight, 
  ArrowLeftRight, 
  AlertTriangle, 
  Check, 
  ShieldAlert, 
  Eye, 
  PauseCircle, 
  Fingerprint, 
  MoreVertical, 
  ExternalLink, 
  Radio, 
  Activity,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { DriverRecord, FilterCategory } from '../types/fleet';
import { DriverAvatar } from './DriverAvatar';

interface FleetTableProps {
  drivers: DriverRecord[];
  onInvestigate: (driver: DriverRecord) => void;
  onReviewImei: (driver: DriverRecord) => void;
  onFreezeSession: (driver: DriverRecord) => void;
  onTriggerLiveness: (driver: DriverRecord) => void;
  onOpenTelemetry: (driver: DriverRecord) => void;
  activeFilter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
  syncRateEvents: number;
}

export const FleetTable: React.FC<FleetTableProps> = ({
  drivers,
  onInvestigate,
  onReviewImei,
  onFreezeSession,
  onTriggerLiveness,
  onOpenTelemetry,
  activeFilter,
  onFilterChange,
  syncRateEvents,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const filteredDrivers = useMemo(() => {
    let result = drivers;

    // Filter category
    if (activeFilter === 'high-risk') {
      result = result.filter((d) => d.riskCategory === 'High Risk');
    } else if (activeFilter === 'new-devices') {
      result = result.filter(
        (d) =>
          d.lineageType === 'swap' ||
          d.riskReason.toLowerCase().includes('hardware') ||
          d.lineageStatusType === 'declared'
      );
    } else if (activeFilter === 'pending-liveness') {
      result = result.filter(
        (d) => d.recommendedAction === 'Trigger Liveness' || d.livenessPending
      );
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.id.toLowerCase().includes(q) ||
          d.vehicle.toLowerCase().includes(q) ||
          d.plate.toLowerCase().includes(q) ||
          d.imei.toLowerCase().includes(q) ||
          d.riskReason.toLowerCase().includes(q) ||
          d.hardwareTo.toLowerCase().includes(q)
      );
    }

    return result;
  }, [drivers, activeFilter, searchQuery]);

  // Paginated records
  const totalPages = Math.ceil(filteredDrivers.length / pageSize) || 1;
  const paginatedDrivers = filteredDrivers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-[#006947]';
    if (score >= 50) return 'text-[#b45309]';
    return 'text-[#ba1a1a]';
  };

  const getScoreBarBg = (score: number) => {
    if (score >= 80) return 'bg-[#00855b]';
    if (score >= 50) return 'bg-[#d97706]';
    return 'bg-[#ba1a1a]';
  };

  const getBadgeStyle = (label: string) => {
    switch (label) {
      case 'PRISTINE':
      case 'OPTIMAL':
        return 'text-[#006947] bg-[#e8f5e9]';
      case 'STABLE':
      case 'NORMAL':
        return 'text-[#1e3a8a] bg-[#eff4ff]';
      case 'MODERATE':
        return 'text-[#b45309] bg-[#fef3c7]';
      case 'LOW BASELINE':
      case 'UNSTABLE':
        return 'text-[#92400e] bg-[#fee2e2]';
      case 'CRITICAL':
      case 'IMPOSSIBLE':
        return 'text-[#ba1a1a] bg-[#ffdad6]';
      default:
        return 'text-[#424754] bg-[#f1f5f9]';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-2xs overflow-hidden mb-6">
      {/* Top Search & Filter Bar */}
      <div className="p-4 border-b border-[#e2e8f0] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-xl">
          <Search className="w-4 h-4 text-[#727785] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search driver ID, name, license plate, IMEI, or triage flag..."
            className="w-full pl-9 pr-4 py-2 bg-white text-xs text-[#0b1c30] placeholder-[#727785] border border-[#e2e8f0] rounded-lg focus:outline-hidden focus:border-[#0058be] focus:ring-2 focus:ring-[#0058be]/15 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#727785] hover:text-[#0b1c30]"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Segmented Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => {
              onFilterChange('all');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-[#0058be] text-white font-semibold shadow-xs'
                : 'bg-[#f8f9ff] text-[#565e74] hover:text-[#0b1c30] border border-[#e2e8f0]'
            }`}
          >
            All Monitored <span className="opacity-80">({drivers.length})</span>
          </button>
          <button
            onClick={() => {
              onFilterChange('high-risk');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors cursor-pointer ${
              activeFilter === 'high-risk'
                ? 'bg-[#ba1a1a] text-white font-semibold shadow-xs'
                : 'bg-[#f8f9ff] text-[#ba1a1a] hover:bg-[#ffdad6]/40 border border-[#e2e8f0]'
            }`}
          >
            High Risk <span className="font-bold">({drivers.filter(d => d.riskCategory === 'High Risk').length})</span>
          </button>
          <button
            onClick={() => {
              onFilterChange('new-devices');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors cursor-pointer ${
              activeFilter === 'new-devices'
                ? 'bg-[#0058be] text-white font-semibold shadow-xs'
                : 'bg-[#f8f9ff] text-[#565e74] hover:text-[#0b1c30] border border-[#e2e8f0]'
            }`}
          >
            New Devices <span className="opacity-80">({drivers.filter(d => d.lineageType === 'swap' || d.lineageStatusType === 'declared').length})</span>
          </button>
          <button
            onClick={() => {
              onFilterChange('pending-liveness');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors cursor-pointer ${
              activeFilter === 'pending-liveness'
                ? 'bg-[#0058be] text-white font-semibold shadow-xs'
                : 'bg-[#f8f9ff] text-[#565e74] hover:text-[#0b1c30] border border-[#e2e8f0]'
            }`}
          >
            Pending Liveness <span className="opacity-80">({drivers.filter(d => d.livenessPending || d.recommendedAction === 'Trigger Liveness').length})</span>
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#f8f9ff] border-b border-[#e2e8f0] text-[11px] font-semibold uppercase tracking-wider text-[#727785]">
              <th className="py-3 px-4 min-w-[200px]">DRIVER & VEHICLE</th>
              <th className="py-3 px-4 min-w-[120px]">SHIFT & DUTY</th>
              <th className="py-3 px-4 min-w-[220px]">TELEMETRY & HARDWARE LINEAGE</th>
              <th className="py-3 px-4 min-w-[150px]">CONTEXT CONTINUITY</th>
              <th className="py-3 px-4 min-w-[150px]">BEHAVIORAL CONTINUITY</th>
              <th className="py-3 px-4 min-w-[180px]">RISK CLASSIFICATION</th>
              <th className="py-3 px-4 text-right min-w-[150px]">QUICK ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0] text-xs">
            {paginatedDrivers.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[#727785]">
                  <p className="text-sm font-medium">No drivers found matching your filter</p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      onFilterChange('all');
                    }}
                    className="mt-2 text-xs text-[#0058be] font-semibold hover:underline"
                  >
                    Reset all filters
                  </button>
                </td>
              </tr>
            ) : (
              paginatedDrivers.map((driver) => {
                const statusDotColor =
                  driver.riskCategory === 'High Risk'
                    ? 'red'
                    : driver.riskCategory === 'Medium Risk'
                    ? 'amber'
                    : 'green';

                return (
                  <tr
                    key={driver.id}
                    className="hover:bg-[#f8f9ff] transition-colors group cursor-pointer"
                    onClick={() => onInvestigate(driver)}
                  >
                    {/* DRIVER & VEHICLE */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <DriverAvatar
                          id={driver.id}
                          name={driver.name}
                          statusDot={statusDotColor}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#0b1c30] truncate hover:text-[#0058be]">
                              {driver.name}
                            </span>
                            <span className="text-[10px] font-semibold font-mono text-[#565e74] bg-[#eff4ff] border border-[#d3e4fe] px-1.5 py-0.2 rounded shrink-0">
                              #{driver.id}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#565e74] truncate mt-0.5">
                            <span>{driver.vehicle}</span> · <span className="font-mono">{driver.plate}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* SHIFT & DUTY */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div>
                          {driver.shiftStatus === 'Active Trip' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#eff4ff] text-[#0058be]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#0058be]" />
                              Active Trip
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#f1f5f9] text-[#424754]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#727785]" />
                              {driver.shiftStatus}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-[#727785]">
                          <Clock className="w-3 h-3 text-[#727785]" />
                          <span>{driver.shiftDuration}</span>
                        </div>
                      </div>
                    </td>

                    {/* TELEMETRY & HARDWARE LINEAGE */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0b1c30]">
                          {driver.hardwareFrom && (
                            <>
                              <span className="font-mono">{driver.hardwareFrom}</span>
                              {driver.lineageType === 'bidirectional' ? (
                                <ArrowLeftRight className="w-3 h-3 text-[#565e74] shrink-0" />
                              ) : (
                                <ArrowRight className="w-3.5 h-3.5 text-[#ba1a1a] shrink-0" />
                              )}
                            </>
                          )}
                          <span className={driver.lineageType === 'swap' ? 'text-[#ba1a1a] font-mono' : 'font-mono'}>
                            {driver.hardwareTo}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px]">
                          {driver.lineageStatusType === 'critical' ? (
                            <span className="inline-flex items-center gap-1 text-[#ba1a1a] font-medium">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>{driver.lineageStatusText}</span>
                            </span>
                          ) : driver.lineageStatusType === 'declared' ? (
                            <span className="inline-flex items-center gap-1 text-[#565e74] font-medium">
                              <Check className="w-3 h-3 text-[#006947] shrink-0" />
                              <span>{driver.lineageStatusText}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[#006947] font-medium">
                              <CheckCircle2 className="w-3 h-3 text-[#006947] shrink-0" />
                              <span>{driver.lineageStatusText}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* CONTEXT CONTINUITY */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold tabular-nums ${getScoreColor(driver.contextScore)}`}>
                            {driver.contextScore} / 100
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${getBadgeStyle(
                              driver.contextLabel
                            )}`}
                          >
                            {driver.contextLabel}
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-[#e2e8f0] h-1 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getScoreBarBg(driver.contextScore)}`}
                            style={{ width: `${driver.contextScore}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-[#565e74] truncate">
                          {driver.contextDetail}
                        </p>
                      </div>
                    </td>

                    {/* BEHAVIORAL CONTINUITY */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold tabular-nums ${getScoreColor(driver.behavioralScore)}`}>
                            {driver.behavioralScore} / 100
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${getBadgeStyle(
                              driver.behavioralLabel
                            )}`}
                          >
                            {driver.behavioralLabel}
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-[#e2e8f0] h-1 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getScoreBarBg(driver.behavioralScore)}`}
                            style={{ width: `${driver.behavioralScore}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-[#565e74] truncate">
                          {driver.behavioralDetail}
                        </p>
                        {Object.keys(driver.signalScores || {}).length > 0 && <p className="text-[10px] text-[#565e74] truncate" title={Object.entries(driver.signalScores || {}).map(([k,v]) => `${k}: ${driver.signalMetric === 'p_value' ? 'p=' : 'score='}${v.toFixed(3)}`).join(' · ')}>
                          {Object.entries(driver.signalScores || {}).map(([k,v]) => `${k} ${driver.signalMetric === 'p_value' ? 'p' : 'score'}=${v.toFixed(2)}`).join(' · ')}
                        </p>}
                        {driver.adaptiveThreshold && <p className="text-[10px] text-[#0058be]" title={driver.adaptiveThreshold.note}>Threshold {driver.adaptiveThreshold.threshold?.toFixed(3)} · {driver.adaptiveThreshold.source}</p>}
                      </div>
                    </td>

                    {/* RISK CLASSIFICATION */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div>
                          {driver.riskCategory === 'High Risk' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#ffdad6] text-[#ba1a1a]">
                              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                              High Risk · {driver.riskScore}
                            </span>
                          ) : driver.riskCategory === 'Medium Risk' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#eff4ff] text-[#0058be]">
                              Medium Risk · {driver.riskScore}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#e8f5e9] text-[#006947]">
                              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                              Trusted · 0{driver.riskScore}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#565e74] font-medium leading-tight">
                          {driver.riskReason}
                        </div>
                      </div>
                    </td>

                    {/* QUICK ACTION */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {driver.recommendedAction === 'Investigate' && (
                          <>
                            <button
                              onClick={() => onInvestigate(driver)}
                              className="px-3 py-1.5 rounded-md bg-[#eff4ff] hover:bg-[#dce9ff] text-[#0058be] font-semibold text-xs flex items-center gap-1.5 border border-[#d3e4fe] transition-colors cursor-pointer"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Investigate
                            </button>
                            <button
                              onClick={() => onInvestigate(driver)}
                              className="p-1.5 text-[#727785] hover:text-[#0b1c30] hover:bg-[#f1f5f9] rounded transition-colors"
                              title="Expand details"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {driver.recommendedAction === 'Review IMEI' && (
                          <>
                            <button
                              onClick={() => onReviewImei(driver)}
                              className="px-3 py-1.5 rounded-md bg-[#eff4ff] hover:bg-[#dce9ff] text-[#0058be] font-semibold text-xs flex items-center gap-1.5 border border-[#d3e4fe] transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Review IMEI
                            </button>
                            <button
                              onClick={() => onInvestigate(driver)}
                              className="p-1.5 text-[#727785] hover:text-[#0b1c30] hover:bg-[#f1f5f9] rounded transition-colors"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {driver.recommendedAction === 'Telemetry' && (
                          <>
                            <button
                              onClick={() => onOpenTelemetry(driver)}
                              className="px-3 py-1.5 rounded-md bg-[#eff4ff] hover:bg-[#dce9ff] text-[#0058be] font-semibold text-xs flex items-center gap-1.5 border border-[#d3e4fe] transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Telemetry
                            </button>
                            <button
                              onClick={() => onInvestigate(driver)}
                              className="p-1.5 text-[#727785] hover:text-[#0b1c30] hover:bg-[#f1f5f9] rounded transition-colors"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {driver.recommendedAction === 'Freeze Session' && (
                          <>
                            <button
                              onClick={() => onFreezeSession(driver)}
                              className={`px-3 py-1.5 rounded-md font-semibold text-xs flex items-center gap-1.5 border transition-colors cursor-pointer ${
                                driver.sessionFrozen
                                  ? 'bg-[#ba1a1a] text-white border-[#ba1a1a]'
                                  : 'bg-[#eff4ff] hover:bg-[#fee2e2] text-[#0058be] hover:text-[#ba1a1a] border-[#d3e4fe]'
                              }`}
                            >
                              {driver.sessionFrozen ? (
                                <>
                                  <Lock className="w-3.5 h-3.5" />
                                  Session Frozen
                                </>
                              ) : (
                                <>
                                  <PauseCircle className="w-3.5 h-3.5" />
                                  Freeze Session
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => onInvestigate(driver)}
                              className="p-1.5 text-[#727785] hover:text-[#0b1c30] hover:bg-[#f1f5f9] rounded transition-colors"
                            >
                              <Radio className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {driver.recommendedAction === 'Trigger Liveness' && (
                          <>
                            <button
                              onClick={() => onTriggerLiveness(driver)}
                              className="px-3 py-1.5 rounded-md bg-[#0058be] hover:bg-[#0047a0] text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                            >
                              <Fingerprint className="w-3.5 h-3.5" />
                              Trigger Liveness
                            </button>
                            <button
                              onClick={() => onInvestigate(driver)}
                              className="p-1.5 text-[#727785] hover:text-[#0b1c30] hover:bg-[#f1f5f9] rounded transition-colors"
                            >
                              <Activity className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer with Sync Rate and Pagination */}
      <div className="px-4 py-3 border-t border-[#e2e8f0] bg-[#ffffff] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#565e74]">
        <div className="flex items-center gap-2">
          <span>
            Showing <strong className="font-semibold text-[#0b1c30]">{filteredDrivers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredDrivers.length)}</strong> of{' '}
            <strong className="font-semibold text-[#0b1c30]">{filteredDrivers.length}</strong> drivers
          </span>
          <span className="text-[#c2c6d6]">·</span>
          <span>
            Telemetry sync rate:{' '}
            <strong className="font-mono text-[#006947] font-semibold">
              {syncRateEvents.toLocaleString()} events/sec
            </strong>
          </span>
        </div>

        {/* Pagination */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded hover:bg-[#f8f9ff] text-[#565e74] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentPage(1)}
            className={`w-7 h-7 rounded text-xs font-semibold cursor-pointer ${
              currentPage === 1
                ? 'bg-[#0058be] text-white'
                : 'text-[#565e74] hover:bg-[#f8f9ff]'
            }`}
          >
            1
          </button>
          <button
            onClick={() => setCurrentPage(2)}
            className={`w-7 h-7 rounded text-xs font-semibold cursor-pointer ${
              currentPage === 2
                ? 'bg-[#0058be] text-white'
                : 'text-[#565e74] hover:bg-[#f8f9ff]'
            }`}
          >
            2
          </button>
          <button
            onClick={() => setCurrentPage(3)}
            className={`w-7 h-7 rounded text-xs font-semibold cursor-pointer ${
              currentPage === 3
                ? 'bg-[#0058be] text-white'
                : 'text-[#565e74] hover:bg-[#f8f9ff]'
            }`}
          >
            3
          </button>
          <span className="px-1 text-[#727785]">...</span>
          <button
            onClick={() => setCurrentPage(8578)}
            className="px-2 h-7 rounded text-xs font-medium text-[#565e74] hover:bg-[#f8f9ff] cursor-pointer"
          >
            8,578
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.min(8578, p + 1))}
            className="p-1.5 rounded hover:bg-[#f8f9ff] text-[#565e74] cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
