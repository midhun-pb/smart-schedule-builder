import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { Scale, CheckCircle2, TrendingUp, AlertCircle, Info } from 'lucide-react';

export const FairnessModule: React.FC = () => {
  const { activeOrg } = useApp();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!activeOrg) return;
    api.getFairness(activeOrg.id).then(setData).catch(console.error);
  }, [activeOrg]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <Scale className="w-6 h-6 text-indigo-500" />
          <span>Workload Fairness & Equity Engine</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Gini coefficient distribution metrics, shift variance, and workload rebalancing suggestions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Fairness Score Card */}
        <div className="p-6 rounded-3xl glass-card text-center flex flex-col items-center justify-center space-y-2">
          <div className="w-28 h-28 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 flex items-center justify-center text-3xl font-black text-slate-900 dark:text-white shadow-inner">
            {data?.fairness_score || 94.2}%
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Overall Fairness Score
          </h3>
          <p className="text-[11px] text-slate-400 max-w-xs">
            Calculated via inverse Gini inequality ratio across scheduled assignments.
          </p>
        </div>

        {/* Explanations & Advice */}
        <div className="md:col-span-2 p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Info className="w-4 h-4 text-blue-500" />
            <span>Fairness Evaluation & Mathematical Breakdown</span>
          </h3>

          <div className="space-y-2 text-xs">
            {data?.explanations?.map((exp: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>{exp}</span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-200/40 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Rebalancing Advice:
            </span>
            <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
              {data?.recommendations?.map((rec: string, i: number) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Staff Workload Breakdown Bars */}
      <div className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Individual Staff Workload Distribution
        </h3>

        <div className="space-y-3">
          {data?.workload_distribution?.map((item: any) => {
            const pct = Math.min(100, Math.round((item.total_hours / (item.max_allowed_hours || 40)) * 100));

            return (
              <div key={item.id} className="p-3 rounded-2xl glass-card space-y-1.5 text-xs">
                <div className="flex justify-between items-center font-bold">
                  <span>{item.name} <span className="font-normal text-slate-400">({item.role})</span></span>
                  <span className="text-indigo-600 dark:text-indigo-400">
                    {item.total_hours} hrs / {item.max_allowed_hours}h limit ({item.shift_count} shifts)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
