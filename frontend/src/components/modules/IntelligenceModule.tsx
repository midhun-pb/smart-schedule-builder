import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { Brain, Sparkles, TrendingUp, AlertTriangle, BookOpen, Layers } from 'lucide-react';

export const IntelligenceModule: React.FC = () => {
  const { activeOrg } = useApp();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!activeOrg) return;
    api.getSkillIntelligence(activeOrg.id).then(setData).catch(console.error);
  }, [activeOrg]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <Brain className="w-6 h-6 text-purple-500" />
          <span>Skill Intelligence & Gap Analysis</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Domain correlation graph, hidden skill inference, and training recommendations.
        </p>
      </div>

      {/* Grid: Hidden Skills and Gap Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hidden Skills Matrix */}
        <div className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span>Inferred Hidden Skills</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Confidence Scored</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Inferred skills are derived from verified competencies through industry association models,
            kept strictly distinct from verified qualifications.
          </p>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {data?.inferred_skills?.map((inf: any, idx: number) => (
              <div key={idx} className="p-3 rounded-2xl glass-card text-xs flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>{inf.person_name}</span>
                    <span className="text-purple-500 font-semibold">~{inf.skill}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{inf.reason}</div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-purple-600 dark:text-purple-400">
                    {Math.round(inf.confidence * 100)}%
                  </span>
                  <span className="block text-[9px] text-slate-400 uppercase font-semibold">Conf.</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Skill Gap Analysis */}
        <div className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Timetable Skill Gaps & Supply Risk</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Supply vs Demand</span>
          </div>

          <div className="space-y-3">
            {data?.gap_analysis?.skill_gaps?.length === 0 ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-600 text-xs font-semibold text-center">
                All scheduled skill requirements are comfortably covered by staff.
              </div>
            ) : (
              data?.gap_analysis?.skill_gaps?.map((gap: any, i: number) => (
                <div key={i} className="p-3.5 rounded-2xl glass-card text-xs space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>{gap.skill}</span>
                    <span className="text-amber-500 uppercase text-[10px]">{gap.status}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Demand: {gap.required_demand} slot(s) | Available: {gap.available_supply} staff member(s)
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Upskilling Recommendations */}
          <div className="p-4 rounded-2xl glass-pill space-y-2 pt-3 border-t border-slate-200/40">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Training & Mentorship Actions:
            </div>
            {data?.gap_analysis?.training_recommendations?.map((rec: string, i: number) => (
              <div key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                <BookOpen className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
