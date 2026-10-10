import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { triggerHaptic } from '../../utils/haptics';
import { Users2, Sparkles, CheckCircle2, Plus, Trash2, ArrowRight } from 'lucide-react';

export const TeamBuilderModule: React.FC = () => {
  const { activeOrg, addToast } = useApp();
  const [teamName, setTeamName] = useState('Core Curriculum Review Squad');
  const [roles, setRoles] = useState([
    { title: 'Database Lead', skills: 'DBMS, SQL', count: 1 },
    { title: 'Programming Specialist', skills: 'Python, Algorithms', count: 1 },
    { title: 'Systems Instructor', skills: 'Operating Systems', count: 1 },
  ]);
  const [teamResult, setTeamResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAddRole = () => {
    triggerHaptic(10);
    setRoles([...roles, { title: 'Subject Expert', skills: 'Data Structures', count: 1 }]);
  };

  const handleRemoveRole = (idx: number) => {
    triggerHaptic(10);
    setRoles(roles.filter((_, i) => i !== idx));
  };

  const handleSolveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) return;
    triggerHaptic(20);
    setIsLoading(true);

    try {
      const payloadRoles = roles.map((r) => ({
        title: r.title,
        skills: r.skills.split(',').map((s) => s.trim()).filter(Boolean),
        count: Number(r.count) || 1,
      }));

      const res = await api.findTeam({
        org_id: activeOrg.id,
        team_name: teamName,
        required_roles: payloadRoles,
      });

      setTeamResult(res);
      addToast('Team Generated', `Viability: ${res.viability_rating} (${res.team_coverage_percentage}% coverage)`, 'success');
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <Users2 className="w-6 h-6 text-blue-500" />
          <span>Cross-Functional Team & Squad Builder</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Assemble balanced teams with optimal skill complementarity and non-overlapping schedules.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Specification Form */}
        <form onSubmit={handleSolveTeam} className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Squad / Project Name:</label>
            <input
              type="text"
              required
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
            />
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-400">Required Roles & Skill Sets:</span>
              <button
                type="button"
                onClick={handleAddRole}
                className="px-2.5 py-1 rounded-lg glass-pill text-[11px] font-semibold text-blue-500 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Role
              </button>
            </div>

            {roles.map((r, i) => (
              <div key={i} className="p-3 rounded-2xl glass-card space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={r.title}
                    onChange={(e) => {
                      const updated = [...roles];
                      updated[i].title = e.target.value;
                      setRoles(updated);
                    }}
                    placeholder="Role Title"
                    className="flex-1 px-2.5 py-1.5 rounded-lg glass-input text-xs font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveRole(i)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <input
                  type="text"
                  value={r.skills}
                  onChange={(e) => {
                    const updated = [...roles];
                    updated[i].skills = e.target.value;
                    setRoles(updated);
                  }}
                  placeholder="Required skills (comma separated)"
                  className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs text-slate-600 dark:text-slate-300"
                />
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl glass-button-primary text-xs font-bold flex items-center justify-center gap-2 mt-4"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isLoading ? 'Solving Optimal Team...' : 'Assemble & Evaluate Squad'}</span>
          </button>
        </form>

        {/* Results Panel */}
        <div className="space-y-4">
          {teamResult ? (
            <div className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{teamResult.team_name}</h3>
                  <div className="text-xs text-blue-500 font-semibold">{teamResult.viability_rating}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-emerald-500">{teamResult.team_coverage_percentage}%</div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Skill Coverage</div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                {teamResult.role_allocations?.map((alloc: any, i: number) => (
                  <div key={i} className="p-3.5 rounded-2xl glass-card text-xs space-y-2">
                    <div className="font-bold text-slate-900 dark:text-white flex justify-between">
                      <span>{alloc.role}</span>
                      <span className="text-slate-400 text-[10px]">Needs: {alloc.required_skills.join(', ')}</span>
                    </div>

                    <div className="space-y-1">
                      {alloc.allocated_members?.map((m: any, mi: number) => (
                        <div key={mi} className="flex items-center justify-between text-[11px] p-2 rounded-xl glass-pill">
                          <span className="font-semibold text-blue-600 dark:text-blue-400">{m.name}</span>
                          <span className="text-slate-500">{m.fit_score}% fit</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center rounded-3xl glass-panel border border-dashed border-slate-300 dark:border-slate-800 text-slate-400 text-xs">
              Define required roles and click "Assemble & Evaluate Squad" to run the complementarity optimizer.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
