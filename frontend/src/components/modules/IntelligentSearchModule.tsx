import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { SearchCandidate } from '../../types';
import { triggerHaptic } from '../../utils/haptics';
import {
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  Award,
  Briefcase,
  ChevronRight,
  ArrowRight,
  UserCheck,
} from 'lucide-react';

export const IntelligentSearchModule: React.FC = () => {
  const { activeOrg, addToast, setActiveTab } = useApp();
  const [query, setQuery] = useState('');
  const [parsedEntities, setParsedEntities] = useState<any>(null);
  const [results, setResults] = useState<SearchCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const EXAMPLE_QUERIES = [
    'Find a DBMS teacher for S5 CSE on Monday at 10 AM',
    'Find two experienced Python developers available tomorrow',
    'Find a qualified replacement with M.Tech qualification',
    'Find a faculty member for Computer Networks lab session',
  ];

  // Auto-fill query if passed from dashboard
  useEffect(() => {
    const pending = localStorage.getItem('smart_sched_pending_search');
    if (pending) {
      localStorage.removeItem('smart_sched_pending_search');
      setQuery(pending);
      executeSearch(pending);
    }
  }, []);

  const executeSearch = async (queryString: string) => {
    if (!activeOrg || !queryString.trim()) return;
    triggerHaptic(15);
    setIsLoading(true);

    try {
      const res = await api.searchNLP(activeOrg.id, queryString, 5);
      setParsedEntities(res.parsed_entities);
      setResults(res.results);
      addToast('IR Search Complete', `Ranked ${res.results.length} candidates using TF-IDF & constraint scoring`, 'info');
    } catch (err: any) {
      addToast('Search Error', err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Search Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-blue-500" />
          <span>Intelligent IR / NLP Candidate Search</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Natural language entity extraction (skills, time, qualifications, workload) paired with real TF-IDF similarity ranking.
        </p>
      </div>

      {/* Natural Language Search Bar */}
      <div className="p-6 md:p-8 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="w-5 h-5 text-blue-500 absolute left-4 top-3.5 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in plain English: e.g. 'Find a DBMS teacher for S5 CSE on Monday at 10 AM'..."
            className="w-full pl-12 pr-28 py-3.5 rounded-2xl glass-input text-xs md:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 shadow-inner"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="absolute right-2 top-2 px-5 py-2 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-1.5 shadow-md disabled:opacity-50"
          >
            {isLoading ? 'Ranking...' : 'Rank Staff'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Example Query Chips */}
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Try Example Queries:
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((eq, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setQuery(eq);
                  executeSearch(eq);
                }}
                className="px-3 py-1.5 rounded-xl glass-pill hover:border-blue-400/60 text-[11px] text-slate-600 dark:text-slate-300 font-medium transition-colors text-left"
              >
                "{eq}"
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Parsed Requirement Breakdown Card */}
      {parsedEntities && (
        <div className="p-5 rounded-3xl glass-card border border-blue-500/30 bg-blue-500/5 space-y-2 animate-in fade-in duration-200">
          <div className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            <span>Extracted Requirement Entities</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
            <div className="p-2.5 rounded-xl glass-pill">
              <span className="text-[10px] text-slate-400 block font-semibold">Identified Skills</span>
              <strong className="text-slate-800 dark:text-slate-200">
                {parsedEntities.skills.join(', ') || 'Any Subject'}
              </strong>
            </div>

            <div className="p-2.5 rounded-xl glass-pill">
              <span className="text-[10px] text-slate-400 block font-semibold">Target Schedule</span>
              <strong className="text-slate-800 dark:text-slate-200">
                {parsedEntities.day_of_week !== null ? `Day ${parsedEntities.day_of_week + 1}` : 'Any Day'} • {parsedEntities.time || 'Flexible'}
              </strong>
            </div>

            <div className="p-2.5 rounded-xl glass-pill">
              <span className="text-[10px] text-slate-400 block font-semibold">Qualifications</span>
              <strong className="text-slate-800 dark:text-slate-200">
                {parsedEntities.qualifications.join(', ') || 'Not constrained'}
              </strong>
            </div>

            <div className="p-2.5 rounded-xl glass-pill">
              <span className="text-[10px] text-slate-400 block font-semibold">Requested Count</span>
              <strong className="text-slate-800 dark:text-slate-200">
                {parsedEntities.requested_count} candidate(s)
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Ranked Candidate Results */}
      <div className="space-y-4">
        {results.map((cand, idx) => {
          const p = cand.person;
          const isTopMatch = idx === 0 && cand.match_percentage >= 75;

          return (
            <div
              key={p.id}
              className={`p-6 rounded-3xl glass-panel border transition-all space-y-4 ${
                isTopMatch
                  ? 'border-emerald-500/50 shadow-glass-glow'
                  : 'border-white/40 dark:border-white/10 hover:border-blue-400/50'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-md">
                    #{idx + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {p.name}
                      </h3>
                      {cand.is_recommended && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                          Recommended
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {p.role_title} • {p.department_name} • {p.employee_code}
                    </div>
                  </div>
                </div>

                {/* Match Percentage Badge */}
                <div className="text-right">
                  <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                    {cand.match_percentage}%
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    Overall Fit Score
                  </div>
                </div>
              </div>

              {/* Explanations & Qualifications Match */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
                {/* Positive explanations */}
                <div className="p-3 rounded-2xl glass-pill space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Why Matched:
                  </span>
                  {cand.explanations.map((exp, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-emerald-600 dark:text-emerald-400 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>{exp}</span>
                    </div>
                  ))}
                </div>

                {/* Missing requirements / warnings */}
                <div className="p-3 rounded-2xl glass-pill space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Gaps & Limitations:
                  </span>
                  {cand.missing_requirements.length === 0 && cand.rejection_reasons.length === 0 ? (
                    <div className="text-slate-400 text-[11px]">No unmet constraints detected.</div>
                  ) : (
                    <>
                      {cand.missing_requirements.map((mr, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-amber-600 dark:text-amber-400 text-[11px]">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          <span>{mr}</span>
                        </div>
                      ))}
                      {cand.rejection_reasons.map((rr, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-red-600 dark:text-red-400 text-[11px]">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          <span>{rr}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Skills and Qualifications tags */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/40 dark:border-slate-800/40">
                <span className="text-[10px] text-slate-400 font-semibold mr-1">Skills:</span>
                {p.skills.map((s, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold">
                    {s.name} ({s.level})
                  </span>
                ))}
                {p.inferred_skills.map((inf, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-semibold" title={inf.reason}>
                    ~{inf.name}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
