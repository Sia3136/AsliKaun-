import React from 'react';
import { TabKey } from '../types/fleet';

interface NavigationTabsProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  investigationCount?: number;
  reviewQueueCount?: number;
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTab,
  onSelectTab,
  investigationCount = 12,
  reviewQueueCount = 5,
}) => {
  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'fleet-monitor', label: 'Fleet Monitor' },
    { key: 'investigations', label: 'Investigations', badge: investigationCount },
    { key: 'review-queue', label: 'Review Queue', badge: reviewQueueCount },
    { key: 'scenario-simulator', label: 'Scenario Simulator' },
    { key: 'model-performance', label: 'Model Performance' },
    { key: 'audit-logs', label: 'Audit Logs' },
  ];

  return (
    <nav className="w-full bg-white border-b border-[#e2e8f0] px-6 py-2 flex items-center gap-1 overflow-x-auto text-sm">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onSelectTab(tab.key)}
            className={`px-3.5 py-1.5 rounded-md font-medium text-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer ${
              isActive
                ? 'bg-[#0058be] text-white shadow-xs font-semibold'
                : 'text-[#565e74] hover:text-[#0b1c30] hover:bg-[#f8f9ff]'
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-[#eff4ff] text-[#0058be]'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
