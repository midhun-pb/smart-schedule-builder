import React, { createContext, useContext, useState, useEffect } from 'react';
import { Organization, User } from '../types';
import { api } from '../api/client';
import { triggerHaptic } from '../utils/haptics';

interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  activeOrg: Organization | null;
  organizations: Organization[];
  currentUser: User | null;
  activeTab: string;
  theme: 'light' | 'dark';
  themeMode: 'light' | 'dark' | 'auto';
  effectiveTheme: 'light' | 'dark';
  unreadCount: number;
  toasts: Toast[];
  setActiveTab: (tab: string) => void;
  switchOrg: (org: Organization) => void;
  switchRole: (role: 'admin' | 'manager' | 'employee', personId?: number) => Promise<void>;
  toggleTheme: () => void;
  setThemeMode: (mode: 'light' | 'dark' | 'auto') => void;
  refreshOrgList: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  addToast: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTabState] = useState<string>('dashboard');
  const [themeMode, setThemeModeState] = useState<'light' | 'dark' | 'auto'>('dark');
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('dark');
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Appearance & Theme setup (Light Glass, Dark Glass, Auto)
  useEffect(() => {
    const savedMode = (localStorage.getItem('smart_sched_theme_mode') as 'light' | 'dark' | 'auto') || 'dark';
    setThemeModeState(savedMode);

    const applyTheme = (mode: 'light' | 'dark' | 'auto') => {
      let resolved: 'light' | 'dark' = 'dark';
      if (mode === 'auto') {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        resolved = prefersDark ? 'dark' : 'light';
      } else {
        resolved = mode;
      }
      setEffectiveTheme(resolved);
      if (resolved === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme(savedMode);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const current = (localStorage.getItem('smart_sched_theme_mode') as 'light' | 'dark' | 'auto') || 'dark';
      if (current === 'auto') {
        applyTheme('auto');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const setThemeMode = (mode: 'light' | 'dark' | 'auto') => {
    triggerHaptic(12);
    setThemeModeState(mode);
    localStorage.setItem('smart_sched_theme_mode', mode);
    let resolved: 'light' | 'dark' = 'dark';
    if (mode === 'auto') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      resolved = prefersDark ? 'dark' : 'light';
    } else {
      resolved = mode;
    }
    setEffectiveTheme(resolved);
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const toggleTheme = () => {
    // Cycle: dark -> light -> auto -> dark
    const nextMode = themeMode === 'dark' ? 'light' : themeMode === 'light' ? 'auto' : 'dark';
    setThemeMode(nextMode);
  };

  const addToast = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    triggerHaptic(type === 'error' ? [30, 50, 30] : 15);
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const setActiveTab = (tab: string) => {
    triggerHaptic(10);
    setActiveTabState(tab);
  };

  const refreshOrgList = async () => {
    try {
      const orgs = await api.getOrganizations();
      setOrganizations(orgs);
      if (orgs.length > 0 && !activeOrg) {
        // Default to first org (e.g. Apex Institute of Technology)
        setActiveOrg(orgs[0]);
      }
    } catch (err) {
      console.error('Failed to load organizations', err);
    }
  };

  const refreshNotifications = async () => {
    if (!activeOrg) return;
    try {
      const data = await api.getNotifications(activeOrg.id);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      // Quiet fail for notifications
    }
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      try {
        const orgs = await api.getOrganizations();
        setOrganizations(orgs);
        const selected = orgs[0] || null;
        setActiveOrg(selected);

        // Switch to default admin
        const authRes = await api.switchRole('admin');
        if (authRes.user) {
          setCurrentUser(authRes.user);
          localStorage.setItem('smart_sched_token', authRes.access_token);
        }

        if (selected) {
          const notifs = await api.getNotifications(selected.id);
          setUnreadCount(notifs.unread_count || 0);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      }
    };
    init();
  }, []);

  const switchOrg = (org: Organization) => {
    triggerHaptic(15);
    setActiveOrg(org);
    addToast('Organization Switched', `Active organization set to ${org.name}`, 'info');
  };

  const switchRole = async (role: 'admin' | 'manager' | 'employee', personId?: number) => {
    triggerHaptic(20);
    try {
      const res = await api.switchRole(role, personId);
      setCurrentUser(res.user);
      localStorage.setItem('smart_sched_token', res.access_token);
      addToast('Role Switched', `Now acting as ${role.toUpperCase()}`, 'success');
    } catch (err: any) {
      addToast('Role Switch Error', err.message, 'error');
    }
  };

  return (
    <AppContext.Provider
      value={{
        activeOrg,
        organizations,
        currentUser,
        activeTab,
        theme: effectiveTheme,
        themeMode,
        effectiveTheme,
        unreadCount,
        toasts,
        setActiveTab,
        switchOrg,
        switchRole,
        toggleTheme,
        setThemeMode,
        refreshOrgList,
        refreshNotifications,
        addToast,
        removeToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
