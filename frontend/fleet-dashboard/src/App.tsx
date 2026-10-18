import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  Download, 
  ChevronRight,
  ShieldAlert,
  SlidersHorizontal,
  FileSpreadsheet
} from 'lucide-react';
import { DriverRecord, TabKey, FilterCategory } from './types/fleet';
import { INITIAL_DRIVERS } from './data/mockFleetData';
import { Header } from './components/Header';
import { NavigationTabs } from './components/NavigationTabs';
import { StatCards } from './components/StatCards';
import { FleetTable } from './components/FleetTable';
import { GeoTelemetryCorridor } from './components/GeoTelemetryCorridor';
import { ThreatDistribution } from './components/ThreatDistribution';
import { InvestigateDrawer } from './components/modals/InvestigateDrawer';
import { ReviewImeiModal } from './components/modals/ReviewImeiModal';
import { TriggerLivenessModal } from './components/modals/TriggerLivenessModal';
import { FreezeSessionModal } from './components/modals/FreezeSessionModal';
import { CommandPalette } from './components/modals/CommandPalette';
import { OverviewScreen } from './components/screens/OverviewScreen';
import { InvestigationsScreen } from './components/screens/InvestigationsScreen';
import { ReviewQueueScreen } from './components/screens/ReviewQueueScreen';
import { ScenarioSimulatorScreen } from './components/screens/ScenarioSimulatorScreen';
import { ModelPerformanceScreen } from './components/screens/ModelPerformanceScreen';
import { AuditLogsScreen } from './components/screens/AuditLogsScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('fleet-monitor');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [drivers, setDrivers] = useState<DriverRecord[]>(INITIAL_DRIVERS);
  const [syncRateEvents, setSyncRateEvents] = useState<number>(1240);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active Modals & Drawers
  const [selectedDriverForInvestigation, setSelectedDriverForInvestigation] = useState<DriverRecord | null>(null);
  const [selectedDriverForImei, setSelectedDriverForImei] = useState<DriverRecord | null>(null);
  const [selectedDriverForLiveness, setSelectedDriverForLiveness] = useState<DriverRecord | null>(null);
  const [selectedDriverForFreeze, setSelectedDriverForFreeze] = useState<DriverRecord | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Capture OAuth credentials from URL parameters on login redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('auth_token');
    const email = params.get('user_email');
    const name = params.get('user_name');
    const provider = params.get('provider') || 'google';

    if (token) {
      sessionStorage.setItem('tm-auth', 'true');
      sessionStorage.setItem('tm-auth-token', token);
      if (email) {
        sessionStorage.setItem('tm-auth-user', JSON.stringify({
          email,
          name: name || email.split('@')[0],
          provider,
        }));
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Background Simulated Sync Jitter
  useEffect(() => {
    const interval = setInterval(() => {
      setSyncRateEvents((prev) => Math.floor(1230 + Math.random() * 25));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut for Command Palette (⌘K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRefreshFeed = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setSyncRateEvents(1258);
    }, 600);
  };

  // Real CSV Export Functionality
  const handleExportCSV = () => {
    const headers = [
      'Driver ID',
      'Name',
      'Vehicle',
      'License Plate',
      'Shift Status',
      'Shift Duration',
      'Hardware From',
      'Hardware To',
      'Lineage Status',
      'Context Continuity Score',
      'Behavioral Continuity Score',
      'Risk Score',
      'Risk Category',
      'Risk Classification Reason',
      'IMEI',
      'MAC Address',
      'Carrier',
      'Corridor Location',
      'Speed (mph)'
    ];

    const rows = drivers.map((d) => [
      d.id,
      `"${d.name}"`,
      `"${d.vehicle}"`,
      `"${d.plate}"`,
      d.shiftStatus,
      `"${d.shiftDuration}"`,
      `"${d.hardwareFrom || ''}"`,
      `"${d.hardwareTo}"`,
      `"${d.lineageStatusText}"`,
      d.contextScore,
      d.behavioralScore,
      d.riskScore,
      d.riskCategory,
      `"${d.riskReason}"`,
      d.imei,
      d.macAddress,
      `"${d.carrier}"`,
      `"${d.location.corridor}"`,
      d.location.speedMph
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `trustmesh_telemetry_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Actions handlers
  const handleApproveImei = (driverId: string) => {
    setDrivers((prev) =>
      prev.map((d) =>
        d.id === driverId
          ? {
              ...d,
              riskCategory: 'Trusted',
              riskScore: 14,
              riskReason: 'Hardware Swap Approved & Enrolled',
              lineageStatusText: 'Attestation verified by Threat Ops',
              lineageStatusType: 'verified',
            }
          : d
      )
    );
  };

  const handleLivenessSuccess = (driverId: string) => {
    setDrivers((prev) =>
      prev.map((d) =>
        d.id === driverId
          ? {
              ...d,
              riskCategory: 'Trusted',
              riskScore: 18,
              riskReason: 'Biometric Liveness Challenge Verified',
              livenessPending: false,
            }
          : d
      )
    );
    setSelectedDriverForLiveness(null);
  };

  const handleConfirmFreeze = (driverId: string) => {
    setDrivers((prev) =>
      prev.map((d) =>
        d.id === driverId
          ? {
              ...d,
              sessionFrozen: true,
              shiftStatus: 'Standby',
              riskReason: 'Session Locked Down by Threat Ops',
            }
          : d
      )
    );
    setSelectedDriverForFreeze(null);
    if (selectedDriverForInvestigation?.id === driverId) {
      setSelectedDriverForInvestigation((prev) => (prev ? { ...prev, sessionFrozen: true } : null));
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] flex flex-col font-sans selection:bg-[#eff4ff] selection:text-[#0058be]">
      {/* Top Header */}
      <Header
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onSelectDriverById={(id) => {
          const found = drivers.find((d) => d.id === id);
          if (found) setSelectedDriverForInvestigation(found);
        }}
        unreadAlertsCount={4}
      />

      {/* Secondary Navigation Tabs */}
      <NavigationTabs
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        investigationCount={drivers.filter((d) => d.riskCategory === 'High Risk').length}
        reviewQueueCount={drivers.filter((d) => d.lineageType === 'swap').length}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6">
        {activeTab === 'fleet-monitor' && (
          <div>
            {/* Breadcrumb & Screen Title Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#727785] tracking-wide mb-1">
                  <span>FLEET CORE MESH</span>
                  <span>/</span>
                  <span className="text-[#0058be]">Telemetry Protocol L4</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#0b1c30]">
                  Fleet Telemetry &amp; Driver Monitor
                </h1>
                <p className="text-xs md:text-sm text-[#565e74] mt-1 max-w-4xl">
                  Continuous verification stream across 42,890 registered commercial fleet drivers. Real-time hardware lineage, velocity anomalies, and biometrics.
                </p>
              </div>

              {/* Action Buttons: Refresh Feed + Export CSV */}
              <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
                <button
                  onClick={handleRefreshFeed}
                  className="px-4 py-2 bg-white hover:bg-[#f8f9ff] text-[#0b1c30] text-xs font-semibold rounded-md border border-[#e2e8f0] shadow-2xs flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#565e74] ${isRefreshing ? 'animate-spin text-[#0058be]' : ''}`} />
                  <span>Refresh Feed</span>
                </button>
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 bg-[#0058be] hover:bg-[#0047a0] text-white text-xs font-semibold rounded-md shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* 4 Metric KPI Stat Cards */}
            <StatCards
              activeStreams={42890}
              severeCount={632}
              newHardwareCount={1204}
              livenessGateCount={43}
              onFilterClick={setActiveFilter}
            />

            {/* Main Fleet Telemetry Table */}
            <FleetTable
              drivers={drivers}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              onInvestigate={(driver) => setSelectedDriverForInvestigation(driver)}
              onReviewImei={(driver) => setSelectedDriverForImei(driver)}
              onFreezeSession={(driver) => setSelectedDriverForFreeze(driver)}
              onTriggerLiveness={(driver) => setSelectedDriverForLiveness(driver)}
              onOpenTelemetry={(driver) => setSelectedDriverForInvestigation(driver)}
              syncRateEvents={syncRateEvents}
            />

            {/* Bottom 2 Columns: Geo-Telemetry Corridor & Threat Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GeoTelemetryCorridor
                drivers={drivers}
                onSelectDriver={(driver) => setSelectedDriverForInvestigation(driver)}
              />
              <ThreatDistribution
                onOpenSimulator={() => setActiveTab('scenario-simulator')}
              />
            </div>
          </div>
        )}

        {/* Alternate Screens for navigation tabs */}
        {activeTab === 'overview' && (
          <OverviewScreen
            drivers={drivers}
            onNavigateToFleet={() => setActiveTab('fleet-monitor')}
          />
        )}

        {activeTab === 'investigations' && (
          <InvestigationsScreen
            drivers={drivers}
            onInvestigateDriver={(driver) => setSelectedDriverForInvestigation(driver)}
          />
        )}

        {activeTab === 'review-queue' && (
          <ReviewQueueScreen
            drivers={drivers}
            onReviewImei={(driver) => setSelectedDriverForImei(driver)}
          />
        )}

        {activeTab === 'scenario-simulator' && (
          <ScenarioSimulatorScreen />
        )}

        {activeTab === 'model-performance' && (
          <ModelPerformanceScreen />
        )}

        {activeTab === 'audit-logs' && (
          <AuditLogsScreen />
        )}
      </main>

      {/* Global Bottom Status Bar / Footer */}
      <footer className="w-full bg-white border-t border-[#e2e8f0] px-6 py-3 mt-12 text-xs text-[#565e74] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#0b1c30]">
            AsliKaun Security OS v3.4-prod
          </span>
          <span className="text-[#c2c6d6]">·</span>
          <span className="inline-flex items-center gap-1.5 text-[#006947] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#006947]" />
            Operational Continuity 99.99%
          </span>
        </div>
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setActiveTab('model-performance')}
            className="text-[#565e74] hover:text-[#0b1c30] transition-colors cursor-pointer"
          >
            Cluster Telemetry
          </button>
          <button 
            onClick={() => setActiveTab('investigations')}
            className="text-[#565e74] hover:text-[#0b1c30] transition-colors cursor-pointer"
          >
            SOC Runbooks
          </button>
          <button 
            onClick={() => setActiveTab('scenario-simulator')}
            className="text-[#565e74] hover:text-[#0b1c30] transition-colors cursor-pointer"
          >
            Threat Intelligence
          </button>
        </div>
      </footer>

      {/* Modals & Slide-over Drawers */}
      <InvestigateDrawer
        driver={selectedDriverForInvestigation}
        onClose={() => setSelectedDriverForInvestigation(null)}
        onFreezeSession={(driver) => setSelectedDriverForFreeze(driver)}
        onTriggerLiveness={(driver) => setSelectedDriverForLiveness(driver)}
      />

      <ReviewImeiModal
        driver={selectedDriverForImei}
        onClose={() => setSelectedDriverForImei(null)}
        onApprove={handleApproveImei}
      />

      <TriggerLivenessModal
        driver={selectedDriverForLiveness}
        onClose={() => setSelectedDriverForLiveness(null)}
        onSuccess={handleLivenessSuccess}
      />

      <FreezeSessionModal
        driver={selectedDriverForFreeze}
        onClose={() => setSelectedDriverForFreeze(null)}
        onConfirmFreeze={handleConfirmFreeze}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        drivers={drivers}
        onSelectDriver={(driver) => setSelectedDriverForInvestigation(driver)}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />
    </div>
  );
}
