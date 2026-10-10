import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { ActiveReplacement, TimetableSlot } from '../../types';
import { triggerHaptic } from '../../utils/haptics';
import {
  RefreshCw,
  ArrowRightLeft,
  UserCheck,
  RotateCcw,
  History,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

export const ReplacementsModule: React.FC = () => {
  const { activeOrg, addToast, setActiveTab } = useApp();
  const [activeTab, setActiveTabLocal] = useState<'active' | 'pending-returns' | 'wizard' | 'swaps' | 'history'>('active');
  const [activeReplacements, setActiveReplacements] = useState<ActiveReplacement[]>([]);
  const [pendingReturns, setPendingReturns] = useState<any[]>([]);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [swaps, setSwaps] = useState<any[]>([]);

  // Wizard state (7-step interactive replacement flow)
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [availableSlots, setAvailableSlots] = useState<TimetableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimetableSlot | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [replacementType, setReplacementType] = useState<'temporary' | 'permanent'>('temporary');
  const [replacementReason, setReplacementReason] = useState('Coverage for emergency leave');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchData = async () => {
    if (!activeOrg) return;
    try {
      const activeList = await api.getActiveReplacements(activeOrg.id);
      setActiveReplacements(activeList);

      const returnsList = await api.getPendingReturns(activeOrg.id);
      setPendingReturns(returnsList);

      const histList = await api.getReplacementHistory(activeOrg.id);
      setHistoryLogs(histList);

      const swapList = await api.getSwaps(activeOrg.id);
      setSwaps(swapList);

      // Load timetable slots for wizard
      const schedList = await api.getSchedules(activeOrg.id);
      if (schedList.length > 0) {
        const details = await api.getScheduleDetails(schedList[0].id);
        setAvailableSlots(details.slots || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeOrg]);

  // Step 2 & 3: Find qualified candidates
  const handleSelectSlotForWizard = async (slot: TimetableSlot) => {
    triggerHaptic(10);
    setSelectedSlot(slot);
    if (!slot.assignment_id || !activeOrg) return;

    try {
      setIsProcessing(true);
      const res = await api.recommendReplacement(activeOrg.id, slot.assignment_id);
      setCandidates(res.candidates || []);
      if (res.candidates && res.candidates.length > 0) {
        // Recommend best candidate by default
        const best = res.candidates.find((c: any) => c.is_available) || res.candidates[0];
        setSelectedCandidate(best);
      }
      setWizardStep(2);
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 5, 6, 7: Authorize replacement & update timetable
  const handleAuthorizeReplacement = async () => {
    if (!selectedSlot?.assignment_id || !selectedCandidate || !activeOrg) return;
    triggerHaptic(20);
    setIsProcessing(true);

    try {
      const res = await api.approveReplacement({
        org_id: activeOrg.id,
        assignment_id: selectedSlot.assignment_id,
        replacement_person_id: selectedCandidate.person_id,
        replacement_type: replacementType,
        reason: replacementReason,
      });

      addToast(
        'Replacement Applied',
        `Assigned ${selectedCandidate.person_name} as ${replacementType} replacement on timetable.`,
        'success'
      );

      // Reset wizard
      setWizardStep(1);
      setSelectedSlot(null);
      setSelectedCandidate(null);
      setActiveTabLocal('active');
      fetchData();
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Return to Work: Restore original assignment
  const handleRestore = async (logId: number) => {
    triggerHaptic(20);
    try {
      const res = await api.restoreReplacement(logId);
      if (res.success) {
        addToast('Restored', res.message, 'success');
        fetchData();
      } else {
        addToast('Conflict Detected', res.message, 'error');
      }
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  const handleApproveSwap = async (swapId: number) => {
    triggerHaptic(15);
    try {
      await api.approveSwap(swapId);
      addToast('Swap Approved', 'Shift assignments exchanged on timetable', 'success');
      fetchData();
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Module Header & Sub-Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-blue-500" />
            <span>Swaps & Replacements Lifecycle</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Full 7-step replacement flow, safe Return-to-Work restoration, and peer swap approvals.
          </p>
        </div>

        {/* Sub-Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl glass-panel border border-white/20 dark:border-white/10 self-start">
          <button
            onClick={() => setActiveTabLocal('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'active' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Active Swaps ({activeReplacements.length})
          </button>
          <button
            onClick={() => setActiveTabLocal('pending-returns')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'pending-returns' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Pending Returns ({pendingReturns.length})
          </button>
          <button
            onClick={() => setActiveTabLocal('wizard')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
              activeTab === 'wizard' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Replacement Wizard</span>
          </button>
          <button
            onClick={() => setActiveTabLocal('swaps')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'swaps' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Swap Requests ({swaps.length})
          </button>
          <button
            onClick={() => setActiveTabLocal('history')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'history' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            History & Audit
          </button>
        </div>
      </div>

      {/* Tab 1: Active Swaps & Replacements */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeReplacements.length === 0 ? (
              <div className="md:col-span-2 p-12 text-center rounded-3xl glass-panel border border-dashed border-slate-300 dark:border-slate-800">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  All Timetable Slots Filled by Original Staff
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  No active temporary or emergency replacements currently active.
                </p>
              </div>
            ) : (
              activeReplacements.map((rep) => (
                <div
                  key={rep.id}
                  className="p-5 rounded-3xl glass-panel border border-amber-500/30 dark:border-amber-500/20 shadow-md space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider border border-amber-500/30">
                      {rep.replacement_type} Replacement
                    </span>
                    <span className="text-xs text-slate-400">{rep.date_str}</span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {rep.slot_title}
                    </h3>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      <span>{rep.time_window}</span>
                    </div>
                  </div>

                  {/* Flow representation */}
                  <div className="p-3 rounded-2xl glass-pill flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Original:</span>
                      <strong className="text-slate-700 dark:text-slate-300">{rep.original_person_name}</strong>
                    </div>
                    <ArrowRightLeft className="w-4 h-4 text-amber-500 mx-2" />
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Replacement:</span>
                      <strong className="text-blue-600 dark:text-blue-400">{rep.replacement_person_name}</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500 italic">"{rep.reason}"</span>
                    {rep.can_restore && (
                      <button
                        onClick={() => handleRestore(rep.id)}
                        className="px-3.5 py-1.5 rounded-xl glass-pill hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Return to Work (Restore)</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Pending Returns (Staff returning from leave) */}
      {activeTab === 'pending-returns' && (
        <div className="space-y-4">
          <div className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Returning Staff Awaiting Timetable Reintegration
            </h3>
            <p className="text-xs text-slate-500">
              When employees confirm return to work, the system runs automated availability and overlap checks before safely restoring their original assignments.
            </p>

            <div className="divide-y divide-slate-200/40 dark:divide-slate-800/40">
              {pendingReturns.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No pending returns at this time.
                </div>
              ) : (
                pendingReturns.map((ret: any) => (
                  <div key={ret.replacement_log_id} className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-xs">
                        {ret.original_person.name} ({ret.original_person.role})
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Date: {ret.date_str} • Shift Window: {ret.time_window} • Current coverage by {ret.replacement_person.name}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRestore(ret.replacement_log_id)}
                      className="px-4 py-2 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-1.5 shadow-md"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Verify & Restore Assignment</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Interactive 7-Step Replacement Wizard */}
      {activeTab === 'wizard' && (
        <div className="p-6 md:p-8 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-6 max-w-3xl">
          {/* Wizard Header & Step Progress */}
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-500" />
                <span>7-Step Replacement Workflow</span>
              </h3>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                Step {wizardStep} of 3
              </span>
            </div>

            <div className="flex gap-2 mt-3">
              <div className={`h-1.5 flex-1 rounded-full ${wizardStep >= 1 ? 'bg-blue-600' : 'bg-slate-200'}`} />
              <div className={`h-1.5 flex-1 rounded-full ${wizardStep >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`} />
              <div className={`h-1.5 flex-1 rounded-full ${wizardStep >= 3 ? 'bg-blue-600' : 'bg-slate-200'}`} />
            </div>
          </div>

          {/* Step 1: Select Affected Slot */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Step 1: Identify Affected Timetable Slot
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choose which assignment requires replacement coverage.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                {availableSlots.map((slot) => (
                  <div
                    key={slot.slot_id}
                    onClick={() => handleSelectSlotForWizard(slot)}
                    className="p-3.5 rounded-2xl glass-card border hover:border-blue-500 cursor-pointer text-xs space-y-1.5"
                  >
                    <div className="font-bold text-slate-900 dark:text-white">{slot.title}</div>
                    <div className="text-[11px] text-slate-500">
                      {slot.start_time}-{slot.end_time} • {slot.person_name || 'Unfilled'}
                    </div>
                    <div className="text-[10px] text-blue-500 font-medium">
                      Skills: {slot.required_skills.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Rank Candidates & Explain Match */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Step 2, 3 & 4: Evaluate, Rank & Recommend Candidates
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Algorithm evaluated availability, skill match, workload balance, and qualifications.
                </p>
              </div>

              <div className="space-y-3">
                {candidates.map((cand) => {
                  const isSelected = selectedCandidate?.person_id === cand.person_id;
                  return (
                    <div
                      key={cand.person_id}
                      onClick={() => {
                        triggerHaptic(10);
                        setSelectedCandidate(cand);
                      }}
                      className={`p-4 rounded-2xl glass-card border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/5'
                          : 'border-white/30 dark:border-white/10 hover:border-blue-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-xs">
                            {cand.person_name} ({cand.role_title})
                          </div>
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                            {cand.explanations.join(' • ') || 'Available candidate'}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-base font-black text-blue-600 dark:text-blue-400">
                            {cand.match_percentage}%
                          </span>
                          <span className="text-[9px] block text-slate-400 uppercase font-semibold">
                            Match Score
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setWizardStep(1)}
                  className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold"
                >
                  Back
                </button>
                <button
                  disabled={!selectedCandidate}
                  onClick={() => setWizardStep(3)}
                  className="px-5 py-2.5 rounded-xl glass-button-primary text-xs font-semibold"
                >
                  Proceed to Authorization
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Authorize & Update Timetable */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Step 5, 6 & 7: Authorize & Update Timetable
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirm deployment of replacement on timetable with audit logging.
                </p>
              </div>

              <div className="p-4 rounded-2xl glass-pill text-xs space-y-2">
                <div>Selected Slot: <strong className="text-slate-800 dark:text-slate-200">{selectedSlot?.title}</strong></div>
                <div>Replacement Candidate: <strong className="text-blue-500">{selectedCandidate?.person_name}</strong></div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Replacement Type:</label>
                  <select
                    value={replacementType}
                    onChange={(e: any) => setReplacementType(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
                  >
                    <option value="temporary">Temporary Replacement (Reversible)</option>
                    <option value="permanent">Permanent Reassignment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Reason / Justification:</label>
                  <input
                    type="text"
                    value={replacementReason}
                    onChange={(e) => setReplacementReason(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setWizardStep(2)}
                  className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold"
                >
                  Back
                </button>
                <button
                  disabled={isProcessing}
                  onClick={handleAuthorizeReplacement}
                  className="px-6 py-2.5 rounded-xl glass-button-primary text-xs font-semibold"
                >
                  {isProcessing ? 'Updating...' : 'Authorize & Update Timetable'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Peer Swap Requests */}
      {activeTab === 'swaps' && (
        <div className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Colleague Shift Swap Requests
          </h3>
          <div className="divide-y divide-slate-200/40 dark:divide-slate-800/40">
            {swaps.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No active swap proposals.
              </div>
            ) : (
              swaps.map((s) => (
                <div key={s.id} className="py-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {s.requester_name} ↔ {s.target_name}
                    </div>
                    <div className="text-[11px] text-slate-500">"{s.reason}" • Status: {s.status}</div>
                  </div>
                  {s.status === 'pending' && (
                    <button
                      onClick={() => handleApproveSwap(s.id)}
                      className="px-3.5 py-1.5 rounded-xl glass-button-primary text-xs font-semibold"
                    >
                      Approve Swap
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Complete Replacement Audit History */}
      {activeTab === 'history' && (
        <div className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-blue-500" />
            <span>Complete Replacement Audit Trail</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/50 text-[10px] uppercase font-semibold text-slate-400">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Original Staff</th>
                  <th className="py-2.5 px-3">Replacement Staff</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Match Score</th>
                  <th className="py-2.5 px-3">Justification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/40">
                {historyLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 px-3 text-slate-400">{log.date_str}</td>
                    <td className="py-2.5 px-3 font-semibold">{log.original_person_name}</td>
                    <td className="py-2.5 px-3 font-bold text-blue-600 dark:text-blue-400">{log.replacement_person_name}</td>
                    <td className="py-2.5 px-3 capitalize">{log.replacement_type}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        log.status === 'restored' ? 'bg-slate-500/10 text-slate-500' : 'bg-amber-500/10 text-amber-600'
                      }`}>
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold">{log.match_score}%</td>
                    <td className="py-2.5 px-3 text-slate-500">{log.reason}</td>
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
