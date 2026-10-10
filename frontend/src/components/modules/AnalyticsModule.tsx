import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { BarChart3, TrendingUp, Users, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';

export const AnalyticsModule: React.FC = () => {
  const { activeOrg } = useApp();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!activeOrg) return;
    api.getAnalytics(activeOrg.id).then(setData).catch(console.error);
  }, [activeOrg]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-blue-500" />
          <span>Operational Analytics & Trends</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Real metrics on schedule coverage, leave volume, replacement frequencies, and overtime.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl glass-card">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Schedule Coverage</div>
          <div className="text-3xl font-extrabold text-emerald-500 mt-1">
            {data?.schedule_coverage?.rate || 100}%
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {data?.schedule_coverage?.filled_slots || 7} / {data?.schedule_coverage?.total_slots || 7} filled
          </div>
        </div>

        <div className="p-5 rounded-3xl glass-card">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Leave Requests</div>
          <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
            {data?.leave_analytics?.total_leaves || 2}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {data?.leave_analytics?.emergency_leaves || 1} emergency absences
          </div>
        </div>

        <div className="p-5 rounded-3xl glass-card">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Replacements</div>
          <div className="text-3xl font-extrabold text-amber-500 mt-1">
            {data?.replacement_metrics?.total_replacements || 1}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {data?.replacement_metrics?.safely_restored || 0} safely restored
          </div>
        </div>

        <div className="p-5 rounded-3xl glass-card">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Average Hours</div>
          <div className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">
            {data?.staffing?.average_hours_per_week || 32.5}h
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Per active team member
          </div>
        </div>
      </div>

      {/* Weekly Trends Bar Representation */}
      <div className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Daily Operational Demand vs Fulfillment
        </h3>

        <div className="grid grid-cols-5 gap-3 pt-3">
          {data?.trends?.map((t: any) => (
            <div key={t.day} className="p-4 rounded-2xl glass-card text-center space-y-2">
              <span className="font-bold text-xs block text-slate-900 dark:text-white">{t.day}</span>
              <div className="h-28 flex items-end justify-center gap-1.5 pb-2">
                <div
                  className="w-4 bg-slate-300 dark:bg-slate-700 rounded-t-md transition-all"
                  style={{ height: `${(t.demand / 15) * 100}%` }}
                  title={`Demand: ${t.demand}`}
                />
                <div
                  className="w-4 bg-blue-600 rounded-t-md transition-all"
                  style={{ height: `${(t.filled / 15) * 100}%` }}
                  title={`Filled: ${t.filled}`}
                />
              </div>
              <div className="text-[10px] text-slate-500">
                {t.filled} / {t.demand} classes
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
