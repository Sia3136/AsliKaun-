export type ShiftStatus = 'Active Trip' | 'On Break' | 'Off Duty' | 'Standby';

export type RiskLevel = 'High Risk' | 'Medium Risk' | 'Low Risk' | 'Trusted';

export interface DriverRecord {
  id: string; // e.g., 'DRV-9042'
  name: string;
  avatarUrl?: string;
  avatarFallback: string;
  avatarBg: string;
  vehicle: string; // e.g., '2022 Toyota Camry Hybrid'
  plate: string; // e.g., 'CA #8KLY912'
  shiftStatus: ShiftStatus;
  shiftDuration: string; // e.g., '4h 18m logged' or '14m remaining'
  isShiftRemaining?: boolean;
  
  // Telemetry & Hardware Lineage
  hardwareFrom?: string; // e.g., 'SM-S918B'
  hardwareTo: string; // e.g., 'iPhone 15 Pro'
  lineageType: 'swap' | 'bidirectional' | 'single';
  lineageStatusText: string;
  lineageStatusType: 'critical' | 'declared' | 'verified' | 'warning';
  
  // Context Continuity
  contextScore: number; // 0 - 100
  contextLabel: 'LOW BASELINE' | 'STABLE' | 'PRISTINE' | 'IMPOSSIBLE' | 'MODERATE';
  contextDetail: string; // e.g., 'Cell-tower radius offset +4.1km'
  
  // Behavioral Continuity
  behavioralScore: number; // 0 - 100
  behavioralLabel: 'CRITICAL' | 'NORMAL' | 'OPTIMAL' | 'UNSTABLE';
  behavioralDetail: string; // e.g., 'G-force delta incongruent'
  
  // Risk Classification
  riskScore: number; // e.g., 94
  riskCategory: RiskLevel;
  riskReason: string; // e.g., 'Likely Account Handoff'
  
  // Quick Action Type
  recommendedAction: 'Investigate' | 'Review IMEI' | 'Telemetry' | 'Freeze Session' | 'Trigger Liveness';
  
  // Detailed Telemetry for Drawer
  imei: string;
  macAddress: string;
  simSerial: string;
  carrier: string;
  location: {
    lat: number;
    lng: number;
    corridor: string;
    speedMph: number;
    heading: number;
  };
  anomalyFlags: string[];
  sessionFrozen?: boolean;
  livenessPending?: boolean;
}

export type TabKey = 
  | 'overview' 
  | 'fleet-monitor' 
  | 'investigations' 
  | 'review-queue' 
  | 'scenario-simulator' 
  | 'model-performance' 
  | 'audit-logs';

export type FilterCategory = 'all' | 'high-risk' | 'new-devices' | 'pending-liveness';
