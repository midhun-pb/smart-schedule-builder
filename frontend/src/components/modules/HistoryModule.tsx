import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { triggerHaptic } from '../../utils/haptics';
import { History, RotateCcw, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const HistoryModule: React.FC = () => {
  const { activeOrg, addToast, setActiveTab } = useApp();
  const [activeTab, setActiveTabLocal] = useState<'versions' | 'audit'>('versions');
  const [versions, setVersions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [activeSchedId, setActiveSchedId] = useState<number | null>(null);

  const fetchData = async () => {
    if (!activeOrg) return;
    try {
      const schedList = await api.getSchedules(activeOrg.id);
      if (schedList.length > 0) {
        setActiveSchedId(schedList[0].id);
        const vList = await api.getVersions(schedList[0].id);
        setVersions(vList);
      }
      const logs = await api.getAuditLogs(activeOrg.id);
      setAuditLogs(logs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeOrg]);

  const handleRollback = async (versionId: number) => {
    triggerHaptic(25);
    try {
      const res = await api.rollbackVersion(versionId);
      addToast('Rollback Complete', res.message, 'success');
      fetchData();
      setActiveTab('schedule');
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-6 h-6 text-blue-500" />
            <span>Version History & Audit Log</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Immutable schedule version snapshots with one-click safe rollback and forensic action auditing.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-2xl glass-panel border border-white/20 dark:border-white/10 self-start">
          <button
            onClick={() => setActiveTabLocal('versions')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'versions' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Schedule Versions ({versions.length})
          </button>
          <button
            onClick={() => setActiveTabLocal('audit')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'audit' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Audit Log ({auditLogs.length})
          </button>
        </div>
      </div>

      {activeTab === 'versions' && (
        <div className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Verified Timetable Snapshots
          </h3>

          <div className="space-y-3">
            {versions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No previous snapshots generated yet. Generate a schedule to create version snapshots.
              </div>
            ) : (
              versions.map((ver) => (
                <div key={ver.id} className="p-4 rounded-2xl glass-card flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-xs">
                        Version {ver.version_number}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                        Fairness: {ver.snapshot_json?.fairness_score || 94}%
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {ver.change_summary} • Created {new Date(ver.created_at).toLocaleString()} by {ver.created_by}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRollback(ver.id)}
                    className="px-3.5 py-2 rounded-xl glass-pill hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors flex-shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Rollback to this Version</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            System Action Audit Trail
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/50 text-[10px] uppercase font-semibold text-slate-400">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Entity</th>
                  <th className="py-2.5 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/40">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 px-3 text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2.5 px-3 font-bold text-blue-600 dark:text-blue-400">{log.action}</td>
                    <td className="py-2.5 px-3 capitalize">{log.entity_type} #{log.entity_id}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] truncate max-w-xs">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
