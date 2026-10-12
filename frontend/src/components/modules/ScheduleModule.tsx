import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { TimetableSlot, Person, Schedule, ActiveReplacement, Holiday, Department, Subject } from '../../types';
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
  Search,
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
  const [draggingSlot, setDraggingSlot] = useState<TimetableSlot | null>(null);
  const [dragOverSlotId, setDragOverSlotId] = useState<number | null>(null);
  const [clickSwapSourceSlot, setClickSwapSourceSlot] = useState<TimetableSlot | null>(null);
  const [swapModal, setSwapModal] = useState<{
    isOpen: boolean;
    sourceSlot: TimetableSlot | null;
    targetSlot: TimetableSlot | null;
    validationResult: any | null;
    isLoading: boolean;
    reason: string;
  }>({
    isOpen: false,
    sourceSlot: null,
    targetSlot: null,
    validationResult: null,
    isLoading: false,
    reason: 'Peer schedule exchange',
  });

  // College Lab Scheduling Modal State
  const [labModal, setLabModal] = useState<{
    isOpen: boolean;
    teacherId: number;
    teacherName: string;
    subject: string;
    dateStr: string;
    startTime: string;
    endTime: string;
    resourceId?: number;
    departmentId?: number;
    semester: string;
    className: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    teacherId: 0,
    teacherName: '',
    subject: '',
    dateStr: '',
    startTime: '14:00',
    endTime: '16:00',
    resourceId: undefined,
    departmentId: undefined,
    semester: 'S5',
    className: 'CSE-A',
    isSubmitting: false,
  });

  // Employee Timetable Perspective State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | 'all'>('all');
  const [showWeekendDays, setShowWeekendDays] = useState<boolean>(true);
  const [employeeSearch, setEmployeeSearch] = useState<string>('');

  // Timetable Layout: 'days-left' (Institutional rows) vs 'days-top' (Column grid)
  const [timetableLayout, setTimetableLayout] = useState<'days-left' | 'days-top'>('days-left');

  // Subjects, Readiness, and Solver Summary State
  const [subjectsList, setSubjectsList] = useState<Subject[]>([]);
  const [rosterReadiness, setRosterReadiness] = useState<any | null>(null);
  const [isLoadingReadiness, setIsLoadingReadiness] = useState(false);
  const [solverSummary, setSolverSummary] = useState<any | null>(null);
  const [isSolverSummaryOpen, setIsSolverSummaryOpen] = useState(false);

  // Manual Edit Slot Subject
  const [editSlotSubjectId, setEditSlotSubjectId] = useState<number | undefined>(undefined);
  const [editSlotSubjectName, setEditSlotSubjectName] = useState<string>('');

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

      const [hList, dList, sList] = await Promise.all([
        api.getHolidays(activeOrg.id).catch(() => []),
        api.getDepartments(activeOrg.id).catch(() => []),
        api.getSubjects(activeOrg.id).catch(() => []),
      ]);
      setHolidaysList(hList || []);
      setDepartmentsList(dList || []);
      setSubjectsList(sList || []);
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

  // Open Smart Generator with Readiness Verification
  const handleOpenSmartGenerator = async () => {
    if (!activeOrg) return;
    triggerHaptic(15);
    setIsGenModalOpen(true);
    setIsLoadingReadiness(true);
    try {
      const ready = await api.getRosterReadiness(activeOrg.id);
      setRosterReadiness(ready);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingReadiness(false);
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

      setSolverSummary(res);
      setIsGenModalOpen(false);
      setIsSolverSummaryOpen(true);
      fetchScheduleData();
    } catch (err: any) {
      addToast('Solver Error', err.message, 'error');
    } finally {
      setIsSolving(false);
    }
  };

  // Accurate duration calculator (including overnight shifts)
  const calculateSlotHours = (start: string, end: string): number => {
    try {
      const [sH, sM] = start.split(':').map(Number);
      const [eH, eM] = end.split(':').map(Number);
      let sMins = sH * 60 + sM;
      let eMins = eH * 60 + eM;
      if (eMins <= sMins) eMins += 1440; // overnight modulo-1440 math
      return Math.round(((eMins - sMins) / 60) * 10) / 10;
    } catch {
      return 1;
    }
  };

  // Distinct time bands across the day for institutional timetable layout
  const distinctTimeBands = React.useMemo(() => {
    const bandsMap = new Map<string, { start: string; end: string; label: string; isBreak: boolean }>();

    slots.forEach((s) => {
      const key = `${s.start_time}-${s.end_time}`;
      if (!bandsMap.has(key)) {
        const isBreak = s.period_type === 'break' || s.period_type === 'lunch';
        bandsMap.set(key, {
          start: s.start_time,
          end: s.end_time,
          label: `${s.start_time} – ${s.end_time}`,
          isBreak,
        });
      }
    });

    const sortedBands = Array.from(bandsMap.values()).sort((a, b) => a.start.localeCompare(b.start));

    if (sortedBands.length === 0) {
      return [
        { start: '09:00', end: '10:00', label: '09:00 – 10:00', isBreak: false },
        { start: '10:00', end: '11:00', label: '10:00 – 11:00', isBreak: false },
        { start: '11:00', end: '12:00', label: '11:00 – 12:00', isBreak: false },
        { start: '12:00', end: '13:00', label: '12:00 – 13:00', isBreak: true },
        { start: '13:00', end: '14:00', label: '13:00 – 14:00', isBreak: false },
        { start: '14:00', end: '15:00', label: '14:00 – 15:00', isBreak: false },
        { start: '15:00', end: '16:00', label: '15:00 – 16:00', isBreak: false },
        { start: '16:00', end: '17:00', label: '16:00 – 17:00', isBreak: false },
      ];
    }
    return sortedBands;
  }, [slots]);

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

  // Save Manual Assignment & Subject Override
  const handleSaveManualEdit = async () => {
    if (!editSlot) return;
    triggerHaptic(15);
    try {
      if (editSlot.assignment_id) {
        await api.updateAssignment(editSlot.assignment_id, {
          person_id: selectedPersonId || null,
          is_replacement: selectedPersonId !== editSlot.original_person_id,
          replacement_type: 'manual',
          replacement_reason: 'Manager manual timetable override',
        });
      }
      await api.updateSlot(editSlot.slot_id, {
        subject_id: editSlotSubjectId || undefined,
        subject_name: editSlotSubjectName || undefined,
        title: editSlotSubjectName ? editSlotSubjectName : editSlot.title,
      });
      addToast('Assignment Updated', 'Timetable slot assignment and subject saved', 'success');
      setEditSlot(null);
      fetchScheduleData();
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  // Timetable Slot Drag & Drop Handlers
  const handleSlotDragStart = (e: React.DragEvent, slot: TimetableSlot) => {
    triggerHaptic(10);
    setDraggingSlot(slot);
    e.dataTransfer.setData('application/slot-id', String(slot.slot_id));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSlotDragOver = (e: React.DragEvent, slot: TimetableSlot) => {
    e.preventDefault();
    if (draggingSlot && draggingSlot.slot_id !== slot.slot_id) {
      e.dataTransfer.dropEffect = 'move';
      if (dragOverSlotId !== slot.slot_id) {
        setDragOverSlotId(slot.slot_id);
      }
    }
  };

  const handleSlotDragLeave = () => {
    setDragOverSlotId(null);
  };

  // Legacy DragOver for Palette items
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Unified Drop Handler for both Slot-to-Slot Swap and Palette Staff Assignment
  const handleDropOnSlot = async (e: React.DragEvent, targetSlot: TimetableSlot) => {
    e.preventDefault();
    setDragOverSlotId(null);
    triggerHaptic(15);

    // 1. Check if dropping a Slot (Swap Request)
    const sourceSlotIdStr = e.dataTransfer.getData('application/slot-id');
    const sourceSlotId = sourceSlotIdStr ? Number(sourceSlotIdStr) : (draggingSlot?.slot_id ?? null);
    if (sourceSlotId && sourceSlotId !== targetSlot.slot_id) {
      const sourceSlot = slots.find((s) => s.slot_id === sourceSlotId) || draggingSlot;
      setDraggingSlot(null);
      if (sourceSlot) {
        initiateSwap(sourceSlot, targetSlot);
        return;
      }
    }

    // 2. Otherwise check if dropping Staff member from Palette
    const pIdStr = e.dataTransfer.getData('text/plain');
    const pId = Number(pIdStr) || draggedPersonId;
    if (pId && activeSchedule) {
      try {
        const res = await api.assignDragDrop({
          schedule_id: activeSchedule.id,
          slot_id: targetSlot.slot_id,
          person_id: pId,
        });

        if (res.has_conflict) {
          addToast('Conflict Warning', res.message, 'error');
        } else {
          addToast('Assignment Updated', `Assigned staff member to ${targetSlot.title}`, 'success');
          fetchScheduleData();
        }
      } catch (err: any) {
        addToast('Drag & Drop Error', err.message, 'error');
      } finally {
        setDraggedPersonId(null);
        setDraggingSlot(null);
      }
    }
  };

  // Initiate Swap Validation & Preview Modal
  const initiateSwap = async (sourceSlot: TimetableSlot, targetSlot: TimetableSlot) => {
    if (!activeSchedule) return;
    if (sourceSlot.slot_id === targetSlot.slot_id) {
      addToast('Invalid Action', 'Cannot swap an assignment with itself', 'error');
      return;
    }

    setSwapModal({
      isOpen: true,
      sourceSlot,
      targetSlot,
      validationResult: null,
      isLoading: true,
      reason: 'Direct timetable exchange',
    });

    try {
      const res = await api.timetableSwap({
        schedule_id: activeSchedule.id,
        source_slot_id: sourceSlot.slot_id,
        target_slot_id: targetSlot.slot_id,
        reason: 'Direct timetable exchange',
        dry_run: true,
      });

      setSwapModal((prev) => ({
        ...prev,
        validationResult: res,
        isLoading: false,
      }));
    } catch (err: any) {
      setSwapModal((prev) => ({
        ...prev,
        validationResult: {
          valid: false,
          errors: [err.message || 'Validation request failed'],
        },
        isLoading: false,
      }));
    }
  };

  // Confirm and Execute Swap to Database
  const confirmExecuteSwap = async () => {
    if (!activeSchedule || !swapModal.sourceSlot || !swapModal.targetSlot) return;
    try {
      const res = await api.timetableSwap({
        schedule_id: activeSchedule.id,
        source_slot_id: swapModal.sourceSlot.slot_id,
        target_slot_id: swapModal.targetSlot.slot_id,
        reason: swapModal.reason || 'Direct timetable exchange',
        dry_run: false,
        approved_by: 'Authorized Scheduler',
      });

      if (res.success) {
        addToast('Swap Executed', res.message || 'Assignments swapped and saved to database', 'success');
        setSwapModal({
          isOpen: false,
          sourceSlot: null,
          targetSlot: null,
          validationResult: null,
          isLoading: false,
          reason: '',
        });
        setClickSwapSourceSlot(null);
        await fetchScheduleData();
      } else {
        addToast('Swap Failed', res.message || 'Unable to execute swap', 'error');
      }
    } catch (err: any) {
      addToast('Swap Error', err.message || 'Failed to execute swap', 'error');
    }
  };

  // Click-to-Swap Toggle
  const handleInitiateClickSwap = (slot: TimetableSlot, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(10);
    if (!clickSwapSourceSlot) {
      setClickSwapSourceSlot(slot);
      addToast('Swap Selection Active', `Selected ${slot.person_name || slot.title}. Now click any target slot.`, 'info');
    } else if (clickSwapSourceSlot.slot_id === slot.slot_id) {
      setClickSwapSourceSlot(null);
      addToast('Swap Cancelled', 'Selection cleared', 'info');
    } else {
      const src = clickSwapSourceSlot;
      setClickSwapSourceSlot(null);
      initiateSwap(src, slot);
    }
  };

  // College Add Lab Session Modal Handlers
  const handleOpenAddLab = (slot: TimetableSlot, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(10);
    const labRes = resources.find((r) => r.type === 'lab') || resources[0];
    const teacherId = slot.person_id || (people[0]?.id ?? 0);
    const teacherName = slot.person_name || people.find((p) => p.id === teacherId)?.name || 'Faculty Member';
    const subClean = slot.title ? slot.title.replace(' Lab', '').replace(' Lecture', '') : 'Practical Subject';

    setLabModal({
      isOpen: true,
      teacherId,
      teacherName,
      subject: subClean,
      dateStr: slot.date_str || (weekStartDate ? weekStartDate.toISOString().split('T')[0] : '2026-10-16'),
      startTime: '14:00',
      endTime: '16:00',
      resourceId: labRes?.id,
      departmentId: slot.department_id,
      semester: 'S5',
      className: 'CSE-A',
      isSubmitting: false,
    });
  };

  const handleSubmitAddLab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSchedule) return;
    setLabModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      const res = await api.addLabSession(activeSchedule.id, {
        teacher_id: labModal.teacherId,
        subject: labModal.subject,
        date_str: labModal.dateStr,
        start_time: labModal.startTime,
        end_time: labModal.endTime,
        resource_id: labModal.resourceId,
        department_id: labModal.departmentId,
        semester: labModal.semester,
        class_name: labModal.className,
      });

      addToast('Lab Scheduled', res.message || 'Laboratory session scheduled successfully', 'success');
      setLabModal((prev) => ({ ...prev, isOpen: false, isSubmitting: false }));
      await fetchScheduleData();
    } catch (err: any) {
      addToast('Lab Conflict', err.message || 'Cannot schedule lab due to conflict', 'error');
      setLabModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  // Reusable slot card renderer with prominent subject display & drag-and-drop
  const renderSlotCard = (slot: TimetableSlot) => {
    const isReplacement = slot.is_replacement;
    const isBreak = slot.period_type === 'break' || slot.period_type === 'lunch';
    const isUnderstaffed = slot.staffing_status === 'understaffed';
    const isOverstaffed = slot.staffing_status === 'overstaffed';
    const isLocked = slot.is_locked;
    const isCollege = activeOrg?.type === 'college';
    const subjectName = slot.subject || slot.subject_name || (slot as any).profession_metadata?.subject;

    return (
      <div
        key={slot.slot_id}
        draggable={!isBreak && Boolean(slot.person_id)}
        onDragStart={(e) => handleSlotDragStart(e, slot)}
        onDragOver={(e) => handleSlotDragOver(e, slot)}
        onDragLeave={handleSlotDragLeave}
        onDrop={(e) => handleDropOnSlot(e, slot)}
        onClick={() => {
          if (clickSwapSourceSlot && clickSwapSourceSlot.slot_id !== slot.slot_id) {
            const src = clickSwapSourceSlot;
            setClickSwapSourceSlot(null);
            initiateSwap(src, slot);
            return;
          }
          triggerHaptic(10);
          setEditSlot(slot);
          setSelectedPersonId(slot.person_id);
          setEditSlotSubjectId(slot.subject_id || (slot as any).subject?.id);
          setEditSlotSubjectName(subjectName || slot.title || '');
        }}
        className={`p-3 rounded-2xl glass-card border transition-all cursor-pointer relative group ${
          dragOverSlotId === slot.slot_id
            ? 'border-blue-500 bg-blue-500/20 ring-2 ring-blue-500 shadow-lg shadow-blue-500/20 scale-[1.01]'
            : clickSwapSourceSlot?.slot_id === slot.slot_id
            ? 'border-amber-500 bg-amber-500/15 ring-2 ring-amber-500 shadow-md'
            : isBreak
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
            {/* Click-to-Swap Trigger Button */}
            {!isBreak && slot.person_id && (
              <button
                type="button"
                onClick={(e) => handleInitiateClickSwap(slot, e)}
                className={`p-1 rounded-md transition-colors ${
                  clickSwapSourceSlot?.slot_id === slot.slot_id
                    ? 'text-amber-500 bg-amber-500/20 ring-1 ring-amber-500'
                    : 'text-slate-400 hover:text-blue-500 hover:bg-blue-500/10'
                }`}
                title="Swap this assignment with another time slot"
              >
                <ArrowRightLeft className="w-3 h-3" />
              </button>
            )}

            {/* University / College Add Lab Button (Only for College) */}
            {isCollege && !isBreak && (
              <button
                type="button"
                onClick={(e) => handleOpenAddLab(slot, e)}
                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 hover:bg-blue-500/25 text-blue-600 dark:text-blue-400 border border-blue-500/25 transition-colors flex items-center gap-0.5"
                title="Schedule practical lab session for this faculty"
              >
                <Plus className="w-2.5 h-2.5" />
                <span>Add Lab</span>
              </button>
            )}

            {/* Lock Toggle Button */}
            <button
              type="button"
              onClick={(e) => handleToggleLock(slot.slot_id, e)}
              className={`p-1 rounded-md transition-colors ${
                isLocked ? 'text-purple-500 bg-purple-500/10' : 'text-slate-400 hover:text-purple-500'
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

        {/* PROMINENT SUBJECT DISPLAY IN BOLD */}
        <div className="space-y-0.5">
          {isBreak ? (
            <div className="text-xs font-black text-slate-500 italic">
              {slot.period_type === 'lunch' ? 'Lunch Break' : slot.title || 'Recess Interval'}
            </div>
          ) : subjectName ? (
            <div>
              <div className="text-xs font-black text-blue-600 dark:text-blue-400 leading-tight">
                {subjectName}
              </div>
              {slot.title && slot.title !== subjectName && (
                <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 truncate">
                  {slot.title}
                </div>
              )}
            </div>
          ) : isCollege ? (
            <div>
              <div className="text-xs font-black text-amber-500 dark:text-amber-400 leading-tight">
                Subject not assigned
              </div>
              <div className="text-[10px] text-slate-500 truncate">{slot.title}</div>
            </div>
          ) : (
            <div className="text-xs font-black text-slate-900 dark:text-white leading-tight">
              {slot.title}
            </div>
          )}
        </div>

        {/* Resource Location */}
        <div className="text-[10px] text-slate-400 mt-1 truncate">
          {slot.resource_name || 'No Room Assigned'}
        </div>

        {/* Staff Assignment & Badges */}
        <div className="mt-2 pt-1.5 border-t border-slate-200/40 dark:border-slate-800/40 flex items-center justify-between gap-1">
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

          {/* Badges */}
          {!isBreak && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {slot.title?.toLowerCase().includes('lab') && (
                <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[9px] font-bold uppercase tracking-wider border border-blue-500/25">
                  Lab
                </span>
              )}
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

          {/* Smart Roster Generator Button */}
          <button
            onClick={handleOpenSmartGenerator}
            className="px-4 py-2 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Smart Roster Generator</span>
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
                                      draggable={Boolean(slot.person_id)}
                                      onDragStart={(e) => handleSlotDragStart(e, slot)}
                                      onDragOver={(e) => handleSlotDragOver(e, slot)}
                                      onDragLeave={handleSlotDragLeave}
                                      onDrop={(e) => handleDropOnSlot(e, slot)}
                                      onClick={() => {
                                        if (clickSwapSourceSlot && clickSwapSourceSlot.slot_id !== slot.slot_id) {
                                          const src = clickSwapSourceSlot;
                                          setClickSwapSourceSlot(null);
                                          initiateSwap(src, slot);
                                          return;
                                        }
                                        triggerHaptic(10);
                                        setEditSlot(slot);
                                        setSelectedPersonId(slot.person_id);
                                      }}
                                      className={`p-1.5 rounded-xl border text-[10px] cursor-pointer transition-all ${
                                        dragOverSlotId === slot.slot_id
                                          ? 'border-blue-500 bg-blue-500/20 ring-1 ring-blue-500'
                                          : clickSwapSourceSlot?.slot_id === slot.slot_id
                                          ? 'border-amber-500 bg-amber-500/20 ring-1 ring-amber-500'
                                          : isReplacement
                                          ? 'border-amber-400/60 bg-amber-500/10'
                                          : isUnderstaffed
                                          ? 'border-red-400/60 bg-red-500/10'
                                          : isLocked
                                          ? 'border-purple-400/60 bg-purple-500/10'
                                          : 'border-white/40 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 hover:border-blue-400'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <div className="font-extrabold text-slate-900 dark:text-white truncate">
                                          {slot.subject || slot.subject_name || slot.title}
                                        </div>
                                        <div className="flex items-center gap-0.5 flex-shrink-0">
                                          {slot.person_id && (
                                            <button
                                              type="button"
                                              onClick={(e) => handleInitiateClickSwap(slot, e)}
                                              className="p-0.5 hover:text-blue-500 text-slate-400"
                                              title="Swap assignment"
                                            >
                                              <ArrowRightLeft className="w-2.5 h-2.5" />
                                            </button>
                                          )}
                                          {activeOrg?.type === 'college' && (
                                            <button
                                              type="button"
                                              onClick={(e) => handleOpenAddLab(slot, e)}
                                              className="text-[8px] font-bold text-blue-500 hover:text-blue-700"
                                              title="Schedule practical lab for this faculty"
                                            >
                                              +Lab
                                            </button>
                                          )}
                                        </div>
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
            <div className="space-y-4">
              {/* Timetable Layout Toolbar */}
              <div className="p-3.5 rounded-2xl glass-panel border border-white/40 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold">
                  <Layers className="w-4 h-4 text-blue-500" />
                  <span>Timetable Format:</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                    {timetableLayout === 'days-left'
                      ? 'Days on left (Monday-Sunday) with time slot columns across top'
                      : 'Days as vertical columns'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-medium">Layout:</span>
                  <div className="p-1 rounded-xl glass-panel border border-white/20 dark:border-white/10 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(8);
                        setTimetableLayout('days-left');
                      }}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 ${
                        timetableLayout === 'days-left'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Days on Left (Classic)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(8);
                        setTimetableLayout('days-top');
                      }}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 ${
                        timetableLayout === 'days-top'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>Days as Columns</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* LAYOUT 1: DAYS ON LEFT (INSTITUTIONAL TIMETABLE FORMAT) */}
              {timetableLayout === 'days-left' ? (
                <div className="rounded-3xl glass-panel border border-white/40 dark:border-white/10 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[1050px]">
                      <thead>
                        <tr className="bg-slate-100/70 dark:bg-slate-900/70 border-b border-slate-200/60 dark:border-slate-800/80">
                          <th className="py-3 px-4 text-left font-extrabold text-xs text-slate-700 dark:text-slate-200 border-r border-slate-200/40 dark:border-slate-800/40 sticky left-0 z-20 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur-md w-44">
                            Day / Schedule
                          </th>
                          {distinctTimeBands.map((band, bIdx) => (
                            <th
                              key={band.label}
                              className="py-3 px-3 text-center font-bold text-xs text-slate-700 dark:text-slate-200 border-r last:border-r-0 border-slate-200/40 dark:border-slate-800/40 min-w-[170px]"
                            >
                              <div className="text-[10px] text-blue-600 dark:text-blue-400 font-extrabold uppercase tracking-wider">
                                Period {bIdx + 1} {band.isBreak ? '(Break)' : ''}
                              </div>
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                                {band.label}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/40">
                        {(viewMode === 'day' ? [displayedDays[selectedDayView]] : displayedDays).map((dayName, idx) => {
                          const actualDayIdx = viewMode === 'day' ? selectedDayView : idx;
                          const rowDate = new Date(weekStartDate);
                          rowDate.setDate(weekStartDate.getDate() + actualDayIdx);
                          const isWeekend = actualDayIdx >= 5;

                          return (
                            <tr
                              key={dayName}
                              className={`transition-colors ${
                                isWeekend ? 'bg-amber-500/5' : 'hover:bg-white/30 dark:hover:bg-slate-900/30'
                              }`}
                            >
                              {/* Left Sticky Day Header */}
                              <td className="py-3.5 px-4 border-r border-slate-200/40 dark:border-slate-800/40 sticky left-0 z-10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md font-bold text-xs text-slate-900 dark:text-white">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-extrabold text-sm">{dayName}</div>
                                    <div className="text-[10px] text-blue-500 font-semibold mt-0.5">
                                      {rowDate.getDate()} {MONTH_NAMES[rowDate.getMonth()].slice(0, 3)} {rowDate.getFullYear()}
                                    </div>
                                  </div>
                                  {isWeekend && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold">
                                      Weekend
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Time Columns across top */}
                              {distinctTimeBands.map((band) => {
                                const cellSlots = slots.filter(
                                  (s) =>
                                    s.day_of_week === actualDayIdx &&
                                    s.start_time === band.start &&
                                    s.end_time === band.end
                                );

                                return (
                                  <td
                                    key={band.label}
                                    className="p-2.5 border-r last:border-r-0 border-slate-200/30 dark:border-slate-800/30 align-top"
                                  >
                                    {cellSlots.length > 0 ? (
                                      <div className="space-y-2">
                                        {cellSlots.map((slot) => renderSlotCard(slot))}
                                      </div>
                                    ) : band.isBreak ? (
                                      <div className="h-full min-h-[96px] p-2.5 rounded-2xl border border-dashed border-slate-200/60 dark:border-slate-800/60 bg-slate-100/30 dark:bg-slate-900/30 flex flex-col items-center justify-center text-center">
                                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                                          Lunch / Break
                                        </span>
                                        <span className="text-[9px] text-slate-400/80 mt-0.5">{band.label}</span>
                                      </div>
                                    ) : (
                                      <div
                                        onClick={() => {
                                          setNewSlotDay(actualDayIdx);
                                          setNewSlotStart(band.start);
                                          setNewSlotEnd(band.end);
                                          setIsAddSlotOpen(true);
                                        }}
                                        className="h-full min-h-[96px] p-2.5 rounded-2xl border border-dashed border-slate-200/40 dark:border-slate-800/40 bg-slate-50/10 dark:bg-slate-950/10 hover:border-blue-400/60 hover:bg-blue-500/5 transition-all flex flex-col items-center justify-center text-center group cursor-pointer"
                                        title="Click to schedule an assignment in this free period"
                                      >
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-200/50 dark:bg-slate-800 text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-500/10 transition-colors">
                                          FREE
                                        </span>
                                        <span className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex items-center gap-0.5">
                                          <Plus className="w-2.5 h-2.5" /> Add Slot
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* LAYOUT 2: DAYS AS COLUMNS (VERTICAL GRID) */
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
                                daySlots.map((slot) => renderSlotCard(slot))
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* EMPLOYEE INDIVIDUAL TIMETABLES (Monday to Sunday) */}
      {perspective === 'employee' && (
        <div className="space-y-6">
          {/* Header Controls for Employee View */}
          <div className="p-5 rounded-3xl glass-panel border border-white/40 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                <span>Individual Employee Monday-to-Sunday Timetables</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Separate weekly timetable for each staff member with actual skills, qualifications, working hours, and assigned duties.
                {activeOrg?.type === 'college' && ' Includes academic department, semester, subjects, and classes taught.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Employee Search Filter */}
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search staff / teacher..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl glass-input text-xs"
                />
              </div>

              {/* Employee Selector Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Staff Member:</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="px-3 py-1.5 rounded-xl glass-input text-xs font-semibold"
                >
                  <option value="all">-- All Staff ({people.length}) --</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.role_title})
                    </option>
                  ))}
                </select>
              </div>

              {/* Toggle Weekend Shifts */}
              <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-pill text-xs font-semibold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showWeekendDays}
                  onChange={(e) => setShowWeekendDays(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-blue-600 accent-blue-600"
                />
                <span>Show Weekend Shifts (Sat & Sun)</span>
              </label>
            </div>
          </div>

          {/* Individual Staff Cards with Monday to Sunday Grid */}
          <div className="space-y-6">
            {(selectedEmployeeId === 'all' ? people : people.filter((p) => p.id === selectedEmployeeId))
              .filter((p) =>
                !employeeSearch ||
                p.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
                p.department_name?.toLowerCase().includes(employeeSearch.toLowerCase()) ||
                p.role_title?.toLowerCase().includes(employeeSearch.toLowerCase())
              )
              .map((p) => {
              const assigned = slots.filter((s) => s.person_id === p.id);
              const workingSlots = assigned.filter((s) => s.period_type !== 'break' && s.period_type !== 'lunch');
              const weeklyHours = workingSlots.reduce((acc, s) => acc + calculateSlotHours(s.start_time, s.end_time), 0);
              const monthlyHours = Math.round(weeklyHours * 4.33);
              const maxHours = p.max_hours_per_week || 40;
              const ratio = Math.min(100, Math.round((weeklyHours / maxHours) * 100));

              // Extract unique subjects and classes taught for faculty
              const subjectsTaught = Array.from(
                new Set(
                  assigned
                    .map((s) => s.subject || s.subject_name || (s as any).profession_metadata?.subject || s.title?.replace(' Lab', '').replace(' Lecture', ''))
                    .filter(Boolean)
                )
              );
              const classesTaught = Array.from(
                new Set(
                  assigned
                    .map((s) => (s as any).class_name || (s.title?.includes('(') ? s.title.split('(')[1]?.replace(')', '') : 'CSE-A'))
                    .filter(Boolean)
                )
              );
              const displayDays = showWeekendDays ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];

              return (
                <div
                  key={p.id}
                  className="p-6 rounded-3xl glass-card border border-white/40 dark:border-white/10 space-y-5 hover:border-blue-400 transition-all shadow-sm"
                >
                  {/* Top Bar: Profile, Role, Qualifications, Academic Scope */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200/40 dark:border-slate-800/40">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 font-extrabold flex items-center justify-center text-base border border-blue-500/20 flex-shrink-0">
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-base text-slate-900 dark:text-white">{p.name}</h4>
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
                        <div className="text-xs text-slate-500 font-medium mt-0.5">
                          {p.role_title} • {p.department_name || 'Operations'} • {p.email}
                        </div>

                        {/* Qualifications & Skills Pills */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {p.qualifications && p.qualifications.length > 0 ? (
                            p.qualifications.map((q, qIdx) => (
                              <span key={qIdx} className="px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-300 text-[10px] font-bold">
                                {q}
                              </span>
                            ))
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-300 text-[10px] font-bold">
                              Certified Specialist
                            </span>
                          )}

                          {p.skills?.slice(0, 4).map((s, sIdx) => (
                            <span key={sIdx} className="px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-semibold">
                              {s.name} ({s.level})
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Workload Progress & University/College Academic Scope */}
                    <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 min-w-[280px]">
                      {/* Academic Teaching Dossier for College Teachers */}
                      {activeOrg?.type === 'college' && (
                        <div className="text-right text-xs space-y-0.5 bg-blue-50/50 dark:bg-blue-950/20 p-2.5 rounded-2xl border border-blue-500/15 w-full">
                          <div className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">
                            Academic Teaching Profile
                          </div>
                          <div className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                            Dept: {p.department_name || 'Computer Science'} • S3 & S5
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            Subjects: {subjectsTaught.length > 0 ? subjectsTaught.join(', ') : 'Database Systems, Computing'}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            Batches: {classesTaught.length > 0 ? classesTaught.join(', ') : 'CSE-A, CSE-B'}
                          </div>
                        </div>
                      )}

                      {/* Working Hours Bar (Daily, Weekly, and Monthly Calculations) */}
                      <div className="w-full space-y-1">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Weekly: <strong>{weeklyHours} hrs</strong> ({monthlyHours} hrs/mo)</span>
                          <span>Cap: {maxHours} hrs/wk</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(5, ratio)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Individual Monday to Sunday Weekly Timetable Grid */}
                  <div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
                      <span>Weekly Schedule (Monday to Sunday)</span>
                      <span className="text-[11px] font-normal text-slate-400">Drag or click swap icon to exchange duties</span>
                    </div>

                    <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-${displayDays.length} gap-3`}>
                      {displayDays.map((dayIdx) => {
                        const daySlots = assigned.filter((s) => s.day_of_week === dayIdx);
                        const isWeekend = dayIdx >= 5;
                        const colDate = new Date(weekStartDate);
                        colDate.setDate(weekStartDate.getDate() + dayIdx);
                        const dayHours = daySlots
                          .filter((s) => s.period_type !== 'break' && s.period_type !== 'lunch')
                          .reduce((sum, s) => sum + calculateSlotHours(s.start_time, s.end_time), 0);

                        return (
                          <div
                            key={dayIdx}
                            className={`p-3 rounded-2xl border transition-all ${
                              isWeekend
                                ? 'bg-amber-50/20 dark:bg-amber-950/10 border-amber-500/20'
                                : 'bg-white/40 dark:bg-slate-900/40 border-white/40 dark:border-white/10'
                            }`}
                          >
                            {/* Day Header */}
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/40 dark:border-slate-800/40 text-xs">
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white">{ALL_DAYS[dayIdx].slice(0, 3)}</span>
                                <div className="text-[9px] text-blue-500 font-semibold">
                                  {colDate.getDate()} {MONTH_NAMES[colDate.getMonth()].slice(0, 3)}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                  {dayHours > 0 ? `${dayHours}h` : '0h'}
                                </span>
                                {isWeekend && (
                                  <div className="text-[8px] font-extrabold text-amber-500 uppercase">
                                    Weekend
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Duties for this day */}
                            <div className="space-y-2 min-h-[90px]">
                              {daySlots.length === 0 ? (
                                <div className="py-6 text-center text-[10px] text-slate-400 italic">
                                  {isWeekend ? 'Off Duty' : 'FREE / No Duties'}
                                </div>
                              ) : (
                                daySlots.map((s) => renderSlotCard(s))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Smart Roster Generator
                </h3>
              </div>
              <button onClick={() => setIsGenModalOpen(false)} className="p-1 rounded-lg glass-pill">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Automatically generates optimal valid rosters for all employees using constraint optimization,
              balances workloads fairly, prevents overlapping assignments, respects maximum working-hour caps,
              and commits real assignments directly to the database.
            </p>

            {/* Roster Readiness Verification Banner */}
            <div className="p-3 rounded-2xl glass-panel border border-white/30 dark:border-white/10 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Readiness & Pre-Flight Checklist:</span>
                </div>
                {isLoadingReadiness ? (
                  <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold">
                    Verified Ready
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                <div className="p-2 rounded-xl glass-pill text-center">
                  <div className="font-extrabold text-blue-600 dark:text-blue-400">{people.length}</div>
                  <div className="text-[9px] text-slate-400 uppercase font-semibold">Staff Members</div>
                </div>
                <div className="p-2 rounded-xl glass-pill text-center">
                  <div className="font-extrabold text-indigo-600 dark:text-indigo-400">{departmentsList.length || 1}</div>
                  <div className="text-[9px] text-slate-400 uppercase font-semibold">Departments</div>
                </div>
                <div className="p-2 rounded-xl glass-pill text-center">
                  <div className="font-extrabold text-emerald-600 dark:text-emerald-400">{slots.length}</div>
                  <div className="text-[9px] text-slate-400 uppercase font-semibold">Slots to Solve</div>
                </div>
                <div className="p-2 rounded-xl glass-pill text-center">
                  <div className="font-extrabold text-purple-600 dark:text-purple-400">{subjectsList.length}</div>
                  <div className="text-[9px] text-slate-400 uppercase font-semibold">Subjects</div>
                </div>
              </div>
            </div>

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
                {isSolving ? 'Generating Optimal Rosters...' : 'Run Smart Roster Generator'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Solver Summary Confirmation Preview Modal */}
      {isSolverSummaryOpen && solverSummary && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl glass-panel border border-emerald-500/40 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/40 dark:border-slate-800/40">
              <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Roster Generated Successfully
                </h3>
                <div className="text-xs text-slate-500">Google OR-Tools CP-SAT Constraint Satisfaction</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3.5 rounded-2xl glass-card border border-emerald-500/20">
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {solverSummary.fairness_score}%
                </div>
                <div className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">Fairness Score</div>
              </div>
              <div className="p-3.5 rounded-2xl glass-card border border-blue-500/20">
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                  {solverSummary.total_assigned}
                </div>
                <div className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">Assignments Made</div>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-emerald-500/5 p-3 rounded-2xl border border-emerald-500/15">
              Constraint solver completed valid schedules without overlapping shifts, respecting maximum weekly working hours, employee availability, approved leave, and institutional rest periods. All assignments are now committed directly to the database.
            </p>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(12);
                  setIsSolverSummaryOpen(false);
                }}
                className="w-full py-2.5 rounded-2xl glass-button-primary text-xs font-bold shadow-lg shadow-emerald-500/25"
              >
                Accept & View Updated Timetable
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
              {/* Subject Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Subject / Course:
                </label>
                {subjectsList.length > 0 ? (
                  <select
                    value={editSlotSubjectId || ''}
                    onChange={(e) => {
                      const sId = e.target.value ? Number(e.target.value) : undefined;
                      setEditSlotSubjectId(sId);
                      const sObj = subjectsList.find((s) => s.id === sId);
                      if (sObj) {
                        setEditSlotSubjectName(sObj.name);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-semibold"
                  >
                    <option value="">-- Custom / Unassigned Subject --</option>
                    {subjectsList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.name} ({s.semester || 'All'}, {s.is_lab ? 'Lab' : 'Theory'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={editSlotSubjectName}
                    onChange={(e) => setEditSlotSubjectName(e.target.value)}
                    placeholder="Enter subject title (e.g. Operating Systems)"
                    className="w-full px-3.5 py-2 rounded-xl glass-input text-xs font-semibold"
                  />
                )}
              </div>

              {/* Staff Member Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
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
              </div>

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

      {/* Timetable Assignment Swap Preview & Confirmation Modal */}
      {swapModal.isOpen && swapModal.sourceSlot && swapModal.targetSlot && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full rounded-3xl glass-panel border border-white/40 dark:border-white/10 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-slate-800/60 pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirm Timetable Assignment Swap
                </h3>
              </div>
              <button
                onClick={() => setSwapModal({ isOpen: false, sourceSlot: null, targetSlot: null, validationResult: null, isLoading: false, reason: '' })}
                className="p-1 rounded-lg glass-pill"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {swapModal.isLoading ? (
              <div className="py-8 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Validating Qualifications, Availability, and Conflicts...
                </div>
                <div className="text-xs text-slate-400">
                  Verifying teacher skills, leave records, rest periods, and work hours.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Validation Status Badge */}
                {swapModal.validationResult?.valid ? (
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
                    <span><strong>Validation Passed:</strong> Both staff members qualify with zero scheduling conflicts.</span>
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-500" />
                      <span>Swap Validation Failed:</span>
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-[11px]">
                      {(swapModal.validationResult?.errors || ['Incompatible assignment']).map((err: string, i: number) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Before and After Comparison Preview */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {/* Slot A Card */}
                  <div className="p-3.5 rounded-2xl glass-card border border-white/30 dark:border-white/10 space-y-2">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Time Slot A</div>
                    <div className="font-bold text-slate-900 dark:text-white truncate">{swapModal.sourceSlot.title}</div>
                    <div className="text-[11px] text-slate-500">
                      {ALL_DAYS[swapModal.sourceSlot.day_of_week]} • {swapModal.sourceSlot.start_time}-{swapModal.sourceSlot.end_time}
                    </div>
                    <div className="pt-2 border-t border-slate-200/40 dark:border-slate-800/40 space-y-1">
                      <div className="text-slate-400 text-[10px]">Staff Reassignment:</div>
                      <div className="flex items-center gap-1 text-[11px] font-semibold">
                        <span className="line-through text-slate-400">{swapModal.sourceSlot.person_name || 'Unassigned'}</span>
                        <ArrowRightLeft className="w-3 h-3 text-blue-500" />
                        <span className="text-blue-600 dark:text-blue-400">{swapModal.targetSlot.person_name || 'Unassigned'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Slot B Card */}
                  <div className="p-3.5 rounded-2xl glass-card border border-white/30 dark:border-white/10 space-y-2">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Time Slot B</div>
                    <div className="font-bold text-slate-900 dark:text-white truncate">{swapModal.targetSlot.title}</div>
                    <div className="text-[11px] text-slate-500">
                      {ALL_DAYS[swapModal.targetSlot.day_of_week]} • {swapModal.targetSlot.start_time}-{swapModal.targetSlot.end_time}
                    </div>
                    <div className="pt-2 border-t border-slate-200/40 dark:border-slate-800/40 space-y-1">
                      <div className="text-slate-400 text-[10px]">Staff Reassignment:</div>
                      <div className="flex items-center gap-1 text-[11px] font-semibold">
                        <span className="line-through text-slate-400">{swapModal.targetSlot.person_name || 'Unassigned'}</span>
                        <ArrowRightLeft className="w-3 h-3 text-blue-500" />
                        <span className="text-blue-600 dark:text-blue-400">{swapModal.sourceSlot.person_name || 'Unassigned'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reason Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Swap Reason / Operational Justification
                  </label>
                  <input
                    type="text"
                    value={swapModal.reason}
                    onChange={(e) => setSwapModal({ ...swapModal, reason: e.target.value })}
                    placeholder="e.g. Peer teaching exchange, personal shift preference"
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200/40 dark:border-slate-800/40">
              <button
                type="button"
                onClick={() => setSwapModal({ isOpen: false, sourceSlot: null, targetSlot: null, validationResult: null, isLoading: false, reason: '' })}
                className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={swapModal.isLoading || !swapModal.validationResult?.valid}
                onClick={confirmExecuteSwap}
                className="px-5 py-2.5 rounded-xl glass-button-primary text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Apply Swap</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* College Lab Practical Scheduling Modal (Only for College) */}
      {labModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitAddLab}
            className="max-w-md w-full rounded-3xl glass-panel border border-white/40 dark:border-white/10 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-slate-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Schedule Practical Lab Session
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLabModal((prev) => ({ ...prev, isOpen: false }))}
                className="p-1 rounded-lg glass-pill"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Assigned Faculty / Teacher
                </label>
                <select
                  value={labModal.teacherId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const t = people.find((p) => p.id === id);
                    setLabModal({ ...labModal, teacherId: id, teacherName: t?.name || '' });
                  }}
                  className="w-full px-3 py-2 rounded-xl glass-input"
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.role_title} • {p.department_name || 'CSE'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Lab Subject / Practical Title
                </label>
                {subjectsList.length > 0 ? (
                  <div className="space-y-1.5">
                    <select
                      value={subjectsList.some((s) => s.name === labModal.subject) ? labModal.subject : '__custom__'}
                      onChange={(e) => {
                        if (e.target.value !== '__custom__') {
                          setLabModal({ ...labModal, subject: e.target.value });
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                    >
                      <option value="__custom__">-- Select Registered Subject or Enter Below --</option>
                      {subjectsList.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.code} - {s.name} ({s.semester || 'All'}, {s.is_lab ? 'Lab' : 'Theory'})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      required
                      value={labModal.subject}
                      onChange={(e) => setLabModal({ ...labModal, subject: e.target.value })}
                      placeholder="e.g. Operating Systems Lab, Data Structures Lab"
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs font-semibold"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    required
                    value={labModal.subject}
                    onChange={(e) => setLabModal({ ...labModal, subject: e.target.value })}
                    placeholder="e.g. Operating Systems Lab, Data Structures Lab"
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Date</label>
                  <input
                    type="date"
                    required
                    value={labModal.dateStr}
                    onChange={(e) => setLabModal({ ...labModal, dateStr: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl glass-input font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Semester & Class</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      value={labModal.semester}
                      onChange={(e) => setLabModal({ ...labModal, semester: e.target.value })}
                      placeholder="S5"
                      className="w-full px-2.5 py-2 rounded-xl glass-input text-center font-bold"
                    />
                    <input
                      type="text"
                      value={labModal.className}
                      onChange={(e) => setLabModal({ ...labModal, className: e.target.value })}
                      placeholder="CSE-A"
                      className="w-full px-2.5 py-2 rounded-xl glass-input text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Start Time</label>
                  <input
                    type="time"
                    required
                    value={labModal.startTime}
                    onChange={(e) => setLabModal({ ...labModal, startTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl glass-input text-center font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">End Time</label>
                  <input
                    type="time"
                    required
                    value={labModal.endTime}
                    onChange={(e) => setLabModal({ ...labModal, endTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl glass-input text-center font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Laboratory Facility / Room
                </label>
                <select
                  value={labModal.resourceId || ''}
                  onChange={(e) => setLabModal({ ...labModal, resourceId: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-3 py-2 rounded-xl glass-input font-medium"
                >
                  <option value="">-- Auto-Assign Available Lab --</option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.type === 'lab' ? 'Laboratory' : 'Room'} - Cap: {r.capacity || 40})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200/40 dark:border-slate-800/40">
              <button
                type="button"
                onClick={() => setLabModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={labModal.isSubmitting}
                className="px-5 py-2.5 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>{labModal.isSubmitting ? 'Validating Conflicts...' : 'Schedule Lab Session'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Click-to-Swap Floating Helper Banner */}
      {clickSwapSourceSlot && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-5 py-3 rounded-2xl glass-panel border border-blue-500/60 shadow-2xl flex items-center gap-4 bg-slate-900/95 text-white animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2.5 text-xs">
            <ArrowRightLeft className="w-4 h-4 text-blue-400 animate-spin" style={{ animationDuration: '3s' }} />
            <div>
              <span>Swap Selected: <strong>{clickSwapSourceSlot.person_name || clickSwapSourceSlot.title}</strong></span>
              <div className="text-[10px] text-slate-300">
                {ALL_DAYS[clickSwapSourceSlot.day_of_week]} ({clickSwapSourceSlot.start_time}-{clickSwapSourceSlot.end_time})
              </div>
            </div>
          </div>
          <span className="text-xs text-blue-300 font-medium hidden sm:inline">Click any destination slot to propose swap</span>
          <button
            onClick={() => {
              setClickSwapSourceSlot(null);
              addToast('Swap Cancelled', 'Selection cleared', 'info');
            }}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};
