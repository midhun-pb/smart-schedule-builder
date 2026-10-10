import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { AppNotification } from '../../types';
import { triggerHaptic } from '../../utils/haptics';
import { Bell, CheckCheck, Clock, CheckCircle2, ChevronRight } from 'lucide-react';

export const NotificationsModule: React.FC = () => {
  const { activeOrg, refreshNotifications, setActiveTab } = useApp();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const fetchNotifs = async () => {
    if (!activeOrg) return;
    try {
      const res = await api.getNotifications(activeOrg.id);
      setNotifications(res.notifications || []);
      refreshNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, [activeOrg]);

  const handleMarkRead = async (id: number) => {
    triggerHaptic(10);
    try {
      await api.markNotificationRead(id);
      fetchNotifs();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAll = async () => {
    if (!activeOrg) return;
    triggerHaptic(15);
    try {
      await api.markAllNotificationsRead(activeOrg.id);
      fetchNotifs();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filterCategory === 'all') return true;
    return n.category === filterCategory;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-500" />
            <span>Operational Notification Center</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time alerts on emergency absences, replacement approvals, and schedule publications.
          </p>
        </div>

        <button
          onClick={handleMarkAll}
          className="px-3.5 py-2 rounded-xl glass-pill hover:bg-white/60 dark:hover:bg-slate-800/60 text-xs font-semibold flex items-center gap-1.5 self-start transition-colors"
        >
          <CheckCheck className="w-4 h-4 text-blue-500" />
          <span>Mark All as Read</span>
        </button>
      </div>

      {/* Filter Category Chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        {['all', 'leave', 'replacement', 'schedule', 'system'].map((cat) => (
          <button
            key={cat}
            onClick={() => {
              triggerHaptic(10);
              setFilterCategory(cat);
            }}
            className={`px-3 py-1.5 rounded-xl capitalize font-semibold transition-all ${
              filterCategory === cat
                ? 'bg-blue-600 text-white shadow-sm'
                : 'glass-pill text-slate-600 dark:text-slate-300 hover:bg-white/50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-3">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No notifications in this category.
          </div>
        ) : (
          filtered.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                handleMarkRead(n.id);
                if (n.link_url) {
                  const targetTab = n.link_url.replace('/', '');
                  if (targetTab) setActiveTab(targetTab);
                }
              }}
              className={`p-4 rounded-2xl glass-card flex items-start justify-between gap-4 cursor-pointer transition-all ${
                !n.is_read
                  ? 'border-blue-500/40 bg-blue-500/5'
                  : 'border-white/20 dark:border-white/10 opacity-75'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                    !n.is_read ? 'bg-blue-600 animate-pulse' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-2">
                    <span>{n.title}</span>
                    <span className="text-[10px] px-2 py-0.2 rounded-full uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                      {n.category}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                    {n.message}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(n.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>

              {n.link_url && (
                <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 mt-2" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
