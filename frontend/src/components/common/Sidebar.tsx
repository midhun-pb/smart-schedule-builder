import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  Building,
  Users,
  CalendarDays,
  Sparkles,
  RefreshCw,
  Clock,
  Brain,
  Scale,
  AlertTriangle,
  Users2,
  BarChart3,
  History,
  Bell,
  Sliders,
  X,
  ChevronDown,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

interface NavItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  adminOnly?: boolean;
}

const CORE_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'schedule', label: 'Timetable & Roster', icon: CalendarDays },
  { key: 'profiles', label: 'Employees & Teachers', icon: Users },
  { key: 'org-setup', label: 'Organization Setup', icon: Building },
  { key: 'fairness', label: 'Workload & Fairness', icon: Scale },
  { key: 'issues', label: 'Schedule Issues', icon: AlertTriangle },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'settings', label: 'Settings', icon: Sliders },
];

const ADVANCED_ITEMS: NavItem[] = [
  { key: 'replacements', label: 'Swaps & Replacements', icon: RefreshCw },
  { key: 'search', label: 'Intelligent Search', icon: Sparkles, badge: 'IR/NLP' },
  { key: 'leave', label: 'Availability & Leave', icon: Clock },
  { key: 'intelligence', label: 'Skill Intelligence', icon: Brain },
  { key: 'team-builder', label: 'Team Builder', icon: Users2 },
  { key: 'holidays', label: 'Holiday Management', icon: CalendarDays },
  { key: 'analytics', label: 'Analytics & Reports', icon: BarChart3 },
  { key: 'history', label: 'History & Rollback', icon: History },
];

export const Sidebar: React.FC<{
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}> = ({ isOpenMobile, onCloseMobile }) => {
  const { activeTab, setActiveTab, unreadCount, currentUser } = useApp();
  const isCurrentTabAdvanced = ADVANCED_ITEMS.some((i) => i.key === activeTab);
  const [showAdvanced, setShowAdvanced] = React.useState<boolean>(isCurrentTabAdvanced);

  React.useEffect(() => {
    if (isCurrentTabAdvanced) {
      setShowAdvanced(true);
    }
  }, [isCurrentTabAdvanced]);

  const handleSelect = (key: string) => {
    triggerHaptic(12);
    setActiveTab(key);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed md:sticky top-0 md:top-[61px] left-0 h-screen md:h-[calc(100vh-61px)] w-72 glass-panel border-r border-white/20 dark:border-white/10 z-50 md:z-30 flex flex-col transition-all duration-300 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-white/20 dark:border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm">Smart Schedule</span>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg glass-pill hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Core Workflow
          </div>

          {CORE_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            const isNotif = item.key === 'notifications' && unreadCount > 0;

            return (
              <button
                key={item.key}
                onClick={() => handleSelect(item.key)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-blue-600/90 text-white shadow-md shadow-blue-500/25 backdrop-blur-md'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-blue-500'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.badge && !isActive && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/20">
                      {item.badge}
                    </span>
                  )}
                  {isNotif && (
                    <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          {/* Advanced Operations Collapsible Section */}
          <div className="pt-3">
            <button
              onClick={() => {
                triggerHaptic(8);
                setShowAdvanced(!showAdvanced);
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                <span>Advanced Operations</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-500">
                  {ADVANCED_ITEMS.length}
                </span>
                {showAdvanced ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                )}
              </div>
            </button>

            {showAdvanced && (
              <div className="mt-1 space-y-1 pl-1 border-l-2 border-indigo-500/20 ml-2 animate-in fade-in slide-in-from-top-1 duration-200">
                {ADVANCED_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.key;

                  return (
                    <button
                      key={item.key}
                      onClick={() => handleSelect(item.key)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all group ${
                        isActive
                          ? 'bg-indigo-600/90 text-white shadow-md shadow-indigo-500/25 backdrop-blur-md'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`w-3.5 h-3.5 transition-transform group-hover:scale-110 ${
                            isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-indigo-500'
                          }`}
                        />
                        <span>{item.label}</span>
                      </div>

                      {item.badge && !isActive && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-500/20">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* User Card at bottom of sidebar */}
        <div className="p-3 border-t border-white/20 dark:border-white/10">
          <div className="p-3 rounded-2xl glass-card flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-xs shadow-sm">
              {currentUser?.full_name ? currentUser.full_name[0] : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                {currentUser?.full_name || 'Admin User'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {currentUser?.role || 'Administrator'}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
