import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { LeaveRequest, Person } from '../../types';
import { triggerHaptic } from '../../utils/haptics';
import {
  Clock,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

export const AvailabilityLeaveModule: React.FC = () => {
  const { activeOrg, currentUser, addToast, setActiveTab } = useApp();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [activeTab, setActiveTabLocal] = useState<'my-availability' | 'emergency' | 'request-off' | 'management'>('my-availability');

  // Emergency Leave Form
  const [selectedPersonId, setSelectedPersonId] = useState<number>(1);
  const [emergencyStartDate, setEmergencyStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [emergencyEndDate, setEmergencyEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [emergencyReason, setEmergencyReason] = useState('Severe sudden illness / medical emergency');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Planned Day Off Form
  const [plannedStartDate, setPlannedStartDate] = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [plannedEndDate, setPlannedEndDate] = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [plannedReason, setPlannedReason] = useState('Personal family event');

  // Availability Grid (Mon-Fri)
  const [availabilityRules, setAvailabilityRules] = useState([
    { day_of_week: 0, day_name: 'Monday', is_available: true, start_time: '09:00', end_time: '17:00', preference_level: 5 },
    { day_of_week: 1, day_name: 'Tuesday', is_available: true, start_time: '09:00', end_time: '17:00', preference_level: 5 },
    { day_of_week: 2, day_name: 'Wednesday', is_available: true, start_time: '09:00', end_time: '17:00', preference_level: 4 },
    { day_of_week: 3, day_name: 'Thursday', is_available: true, start_time: '09:00', end_time: '17:00', preference_level: 5 },
    { day_of_week: 4, day_name: 'Friday', is_available: true, start_time: '09:00', end_time: '16:00', preference_level: 3 },
  ]);

  const fetchData = async () => {
    if (!activeOrg) return;
    try {
      const leaveList = await api.getLeaves(activeOrg.id);
      setLeaves(leaveList);
      const staff = await api.getPeople({ org_id: activeOrg.id });
      setPeople(staff);
      if (staff.length > 0 && !selectedPersonId) {
        setSelectedPersonId(staff[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeOrg]);

  const handleEmergencySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) return;
    triggerHaptic(25);
    setIsSubmitting(true);

    try {
      const res = await api.submitEmergencyLeave({
        org_id: activeOrg.id,
        person_id: currentUser?.person_id || selectedPersonId,
        start_date: emergencyStartDate,
        end_date: emergencyEndDate,
        reason: emergencyReason,
      });

      addToast(
        'Emergency Absence Recorded',
        `Promptly recorded. ${res.affected_count} affected assignments flagged for immediate coverage.`,
        'success'
      );

      fetchData();
      setActiveTabLocal('management');
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePlannedLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) return;
    triggerHaptic(15);
    setIsSubmitting(true);

    try {
      const res = await api.requestDayOff({
        org_id: activeOrg.id,
        person_id: currentUser?.person_id || selectedPersonId,
        leave_type: 'day_off',
        start_date: plannedStartDate,
        end_date: plannedEndDate,
        reason: plannedReason,
      });

      addToast(
        'Leave Request Submitted',
        'Submitted for manager review. (Planned leave is not auto-approved)',
        'info'
      );

      fetchData();
      setActiveTabLocal('management');
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (id: number) => {
    triggerHaptic(15);
    try {
      await api.approveLeave(id);
      addToast('Approved', 'Leave request approved', 'success');
      fetchData();
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  const handleReject = async (id: number) => {
    triggerHaptic(15);
    try {
      await api.rejectLeave(id);
      addToast('Rejected', 'Leave request rejected', 'info');
      fetchData();
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  const handleConfirmReturn = async (leaveId: number, personId: number) => {
    if (!activeOrg) return;
    triggerHaptic(20);
    try {
      const res = await api.returnToWork({
        org_id: activeOrg.id,
        leave_request_id: leaveId,
        person_id: personId,
      });
      addToast('Return to Work Confirmed', res.message, 'success');
      fetchData();
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  const handleSaveAvailability = async () => {
    triggerHaptic(15);
    try {
      const pId = currentUser?.person_id || selectedPersonId;
      await api.updateAvailabilityRules(pId, availabilityRules);
      addToast('Availability Saved', 'Regular working hours and preference levels updated', 'success');
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
            <Clock className="w-6 h-6 text-blue-500" />
            <span>Availability & Leave Management</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Self-service availability adjustments, immediate emergency leave, and manager approval queues.
          </p>
        </div>

        {/* Sub-Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl glass-panel border border-white/20 dark:border-white/10 self-start">
          <button
            onClick={() => setActiveTabLocal('my-availability')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'my-availability' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            My Availability
          </button>
          <button
            onClick={() => setActiveTabLocal('emergency')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
              activeTab === 'emergency' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-red-500'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Emergency Leave</span>
          </button>
          <button
            onClick={() => setActiveTabLocal('request-off')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'request-off' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Request Day Off
          </button>
          <button
            onClick={() => setActiveTabLocal('management')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'management' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Leave Approvals ({leaves.filter((l) => l.status === 'pending' || l.status === 'emergency_recorded').length})
          </button>
        </div>
      </div>

      {/* Tab 1: My Availability Grid */}
      {activeTab === 'my-availability' && (
        <div className="p-6 md:p-8 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-6 max-w-3xl">
          <div className="border-b border-slate-200/50 dark:border-slate-800/80 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Regular Working Hours & Preference Levels
              </h3>
              <p className="text-xs text-slate-500">
                Set preferred hours and preference weighting (1 = Strongly Avoid to 5 = Strongly Prefer).
              </p>
            </div>
            <button
              onClick={handleSaveAvailability}
              className="px-4 py-2 rounded-xl glass-button-primary text-xs font-semibold"
            >
              Save Schedule
            </button>
          </div>

          <div className="space-y-3">
            {availabilityRules.map((rule, idx) => (
              <div
                key={rule.day_of_week}
                className="p-3.5 rounded-2xl glass-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={rule.is_available}
                    onChange={(e) => {
                      const updated = [...availabilityRules];
                      updated[idx].is_available = e.target.checked;
                      setAvailabilityRules(updated);
                    }}
                    className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                  />
                  <span className="font-bold text-slate-900 dark:text-white w-24">
                    {rule.day_name}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    disabled={!rule.is_available}
                    value={rule.start_time}
                    onChange={(e) => {
                      const updated = [...availabilityRules];
                      updated[idx].start_time = e.target.value;
                      setAvailabilityRules(updated);
                    }}
                    className="px-2 py-1 rounded-lg glass-input text-xs disabled:opacity-40"
                  />
                  <span className="text-slate-400">to</span>
                  <input
                    type="time"
                    disabled={!rule.is_available}
                    value={rule.end_time}
                    onChange={(e) => {
                      const updated = [...availabilityRules];
                      updated[idx].end_time = e.target.value;
                      setAvailabilityRules(updated);
                    }}
                    className="px-2 py-1 rounded-lg glass-input text-xs disabled:opacity-40"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Preference:</span>
                  <select
                    disabled={!rule.is_available}
                    value={rule.preference_level}
                    onChange={(e) => {
                      const updated = [...availabilityRules];
                      updated[idx].preference_level = Number(e.target.value);
                      setAvailabilityRules(updated);
                    }}
                    className="px-2 py-1 rounded-lg glass-input text-xs disabled:opacity-40"
                  >
                    <option value="5">5 - Strongly Prefer</option>
                    <option value="4">4 - Prefer</option>
                    <option value="3">3 - Neutral</option>
                    <option value="2">2 - Dislike</option>
                    <option value="1">1 - Avoid</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Emergency Leave Form */}
      {activeTab === 'emergency' && (
        <form onSubmit={handleEmergencySubmit} className="p-6 md:p-8 rounded-3xl glass-panel border border-red-500/30 dark:border-red-500/20 space-y-6 max-w-2xl bg-red-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/20 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-red-950 dark:text-red-200">
                File Emergency Leave / Sudden Absence
              </h3>
              <p className="text-xs text-red-800/80 dark:text-red-300/80">
                Unavailability is recorded immediately. The system identifies affected timetable slots and initiates replacement search.
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            {currentUser?.role !== 'employee' && (
              <div>
                <label className="block font-semibold mb-1">Staff Member Filing Emergency Leave:</label>
                <select
                  value={selectedPersonId}
                  onChange={(e) => setSelectedPersonId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.role_title})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Start Date:</label>
                <input
                  type="date"
                  required
                  value={emergencyStartDate}
                  onChange={(e) => setEmergencyStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">End Date:</label>
                <input
                  type="date"
                  required
                  value={emergencyEndDate}
                  onChange={(e) => setEmergencyEndDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">Reason / Nature of Emergency:</label>
              <textarea
                required
                rows={3}
                value={emergencyReason}
                onChange={(e) => setEmergencyReason(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-lg shadow-red-500/20"
          >
            {isSubmitting ? 'Recording Emergency...' : 'Submit Emergency Absence'}
          </button>
        </form>
      )}

      {/* Tab 3: Request Day Off (Planned) */}
      {activeTab === 'request-off' && (
        <form onSubmit={handlePlannedLeaveSubmit} className="p-6 md:p-8 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-6 max-w-2xl">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Request a Planned Day Off
            </h3>
            <p className="text-xs text-slate-500">
              Planned leaves require manager approval and are strictly held in pending status until reviewed.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            {currentUser?.role !== 'employee' && (
              <div>
                <label className="block font-semibold mb-1">Staff Member:</label>
                <select
                  value={selectedPersonId}
                  onChange={(e) => setSelectedPersonId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.role_title})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Start Date:</label>
                <input
                  type="date"
                  required
                  value={plannedStartDate}
                  onChange={(e) => setPlannedStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">End Date:</label>
                <input
                  type="date"
                  required
                  value={plannedEndDate}
                  onChange={(e) => setPlannedEndDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">Reason:</label>
              <textarea
                required
                rows={3}
                value={plannedReason}
                onChange={(e) => setPlannedReason(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl glass-button-primary text-xs font-bold"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Planned Leave for Approval'}
          </button>
        </form>
      )}

      {/* Tab 4: Manager Leave Approvals & Return to Work */}
      {activeTab === 'management' && (
        <div className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Leave Requests & Absence Registry
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/50 text-[10px] uppercase font-semibold text-slate-400">
                  <th className="py-2.5 px-3">Staff</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Date Window</th>
                  <th className="py-2.5 px-3">Affected Slots</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/40">
                {leaves.map((l) => (
                  <tr key={l.id}>
                    <td className="py-3 px-3 font-bold">{l.person_name}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        l.leave_type === 'emergency' ? 'bg-red-500/10 text-red-600' : 'bg-blue-500/10 text-blue-600'
                      }`}>
                        {l.leave_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500">{l.start_date} to {l.end_date}</td>
                    <td className="py-3 px-3 font-semibold text-amber-500">{l.affected_slots_count} slots</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        l.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600' :
                        l.status === 'emergency_recorded' ? 'bg-red-500/10 text-red-600' :
                        l.status === 'rejected' ? 'bg-slate-500/10 text-slate-500' : 'bg-amber-500/10 text-amber-600'
                      }`}>
                        {l.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500 max-w-xs truncate">{l.reason}</td>
                    <td className="py-3 px-3 text-right space-x-1.5">
                      {l.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(l.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(l.id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 font-semibold text-slate-700 dark:text-slate-200"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {(l.status === 'approved' || l.status === 'emergency_recorded') && !l.return_confirmed && (
                        <button
                          onClick={() => handleConfirmReturn(l.id, l.person_id)}
                          className="px-2.5 py-1 rounded-lg glass-pill text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/30"
                        >
                          Confirm Return to Work
                        </button>
                      )}
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
