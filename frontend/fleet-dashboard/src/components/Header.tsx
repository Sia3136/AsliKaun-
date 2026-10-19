import React, { useState } from 'react';
import { 
  Shield, 
  Search, 
  Bell, 
  ChevronDown, 
  CheckCircle2, 
  AlertTriangle, 
  Radio, 
  SlidersHorizontal,
  LogOut,
  UserCheck
} from 'lucide-react';

interface HeaderProps {
  onOpenCommandPalette: () => void;
  onSelectDriverById?: (id: string) => void;
  unreadAlertsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({ 
  onOpenCommandPalette,
  onSelectDriverById,
  unreadAlertsCount = 4 
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [userProfile] = useState<{ name: string; email: string; provider?: string }>(() => {
    try {
      const stored = sessionStorage.getItem('tm-auth-user') || localStorage.getItem('tm-auth-user');
      if (stored) return JSON.parse(stored);
    } catch {}
    return { name: 'Elena Vance', email: 'elena.vance@defense.trustmesh.io', provider: 'email' };
  });

  const handleLogout = () => {
    sessionStorage.removeItem('tm-auth');
    sessionStorage.removeItem('tm-auth-token');
    sessionStorage.removeItem('tm-auth-user');
    window.location.assign('/auth?mode=login');
  };

  const notifications = [
    {
      id: 'notif-1',
      title: 'Geofence velocity spike detected (Delhi NH-48)',
      time: '2m ago',
      driver: 'Tariq Al-Mansoor (#DRV-3319)',
      driverId: 'DRV-3319',
      severity: 'critical',
    },
    {
      id: 'notif-2',
      title: 'Unpaired MAC hardware swap in Mumbai BKC',
      time: '8m ago',
      driver: 'Marcus Vance (#DRV-9042)',
      driverId: 'DRV-9042',
      severity: 'critical',
    },
    {
      id: 'notif-3',
      title: 'Biometric liveness challenge scheduled (Chennai OMR)',
      time: '14m ago',
      driver: 'Elena Rostova (#DRV-6621)',
      driverId: 'DRV-6621',
      severity: 'warning',
    },
    {
      id: 'notif-4',
      title: 'Self-service IMEI swap pre-declared (Bengaluru Depot)',
      time: '26m ago',
      driver: 'Sophia Chen (#DRV-4112)',
      driverId: 'DRV-4112',
      severity: 'info',
    },
  ];

  return (
    <header className="w-full bg-white border-b border-[#e2e8f0] px-6 py-2.5 flex items-center justify-between sticky top-0 z-30">
      {/* Left zone: Brand, Version */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2.5">
          {/* AsliKaun Brand Logo */}
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
            <img src="/aslikaun-logo.png" alt="AsliKaun Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-lg font-bold tracking-tight text-[#0b1c30]">
            AsliKaun
          </span>
          <span className="text-[10px] font-semibold tracking-wider uppercase text-[#424754] bg-[#eff4ff] border border-[#d3e4fe] px-2 py-0.5 rounded">
            ENTERPRISE INTEL V3.4
          </span>
        </div>
      </div>

      {/* Right zone: Quick Search, Alert Notifications, User Account Profile */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Search trigger with ⌘K shortcut */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 bg-[#f8f9ff] hover:bg-[#eff4ff] text-[#727785] hover:text-[#0b1c30] px-3.5 py-1.5 rounded-lg border border-[#e2e8f0] text-xs transition-colors cursor-pointer w-64 md:w-80 justify-between"
          title="Search driver ID, session hash, IMEI (⌘K)"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-[#727785] shrink-0" />
            <span className="truncate">Search driver ID, session hash, IMEI...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold font-mono bg-white text-[#565e74] border border-[#c2c6d6] rounded shadow-2xs">
            ⌘K
          </kbd>
        </button>

        {/* Notification Bell with Badge */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-[#565e74] hover:text-[#0b1c30] hover:bg-[#f8f9ff] transition-colors cursor-pointer"
            aria-label="Threat notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-[#ba1a1a] text-white rounded-full text-[10px] font-bold flex items-center justify-center leading-none">
                {unreadAlertsCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-[#e2e8f0] py-2 z-50 text-xs">
              <div className="px-3 py-2 border-b border-[#f1f5f9] flex items-center justify-between">
                <span className="font-semibold text-[#0b1c30]">Security & Telemetry Alerts</span>
                <span className="text-[11px] text-[#0058be] font-medium cursor-pointer hover:underline">
                  Mark all read
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-[#f1f5f9]">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (onSelectDriverById) onSelectDriverById(n.driverId);
                      setShowNotifications(false);
                    }}
                    className="p-3 hover:bg-[#f8f9ff] cursor-pointer transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      {n.severity === 'critical' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-[#ba1a1a] shrink-0 mt-0.5" />
                      ) : n.severity === 'warning' ? (
                        <Radio className="w-3.5 h-3.5 text-[#d97706] shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#006947] shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#0b1c30] truncate">{n.title}</p>
                        <p className="text-[11px] text-[#565e74] truncate">{n.driver}</p>
                        <span className="text-[10px] text-[#727785] mt-1 block">{n.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-3 py-1.5 border-t border-[#f1f5f9] bg-[#f8f9ff] text-center">
                <button 
                  onClick={() => setShowNotifications(false)}
                  className="text-[11px] text-[#0058be] font-semibold hover:underline"
                >
                  View All Threat Feed Events
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Account Profile */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1 pl-2 hover:bg-[#f8f9ff] rounded-lg transition-colors cursor-pointer border border-transparent hover:border-[#e2e8f0]"
          >
            {/* User Avatar */}
            <div className="w-8 h-8 rounded-full bg-[#0058be] text-white flex items-center justify-center font-semibold text-xs border border-white shadow-xs">
              {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : <UserCheck className="w-4 h-4" />}
            </div>
            <div className="text-left hidden md:block">
              <div className="text-xs font-semibold text-[#0b1c30] leading-tight">{userProfile.name}</div>
              <div className="text-[11px] text-[#565e74] leading-tight">
                {userProfile.provider === 'google' ? 'Google Authenticated' : 'Threat Ops Lead'}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#727785]" />
          </button>

          {/* Profile Dropdown */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-[#e2e8f0] py-2 z-50 text-xs">
              <div className="px-3 py-2 border-b border-[#f1f5f9]">
                <p className="font-semibold text-[#0b1c30]">{userProfile.name}</p>
                <p className="text-[11px] text-[#565e74] break-all">{userProfile.email}</p>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[#006947] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#006947]" />
                  {userProfile.provider === 'google' ? 'Google OAuth 2.0 Session' : 'Active Shift: SOC Tier 3 Lead'}
                </div>
              </div>
              <div className="py-1">
                <button 
                  onClick={() => setShowProfileMenu(false)}
                  className="w-full text-left px-3 py-2 hover:bg-[#f8f9ff] text-[#0b1c30] flex items-center gap-2 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#565e74]" />
                  Threat Sensitivity Preferences
                </button>
                <button 
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 hover:bg-[#f8f9ff] text-[#ba1a1a] flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Handoff & End Shift (Logout)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
