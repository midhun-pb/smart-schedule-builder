import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { triggerHaptic } from '../../utils/haptics';
import {
  CalendarDays,
  Users,
  Building2,
  BookOpen,
  Sparkles,
  Scale,
  AlertTriangle,
  Settings,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Layers,
  FileSpreadsheet,
  Brain,
  History,
  ShieldAlert,
  BarChart3,
} from 'lucide-react';

export const DashboardModule: React.FC = () => {
  const { activeOrg, setActiveTab, addToast } = useApp();
  const [stats, setStats] = useState<any>(null);
  const [peopleCount, setPeopleCount] = useState<number>(0);
  const [deptCount, setDeptCount] = useState<number>(0);
  const [subjectsCount, setSubjectsCount] = useState<number>(0);
  const [latestSchedule, setLatestSchedule] = useState<any>(null);
  const [activeReplacements, setActiveReplacements] = useState<any[]>([]);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [quickQuery, setQuickQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!activeOrg) return;
    setIsLoading(true);

    Promise.all([
      api.getPeople({ org_id: activeOrg.id }).catch(() => []),
      api.getDepartments(activeOrg.id).catch(() => []),
      api.getSubjects(activeOrg.id).catch(() => []),
      api.getSchedules(activeOrg.id).catch(() => []),
      api.getActiveReplacements(activeOrg.id).catch(() => []),
      api.getIssues(activeOrg.id).catch(() => null),
      api.getFairness(activeOrg.id).catch(() => null),
    ])
      .then(([people, depts, subjects, schedules, replacements, issues, fairness]) => {
        setPeopleCount(people?.length || 0);
        setDeptCount(depts?.length || 0);
        setSubjectsCount(subjects?.length || 0);
        setActiveReplacements(replacements || []);

        const latest = schedules && schedules.length > 0 ? schedules[0] : null;
        setLatestSchedule(latest);

        setStats({
          people: people || [],
          departments: depts || [],
          subjects: subjects || [],
          schedules: schedules || [],
          issues: issues || { summary: {}, conflicts: [] },
          fairness: fairness || { fairness_score: 95.0, high_workload_count: 0 },
        });
      })
      .finally(() => setIsLoading(false));
  }, [activeOrg]);

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickQuery.trim()) return;
    triggerHaptic(15);
    localStorage.setItem('smart_sched_pending_search', quickQuery);
    setActiveTab('search');
  };

  const isSetupComplete = activeOrg?.settings_json?.setup_completed;
  const setupStep = activeOrg?.settings_json?.setup_step || 1;

  const totalAssignments = latestSchedule?.total_assignments || 0;
  const conflictCount = stats?.issues?.summary?.total_issues || latestSchedule?.conflict_count || 0;
  const unfilledCount = stats?.issues?.summary?.unfilled_slots || 0;
  const fairnessScore = stats?.fairness?.fairness_score || latestSchedule?.fairness_score || 95.0;
  const isPublished = latestSchedule?.status === 'published';

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto">
      {/* 1. Incomplete Setup Resume Banner */}
      {!isSetupComplete && (
        <div className="p-4 md:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Setup In Progress: Step {Math.min(setupStep, 5)} of 5
              </div>
              <div className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                {activeOrg?.name} is partially configured. Continue through the simple setup wizard to complete timetable generation.
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              triggerHaptic(15);
              setActiveTab('org-setup');
            }}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 whitespace-nowrap"
          >
            <span>Continue Setup</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Welcome & Organization Header */}
      <div className="p-6 md:p-8 rounded-3xl glass-panel border border-white/40 dark:border-white/10 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-2 border border-blue-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              {activeOrg?.name || 'Smart Schedule Platform'}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Operations & Schedule Dashboard
            </h1>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-xl">
              {activeOrg?.type === 'college'
                ? 'Academic timetable management, faculty workload limits, classroom and lab scheduling.'
                : activeOrg?.type === 'airline'
                ? 'Aviation flight duty periods, rest interval enforcement, and crew pairing.'
                : 'Enterprise shift scheduling, operational task balancing, and workload optimization.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                triggerHaptic(15);
                setActiveTab('schedule');
              }}
              className="px-4 py-2.5 rounded-xl glass-button-primary text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <CalendarDays className="w-4 h-4" />
              <span>View Timetable</span>
            </button>
            <button
              onClick={() => {
                triggerHaptic(15);
                setActiveTab('org-setup');
              }}
              className="px-4 py-2.5 rounded-xl glass-pill hover:bg-white/60 dark:hover:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300/40"
            >
              Edit Setup
            </button>
          </div>
        </div>
      </div>

      {/* 3. Primary Actions Grid (The 8 Clear Actions requested) */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 mb-3">
          Primary Actions
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            {
              id: 'view-timetable',
              title: 'View Timetable',
              desc: 'Interactive 7-day schedule',
              icon: CalendarDays,
              color: 'text-blue-500 bg-blue-500/10',
              action: () => setActiveTab('schedule'),
            },
            {
              id: 'employees',
              title: activeOrg?.type === 'college' ? 'Teachers / Faculty' : 'Employees / Staff',
              desc: `${peopleCount} registered members`,
              icon: Users,
              color: 'text-emerald-500 bg-emerald-500/10',
              action: () => setActiveTab('profiles'),
            },
            {
              id: 'departments',
              title: 'Departments',
              desc: `${deptCount} operational units`,
              icon: Building2,
              color: 'text-indigo-500 bg-indigo-500/10',
              action: () => setActiveTab('org-setup'),
            },
            {
              id: 'subjects',
              title: activeOrg?.type === 'college' ? 'Subjects / Courses' : 'Duties / Tasks',
              desc: activeOrg?.type === 'college' ? `${subjectsCount} courses active` : 'Configured shift roles',
              icon: BookOpen,
              color: 'text-purple-500 bg-purple-500/10',
              action: () => setActiveTab('org-setup'),
            },
            {
              id: 'smart-generator',
              title: 'Smart Roster Generator',
              desc: 'Google OR-Tools solver',
              icon: Sparkles,
              color: 'text-amber-500 bg-amber-500/10',
              action: () => {
                setActiveTab('schedule');
              },
            },
            {
              id: 'workload',
              title: 'Workload & Fairness',
              desc: `Gini index: ${fairnessScore}%`,
              icon: Scale,
              color: 'text-teal-500 bg-teal-500/10',
              action: () => setActiveTab('fairness'),
            },
            {
              id: 'issues',
              title: 'Schedule Issues',
              desc: conflictCount === 0 ? 'Zero clashes detected' : `${conflictCount} warnings`,
              icon: AlertTriangle,
              color: 'text-rose-500 bg-rose-500/10',
              action: () => setActiveTab('issues'),
            },
            {
              id: 'settings',
              title: 'Settings & Rules',
              desc: 'Working days & breaks',
              icon: Settings,
              color: 'text-slate-500 bg-slate-500/10',
              action: () => setActiveTab('settings'),
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                onClick={() => {
                  triggerHaptic(10);
                  item.action();
                }}
                className="p-4 rounded-2xl glass-card border border-white/40 dark:border-white/10 hover:border-blue-400 cursor-pointer transition-all group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className={`w-9 h-9 rounded-xl ${item.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                    {item.title}
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Live Database Operational Metrics (Requested by User) */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 mb-3">
          Operational Live Metrics
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {/* Metric 1: Headcount */}
          <div
            onClick={() => setActiveTab('profiles')}
            className="p-4 rounded-2xl glass-card border border-white/40 dark:border-white/10 cursor-pointer hover:border-slate-300"
          >
            <div className="text-[10px] font-bold uppercase text-slate-400">Total Employees</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {peopleCount}
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Active in database</span>
            </div>
          </div>

          {/* Metric 2: Departments */}
          <div
            onClick={() => setActiveTab('org-setup')}
            className="p-4 rounded-2xl glass-card border border-white/40 dark:border-white/10 cursor-pointer hover:border-slate-300"
          >
            <div className="text-[10px] font-bold uppercase text-slate-400">Departments</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {deptCount}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Operational teams
            </div>
          </div>

          {/* Metric 3: Upcoming Assignments */}
          <div
            onClick={() => setActiveTab('schedule')}
            className="p-4 rounded-2xl glass-card border border-white/40 dark:border-white/10 cursor-pointer hover:border-slate-300"
          >
            <div className="text-[10px] font-bold uppercase text-slate-400">Assigned Duties</div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
              {totalAssignments}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Master timetable slots
            </div>
          </div>

          {/* Metric 4: Unfilled Periods */}
          <div
            onClick={() => setActiveTab('issues')}
            className="p-4 rounded-2xl glass-card border border-white/40 dark:border-white/10 cursor-pointer hover:border-slate-300"
          >
            <div className="text-[10px] font-bold uppercase text-slate-400">Unfilled Periods</div>
            <div className={`text-2xl font-black mt-1 ${unfilledCount > 0 ? 'text-amber-500' : 'text-slate-900 dark:text-white'}`}>
              {unfilledCount}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Periods needing coverage
            </div>
          </div>

          {/* Metric 5: Scheduling Conflicts */}
          <div
            onClick={() => setActiveTab('issues')}
            className="p-4 rounded-2xl glass-card border border-white/40 dark:border-white/10 cursor-pointer hover:border-slate-300"
          >
            <div className="text-[10px] font-bold uppercase text-slate-400">Scheduling Conflicts</div>
            <div className={`text-2xl font-black mt-1 ${conflictCount > 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {conflictCount}
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>{conflictCount === 0 ? 'Zero clashes' : 'Conflicts detected'}</span>
            </div>
          </div>

          {/* Metric 6: Workload Warnings */}
          <div
            onClick={() => setActiveTab('fairness')}
            className="p-4 rounded-2xl glass-card border border-white/40 dark:border-white/10 cursor-pointer hover:border-slate-300"
          >
            <div className="text-[10px] font-bold uppercase text-slate-400">Workload Warnings</div>
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
              {stats?.fairness?.high_workload_count || 0}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Gini index score {fairnessScore}%
            </div>
          </div>

          {/* Metric 7: Timetable Publication Status */}
          <div
            onClick={() => setActiveTab('schedule')}
            className="p-4 rounded-2xl glass-card border border-white/40 dark:border-white/10 cursor-pointer hover:border-slate-300 col-span-2"
          >
            <div className="text-[10px] font-bold uppercase text-slate-400">Timetable Status</div>
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${isPublished ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  {isPublished ? 'Published & Active' : 'Draft / In Preparation'}
                </span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                isPublished ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
              }`}>
                {latestSchedule ? `Version ${latestSchedule.version}` : 'Not Created'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              {latestSchedule ? `Period: ${latestSchedule.period_start} to ${latestSchedule.period_end}` : 'Run Smart Roster Generator to publish'}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Active Temporary Replacements Notice (if any) */}
      {activeReplacements.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                {activeReplacements.length} Active Duty Swaps / Replacements In Effect
              </div>
              <div className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                Staff replacement {activeReplacements[0]?.replacement_person_name} is covering {activeReplacements[0]?.slot_title}.
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('replacements')}
            className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors flex items-center gap-1"
          >
            <span>Manage Swaps</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 6. Collapsible Advanced Tools Section (kept accessible without cluttering) */}
      <div className="p-5 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
        <button
          onClick={() => {
            triggerHaptic(5);
            setShowAdvanced(!showAdvanced);
          }}
          className="w-full flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" />
            <span>Advanced Tools & Operations</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <span>{showAdvanced ? 'Hide Advanced' : 'Show Advanced'}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {showAdvanced && (
          <div className="space-y-4 pt-2 border-t border-white/20 dark:border-white/10 animate-in fade-in duration-200">
            {/* Quick Natural Language Search Bar */}
            <form onSubmit={handleQuickSearch} className="relative">
              <div className="relative flex items-center">
                <Sparkles className="w-4 h-4 text-blue-500 absolute left-4 pointer-events-none" />
                <input
                  type="text"
                  value={quickQuery}
                  onChange={(e) => setQuickQuery(e.target.value)}
                  placeholder="Ask in natural language: e.g. 'Find a DBMS teacher for S5 CSE on Monday at 10 AM'..."
                  className="w-full pl-11 pr-24 py-2.5 rounded-2xl glass-input text-xs"
                />
                <button
                  type="submit"
                  className="absolute right-2 px-3 py-1 rounded-xl glass-button-primary text-xs font-semibold"
                >
                  Search
                </button>
              </div>
            </form>

            {/* Advanced Tool Pills */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {[
                { title: 'Excel / CSV Import', icon: FileSpreadsheet, tab: 'profiles' },
                { title: 'Absence & Leave', icon: Clock, tab: 'leave' },
                { title: 'Swaps & Replacements', icon: RefreshCw, tab: 'replacements' },
                { title: 'Skill Intelligence', icon: Brain, tab: 'intelligence' },
                { title: 'Team Builder', icon: Users, tab: 'team-builder' },
                { title: 'Holidays & Closures', icon: CalendarDays, tab: 'holidays' },
                { title: 'Analytics & Trends', icon: BarChart3, tab: 'analytics' },
                { title: 'History & Rollback', icon: History, tab: 'history' },
              ].map((adv) => {
                const Icon = adv.icon;
                return (
                  <button
                    key={adv.title}
                    onClick={() => {
                      triggerHaptic(10);
                      setActiveTab(adv.tab);
                    }}
                    className="p-2.5 rounded-xl glass-pill hover:bg-white/60 dark:hover:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-300/40 flex items-center gap-2"
                  >
                    <Icon className="w-3.5 h-3.5 text-blue-500" />
                    <span className="truncate">{adv.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
