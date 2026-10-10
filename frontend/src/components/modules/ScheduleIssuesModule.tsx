import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { AlertTriangle, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';

export const ScheduleIssuesModule: React.FC = () => {
  const { activeOrg, setActiveTab } = useApp();
  const [issues, setIssues] = useState<any>(null);

  useEffect(() => {
    if (!activeOrg) return;
    api.getIssues(activeOrg.id).then(setIssues).catch(console.error);
  }, [activeOrg]);

  const summary = issues?.summary || { total_issues: 0 };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
          <span>Schedule Health & Issue Resolution</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Proactive conflict detector: unfilled slots, simultaneous double-bookings, and leave collisions.
        </p>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-3xl glass-card text-center">
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {summary.total_issues}
          </div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Total Issues
          </span>
        </div>

        <div className="p-4 rounded-3xl glass-card text-center">
          <div className="text-2xl font-extrabold text-amber-500">
            {summary.unfilled_count || 0}
          </div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Unfilled Slots
          </span>
        </div>

        <div className="p-4 rounded-3xl glass-card text-center">
          <div className="text-2xl font-extrabold text-red-500">
            {summary.conflict_count || 0}
          </div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Overlaps
          </span>
        </div>

        <div className="p-4 rounded-3xl glass-card text-center">
          <div className="text-2xl font-extrabold text-purple-500">
            {summary.leave_affected_count || 0}
          </div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Leave Collisions
          </span>
        </div>
      </div>

      {/* Unfilled Assignments */}
      <div className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Unfilled Timetable Assignments
        </h3>

        {issues?.unfilled_assignments?.length === 0 ? (
          <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-600 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>All timetable slots are completely staffed.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {issues?.unfilled_assignments?.map((u: any, idx: number) => (
              <div key={idx} className="p-3.5 rounded-2xl glass-card flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{u.title}</div>
                  <div className="text-[11px] text-slate-500">{u.date_str} • {u.time} • Skills: {u.required_skills.join(', ')}</div>
                </div>
                <button
                  onClick={() => setActiveTab('search')}
                  className="px-3 py-1.5 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-1"
                >
                  <span>Find Candidate</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scheduling Conflicts */}
      {issues?.scheduling_conflicts?.length > 0 && (
        <div className="p-6 rounded-3xl glass-panel border border-red-500/30 bg-red-500/5 space-y-3">
          <h3 className="text-sm font-bold text-red-950 dark:text-red-200">
            Simultaneous Scheduling Conflicts
          </h3>
          <div className="space-y-2">
            {issues.scheduling_conflicts.map((c: any, i: number) => (
              <div key={i} className="p-3 rounded-2xl glass-card text-xs text-red-900 dark:text-red-200">
                {c.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
