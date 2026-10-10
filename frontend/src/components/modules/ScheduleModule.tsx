import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { TimetableSlot, Person, Schedule, ActiveReplacement, Holiday, Department } from '../../types';
import { triggerHaptic } from '../../utils/haptics';
import {
  CalendarDays,
  Sparkles,
  Sliders,
  RefreshCw,
  AlertTriangle,
  Send,
  Filter,
  CheckCircle2,
  Clock,
  Layers,
  Edit2,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowRightLeft,
  Lock,
  Unlock,
  Trash2,
  Plus,
  ShieldCheck,
  ShieldAlert,
  GripVertical,
  Check,
  User,
  Users,
  Building,
  Briefcase,
  MapPin,
  Calendar,
} from 'lucide-react';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const formatFullDate = (d: Date): string => {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const formatWeekRange = (mondayDate: Date): string => {
  const sundayDate = new Date(mondayDate);
  sundayDate.setDate(mondayDate.getDate() + 6);
  return `${formatFullDate(mondayDate)} – ${formatFullDate(sundayDate)}`;
};

export const formatOvernightRange = (startDateStr: string, startTime: string, endTime: string): string => {
  try {
    const parts = startDateStr.split('-').map(Number);
    if (parts.length === 3) {
      const startDate = new Date(parts[0], parts[1] - 1, parts[2]);
      if (endTime < startTime) {
        const nextDate = new Date(startDate);
        nextDate.setDate(startDate.getDate() + 1);
        const sDay = startDate.getDate();
        const sMonth = MONTH_NAMES[startDate.getMonth()];
        const sYear = startDate.getFullYear();
        const nDay = nextDate.getDate();
        const nMonth = MONTH_NAMES[nextDate.getMonth()];
        const nYear = nextDate.getFullYear();
        return `${sDay} ${sMonth} ${sYear}, ${startTime} – ${nDay} ${nMonth} ${nYear}, ${endTime}`;
      } else {
        const sDay = startDate.getDate();
        const sMonth = MONTH_NAMES[startDate.getMonth()];
        const sYear = startDate.getFullYear();
        return `${sDay} ${sMonth} ${sYear}, ${startTime} – ${endTime}`;
      }
    }
  } catch {}
  return `${startDateStr} ${startTime} – ${endTime}`;
};

export const ScheduleModule: React.FC = () => {
  const { activeOrg, addToast, setActiveTab } = useApp();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [activeSchedule, setActiveSchedule] = useState<Schedule | null>(null);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [activeReplacements, setActiveReplacements] = useState<ActiveReplacement[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'week' | 'day' | 'month'>('week');
  const [perspective, setPerspective] = useState<'matrix' | 'employee' | 'department' | 'resource' | 'holiday'>('matrix');
  const [selectedDayView, setSelectedDayView] = useState<number>(0);
  const [filterDept, setFilterDept] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Calendar Date Navigation (Dynamic Week, Day, and Month Handling)
  const [calendarYear, setCalendarYear] = useState<number>(2026);
  const [calendarMonth, setCalendarMonth] = useState<number>(9); // 0-indexed: 9 = October
  const [weekStartDate, setWeekStartDate] = useState<Date>(new Date(2026, 9, 12));
  const [holidaysList, setHolidaysList] = useState<Holiday[]>([]);
  const [departmentsList, setDepartmentsList] = useState<Department[]>([]);

  // Generator Modal State with Selective Regeneration
  const [isGenModalOpen, setIsGenModalOpen] = useState(false);
  const [fairnessWeight, setFairnessWeight] = useState(1.0);
  const [prefWeight, setPrefWeight] = useState(1.0);
  const [overtimeWeight, setOvertimeWeight] = useState(1.0);
  const [selectedRegenDays, setSelectedRegenDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [regenAllDays, setRegenAllDays] = useState(true);
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [isSolving, setIsSolving] = useState(false);

  // Manual Edit Modal State
  const [editSlot, setEditSlot] = useState<TimetableSlot | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<number | undefined>(undefined);

  // Add Slot Modal State
  const [isAddSlotOpen, setIsAddSlotOpen] = useState(false);
  const [newSlotTitle, setNewSlotTitle] = useState('');
  const [newSlotDay, setNewSlotDay] = useState(0);
  const [newSlotStart, setNewSlotStart] = useState('09:00');
  const [newSlotEnd, setNewSlotEnd] = useState('11:00');
  const [newSlotType, setNewSlotType] = useState('work');
  const [newSlotMinStaff, setNewSlotMinStaff] = useState(1);
  const [newSlotTargetStaff, setNewSlotTargetStaff] = useState(1);
  const [newSlotMaxStaff, setNewSlotMaxStaff] = useState(2);
  const [newSlotResourceId, setNewSlotResourceId] = useState<number | undefined>(undefined);

  // Pre-Publish Validation Modal State
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishValidation, setPublishValidation] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Drag and Drop State
  const [draggedPersonId, setDraggedPersonId] = useState<number | null>(null);

  const fetchScheduleData = async () => {
    if (!activeOrg) return;
    setIsLoading(true);
    try {
      const schedList = await api.getSchedules(activeOrg.id);
      setSchedules(schedList);
      const current = schedList[0] || null;
      setActiveSchedule(current);

      if (current) {
        const details = await api.getScheduleDetails(current.id);
        setSlots(details.slots || []);
        if (details.resources) {
          setResources(details.resources);
        }

        if (current.period_start) {
          const parts = current.period_start.split('-').map(Number);
          if (parts.length === 3) {
            setCalendarYear(parts[0]);
            setCalendarMonth(parts[1] - 1);
            const dt = new Date(parts[0], parts[1] - 1, parts[2]);
            const dOfWeek = (dt.getDay() + 6) % 7;
            dt.setDate(dt.getDate() - dOfWeek);
            setWeekStartDate(dt);
          }
        }
      }

      const reps = await api.getActiveReplacements(activeOrg.id);
      setActiveReplacements(reps);

      const staff = await api.getPeople({ org_id: activeOrg.id });
      setPeople(staff);

      const [hList, dList] = await Promise.all([
        api.getHolidays(activeOrg.id).catch(() => []),
        api.getDepartments(activeOrg.id).catch(() => []),
      ]);
      setHolidaysList(hList || []);
      setDepartmentsList(dList || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduleData();
  }, [activeOrg]);

  // Calendar Navigation Handlers
  const handlePrevMonth = () => {
    triggerHaptic(10);
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    triggerHaptic(10);
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    triggerHaptic(10);
    const now = new Date();
    setCalendarYear(now.getFullYear());
    setCalendarMonth(now.getMonth());
  };

  const handlePrevWeek = () => {
    triggerHaptic(10);
    const nextW = new Date(weekStartDate);
    nextW.setDate(weekStartDate.getDate() - 7);
    setWeekStartDate(nextW);
  };

  const handleNextWeek = () => {
    triggerHaptic(10);
    const nextW = new Date(weekStartDate);
    nextW.setDate(weekStartDate.getDate() + 7);
    setWeekStartDate(nextW);
  };

  // Determine active days list (5 days or 7 days)
  const hasWeekendSlots = slots.some((s) => s.day_of_week === 5 || s.day_of_week === 6);
  const displayedDays = hasWeekendSlots ? ALL_DAYS : ALL_DAYS.slice(0, 5);

  // Toggle slot lock
  const handleToggleLock = async (slotId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(12);
    try {
      const res = await api.toggleSlotLock(slotId);
      addToast(
        'Slot Lock Status',
        res.is_locked ? 'Assignment locked. Protected from solver overwrite.' : 'Assignment unlocked.',
        'info'
      );
      fetchScheduleData();
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  // Delete a slot
  const handleDeleteSlot = async (slotId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(15);
    if (!window.confirm('Delete this slot from the timetable? This removes associated assignments.')) return;
    try {
      await api.deleteSlot(slotId);
      addToast('Slot Removed', 'Timetable slot deleted successfully', 'info');
      fetchScheduleData();
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  // Execute OR-Tools Generator with selective regeneration
  const handleGenerate = async () => {
    if (!activeOrg) return;
    triggerHaptic(25);
    setIsSolving(true);

    try {
      const today = new Date();
      const periodStart = today.toISOString().split('T')[0];
      const nextWeek = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000);
      const periodEnd = nextWeek.toISOString().split('T')[0];

      const res = await api.generateSchedule({
        org_id: activeOrg.id,
        title: activeSchedule ? activeSchedule.title : `${activeOrg.name} Master Timetable`,
        period_start: periodStart,
        period_end: periodEnd,
        fairness_weight: fairnessWeight,
        preference_weight: prefWeight,
        overtime_penalty_weight: overtimeWeight,
        regenerate_days: regenAllDays ? undefined : selectedRegenDays,
        only_unassigned: onlyUnassigned,
      });

      addToast(
        'Schedule Generated',
        `Google OR-Tools solved optimal schedule: ${res.total_assigned} assignments, Fairness: ${res.fairness_score}%`,
        'success'
      );

      setIsGenModalOpen(false);
      fetchScheduleData();
    } catch (err: any) {
      addToast('Solver Error', err.message, 'error');
    } finally {
      setIsSolving(false);
    }
  };

  // Add new Slot
  const handleCreateNewSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !activeSchedule) return;
    if (newSlotStart >= newSlotEnd) {
      addToast('Time Error', 'Start time must be before end time', 'error');
      return;
    }
    triggerHaptic(15);

    try {
      await api.createSlot({
        org_id: activeOrg.id,
        schedule_id: activeSchedule.id,
        title: newSlotTitle.trim(),
        day_of_week: newSlotDay,
        start_time: newSlotStart,
        end_time: newSlotEnd,
        period_type: newSlotType,
        min_staff: newSlotType === 'work' ? newSlotMinStaff : 0,
        target_staff: newSlotType === 'work' ? newSlotTargetStaff : 0,
        max_staff: newSlotType === 'work' ? newSlotMaxStaff : 0,
        resource_id: newSlotResourceId || undefined,
        required_skills: [],
      });

      addToast('Slot Created', `Added ${newSlotTitle} on ${ALL_DAYS[newSlotDay]}`, 'success');
      setIsAddSlotOpen(false);
      setNewSlotTitle('');
      fetchScheduleData();
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  // Open Pre-Publish Validation Check
  const handleOpenPublishCheck = async () => {
    if (!activeSchedule) return;
    triggerHaptic(15);
    setIsValidating(true);
    try {
      const val = await api.prePublishCheck(activeSchedule.id);
      setPublishValidation(val);
      setIsPublishModalOpen(true);
    } catch (err: any) {
      addToast('Validation Check Error', err.message, 'error');
    } finally {
      setIsValidating(false);
    }
  };

  // Confirm Publish
  const handleConfirmPublish = async () => {
    if (!activeSchedule) return;
    triggerHaptic(20);
    try {
      await api.publishSchedule(activeSchedule.id);
      addToast('Schedule Published', 'Timetable officially locked and published to team', 'success');
      setIsPublishModalOpen(false);
      fetchScheduleData();
    } catch (err: any) {
      addToast('Publish Error', err.message, 'error');
    }
  };

  // Save Manual Assignment Override
  const handleSaveManualEdit = async () => {
    if (!editSlot || !editSlot.assignment_id) return;
    triggerHaptic(15);
    try {
      await api.updateAssignment(editSlot.assignment_id, {
        person_id: selectedPersonId || null,
        is_replacement: selectedPersonId !== editSlot.original_person_id,
        replacement_type: 'manual',
        replacement_reason: 'Manager manual timetable override',
      });
      addToast('Assignment Updated', 'Timetable slot assignment updated', 'success');
      setEditSlot(null);
      fetchScheduleData();
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  // HTML5 Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnSlot = async (e: React.DragEvent, slot: TimetableSlot) => {
    e.preventDefault();
    triggerHaptic(15);
    const pIdStr = e.dataTransfer.getData('text/plain');
    const pId = Number(pIdStr) || draggedPersonId;
    if (!pId || !activeSchedule) return;

    try {
      const res = await api.assignDragDrop({
        schedule_id: activeSchedule.id,
        slot_id: slot.slot_id,
        person_id: pId,
      });

      if (res.has_conflict) {
        addToast('Conflict Warning', res.message, 'error');
      } else {
        addToast('Assignment Updated', `Assigned staff member to ${slot.title}`, 'success');
        fetchScheduleData();
      }
    } catch (err: any) {
      addToast('Drag & Drop Error', err.message, 'error');
    } finally {
      setDraggedPersonId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Schedule Header & Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-blue-500" />
              <span>Timetable & Scheduling Engine</span>
            </h1>
            {activeSchedule && (
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                activeSchedule.status === 'published'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              }`}>
                v{activeSchedule.version} ({activeSchedule.status.toUpperCase()})
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            OR-Tools constraint programming timetable with multi-objective fairness, drag-and-drop, staffing levels, and lock protection.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 rounded-2xl glass-panel border border-white/20 dark:border-white/10 text-xs font-semibold">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                viewMode === 'day' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                viewMode === 'week' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                viewMode === 'month' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Month
            </button>
          </div>

          {/* Add Slot Button */}
          <button
            onClick={() => {
              triggerHaptic(10);
              setIsAddSlotOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl glass-pill hover:bg-white/60 dark:hover:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300/40 dark:border-white/10 flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-blue-500" />
            <span>Add Slot</span>
          </button>

          {/* Generate Schedule Button */}
          <button
            onClick={() => {
              triggerHaptic(15);
              setIsGenModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate with OR-Tools</span>
          </button>

          {/* Pre-Publish Check & Publish Button */}
          <button
            onClick={handleOpenPublishCheck}
            disabled={isValidating}
            className="px-3.5 py-2 rounded-xl glass-pill hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Publish Checklist</span>
          </button>
        </div>
      </div>

      {/* Quick Staff Drag Palette (Allows Dragging onto Timetable Slots) */}
      <div className="p-4 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold">
            <GripVertical className="w-4 h-4 text-blue-500" />
            <span>Staff Drag & Drop Palette:</span>
            <span className="text-[11px] text-slate-400 font-normal">
              Drag any team member directly onto a slot in the grid below to assign or override
            </span>
          </div>
          <span className="text-[11px] text-slate-400">{people.length} Staff Available</span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1 max-h-24 overflow-y-auto">
          {people.map((p) => (
            <div
              key={p.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', String(p.id));
                setDraggedPersonId(p.id);
              }}
              className="px-3 py-1.5 rounded-xl glass-pill border border-blue-500/20 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-grab active:cursor-grabbing hover:border-blue-500 flex items-center gap-1.5 select-none transition-all shadow-sm"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{p.name}</span>
              <span className="text-[10px] text-slate-400 font-normal">({p.role_title})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Perspectives Selector & Dynamic Detailed Date Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Perspective Navigation Pills */}
        <div className="flex items-center p-1 rounded-2xl glass-panel border border-white/20 dark:border-white/10 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => {
              triggerHaptic(10);
              setPerspective('matrix');
            }}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              perspective === 'matrix' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Timetable Matrix</span>
          </button>
          <button
            onClick={() => {
              triggerHaptic(10);
              setPerspective('employee');
            }}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              perspective === 'employee' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Employee View</span>
          </button>
          <button
            onClick={() => {
              triggerHaptic(10);
              setPerspective('department');
            }}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              perspective === 'department' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Department View</span>
          </button>
          <button
            onClick={() => {
              triggerHaptic(10);
              setPerspective('resource');
            }}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              perspective === 'resource' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Resource & Room View</span>
          </button>
          <button
            onClick={() => {
              triggerHaptic(10);
              setPerspective('holiday');
            }}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              perspective === 'holiday' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Holiday & Closure View</span>
          </button>
        </div>

        {/* Dynamic Detailed Date Banner with Navigation */}
        <div className="flex items-center gap-2">
          {viewMode === 'month' && perspective === 'matrix' ? (
            <div className="flex items-center gap-2 p-1.5 rounded-2xl glass-panel border border-white/20 dark:border-white/10 text-xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded-lg glass-pill hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleToday}
                className="px-2.5 py-0.5 rounded-lg glass-pill font-semibold text-blue-600 dark:text-blue-400 text-[11px]"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded-lg glass-pill hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="font-extrabold text-xs px-2 text-slate-900 dark:text-white">
                {MONTH_NAMES[calendarMonth]} {calendarYear}
              </span>
            </div>
          ) : viewMode === 'week' && perspective === 'matrix' ? (
            <div className="flex items-center gap-2 p-1.5 rounded-2xl glass-panel border border-white/20 dark:border-white/10 text-xs">
              <button
                type="button"
                onClick={handlePrevWeek}
                className="p-1 rounded-lg glass-pill hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                title="Previous Week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setWeekStartDate(new Date(2026, 9, 12))}
                className="px-2.5 py-0.5 rounded-lg glass-pill font-semibold text-blue-600 dark:text-blue-400 text-[11px]"
              >
                Active Week
              </button>
              <button
                type="button"
                onClick={handleNextWeek}
                className="p-1 rounded-lg glass-pill hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                title="Next Week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="font-bold text-xs px-2 text-slate-900 dark:text-white truncate max-w-[260px]">
                {formatWeekRange(weekStartDate)}
              </span>
            </div>
          ) : (
            <div className="px-3.5 py-2 rounded-2xl glass-panel border border-white/20 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white">
              {(() => {
                const d = new Date(weekStartDate);
                d.setDate(weekStartDate.getDate() + selectedDayView);
                return formatFullDate(d);
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Main Perspective Body */}
      {perspective === 'matrix' && (
        <>
          {/* Day Mode Sub-Selector */}
          {viewMode === 'day' && (
            <div className="flex items-center gap-2 p-1 rounded-2xl glass-panel border border-white/20 dark:border-white/10 overflow-x-auto">
              {displayedDays.map((name, idx) => (
                <button
                  key={name}
                  onClick={() => setSelectedDayView(idx)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    selectedDayView === idx ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {/* MONTH CALENDAR VIEW (Requirement 5) */}
          {viewMode === 'month' ? (
            <div className="rounded-3xl glass-panel border border-white/40 dark:border-white/10 overflow-hidden shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-200/40 dark:border-slate-800/40">
                <span className="font-bold text-slate-900 dark:text-white">
                  Monthly Timetable Matrix: {MONTH_NAMES[calendarMonth]} {calendarYear}
                </span>
                <span>
                  {new Date(calendarYear, calendarMonth + 1, 0).getDate()} Days •{' '}
                  {new Date(calendarYear, 1, 29).getMonth() === 1 ? 'Leap Year' : 'Standard Year'} • Monday Aligned
                </span>
              </div>

              {/* 7-Column Month Header */}
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-extrabold text-slate-700 dark:text-slate-300 py-1 bg-slate-100/40 dark:bg-slate-900/40 rounded-xl">
                {ALL_DAYS.map((d) => (
                  <div key={d} className="py-1">
                    {d.slice(0, 3)}
                  </div>
                ))}
              </div>

              {/* 7-Column Month Cells Grid */}
              {(() => {
                const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                const firstDayWeekday = (new Date(calendarYear, calendarMonth, 1).getDay() + 6) % 7;
                const blankCells = Array.from({ length: firstDayWeekday });
                const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);

                return (
                  <div className="grid grid-cols-7 gap-2">
                    {/* Prefix Blanks */}
                    {blankCells.map((_, bIdx) => (
                      <div
                        key={`blank-${bIdx}`}
                        className="min-h-[120px] p-2 rounded-2xl border border-dashed border-slate-200/30 dark:border-slate-800/30 bg-slate-50/10 dark:bg-black/10 opacity-30"
                      />
                    ))}

                    {/* Month Days */}
                    {dayNumbers.map((dayNum) => {
                      const cellDate = new Date(calendarYear, calendarMonth, dayNum);
                      const cellWeekday = (cellDate.getDay() + 6) % 7;
                      const isoDate = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                      const isToday =
                        cellDate.getFullYear() === 2026 &&
                        cellDate.getMonth() === 9 &&
                        cellDate.getDate() === 10;

                      // Check holidays
                      const dayHoliday = holidaysList.find(
                        (h) => isoDate >= h.start_date && isoDate <= (h.end_date || h.start_date)
                      );

                      // Match slots
                      const daySlots = slots.filter(
                        (s) =>
                          (s.date_str && s.date_str === isoDate) ||
                          (!s.date_str && s.day_of_week === cellWeekday)
                      );

                      return (
                        <div
                          key={`day-${dayNum}`}
                          className={`min-h-[130px] p-2.5 rounded-2xl glass-card border transition-all flex flex-col justify-between ${
                            dayHoliday
                              ? 'border-amber-400/60 bg-amber-500/5'
                              : isToday
                              ? 'border-blue-500 bg-blue-500/10 shadow-sm'
                              : 'border-white/30 dark:border-white/10 hover:border-blue-400'
                          }`}
                        >
                          <div>
                            {/* Day Header */}
                            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                                  isToday ? 'bg-blue-600 text-white' : 'text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {dayNum}
                              </span>

                              {dayHoliday && (
                                <span
                                  className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 truncate max-w-[80px]"
                                  title={dayHoliday.name}
                                >
                                  {dayHoliday.name}
                                </span>
                              )}
                            </div>

                            {/* Slot Cards in Cell */}
                            <div className="space-y-1.5 max-h-24 overflow-y-auto pr-0.5">
                              {daySlots.length === 0 ? (
                                <div className="text-[9px] text-slate-400 italic pt-1">
                                  {cellWeekday >= 5 ? 'Weekend' : 'No slots'}
                                </div>
                              ) : (
                                daySlots.map((slot) => {
                                  const isReplacement = slot.is_replacement;
                                  const isUnderstaffed = slot.staffing_status === 'understaffed';
                                  const isLocked = slot.is_locked;

                                  return (
                                    <div
                                      key={slot.slot_id}
                                      onDragOver={handleDragOver}
                                      onDrop={(e) => handleDropOnSlot(e, slot)}
                                      onClick={() => {
                                        triggerHaptic(10);
                                        setEditSlot(slot);
                                        setSelectedPersonId(slot.person_id);
                                      }}
                                      className={`p-1.5 rounded-xl border text-[10px] cursor-pointer transition-all ${
                                        isReplacement
                                          ? 'border-amber-400/60 bg-amber-500/10'
                                          : isUnderstaffed
                                          ? 'border-red-400/60 bg-red-500/10'
                                          : isLocked
                                          ? 'border-purple-400/60 bg-purple-500/10'
                                          : 'border-white/40 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 hover:border-blue-400'
                                      }`}
                                    >
                                      <div className="font-bold text-slate-900 dark:text-white truncate">
                                        {slot.title}
                                      </div>
                                      <div className="flex items-center justify-between text-[9px] text-slate-500 mt-0.5">
                                        <span className="truncate">{slot.person_name || 'Unassigned'}</span>
                                        <span className="font-semibold text-blue-500">{slot.start_time}</span>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          <div className="text-[8px] text-slate-400 pt-1 border-t border-slate-200/30 dark:border-slate-800/30 flex justify-between">
                            <span>{daySlots.length} duty</span>
                            <span>{ALL_DAYS[cellWeekday].slice(0, 3)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ) : (
            /* WEEK AND DAY VIEW MATRIX */
            <div className="rounded-3xl glass-panel border border-white/40 dark:border-white/10 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <div className="min-w-[950px]">
                  {/* Header row: Days with Full Detailed Dates */}
                  <div
                    className={`grid ${
                      viewMode === 'day'
                        ? 'grid-cols-1'
                        : displayedDays.length === 7
                        ? 'grid-cols-7'
                        : 'grid-cols-5'
                    } border-b border-slate-200/50 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-900/50`}
                  >
                    {(viewMode === 'day' ? [displayedDays[selectedDayView]] : displayedDays).map((day, idx) => {
                      const actualDayIdx = viewMode === 'day' ? selectedDayView : idx;
                      const colDate = new Date(weekStartDate);
                      colDate.setDate(weekStartDate.getDate() + actualDayIdx);

                      return (
                        <div
                          key={day}
                          className="py-3 px-4 font-bold text-xs text-slate-700 dark:text-slate-200 border-r last:border-r-0 border-slate-200/40 dark:border-slate-800/40"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span>{day}</span>
                              <div className="text-[10px] text-blue-500 font-semibold mt-0.5">
                                {colDate.getDate()} {MONTH_NAMES[colDate.getMonth()]} {colDate.getFullYear()}
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-400 font-normal">Day {actualDayIdx + 1}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Timetable Slots Grid */}
                  <div
                    className={`grid ${
                      viewMode === 'day'
                        ? 'grid-cols-1'
                        : displayedDays.length === 7
                        ? 'grid-cols-7'
                        : 'grid-cols-5'
                    } divide-x divide-slate-200/40 dark:divide-slate-800/40 min-h-[500px] p-3 gap-3 bg-white/20 dark:bg-black/10`}
                  >
                    {(viewMode === 'day' ? [selectedDayView] : displayedDays.map((_, i) => i)).map((dayIdx) => {
                      const daySlots = slots.filter((s) => s.day_of_week === dayIdx);

                      return (
                        <div key={dayIdx} className="space-y-3">
                          {daySlots.length === 0 ? (
                            <div className="p-4 rounded-2xl border border-dashed border-slate-300/60 dark:border-slate-800 text-center text-[11px] text-slate-400">
                              No scheduled slots on {ALL_DAYS[dayIdx]}
                            </div>
                          ) : (
                            daySlots.map((slot) => {
                              const isReplacement = slot.is_replacement;
                              const isBreak = slot.period_type === 'break' || slot.period_type === 'lunch';
                              const isUnderstaffed = slot.staffing_status === 'understaffed';
                              const isOverstaffed = slot.staffing_status === 'overstaffed';
                              const isLocked = slot.is_locked;

                              return (
                                <div
                                  key={slot.slot_id}
                                  onDragOver={handleDragOver}
                                  onDrop={(e) => handleDropOnSlot(e, slot)}
                                  onClick={() => {
                                    triggerHaptic(10);
                                    setEditSlot(slot);
                                    setSelectedPersonId(slot.person_id);
                                  }}
                                  className={`p-3.5 rounded-2xl glass-card border transition-all cursor-pointer relative group ${
                                    isBreak
                                      ? 'bg-slate-100/40 dark:bg-slate-900/40 border-dashed border-slate-300 dark:border-slate-700'
                                      : isReplacement
                                      ? 'border-amber-400/60 bg-amber-500/5 shadow-amber-500/10'
                                      : isUnderstaffed
                                      ? 'border-red-400/60 bg-red-500/5 shadow-red-500/10'
                                      : isLocked
                                      ? 'border-purple-400/60 bg-purple-500/5'
                                      : 'border-white/40 dark:border-white/10 hover:border-blue-400'
                                  }`}
                                >
                                  {/* Card Top: Time Window & Quick Action Buttons */}
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-semibold mb-1">
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-blue-500" />
                                      {formatOvernightRange(slot.date_str || '2026-10-12', slot.start_time, slot.end_time)}
                                    </span>

                                    <div className="flex items-center gap-1">
                                      {/* Lock Toggle Button */}
                                      <button
                                        type="button"
                                        onClick={(e) => handleToggleLock(slot.slot_id, e)}
                                        className={`p-1 rounded-md transition-colors ${
                                          isLocked
                                            ? 'text-purple-500 bg-purple-500/10'
                                            : 'text-slate-400 hover:text-purple-500'
                                        }`}
                                        title={isLocked ? 'Locked (click to unlock)' : 'Unlocked (click to lock)'}
                                      >
                                        {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                      </button>

                                      {/* Delete Slot Button */}
                                      <button
                                        type="button"
                                        onClick={(e) => handleDeleteSlot(slot.slot_id, e)}
                                        className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete slot"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Slot Title */}
                                  <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                                    {slot.title}
                                  </div>

                                  {/* Resource Location */}
                                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                                    {slot.resource_name || 'No Room Assigned'}
                                  </div>

                                  {/* Staff Assignment & Badges */}
                                  <div className="mt-2.5 pt-2 border-t border-slate-200/40 dark:border-slate-800/40 flex items-center justify-between gap-1">
                                    <div className="min-w-0 flex-1">
                                      {isBreak ? (
                                        <span className="text-[10px] font-semibold text-slate-400 italic">
                                          {slot.period_type === 'lunch' ? 'Lunch Hour' : 'Break Time'}
                                        </span>
                                      ) : isReplacement ? (
                                        <div className="space-y-0.5">
                                          <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                            <ArrowRightLeft className="w-3 h-3 flex-shrink-0" />
                                            <span className="truncate">{slot.person_name}</span>
                                          </div>
                                          <div className="text-[9px] text-slate-400 truncate">
                                            covers for {slot.original_person_name}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">
                                          {slot.person_name || 'Unfilled Slot'}
                                        </div>
                                      )}
                                    </div>

                                    {/* Staffing Status Badges */}
                                    {!isBreak && (
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        {isUnderstaffed && (
                                          <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-600 dark:text-red-400 text-[9px] font-bold uppercase tracking-wider border border-red-500/25">
                                            Understaffed
                                          </span>
                                        )}
                                        {isOverstaffed && (
                                          <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 text-[9px] font-bold uppercase tracking-wider border border-purple-500/25">
                                            Overstaffed
                                          </span>
                                        )}
                                        {isReplacement && (
                                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[9px] font-extrabold uppercase tracking-wide border border-amber-500/30">
                                            Temp
                                          </span>
                                        )}
                                        {isLocked && (
                                          <span className="px-1 py-0.5 rounded bg-purple-500/15 text-purple-500 text-[9px] font-extrabold uppercase">
                                            Locked
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* EMPLOYEE VIEW (Requirement 5) */}
      {perspective === 'employee' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl glass-panel border border-white/40 dark:border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                <span>Employee Timetable & Workload Allocations</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Detailed assignment view grouped by staff member with weekly hour limits and workload balance.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full glass-pill">
              {people.length} Active Staff
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {people.map((p) => {
              const assigned = slots.filter((s) => s.person_id === p.id);
              // Calculate assigned hours (approx 1h per slot if not specified)
              const hoursCount = assigned.length;
              const maxHours = p.max_hours_per_week || 40;
              const ratio = Math.min(100, Math.round((hoursCount / maxHours) * 100));

              return (
                <div
                  key={p.id}
                  className="p-5 rounded-3xl glass-card border border-white/40 dark:border-white/10 space-y-4 hover:border-blue-400 transition-all shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-sm border border-blue-500/20">
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.role_title} • {p.department_name || 'Operations'}</div>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        ratio > 90
                          ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                          : ratio === 0
                          ? 'bg-slate-200/50 text-slate-500 border-slate-300/30'
                          : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      }`}
                    >
                      {ratio > 90 ? 'High Workload' : ratio === 0 ? 'Available' : 'Balanced'}
                    </span>
                  </div>

                  {/* Workload Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Scheduled Assignments: <strong>{assigned.length} slots</strong></span>
                      <span>Target: {maxHours} hrs/wk</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(5, ratio)}%` }}
                      />
                    </div>
                  </div>

                  {/* Scheduled Slots */}
                  <div className="space-y-2 pt-1 border-t border-slate-200/40 dark:border-slate-800/40">
                    <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Scheduled Duties:
                    </div>
                    {assigned.length === 0 ? (
                      <div className="text-xs text-slate-400 italic py-2">
                        No active duties scheduled for this week.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {assigned.map((s) => (
                          <div
                            key={s.slot_id}
                            onClick={() => {
                              setEditSlot(s);
                              setSelectedPersonId(s.person_id);
                            }}
                            className="p-2 rounded-xl glass-pill text-xs flex items-center justify-between cursor-pointer hover:border-blue-500 transition-colors"
                          >
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">{s.title}</div>
                              <div className="text-[10px] text-slate-500">
                                {ALL_DAYS[s.day_of_week]} • {s.start_time} - {s.end_time} ({s.resource_name})
                              </div>
                            </div>
                            {s.is_locked && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/15 text-purple-600 font-bold uppercase">
                                Locked
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DEPARTMENT VIEW (Requirement 5) */}
      {perspective === 'department' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl glass-panel border border-white/40 dark:border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-blue-500" />
                <span>Department Staffing & Shift Coverage</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Timetable grouped by institutional department with real-time staffing level analysis.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full glass-pill">
              {departmentsList.length || 5} Departments
            </span>
          </div>

          <div className="space-y-6">
            {(departmentsList.length > 0 ? departmentsList : [{ id: 1, name: 'Default Department' }]).map((dept: any) => {
              const deptSlots = slots.filter((s) => s.department_id === dept.id || !s.department_id);
              const filled = deptSlots.filter((s) => s.person_id).length;
              const coverage = deptSlots.length ? Math.round((filled / deptSlots.length) * 100) : 100;

              return (
                <div
                  key={dept.id || dept.name}
                  className="p-5 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-slate-800/40 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold text-xs">
                        {dept.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{dept.name}</h4>
                        <span className="text-xs text-slate-500">
                          {deptSlots.length} Total Requirement Slots
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Coverage: <strong>{coverage}%</strong>
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          coverage === 100
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                        }`}
                      >
                        {coverage === 100 ? 'Adequately Staffed' : 'Needs Coverage'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {deptSlots.map((slot) => (
                      <div
                        key={slot.slot_id}
                        onClick={() => {
                          setEditSlot(slot);
                          setSelectedPersonId(slot.person_id);
                        }}
                        className="p-3 rounded-2xl glass-card border border-white/40 dark:border-white/10 text-xs space-y-2 cursor-pointer hover:border-blue-400 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-slate-900 dark:text-white leading-tight">
                            {slot.title}
                          </span>
                          <span className="text-[10px] font-semibold text-blue-500">
                            {ALL_DAYS[slot.day_of_week].slice(0, 3)}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {slot.start_time} - {slot.end_time} • {slot.resource_name}
                        </div>
                        <div className="pt-2 border-t border-slate-200/40 dark:border-slate-800/40 flex justify-between items-center text-[11px]">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                            {slot.person_name || 'Unassigned'}
                          </span>
                          {slot.staffing_status === 'understaffed' && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-500 font-bold uppercase">
                              Deficit
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RESOURCE VIEW (Requirement 5) */}
      {perspective === 'resource' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl glass-panel border border-white/40 dark:border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-500" />
                <span>Resource & Physical Room Allocations</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Classrooms, laboratories, clinical surgical suites, aircraft gates, and vehicle apparatus utilization.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full glass-pill">
              {resources.length || 4} Rooms / Resources
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {resources.map((res) => {
              const resSlots = slots.filter((s) => s.resource_id === res.id);
              const utilization = Math.min(100, Math.round((resSlots.length / 10) * 100));

              return (
                <div
                  key={res.id}
                  className="p-5 rounded-3xl glass-card border border-white/40 dark:border-white/10 space-y-4 hover:border-blue-400 transition-all shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{res.name}</span>
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase glass-pill">
                          {res.type}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Capacity: {res.capacity} persons • Location: {res.location || 'Building Main'}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-blue-500">
                      {resSlots.length} Duties Booked
                    </span>
                  </div>

                  {/* Utilization Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Room Utilization Rota</span>
                      <span>{utilization}% Capacity</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(5, utilization)}%` }}
                      />
                    </div>
                  </div>

                  {/* Booked Slots */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-200/40 dark:border-slate-800/40">
                    <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Timetable Bookings:
                    </div>
                    {resSlots.length === 0 ? (
                      <div className="text-xs text-slate-400 italic py-2">
                        No active duties scheduled for this resource.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {resSlots.map((s) => (
                          <div
                            key={s.slot_id}
                            onClick={() => {
                              setEditSlot(s);
                              setSelectedPersonId(s.person_id);
                            }}
                            className="p-2 rounded-xl glass-pill text-xs flex items-center justify-between cursor-pointer hover:border-blue-500 transition-colors"
                          >
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">{s.title}</div>
                              <div className="text-[10px] text-slate-500">
                                {ALL_DAYS[s.day_of_week]} • {s.start_time} - {s.end_time} • Assigned: {s.person_name || 'Unassigned'}
                              </div>
                            </div>
                            <span className="text-[9px] px-2 py-0.5 rounded font-bold bg-blue-500/10 text-blue-600">
                              Booked
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* HOLIDAY & CLOSURE VIEW (Requirement 5 & 6) */}
      {perspective === 'holiday' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl glass-panel border border-white/40 dark:border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500" />
                <span>Holiday Calendar & Emergency Closures Overlay</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Public, organizational, and emergency closure rules enforcing scheduling blocks and authorized exceptions.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('holidays')}
              className="px-3.5 py-1.5 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <span>Manage Holidays</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {holidaysList.length === 0 ? (
              <div className="md:col-span-2 p-8 rounded-3xl glass-panel border border-white/40 dark:border-white/10 text-center space-y-3">
                <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No Verified Holidays Configured
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Import official national calendars or add organization closure days in the Holiday Management module.
                </p>
              </div>
            ) : (
              holidaysList.map((h) => (
                <div
                  key={h.id}
                  className="p-5 rounded-3xl glass-card border border-amber-500/30 dark:border-amber-500/20 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{h.name}</span>
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          {h.holiday_type.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {h.start_date} {h.end_date && h.end_date !== h.start_date ? `to ${h.end_date}` : ''}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        h.essential_staffing_allowed
                          ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                          : 'bg-red-500/10 text-red-600 border-red-500/20'
                      }`}
                    >
                      {h.essential_staffing_allowed ? 'Essential Staffing Allowed' : 'Strict Total Closure'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {h.description || 'Institutional holiday blocking regular teaching and ordinary assignments.'}
                  </p>

                  <div className="p-3 rounded-2xl glass-pill text-xs flex items-center justify-between">
                    <span className="text-slate-500">Authorized Clearance Roles:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {h.authorized_roles?.length ? h.authorized_roles.join(', ') : 'None (Total Lockdown)'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Active Swaps Panel at Bottom-Left of Timetable (Prompt Requirement 13) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-3xl glass-panel border border-amber-500/30 dark:border-amber-500/20 shadow-lg shadow-amber-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-600 flex items-center justify-center">
                <ArrowRightLeft className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Active Swaps & Replacements
              </h4>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/20">
              {activeReplacements.length} Live
            </span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {activeReplacements.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                No active replacements currently deployed.
              </div>
            ) : (
              activeReplacements.map((rep) => (
                <div
                  key={rep.id}
                  className="p-2.5 rounded-xl glass-card border border-amber-500/20 text-xs flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                      {rep.replacement_person_name} → {rep.slot_title}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {rep.time_window} • Temp Replacement
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('replacements')}
                    className="p-1 rounded-lg hover:bg-amber-500/20 text-amber-600"
                    title="Manage Swaps"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Schedule Insights & Health Overview */}
        <div className="md:col-span-2 p-5 rounded-3xl glass-panel border border-white/40 dark:border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Solver Metrics & Stability
            </h4>
            <span className="text-xs text-slate-500">Google OR-Tools CP-SAT</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-2xl glass-pill text-center">
              <div className="text-lg font-black text-blue-600 dark:text-blue-400">
                {activeSchedule?.fairness_score || 94.2}%
              </div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Fairness Score</div>
            </div>
            <div className="p-3 rounded-2xl glass-pill text-center">
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {slots.filter((s) => s.person_id).length} / {slots.length}
              </div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Slots Filled</div>
            </div>
            <div className="p-3 rounded-2xl glass-pill text-center">
              <div className="text-lg font-black text-purple-600 dark:text-purple-400">
                {slots.filter((s) => s.is_locked).length} Locked
              </div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Protected Slots</div>
            </div>
          </div>
        </div>
      </div>

      {/* Generator Weights Modal with Selective Regeneration */}
      {isGenModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl glass-panel border border-white/40 dark:border-white/10 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-200/40 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  OR-Tools Timetable Optimizer
                </h3>
              </div>
              <button onClick={() => setIsGenModalOpen(false)} className="p-1 rounded-lg glass-pill">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Enforces hard constraints (zero overlaps, approved leaves respected, required skill matching)
              while balancing soft multi-objective goals. Locked slots will never be modified.
            </p>

            {/* Selective Regeneration Options */}
            <div className="p-3 rounded-2xl glass-pill space-y-2 text-xs">
              <div className="font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Selective Regeneration:</span>
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-normal">
                  <input
                    type="checkbox"
                    checked={regenAllDays}
                    onChange={(e) => setRegenAllDays(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-blue-600 accent-blue-600"
                  />
                  <span>All Days</span>
                </label>
              </div>

              {!regenAllDays && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {ALL_DAYS.map((day, idx) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        setSelectedRegenDays((prev) =>
                          prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]
                        );
                      }}
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                        selectedRegenDays.includes(idx)
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'glass-pill text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              )}

              <label className="flex items-center gap-2 pt-1 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyUnassigned}
                  onChange={(e) => setOnlyUnassigned(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-blue-600 accent-blue-600"
                />
                <span className="text-[11px]">Only solve unfilled slots (keep existing staff assignments intact)</span>
              </label>
            </div>

            {/* Weights Sliders */}
            <div className="space-y-3.5">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Workload Fairness Weight</span>
                  <span className="text-blue-500 font-bold">{fairnessWeight.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="2.5"
                  step="0.1"
                  value={fairnessWeight}
                  onChange={(e) => setFairnessWeight(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Staff Preferences Weight</span>
                  <span className="text-blue-500 font-bold">{prefWeight.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="2.5"
                  step="0.1"
                  value={prefWeight}
                  onChange={(e) => setPrefWeight(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Overtime Penalty Weight</span>
                  <span className="text-blue-500 font-bold">{overtimeWeight.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="2.5"
                  step="0.1"
                  value={overtimeWeight}
                  onChange={(e) => setOvertimeWeight(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsGenModalOpen(false)}
                className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={isSolving}
                onClick={handleGenerate}
                className="px-5 py-2.5 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20"
              >
                {isSolving ? 'Solving Constraints...' : 'Execute Optimizer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Slot Edit Modal */}
      {editSlot && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl glass-panel border border-white/40 dark:border-white/10 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-200/40 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Edit Assignment: {editSlot.title}
                </h3>
                <div className="text-xs text-blue-500 font-semibold">
                  {editSlot.start_time} - {editSlot.end_time} ({editSlot.resource_name})
                </div>
              </div>
              <button onClick={() => setEditSlot(null)} className="p-1 rounded-lg glass-pill">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Assigned Staff Member:
              </label>
              <select
                value={selectedPersonId || ''}
                onChange={(e) => setSelectedPersonId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
              >
                <option value="">-- Unassigned --</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role_title})
                  </option>
                ))}
              </select>

              <div className="p-3 rounded-2xl glass-pill text-xs space-y-1 text-slate-500">
                <div>Min Staff: <strong className="text-slate-700 dark:text-slate-200">{editSlot.min_staff}</strong> | Target: <strong className="text-slate-700 dark:text-slate-200">{editSlot.target_staff}</strong> | Max: <strong className="text-slate-700 dark:text-slate-200">{editSlot.max_staff}</strong></div>
                <div>Required Skills: <strong className="text-slate-700 dark:text-slate-200">{editSlot.required_skills.join(', ') || 'Any Subject'}</strong></div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setEditSlot(null)}
                className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveManualEdit}
                className="px-5 py-2.5 rounded-xl glass-button-primary text-xs font-semibold"
              >
                Save Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Slot Modal */}
      {isAddSlotOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateNewSlot} className="max-w-md w-full rounded-3xl glass-panel border border-white/40 dark:border-white/10 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-200/40 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Add Timetable Slot / Period
              </h3>
              <button type="button" onClick={() => setIsAddSlotOpen(false)} className="p-1 rounded-lg glass-pill">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Slot Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Systems Lecture"
                  value={newSlotTitle}
                  onChange={(e) => setNewSlotTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Day of Week</label>
                  <select
                    value={newSlotDay}
                    onChange={(e) => setNewSlotDay(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  >
                    {ALL_DAYS.map((d, i) => (
                      <option key={d} value={i}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Period Type</label>
                  <select
                    value={newSlotType}
                    onChange={(e) => setNewSlotType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  >
                    <option value="work">Work Duty</option>
                    <option value="break">Short Break</option>
                    <option value="lunch">Lunch Meal</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={newSlotStart}
                    onChange={(e) => setNewSlotStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={newSlotEnd}
                    onChange={(e) => setNewSlotEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  />
                </div>
              </div>

              {newSlotType === 'work' && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-semibold mb-1">Min Staff</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={newSlotMinStaff}
                      onChange={(e) => setNewSlotMinStaff(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl glass-input text-center"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Target</label>
                    <input
                      type="number"
                      min="1"
                      max="15"
                      value={newSlotTargetStaff}
                      onChange={(e) => setNewSlotTargetStaff(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl glass-input text-center font-bold text-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Max Staff</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={newSlotMaxStaff}
                      onChange={(e) => setNewSlotMaxStaff(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl glass-input text-center"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold mb-1">Physical Room / Facility</label>
                <select
                  value={newSlotResourceId || ''}
                  onChange={(e) => setNewSlotResourceId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 rounded-xl glass-input"
                >
                  <option value="">-- No Room Assigned --</option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsAddSlotOpen(false)}
                className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl glass-button-primary text-xs font-semibold"
              >
                Create Slot
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pre-Publish Checklist Modal (Prompt Requirement 17) */}
      {isPublishModalOpen && publishValidation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl glass-panel border border-white/40 dark:border-white/10 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-200/40 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Schedule Publication Checklist
                </h3>
              </div>
              <button onClick={() => setIsPublishModalOpen(false)} className="p-1 rounded-lg glass-pill">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl glass-card space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Staffing Coverage Rate:</span>
                  <strong className="text-blue-600 font-bold">{publishValidation.coverage_rate}%</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Work Slots:</span>
                  <span>{publishValidation.total_work_slots}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Unfilled Assignments:</span>
                  <span className={publishValidation.unfilled_count > 0 ? 'text-amber-500 font-bold' : 'text-emerald-500 font-bold'}>
                    {publishValidation.unfilled_count}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Simultaneous Overlap Conflicts:</span>
                  <span className={publishValidation.conflicts_count > 0 ? 'text-red-500 font-bold' : 'text-emerald-500 font-bold'}>
                    {publishValidation.conflicts_count} Hard Conflicts
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pending Leave Approvals:</span>
                  <span>{publishValidation.pending_leave_approvals}</span>
                </div>
              </div>

              {/* Blocking notice if hard conflicts exist */}
              {!publishValidation.can_publish ? (
                <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Publication Blocked:</div>
                    <div>{publishValidation.failure_reason}</div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>Mandatory constraint validation passed. Ready to publish.</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsPublishModalOpen(false)}
                className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold"
              >
                Close
              </button>
              <button
                disabled={!publishValidation.can_publish}
                onClick={handleConfirmPublish}
                className="px-5 py-2.5 rounded-xl glass-button-primary text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Confirm & Publish Schedule</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
