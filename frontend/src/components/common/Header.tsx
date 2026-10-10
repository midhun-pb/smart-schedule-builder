import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Sun,
  Moon,
  Bell,
  Building,
  UserCheck,
  ChevronDown,
  Sparkles,
  Menu,
  ShieldAlert,
  UserCheck2,
  User,
  Sliders,
} from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

export const Header: React.FC<{ onToggleMobileMenu: () => void }> = ({ onToggleMobileMenu }) => {
  const {
    activeOrg,
    organizations,
    switchOrg,
    currentUser,
    switchRole,
    theme,
    themeMode,
    effectiveTheme,
    toggleTheme,
    unreadCount,
    setActiveTab,
  } = useApp();

  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/20 dark:border-white/10 px-4 md:px-6 py-3 transition-colors duration-200">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Left: Mobile Menu & App Branding */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              triggerHaptic(10);
              onToggleMobileMenu();
            }}
            className="md:hidden p-2 rounded-xl glass-pill hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5 text-slate-700 dark:text-slate-200" />
          </button>

          <div
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer group select-none"
          >
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="font-semibold text-base md:text-lg tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent">
                Smart Schedule Builder
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Liquid Glass
              </span>
            </div>
          </div>
        </div>

        {/* Right: Controls & Persona Switcher */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Organization Selector */}
          <div className="relative">
            <button
              onClick={() => {
                triggerHaptic(10);
                setOrgDropdownOpen(!orgDropdownOpen);
                setRoleDropdownOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-pill hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <Building className="w-3.5 h-3.5 text-blue-500" />
              <span className="max-w-[120px] sm:max-w-[180px] truncate">
                {activeOrg ? activeOrg.name : 'Select Organization'}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {orgDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 glass-panel rounded-2xl p-1.5 shadow-2xl border border-white/40 dark:border-white/10 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                  Switch Organization
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => {
                        switchOrg(org);
                        setOrgDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors flex items-center justify-between ${
                        activeOrg?.id === org.id
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <span className="truncate">{org.name}</span>
                      <span className="text-[10px] opacity-75 capitalize">{org.type}</span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-200/50 dark:border-slate-700/50 mt-1.5 pt-1.5">
                  <button
                    onClick={() => {
                      setActiveTab('org-setup');
                      setOrgDropdownOpen(false);
                    }}
                    className="w-full text-center py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    + Create or Setup New Org
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Role Persona Switcher (Enforces backend RBAC & lets user test perspectives) */}
          <div className="relative">
            <button
              onClick={() => {
                triggerHaptic(10);
                setRoleDropdownOpen(!roleDropdownOpen);
                setOrgDropdownOpen(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-pill hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all text-xs font-medium capitalize text-slate-700 dark:text-slate-200 border border-slate-300/40 dark:border-slate-700/50"
            >
              {currentUser?.role === 'admin' ? (
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              ) : currentUser?.role === 'manager' ? (
                <UserCheck2 className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <User className="w-3.5 h-3.5 text-blue-500" />
              )}
              <span className="hidden sm:inline">Role:</span>
              <span className="font-semibold">{currentUser?.role || 'admin'}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {roleDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 glass-panel rounded-2xl p-1.5 shadow-2xl border border-white/40 dark:border-white/10 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                  Switch Persona / Role
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      switchRole('admin');
                      setRoleDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors flex items-center gap-2 ${
                      currentUser?.role === 'admin'
                        ? 'bg-amber-600 text-white'
                        : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <div>
                      <div className="font-semibold">Administrator</div>
                      <div className="text-[10px] opacity-75">Full permissions & settings</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      switchRole('manager');
                      setRoleDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors flex items-center gap-2 ${
                      currentUser?.role === 'manager'
                        ? 'bg-emerald-600 text-white'
                        : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <UserCheck2 className="w-4 h-4" />
                    <div>
                      <div className="font-semibold">Manager / Dean</div>
                      <div className="text-[10px] opacity-75">Approve leaves & swaps</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      switchRole('employee', 1);
                      setRoleDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors flex items-center gap-2 ${
                      currentUser?.role === 'employee'
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <div>
                      <div className="font-semibold">Employee / Teacher</div>
                      <div className="text-[10px] opacity-75">Self-service & availability</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Notifications Button */}
          <button
            onClick={() => {
              triggerHaptic(10);
              setActiveTab('notifications');
            }}
            className="relative p-2 rounded-xl glass-pill hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4 text-slate-700 dark:text-slate-200" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Appearance Mode Button (Light Glass / Dark Glass / Auto) */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl glass-pill hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors text-xs font-medium"
            title={`Current: ${themeMode === 'auto' ? `Auto (System ${effectiveTheme})` : themeMode === 'light' ? 'Light Glass' : 'Dark Glass'}. Click to cycle.`}
          >
            {themeMode === 'auto' ? (
              <Sliders className="w-3.5 h-3.5 text-purple-500" />
            ) : effectiveTheme === 'dark' ? (
              <Moon className="w-3.5 h-3.5 text-blue-400" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span className="hidden lg:inline text-[11px] capitalize">
              {themeMode === 'auto' ? 'Auto' : themeMode === 'light' ? 'Light Glass' : 'Dark Glass'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
