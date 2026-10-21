export type ShiftStatus = 'Active Trip' | 'On Break' | 'Off Duty' | 'Standby';

export type RiskLevel = 'High Risk' | 'Medium Risk' | 'Low Risk' | 'Trusted' | 'Unscored';

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
  hasContextScore?: boolean;
  contextLabel: 'LOW BASELINE' | 'STABLE' | 'PRISTINE' | 'IMPOSSIBLE' | 'MODERATE';
  contextDetail: string; // e.g., 'Cell-tower radius offset +4.1km'
  
  // Behavioral Continuity
  behavioralScore: number; // 0 - 100
  hasBehaviorScore?: boolean;
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
  signalScores?: Record<string, number>;
  signalMetric?: 'p_value' | 'anomaly_score';
  safePauseInfo?: { is_moving?: boolean; speed_mph?: number | null; safe_pause_scheduled?: boolean; scheduled_state?: string } | null;
  adaptiveThreshold?: { threshold?: number; source?: string; sample_count?: number; note?: string } | null;
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
