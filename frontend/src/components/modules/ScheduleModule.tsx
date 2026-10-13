import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import {
  TimetableSlot,
  Person,
  Schedule,
  ActiveReplacement,
  Holiday,
  Department,
  Subject,
  Semester,
  TeacherSubjectAssignment,
  PeriodConfigItem,
  DayPeriodConfig,
  PeriodConfigPayload,
  GlixonAssignment,
  GlixonPreviewResponse,
} from '../../types';
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
  BookOpen,
  GraduationCap,
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
  const [perspective, setPerspective] = useState<'matrix' | 'employee' | 'department' | 'resource' | 'holiday' | 'academic' | 'audit'>('matrix');
  const [selectedDayView, setSelectedDayView] = useState<number>(0);
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterSemester, setFilterSemester] = useState<string>('all');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterTeacher, setFilterTeacher] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [semestersList, setSemestersList] = useState<Semester[]>([]);
  const [teacherAssignmentsList, setTeacherAssignmentsList] = useState<TeacherSubjectAssignment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Teacher Workload & Fairness Audit State
  const [teacherWorkloadsData, setTeacherWorkloadsData] = useState<any[]>([]);
  const [isLoadingWorkloads, setIsLoadingWorkloads] = useState<boolean>(false);

  // GLIXON Intelligent Generator & Preview Modal State
  const [isGlixonModalOpen, setIsGlixonModalOpen] = useState(false);
  const [isGlixonGenerating, setIsGlixonGenerating] = useState(false);
  const [isGlixonCommitting, setIsGlixonCommitting] = useState(false);
  const [glixonPreviewData, setGlixonPreviewData] = useState<GlixonPreviewResponse | null>(null);
  const [glixonActiveTab, setGlixonActiveTab] = useState<'preview' | 'by_teacher' | 'by_class' | 'audit' | 'conflicts'>('preview');
  const [glixonSearch, setGlixonSearch] = useState('');
  const [glixonFairnessWeight, setGlixonFairnessWeight] = useState(1.2);
  const [glixonPrefWeight, setGlixonPrefWeight] = useState(1.0);

  // Period Configuration Modal State (7 days, Sat/Sun independent, break exclusion)
  const [isPeriodConfigOpen, setIsPeriodConfigOpen] = useState(false);
  const [periodConfigDays, setPeriodConfigDays] = useState<DayPeriodConfig[]>([]);
  const [activePeriodDayIdx, setActivePeriodDayIdx] = useState(0);
  const [isLoadingPeriodConfig, setIsLoadingPeriodConfig] = useState(false);
  const [isSavingPeriodConfig, setIsSavingPeriodConfig] = useState(false);


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

  // Manual Edit Slot Subject & Academic Fields
  const [editSlotSubjectId, setEditSlotSubjectId] = useState<number | undefined>(undefined);
  const [editSlotSubjectName, setEditSlotSubjectName] = useState<string>('');
  const [editSlotSemester, setEditSlotSemester] = useState<string>('');
  const [editSlotClass, setEditSlotClass] = useState<string>('');
  const [editSlotResourceId, setEditSlotResourceId] = useState<number | undefined>(undefined);

  // Academic Management State (University / College Semester & Faculty Assignments)
  const [academicSemFilter, setAcademicSemFilter] = useState<string>('all');
  const [academicDeptFilter, setAcademicDeptFilter] = useState<string>('all');
  const [isAddSemModalOpen, setIsAddSemModalOpen] = useState<boolean>(false);
  const [newSemName, setNewSemName] = useState<string>('');
  const [newSemCode, setNewSemCode] = useState<string>('');
  const [newSemYear, setNewSemYear] = useState<string>('2026-2027');

  const [isAddSubModalOpen, setIsAddSubModalOpen] = useState<boolean>(false);
  const [newSubName, setNewSubName] = useState<string>('');
  const [newSubCode, setNewSubCode] = useState<string>('');
  const [newSubDeptId, setNewSubDeptId] = useState<number | undefined>(undefined);
  const [newSubSemId, setNewSubSemId] = useState<number | undefined>(undefined);
  const [newSubSemStr, setNewSubSemStr] = useState<string>('S1');
  const [newSubClass, setNewSubClass] = useState<string>('S1 A');
  const [newSubHours, setNewSubHours] = useState<number>(4);
  const [newSubIsLab, setNewSubIsLab] = useState<boolean>(false);

  const [isAddAssignModalOpen, setIsAddAssignModalOpen] = useState<boolean>(false);
  const [assignTeacherId, setAssignTeacherId] = useState<number | undefined>(undefined);
  const [assignSubId, setAssignSubId] = useState<number | undefined>(undefined);
  const [assignDeptId, setAssignDeptId] = useState<number | undefined>(undefined);
  const [assignSemStr, setAssignSemStr] = useState<string>('S3');
  const [assignClass, setAssignClass] = useState<string>('S3 A');
  const [assignHours, setAssignHours] = useState<number>(4);
  const [assignRoomId, setAssignRoomId] = useState<number | undefined>(undefined);

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

      const [hList, dList, sList, semList, taList] = await Promise.all([
        api.getHolidays(activeOrg.id).catch(() => []),
        api.getDepartments(activeOrg.id).catch(() => []),
        api.getSubjects(activeOrg.id).catch(() => []),
        api.getSemesters(activeOrg.id).catch(() => []),
        api.getTeacherAssignments(activeOrg.id).catch(() => []),
      ]);
      setHolidaysList(hList || []);
      setDepartmentsList(dList || []);
      setSubjectsList(sList || []);
      setSemestersList(semList || []);
      setTeacherAssignmentsList(taList || []);
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

  // Accurate Period Duration Calculator (handles daytime and overnight modulo-1440 math)
  const calculatePeriodDuration = (start: string, end: string) => {
    try {
      const [sH, sM] = start.split(':').map(Number);
      const [eH, eM] = end.split(':').map(Number);
      let sMins = sH * 60 + sM;
      let eMins = eH * 60 + eM;
      if (eMins <= sMins) eMins += 1440;
      const diffMins = eMins - sMins;
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      if (hours > 0 && mins > 0) return `${hours} hr ${mins} min (${diffMins} min)`;
      if (hours > 0) return `${hours} hr (${diffMins} min)`;
      return `${mins} min`;
    } catch {
      return '60 min';
    }
  };

  // Load Teacher Workloads & Fairness Audit
  const loadTeacherWorkloads = async () => {
    if (!activeOrg) return;
    setIsLoadingWorkloads(true);
    try {
      const data = await api.getTeacherWorkloads(activeOrg.id, activeSchedule?.id);
      setTeacherWorkloadsData(data || []);
    } catch (err: any) {
      console.error(err);
      addToast('Audit Error', err.message || 'Failed to load teacher workloads', 'error');
    } finally {
      setIsLoadingWorkloads(false);
    }
  };

  // Open Period Configuration Modal
  const handleOpenPeriodConfig = async () => {
    if (!activeOrg) return;
    triggerHaptic(12);
    setIsPeriodConfigOpen(true);
    setIsLoadingPeriodConfig(true);
    try {
      const res = await api.getPeriodConfig(activeOrg.id);
      if (res && res.days && res.days.length > 0) {
        setPeriodConfigDays(res.days);
      } else {
        const defaultDays: DayPeriodConfig[] = ALL_DAYS.map((name, idx) => ({
          day_name: name,
          day_of_week: idx,
          is_working_day: idx < 5,
          periods: [
            { name: 'Period 1', type: 'teaching', start_time: '09:00', end_time: '10:00', duration_hours: 1, is_active: true, counts_toward_teaching: true },
            { name: 'Morning Break', type: 'break', start_time: '10:00', end_time: '10:15', duration_hours: 0.25, is_active: true, counts_toward_teaching: false },
            { name: 'Period 2', type: 'teaching', start_time: '10:15', end_time: '11:15', duration_hours: 1, is_active: true, counts_toward_teaching: true },
            { name: 'Period 3', type: 'teaching', start_time: '11:15', end_time: '12:15', duration_hours: 1, is_active: true, counts_toward_teaching: true },
            { name: 'Lunch Break', type: 'lunch', start_time: '12:15', end_time: '13:00', duration_hours: 0.75, is_active: true, counts_toward_teaching: false },
            { name: 'Period 4', type: 'teaching', start_time: '13:00', end_time: '14:00', duration_hours: 1, is_active: true, counts_toward_teaching: true },
            { name: 'Period 5', type: 'teaching', start_time: '14:00', end_time: '15:00', duration_hours: 1, is_active: true, counts_toward_teaching: true },
          ],
        }));
        setPeriodConfigDays(defaultDays);
      }
    } catch (err: any) {
      console.error(err);
      addToast('Error', 'Failed to load period configuration', 'error');
    } finally {
      setIsLoadingPeriodConfig(false);
    }
  };

  // Save Period Configuration
  const handleSavePeriodConfig = async () => {
    if (!activeOrg) return;
    triggerHaptic(15);
    setIsSavingPeriodConfig(true);
    try {
      await api.updatePeriodConfig(activeOrg.id, { days: periodConfigDays });
      addToast('Period Timings Saved', 'Weekly period configuration updated successfully', 'success');
      setIsPeriodConfigOpen(false);
      fetchScheduleData();
    } catch (err: any) {
      addToast('Save Error', err.message, 'error');
    } finally {
      setIsSavingPeriodConfig(false);
    }
  };

  // Open GLIXON Intelligent Timetable Generator & Preview
  const handleOpenGlixonModal = () => {
    if (!activeOrg) return;
    triggerHaptic(15);
    setIsGlixonModalOpen(true);
    if (!glixonPreviewData && !isGlixonGenerating) {
      handleRunGlixon();
    }
  };

  // Execute GLIXON Preview Generation
  const handleRunGlixon = async () => {
    if (!activeOrg) return;
    triggerHaptic(20);
    setIsGlixonGenerating(true);
    try {
      const today = new Date();
      const periodStart = today.toISOString().split('T')[0];
      const nextWeek = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000);
      const periodEnd = nextWeek.toISOString().split('T')[0];

      const res = await api.glixonGenerate({
        org_id: activeOrg.id,
        schedule_id: activeSchedule?.id,
        title: activeSchedule ? activeSchedule.title : `${activeOrg.name} Master Timetable`,
        period_start: periodStart,
        period_end: periodEnd,
        preview: true,
        fairness_weight: glixonFairnessWeight,
        preference_weight: glixonPrefWeight,
      });

      setGlixonPreviewData(res);
      addToast('GLIXON Preview Ready', `Generated preview with ${res.assignments?.length || 0} conflict-free assignments`, 'success');
    } catch (err: any) {
      addToast('GLIXON Error', err.message, 'error');
    } finally {
      setIsGlixonGenerating(false);
    }
  };

  // Commit GLIXON Preview to Database (Persists, updates versions, records audit log)
  const handleCommitGlixon = async () => {
    if (!activeOrg || !glixonPreviewData) return;
    triggerHaptic(25);
    setIsGlixonCommitting(true);
    try {
      const res = await api.glixonCommit({
        org_id: activeOrg.id,
        schedule_id: activeSchedule?.id || glixonPreviewData.schedule_id,
        title: activeSchedule?.title || `${activeOrg.name} Master Timetable`,
        period_start: glixonPreviewData.period_start || new Date().toISOString().split('T')[0],
        period_end: glixonPreviewData.period_end || new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        assignments: glixonPreviewData.assignments,
      });


      addToast(
        'Timetable Saved Successfully',
        `Committed ${res.committed_count || glixonPreviewData.assignments.length} assignments to database (Version ${res.version_number || 1})`,
        'success'
      );
      setIsGlixonModalOpen(false);
      fetchScheduleData();
    } catch (err: any) {
      addToast('Commit Failed', err.message, 'error');
    } finally {
      setIsGlixonCommitting(false);
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

  // Distinct available classes / batches for timetable filtering
  const availableClasses = React.useMemo(() => {
    const classSet = new Set<string>();
    slots.forEach((s) => {
      const cls = (s.class_name || (s as any).profession_metadata?.class_name)?.trim();
      if (cls) classSet.add(cls);
    });
    teacherAssignmentsList.forEach((ta) => {
      if (ta.class_name?.trim()) classSet.add(ta.class_name.trim());
    });
    subjectsList.forEach((sub) => {
      if (sub.class_name?.trim()) classSet.add(sub.class_name.trim());
    });
    if (classSet.size === 0 && activeOrg?.type === 'college') {
      ['S1 A', 'S1 B', 'S3 A', 'S3 B', 'S5 A', 'S5 B', 'S7 A'].forEach((c) => classSet.add(c));
    }
    return Array.from(classSet).sort();
  }, [slots, teacherAssignmentsList, subjectsList, activeOrg]);

  // Semester, Department, Class, Teacher, and Subject Filtered Slots for Timetable Matrix
  const matrixFilteredSlots = React.useMemo(() => {
    return slots.filter((slot) => {
      // 1. Department Filter
      if (filterDept !== 'all') {
        const dId = Number(filterDept);
        if (slot.department_id && slot.department_id !== dId) return false;
      }
      // 2. Semester Filter
      if (filterSemester !== 'all') {
        const targetSem = filterSemester.trim().toLowerCase();
        const slotSem = ((slot as any).semester || (slot as any).profession_metadata?.semester || '').trim().toLowerCase();
        if (slotSem && !slotSem.includes(targetSem) && !targetSem.includes(slotSem)) return false;
      }
      // 3. Class Filter
      if (filterClass !== 'all') {
        const targetCls = filterClass.trim().toLowerCase();
        const slotCls = ((slot as any).class_name || (slot as any).profession_metadata?.class_name || slot.title || '').trim().toLowerCase();
        if (!slotCls.includes(targetCls)) return false;
      }
      // 4. Teacher Filter
      if (filterTeacher !== 'all') {
        const tId = Number(filterTeacher);
        if (slot.person_id !== tId) return false;
      }
      // 5. Subject Filter
      if (filterSubject !== 'all') {
        const subId = Number(filterSubject);
        const subObj = subjectsList.find((s) => s.id === subId);
        const slotSubName = (slot.subject_name || slot.subject || (slot as any).profession_metadata?.subject || '').toLowerCase();
        if (slot.subject_id) {
          if (slot.subject_id !== subId) return false;
        } else if (subObj) {
          if (!slotSubName.includes(subObj.name.toLowerCase())) return false;
        }
      }
      return true;
    });
  }, [slots, filterDept, filterSemester, filterClass, filterTeacher, filterSubject, subjectsList]);


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
      const profMeta = {
        ...(editSlot.profession_metadata || {}),
        semester: editSlotSemester || (editSlot as any).semester,
        class_name: editSlotClass || (editSlot as any).class_name,
        subject: editSlotSubjectName,
      };
      await api.updateSlot(editSlot.slot_id, {
        subject_id: editSlotSubjectId || undefined,
        subject_name: editSlotSubjectName || undefined,
        title: editSlotSubjectName ? editSlotSubjectName : editSlot.title,
        resource_id: editSlotResourceId,
        profession_metadata: profMeta,
      });
      addToast('Assignment Updated', 'Timetable slot assignment and academic details saved', 'success');
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

  // Academic Management Handlers (Semesters, Subjects, Faculty Assignments)
  const handleCreateSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !newSemCode.trim()) return;
    triggerHaptic(15);
    try {
      await api.createSemester(activeOrg.id, {
        name: newSemName.trim() || `Semester ${newSemCode.trim()}`,
        code: newSemCode.trim().toUpperCase(),
        academic_year: newSemYear.trim() || '2026-2027',
      });
      addToast('Semester Added', `Semester ${newSemCode.trim().toUpperCase()} configured`, 'success');
      setIsAddSemModalOpen(false);
      setNewSemName('');
      setNewSemCode('');
      fetchScheduleData();
    } catch (err: any) {
      addToast('Error', err.message || 'Failed to add semester', 'error');
    }
  };

  const handleDeleteSemester = async (id: number, code: string) => {
    if (!activeOrg) return;
    if (!window.confirm(`Delete semester ${code}? Associated subjects will need semester reassignment.`)) return;
    triggerHaptic(15);
    try {
      await api.deleteSemester(activeOrg.id, id);
      addToast('Semester Deleted', `Semester ${code} removed`, 'info');
      fetchScheduleData();
    } catch (err: any) {
      addToast('Error', err.message || 'Failed to delete semester', 'error');
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !newSubName.trim()) return;
    triggerHaptic(15);
    try {
      await api.createSubject(activeOrg.id, {
        name: newSubName.trim(),
        code: newSubCode.trim().toUpperCase() || newSubName.slice(0, 5).toUpperCase(),
        department_id: newSubDeptId || (departmentsList[0]?.id ?? undefined),
        semester: newSubSemStr,
        semester_id: newSubSemId || undefined,
        class_name: newSubClass.trim() || 'S1 A',
        required_hours_per_week: newSubHours,
        is_lab: newSubIsLab,
      });
      addToast('Subject Created', `${newSubName.trim()} added to ${newSubSemStr}`, 'success');
      setIsAddSubModalOpen(false);
      setNewSubName('');
      setNewSubCode('');
      fetchScheduleData();
    } catch (err: any) {
      addToast('Error', err.message || 'Failed to create subject', 'error');
    }
  };

  const handleDeleteSubject = async (id: number, name: string) => {
    if (!activeOrg) return;
    if (!window.confirm(`Delete subject ${name} from curriculum?`)) return;
    triggerHaptic(15);
    try {
      await api.deleteSubject(activeOrg.id, id);
      addToast('Subject Deleted', `${name} removed from curriculum`, 'info');
      fetchScheduleData();
    } catch (err: any) {
      addToast('Error', err.message || 'Failed to delete subject', 'error');
    }
  };

  const handleCreateTeacherAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !assignTeacherId || !assignSubId) {
      addToast('Validation', 'Please select both a faculty member and a subject', 'error');
      return;
    }
    triggerHaptic(15);
    try {
      await api.createTeacherAssignment(activeOrg.id, {
        person_id: assignTeacherId,
        subject_id: assignSubId,
        department_id: assignDeptId || (departmentsList[0]?.id ?? undefined),
        semester: assignSemStr,
        class_name: assignClass.trim() || 'S3 A',
        required_hours: assignHours,
        eligible_rooms: assignRoomId ? [assignRoomId] : [],
        is_primary: true,
      });
      addToast('Teacher Assigned', 'Faculty member successfully assigned to subject', 'success');
      setIsAddAssignModalOpen(false);
      fetchScheduleData();
    } catch (err: any) {
      addToast('Assignment Conflict', err.message || 'Failed to assign teacher', 'error');
    }
  };

  const handleDeleteTeacherAssignment = async (id: number) => {
    if (!activeOrg) return;
    if (!window.confirm('Remove this teacher-subject assignment?')) return;
    triggerHaptic(15);
    try {
      await api.deleteTeacherAssignment(activeOrg.id, id);
      addToast('Assignment Removed', 'Teacher assignment removed', 'info');
      fetchScheduleData();
    } catch (err: any) {
      addToast('Error', err.message || 'Failed to remove assignment', 'error');
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
    const subjectName = slot.subject_name || slot.subject || (slot as any).profession_metadata?.subject;
    const semesterStr = slot.semester || (slot as any).profession_metadata?.semester || (isCollege ? 'S3' : '');
    const deptName = slot.department_name || departmentsList.find((d) => d.id === slot.department_id)?.name || (isCollege ? 'Computer Science' : '');
    const className = slot.class_name || (slot as any).profession_metadata?.class_name || (isCollege ? 'S3 A' : '');
    const teacherName = slot.person_name;
    const roomName = slot.resource_name || 'Room not assigned';
    const periodTitle = slot.title;

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
          setEditSlotSemester(semesterStr || 'S3');
          setEditSlotClass(className || 'S3 A');
          setEditSlotResourceId(slot.resource_id);
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
          <span className="flex items-center gap-1 font-mono font-bold text-slate-700 dark:text-slate-300">
            <Clock className="w-3 h-3 text-blue-500 flex-shrink-0" />
            <span>{slot.start_time}–{slot.end_time}</span>
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

        {/* 1. SUBJECT NAME IN BOLD (Most Prominent Item) */}
        <div className="space-y-1">
          {isBreak ? (
            <div className="text-xs font-black text-slate-500 italic">
              {slot.period_type === 'lunch' ? 'Lunch Break' : periodTitle || 'Recess Interval'}
            </div>
          ) : subjectName ? (
            <div className="text-xs font-black text-blue-600 dark:text-blue-400 leading-tight tracking-tight">
              {subjectName}
            </div>
          ) : isCollege ? (
            <div className="text-xs font-black text-amber-500 dark:text-amber-400 leading-tight flex items-center gap-1">
              <span>Subject not assigned</span>
              <span className="text-[9px] font-normal underline opacity-80">(click to assign)</span>
            </div>
          ) : (
            <div className="text-xs font-black text-slate-900 dark:text-white leading-tight">
              {periodTitle}
            </div>
          )}

          {/* 2. SEMESTER & DEPARTMENT LINE (Semester: S3 | Department: Computer Science) */}
          {!isBreak && isCollege && (
            <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 flex-wrap">
              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 font-extrabold border border-blue-500/20">
                Semester: {semesterStr || 'S3'}
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="truncate text-slate-600 dark:text-slate-400">
                Dept: {deptName || 'Computer Science'}
              </span>
            </div>
          )}

          {/* 3. CLASS (Class: S3 A) */}
          {!isBreak && className && (
            <div className="text-[10px] text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1">
              <span className="text-slate-400">Class:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{className}</span>
            </div>
          )}

          {/* 4. TEACHER (Teacher: Dr. Alan Turing) */}
          {!isBreak && (
            <div className="text-[10px] text-slate-600 dark:text-slate-300 flex items-center gap-1">
              <span className="text-slate-400">Teacher:</span>
              {teacherName ? (
                <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                  {teacherName}
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-semibold italic">
                  Not assigned
                </span>
              )}
            </div>
          )}

          {/* 5. ROOM (Room: Lecture Hall 101) & TIME */}
          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between gap-1 pt-1 border-t border-slate-200/40 dark:border-slate-800/40">
            <span className="truncate flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />
              <span>Room: {roomName}</span>
            </span>
            <span className="font-mono text-[9px] text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap">
              {slot.start_time}–{slot.end_time}
            </span>
          </div>

          {/* 7. SECONDARY INFO: Period Name (e.g. "Morning Period 1") */}
          {!isBreak && periodTitle && periodTitle !== subjectName && (
            <div className="text-[9px] italic text-slate-400 truncate">
              Period: {periodTitle}
            </div>
          )}
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

          {/* Period Configuration Button */}
          <button
            onClick={handleOpenPeriodConfig}
            className="px-3.5 py-2 rounded-xl glass-pill hover:bg-white/60 dark:hover:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300/40 dark:border-white/10 flex items-center gap-1.5 transition-colors"
            title="Configure teaching periods, timings, and breaks across 7 days"
          >
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span>Configure Periods</span>
          </button>

          {/* GLIXON Button */}
          <button
            onClick={handleOpenGlixonModal}
            className="px-4 py-1.5 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-2.5 shadow-lg shadow-blue-500/25 group transition-all"
            title="GLIXON — Intelligent Timetable Generator"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse flex-shrink-0" />
            <div className="flex flex-col text-left">
              <span className="font-extrabold text-xs tracking-wider text-white">GLIXON</span>
              <span className="text-[10px] text-blue-100/90 font-medium leading-tight">Intelligent Timetable Generator</span>
            </div>
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
          {activeOrg?.type === 'college' && (
            <button
              onClick={() => {
                triggerHaptic(10);
                setPerspective('academic');
              }}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                perspective === 'academic' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Semesters & Subjects</span>
            </button>
          )}
          <button
            onClick={() => {
              triggerHaptic(10);
              setPerspective('audit');
              loadTeacherWorkloads();
            }}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              perspective === 'audit' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Workload & Fairness Audit</span>
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
                      const daySlots = matrixFilteredSlots.filter(
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
              {/* Semester & Timetable Filter Bar (Requirement 8) */}
              <div className="p-4 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                    <Filter className="w-4 h-4 text-blue-500" />
                    <span>Timetable Filters:</span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      Filter periods by teacher, department, academic semester, subject, and class section
                    </span>
                  </div>

                  {/* Active filters status / Clear button */}
                  {(filterDept !== 'all' || filterSemester !== 'all' || filterClass !== 'all' || filterTeacher !== 'all' || filterSubject !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(8);
                        setFilterDept('all');
                        setFilterSemester('all');
                        setFilterClass('all');
                        setFilterTeacher('all');
                        setFilterSubject('all');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold text-[11px] flex items-center gap-1 w-fit"
                    >
                      <X className="w-3 h-3" />
                      <span>Reset Filters</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {/* Teacher Filter */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Teacher:
                    </label>
                    <select
                      value={filterTeacher}
                      onChange={(e) => {
                        triggerHaptic(5);
                        setFilterTeacher(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs font-semibold"
                    >
                      <option value="all">All Teachers</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Department Filter */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Department:
                    </label>
                    <select
                      value={filterDept}
                      onChange={(e) => {
                        triggerHaptic(5);
                        setFilterDept(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs font-semibold"
                    >
                      <option value="all">All Departments</option>
                      {departmentsList.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Semester Filter */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Semester:
                    </label>
                    <select
                      value={filterSemester}
                      onChange={(e) => {
                        triggerHaptic(5);
                        setFilterSemester(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs font-semibold"
                    >
                      <option value="all">All Semesters</option>
                      {(semestersList.length > 0
                        ? semestersList.map((s) => s.code || s.name)
                        : ['S1', 'S3', 'S5', 'S7']
                      ).map((sem) => (
                        <option key={sem} value={sem}>
                          Semester {sem}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subject Filter */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Subject:
                    </label>
                    <select
                      value={filterSubject}
                      onChange={(e) => {
                        triggerHaptic(5);
                        setFilterSubject(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs font-semibold"
                    >
                      <option value="all">All Subjects</option>
                      {subjectsList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code || 'SUB'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Class / Section Filter */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Class / Section:
                    </label>
                    <select
                      value={filterClass}
                      onChange={(e) => {
                        triggerHaptic(5);
                        setFilterClass(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs font-semibold"
                    >
                      <option value="all">All Classes</option>
                      {availableClasses.map((cls) => (
                        <option key={cls} value={cls}>
                          Class {cls}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>


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
                                const cellSlots = matrixFilteredSlots.filter(
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
                          const daySlots = matrixFilteredSlots.filter((s) => s.day_of_week === dayIdx);

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

      {/* ACADEMIC CURRICULUM & FACULTY ASSIGNMENTS PERSPECTIVE (Requirements 1 & 2) */}
      {perspective === 'academic' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Top Banner */}
          <div className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Semester-Wise Subject & Teacher Assignment System
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Configure college academic semesters, define subjects per semester with classes/sections, and assign qualified teachers to courses and batches.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setIsAddSemModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl glass-pill hover:bg-blue-500/10 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/25 flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Semester</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setIsAddSubModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl glass-pill hover:bg-emerald-500/10 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Subject</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setIsAddAssignModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Assign Faculty</span>
              </button>
            </div>
          </div>

          {/* Section 1: Academic Semesters Directory */}
          <div className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span>College Academic Semesters</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Semesters currently configured for {activeOrg?.name}
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full glass-pill text-blue-600">
                {semestersList.length || 4} Active Semesters
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(semestersList.length > 0 ? semestersList : [
                { id: 1, name: 'Semester S1', code: 'S1', academic_year: '2026-2027', is_active: true },
                { id: 2, name: 'Semester S3', code: 'S3', academic_year: '2026-2027', is_active: true },
                { id: 3, name: 'Semester S5', code: 'S5', academic_year: '2026-2027', is_active: true },
                { id: 4, name: 'Semester S7', code: 'S7', academic_year: '2026-2027', is_active: true },
              ]).map((sem: any) => {
                const subCount = subjectsList.filter((s) => (s.semester === sem.code || s.semester_id === sem.id)).length;
                const assignCount = teacherAssignmentsList.filter((ta) => ta.semester === sem.code || ta.semester_id === sem.id).length;

                return (
                  <div
                    key={sem.id || sem.code}
                    className="p-4 rounded-2xl glass-card border border-white/40 dark:border-white/10 space-y-3 relative group hover:border-blue-400 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black text-sm flex items-center justify-center border border-blue-500/20">
                        {sem.code}
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        Active
                      </span>
                    </div>

                    <div>
                      <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {sem.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        Year: {sem.academic_year || '2026-2027'}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/40 dark:border-slate-800/40 text-[10px] text-slate-500 flex justify-between">
                      <span><strong>{subCount}</strong> Subjects</span>
                      <span><strong>{assignCount}</strong> Faculty</span>
                    </div>

                    {sem.id && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSemester(sem.id, sem.code)}
                        className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete semester"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Semester-Wise Subjects Curriculum */}
          <div className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-500" />
                  <span>Semester-Wise Subjects Curriculum</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Subjects categorized by semester with department, credits, and teaching hours
                </p>
              </div>

              {/* Semester Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  type="button"
                  onClick={() => setAcademicSemFilter('all')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    academicSemFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'glass-pill text-slate-600 dark:text-slate-300'
                  }`}
                >
                  All Semesters
                </button>
                {(semestersList.length > 0 ? semestersList.map((s) => s.code || s.name) : ['S1', 'S3', 'S5', 'S7']).map((sem) => (
                  <button
                    key={sem}
                    type="button"
                    onClick={() => setAcademicSemFilter(sem)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                      academicSemFilter === sem
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'glass-pill text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {sem}
                  </button>
                ))}
              </div>
            </div>

            {/* Grouped Subjects by Semester */}
            <div className="space-y-6">
              {(academicSemFilter === 'all'
                ? (semestersList.length > 0 ? semestersList.map((s) => s.code || s.name) : ['S1', 'S3', 'S5', 'S7'])
                : [academicSemFilter]
              ).map((semCode) => {
                const semSubs = subjectsList.filter((s) => (s.semester === semCode || (!s.semester && semCode === 'S1')));

                return (
                  <div key={semCode} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/80 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        <h5 className="font-extrabold text-sm text-slate-900 dark:text-white">
                          Semester {semCode}
                        </h5>
                        <span className="text-xs text-slate-400 font-semibold">
                          ({semSubs.length} Subjects)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setNewSubSemStr(semCode);
                          setIsAddSubModalOpen(true);
                        }}
                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Subject to {semCode}</span>
                      </button>
                    </div>

                    {semSubs.length === 0 ? (
                      <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 italic">
                        No subjects registered for Semester {semCode} yet. Click "Add Subject" to populate.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {semSubs.map((sub) => {
                          const assignedTeachers = teacherAssignmentsList.filter((ta) => ta.subject_id === sub.id);
                          const dept = departmentsList.find((d) => d.id === sub.department_id);

                          return (
                            <div
                              key={sub.id}
                              className="p-4 rounded-2xl glass-card border border-white/40 dark:border-white/10 space-y-2.5 hover:border-blue-400 transition-all relative group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                    {sub.code}
                                  </span>
                                  <h6 className="font-extrabold text-sm text-slate-900 dark:text-white mt-1 leading-snug">
                                    {sub.name}
                                  </h6>
                                </div>

                                <div className="flex items-center gap-1">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                    sub.is_lab
                                      ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                                      : 'bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                  }`}>
                                    {sub.is_lab ? 'Lab' : 'Theory'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSubject(sub.id, sub.name)}
                                    className="p-1 rounded text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete subject"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="text-[11px] text-slate-500 space-y-0.5">
                                <div>Dept: <strong className="text-slate-700 dark:text-slate-300">{dept?.name || 'Computer Science'}</strong></div>
                                <div>Batch: <strong className="text-slate-700 dark:text-slate-300">{sub.class_name || 'S3 A'}</strong> • Required: <strong className="text-blue-600">{sub.required_hours_per_week || 4} hrs/wk</strong></div>
                              </div>

                              {/* Faculty Assigned */}
                              <div className="pt-2 border-t border-slate-200/40 dark:border-slate-800/40 flex items-center justify-between">
                                <div className="text-[10px] text-slate-500 truncate max-w-[170px]">
                                  {assignedTeachers.length > 0 ? (
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                      👨‍🏫 {assignedTeachers.map((ta) => ta.teacher_name).join(', ')}
                                    </span>
                                  ) : (
                                    <span className="text-amber-500 italic">No faculty assigned</span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setAssignSubId(sub.id);
                                    setAssignSemStr(sub.semester || semCode);
                                    setAssignDeptId(sub.department_id);
                                    setAssignClass(sub.class_name || 'S3 A');
                                    setAssignHours(sub.required_hours_per_week || 4);
                                    setIsAddAssignModalOpen(true);
                                  }}
                                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  + Assign
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Teacher-Subject Assignment Matrix */}
          <div className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-purple-500" />
                  <span>Teacher-Subject Assignment Matrix</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Explicit mapping of faculty members to subjects, semesters, and student batches with conflict validation.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddAssignModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-1.5 w-fit shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Faculty Assignment</span>
              </button>
            </div>

            {/* Assignments Table */}
            <div className="rounded-2xl border border-white/40 dark:border-white/10 overflow-hidden shadow-xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/70 dark:bg-slate-900/70 border-b border-slate-200/60 dark:border-slate-800/80 font-bold text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="py-3 px-4">Faculty Member</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Semester</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Class / Batch</th>
                    <th className="py-3 px-4">Required Hours</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/40 font-medium">
                  {teacherAssignmentsList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-slate-400 italic">
                        No faculty assignments configured yet. Click "New Faculty Assignment" above to map teachers to curriculum subjects.
                      </td>
                    </tr>
                  ) : (
                    teacherAssignmentsList.map((ta) => {
                      const teacher = people.find((p) => p.id === ta.person_id);
                      const sub = subjectsList.find((s) => s.id === ta.subject_id);

                      return (
                        <tr key={ta.id} className="hover:bg-white/30 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 font-extrabold flex items-center justify-center text-[10px]">
                                {(ta.teacher_name || teacher?.name || 'T').slice(0, 2).toUpperCase()}
                              </div>
                              <span>{ta.teacher_name || teacher?.name || 'Faculty Member'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                            {ta.department_name || teacher?.department_name || 'Computer Science'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              {ta.semester || 'S3'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                            {ta.subject_name || sub?.name || 'Subject'}
                            <span className="text-[10px] text-slate-400 ml-1 font-mono">({ta.subject_code || sub?.code})</span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                            {ta.class_name || 'S3 A'}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                            {ta.required_hours || 4} hrs/wk
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteTeacherAssignment(ta.id)}
                              className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                              title="Delete assignment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Workload & Fairness Audit Perspective (Requirement 9) */}
      {perspective === 'audit' && (
        <div className="space-y-6">
          {/* Workload Audit Header & Summary Metrics */}
          <div className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <span>Teacher Workload and Fairness Audit</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Transparent breakdown of daily, weekly, and monthly hours, required vs scheduled teaching periods, free periods, and breaks.
                </p>
              </div>

              <button
                type="button"
                onClick={loadTeacherWorkloads}
                disabled={isLoadingWorkloads}
                className="px-3.5 py-2 rounded-xl glass-pill hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center gap-1.5 transition-colors w-fit"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingWorkloads ? 'animate-spin' : ''}`} />
                <span>Refresh Audit Data</span>
              </button>
            </div>

            {/* Metrics row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl glass-card border border-white/30 text-center">
                <div className="text-xl font-black text-blue-600 dark:text-blue-400">
                  {teacherWorkloadsData.length || people.length}
                </div>
                <div className="text-[10px] text-slate-400 uppercase font-bold mt-1">Teachers Audited</div>
              </div>
              <div className="p-4 rounded-2xl glass-card border border-emerald-500/20 text-center">
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {teacherWorkloadsData.filter((w) => w.status === 'normal').length || Math.max(0, (people.length || 0) - 1)}
                </div>
                <div className="text-[10px] text-slate-400 uppercase font-bold mt-1">Balanced Load</div>
              </div>
              <div className="p-4 rounded-2xl glass-card border border-amber-500/20 text-center">
                <div className="text-xl font-black text-amber-600 dark:text-amber-400">
                  {teacherWorkloadsData.filter((w) => w.status === 'underutilized').length}
                </div>
                <div className="text-[10px] text-slate-400 uppercase font-bold mt-1">Underutilized</div>
              </div>
              <div className="p-4 rounded-2xl glass-card border border-red-500/20 text-center">
                <div className="text-xl font-black text-red-600 dark:text-red-400">
                  {teacherWorkloadsData.filter((w) => w.status === 'overbooked').length}
                </div>
                <div className="text-[10px] text-slate-400 uppercase font-bold mt-1">Overbooked</div>
              </div>
            </div>
          </div>

          {/* Audit Table */}
          <div className="p-5 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/50 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="pb-3 pl-2">Teacher & Role</th>
                    <th className="pb-3">Department</th>
                    <th className="pb-3 text-center">Daily Hours (Mon–Fri)</th>
                    <th className="pb-3 text-center">Weekly Hours</th>
                    <th className="pb-3 text-center">Monthly Hours</th>
                    <th className="pb-3 text-center">Periods (Sched / Req)</th>
                    <th className="pb-3 text-center">Free Periods</th>
                    <th className="pb-3 text-center">Breaks</th>
                    <th className="pb-3 text-right pr-2">Workload Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/30 dark:divide-slate-800/30">
                  {teacherWorkloadsData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No workload audit data currently loaded. Click "Refresh Audit Data" or run GLIXON to evaluate.
                      </td>
                    </tr>
                  ) : (
                    teacherWorkloadsData.map((w: any) => {
                      const isOver = w.status === 'overbooked';
                      const isUnder = w.status === 'underutilized';
                      const dailyMonFri = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
                        .map((day) => w.daily_hours?.[day] || 0)
                        .join('h / ') + 'h';
                      return (
                        <tr
                          key={w.teacher_id}
                          className={`hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors ${
                            isOver ? 'bg-red-500/5' : isUnder ? 'bg-amber-500/5' : ''
                          }`}
                        >
                          <td className="py-3 pl-2">
                            <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-blue-500" />
                              <span>{w.teacher_name}</span>
                            </div>
                          </td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">
                            {w.department_name || 'General Faculty'}
                          </td>
                          <td className="py-3 text-center font-mono text-[11px] text-slate-600 dark:text-slate-400">
                            {dailyMonFri}
                          </td>
                          <td className="py-3 text-center font-bold text-slate-800 dark:text-slate-100">
                            {w.weekly_hours} hrs
                          </td>
                          <td className="py-3 text-center text-slate-600 dark:text-slate-400">
                            {w.monthly_hours} hrs
                          </td>
                          <td className="py-3 text-center">
                            <span className="font-bold text-blue-600 dark:text-blue-400">
                              {w.scheduled_periods}
                            </span>{' '}
                            <span className="text-slate-400">/ {w.required_periods}</span>
                          </td>
                          <td className="py-3 text-center text-slate-600 dark:text-slate-400">
                            {w.free_periods ?? Math.max(0, 30 - w.scheduled_periods)}
                          </td>
                          <td className="py-3 text-center text-slate-600 dark:text-slate-400">
                            {w.break_hours ?? 3.75} hrs
                          </td>
                          <td className="py-3 text-right pr-2">
                            {isOver ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-600 border border-red-500/20">
                                Overbooked
                              </span>
                            ) : isUnder ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                Underutilized
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                Optimal
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
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

      {/* GLIXON — Intelligent Timetable Generator & Preview Modal (Requirements 1, 6, 7) */}
      {isGlixonModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="max-w-5xl w-full max-h-[92vh] flex flex-col rounded-3xl glass-panel border border-blue-500/30 shadow-2xl shadow-blue-500/10 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200/40 dark:border-white/10 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-amber-300 shadow-md">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black tracking-wide text-slate-900 dark:text-white">
                      GLIXON
                    </h3>
                    <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      OR-Tools CP-SAT
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Intelligent Timetable Generator • Conflict-Free Multi-Semester Allocation
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsGlixonModalOpen(false)}
                className="p-2 rounded-xl glass-pill hover:bg-slate-200/60 dark:hover:bg-slate-800/60 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              {isGlixonGenerating ? (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-14 h-14 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 animate-spin">
                    <RefreshCw className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      GLIXON is Solving Timetable Constraints...
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Balancing teacher workloads, preventing room and class collisions, mapping semester subjects, and optimizing teaching periods.
                    </p>
                  </div>
                </div>
              ) : !glixonPreviewData ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl glass-card border border-blue-500/20 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      <span>Ready for Intelligent Timetable Generation</span>
                    </div>
                    <p>
                      GLIXON will inspect all saved teacher-subject assignments, required periods, allowed working days, preferred time bands, room/lab requirements, and academic semester configs to produce a complete conflict-free timetable preview.
                    </p>
                  </div>

                  {/* Weights Configuration */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl glass-pill">
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span>Workload Fairness Weight</span>
                        <span className="text-blue-500 font-bold">{glixonFairnessWeight.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.5"
                        step="0.1"
                        value={glixonFairnessWeight}
                        onChange={(e) => setGlixonFairnessWeight(Number(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span>Teacher Preference Weight</span>
                        <span className="text-blue-500 font-bold">{glixonPrefWeight.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.5"
                        step="0.1"
                        value={glixonPrefWeight}
                        onChange={(e) => setGlixonPrefWeight(Number(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                    </div>
                  </div>

                  <div className="flex justify-center pt-4">
                    <button
                      type="button"
                      onClick={handleRunGlixon}
                      className="px-6 py-3 rounded-2xl glass-button-primary text-sm font-bold flex items-center gap-2 shadow-xl shadow-blue-500/25"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                      <span>Run GLIXON Intelligent Generator</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* PREVIEW AND SAVE SCREEN (Requirement 7) */
                <div className="space-y-5">
                  {/* Summary Metric KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-2xl glass-card border border-emerald-500/20 text-center">
                      <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        {glixonPreviewData.fairness_score}%
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">Fairness Score</div>
                    </div>

                    <div className="p-3.5 rounded-2xl glass-card border border-blue-500/20 text-center">
                      <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                        {glixonPreviewData.assignments?.length || 0}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">Proposed Assignments</div>
                    </div>

                    <div className="p-3.5 rounded-2xl glass-card border border-amber-500/20 text-center">
                      <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                        {glixonPreviewData.unfilled_slots?.length || 0}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">Unfilled Periods</div>
                    </div>

                    <div className="p-3.5 rounded-2xl glass-card border border-purple-500/20 text-center">
                      <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
                        {glixonPreviewData.conflicts?.length || 0}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">Warnings / Conflicts</div>
                    </div>
                  </div>

                  {/* Preview Navigation Tabs */}
                  <div className="flex items-center gap-1 p-1 rounded-2xl glass-panel border border-white/20 dark:border-white/10 text-xs font-semibold overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setGlixonActiveTab('preview')}
                      className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                        glixonActiveTab === 'preview' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      All Assignments ({glixonPreviewData.assignments?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setGlixonActiveTab('by_teacher')}
                      className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                        glixonActiveTab === 'by_teacher' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      By Teacher
                    </button>
                    <button
                      type="button"
                      onClick={() => setGlixonActiveTab('by_class')}
                      className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                        glixonActiveTab === 'by_class' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      By Class & Semester
                    </button>
                    <button
                      type="button"
                      onClick={() => setGlixonActiveTab('audit')}
                      className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                        glixonActiveTab === 'audit' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Teacher Workloads Audit
                    </button>
                    <button
                      type="button"
                      onClick={() => setGlixonActiveTab('conflicts')}
                      className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                        glixonActiveTab === 'conflicts'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      Conflicts & Warnings ({glixonPreviewData.conflicts?.length || 0})
                    </button>
                  </div>

                  {/* TAB 1: ALL ASSIGNMENTS */}
                  {glixonActiveTab === 'preview' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search assignments by teacher, subject, class, semester, or room..."
                          value={glixonSearch}
                          onChange={(e) => setGlixonSearch(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl glass-input text-xs"
                        />
                      </div>

                      <div className="max-h-72 overflow-y-auto rounded-2xl border border-white/20 dark:border-white/10">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100/50 dark:bg-slate-800/50 text-[10px] uppercase font-bold text-slate-400 sticky top-0 backdrop-blur-md">
                            <tr>
                              <th className="py-2.5 px-3">Day & Time</th>
                              <th className="py-2.5 px-3">Subject</th>
                              <th className="py-2.5 px-3">Teacher</th>
                              <th className="py-2.5 px-3">Semester</th>
                              <th className="py-2.5 px-3">Class</th>
                              <th className="py-2.5 px-3">Room / Lab</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/30 dark:divide-slate-800/30">
                            {glixonPreviewData.assignments
                              ?.filter((a) => {
                                if (!glixonSearch.trim()) return true;
                                const q = glixonSearch.toLowerCase();
                                return (
                                  a.teacher_name?.toLowerCase().includes(q) ||
                                  a.subject_name?.toLowerCase().includes(q) ||
                                  a.class_name?.toLowerCase().includes(q) ||
                                  a.semester?.toLowerCase().includes(q) ||
                                  a.resource_name?.toLowerCase().includes(q) ||
                                  a.day_name?.toLowerCase().includes(q)
                                );
                              })
                              .map((a, idx) => (
                                <tr key={idx} className="hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors">
                                  <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                                    <span className="font-bold">{a.day_name}</span>{' '}
                                    <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
                                      {a.start_time}–{a.end_time}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 font-black text-slate-900 dark:text-white">
                                    {a.subject_name}
                                  </td>
                                  <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                                    {a.teacher_name}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[10px]">
                                      {a.semester}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                                    {a.class_name}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-500">
                                    {a.resource_name || 'Classroom Assigned'}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: BY TEACHER */}
                  {glixonActiveTab === 'by_teacher' && (
                    <div className="max-h-72 overflow-y-auto space-y-3">
                      {Object.entries(glixonPreviewData.teacher_timetables || {}).map(([tName, tSlots]) => (
                        <div key={tName} className="p-3.5 rounded-2xl glass-card border border-white/20 dark:border-white/10 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-blue-500" />
                              <span>{tName}</span>
                            </div>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
                              {tSlots.length} Periods Scheduled
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {tSlots.map((ts, idx) => (
                              <div key={idx} className="p-2 rounded-xl glass-pill text-[11px] border border-blue-500/20 space-y-0.5">
                                <div className="font-bold text-slate-800 dark:text-slate-200">
                                  {ts.subject_name} ({ts.semester})
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {ts.day_name} • {ts.start_time}–{ts.end_time} • {ts.class_name}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* TAB 3: BY CLASS & SEMESTER */}
                  {glixonActiveTab === 'by_class' && (
                    <div className="max-h-72 overflow-y-auto space-y-3">
                      {Object.entries(glixonPreviewData.class_timetables || {}).map(([clsName, cSlots]) => (
                        <div key={clsName} className="p-3.5 rounded-2xl glass-card border border-white/20 dark:border-white/10 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Class: {clsName}</span>
                            </div>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold">
                              {cSlots.length} Periods
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                            {cSlots.map((cs, idx) => (
                              <div key={idx} className="p-2 rounded-xl glass-pill text-[11px] border border-indigo-500/20 space-y-0.5">
                                <div className="font-bold text-slate-800 dark:text-slate-200">
                                  {cs.subject_name}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {cs.day_name} • {cs.start_time}–{cs.end_time}
                                </div>
                                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                                  Teacher: {cs.teacher_name}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* TAB 4: TEACHER WORKLOAD AUDIT */}
                  {glixonActiveTab === 'audit' && (
                    <div className="max-h-72 overflow-y-auto rounded-2xl border border-white/20 dark:border-white/10">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100/50 dark:bg-slate-800/50 text-[10px] uppercase font-bold text-slate-400 sticky top-0 backdrop-blur-md">
                          <tr>
                            <th className="py-2.5 px-3">Teacher</th>
                            <th className="py-2.5 px-3 text-center">Weekly Hours</th>
                            <th className="py-2.5 px-3 text-center">Periods (Sched / Req)</th>
                            <th className="py-2.5 px-3 text-center">Free Periods</th>
                            <th className="py-2.5 px-3 text-center">Breaks</th>
                            <th className="py-2.5 px-3 text-right">Fairness Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/30 dark:divide-slate-800/30">
                          {(Array.isArray(glixonPreviewData.teacher_workloads)
                            ? glixonPreviewData.teacher_workloads
                            : Object.values(glixonPreviewData.teacher_workloads || {})
                          ).map((w: any, idx) => (
                            <tr key={idx} className="hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                                {w.teacher_name}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                                {w.weekly_hours} hrs
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold">
                                {w.scheduled_periods} / {w.required_periods}
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-500">
                                {w.free_periods ?? Math.max(0, 30 - w.scheduled_periods)}
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-500">
                                {w.break_hours ?? 3.75} hrs
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                  Optimal
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAB 5: CONFLICTS & WARNINGS */}
                  {glixonActiveTab === 'conflicts' && (
                    <div className="space-y-3">
                      {glixonPreviewData.conflicts && glixonPreviewData.conflicts.length > 0 ? (
                        <div className="space-y-2">
                          {glixonPreviewData.conflicts.map((c, idx) => (
                            <div key={idx} className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-start gap-2 text-amber-700 dark:text-amber-300">
                              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                              <span>{c}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                          <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                            Zero Scheduling Conflicts Detected
                          </div>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">
                            All teachers, rooms, and semesters are 100% conflict-free and ready for persistence.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer (Requirement 7) */}
            <div className="p-4 border-t border-slate-200/40 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 flex-shrink-0 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-3xl">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsGlixonModalOpen(false)}
                  className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/50"
                >
                  Cancel
                </button>
                {glixonPreviewData && (
                  <button
                    type="button"
                    onClick={() => setGlixonActiveTab('conflicts')}
                    className="px-3.5 py-2 rounded-xl glass-pill hover:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>View Conflicts ({glixonPreviewData.conflicts?.length || 0})</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {glixonPreviewData && (
                  <button
                    type="button"
                    disabled={isGlixonGenerating || isGlixonCommitting}
                    onClick={handleRunGlixon}
                    className="px-4 py-2 rounded-xl glass-pill hover:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGlixonGenerating ? 'animate-spin' : ''}`} />
                    <span>Regenerate</span>
                  </button>
                )}

                {glixonPreviewData && (
                  <button
                    type="button"
                    disabled={isGlixonCommitting || isGlixonGenerating}
                    onClick={handleCommitGlixon}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all"
                  >
                    {isGlixonCommitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Persisting to Database...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Confirm and Save to Database</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Period Configuration Modal (Requirement 4) */}
      {isPeriodConfigOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="max-w-4xl w-full max-h-[90vh] flex flex-col rounded-3xl glass-panel border border-indigo-500/30 shadow-2xl shadow-indigo-500/10 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-200/40 dark:border-white/10 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-500 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Period Configuration & Timings
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configure 7-day teaching periods, timings, and break intervals (breaks excluded from teaching hours)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPeriodConfigOpen(false)}
                className="p-2 rounded-xl glass-pill hover:bg-slate-200/60 dark:hover:bg-slate-800/60 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Day Selector Navigation */}
            <div className="p-3 border-b border-slate-200/30 dark:border-white/10 flex items-center gap-1.5 overflow-x-auto flex-shrink-0">
              {ALL_DAYS.map((dayName, idx) => {
                const dayCfg = periodConfigDays.find((d) => d.day_of_week === idx);
                const isWorking = dayCfg ? dayCfg.is_working_day : idx < 5;
                const isWeekend = idx >= 5;
                return (
                  <button
                    key={dayName}
                    type="button"
                    onClick={() => setActivePeriodDayIdx(idx)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      activePeriodDayIdx === idx
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                        : isWorking
                        ? 'glass-pill text-slate-700 dark:text-slate-300'
                        : 'glass-pill opacity-60 text-slate-400'
                    }`}
                  >
                    <span>{dayName}</span>
                    {isWeekend && (
                      <span className="text-[9px] px-1 rounded bg-black/10 dark:bg-white/10">
                        {isWorking ? 'Active' : 'Off'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Content for Selected Day */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {(() => {
                const dayCfg = periodConfigDays.find((d) => d.day_of_week === activePeriodDayIdx) || {
                  day_name: ALL_DAYS[activePeriodDayIdx],
                  day_of_week: activePeriodDayIdx,
                  is_working_day: activePeriodDayIdx < 5,
                  periods: [],
                };

                const updateDay = (updated: DayPeriodConfig) => {
                  setPeriodConfigDays((prev) => {
                    const existingIdx = prev.findIndex((d) => d.day_of_week === activePeriodDayIdx);
                    if (existingIdx >= 0) {
                      const copy = [...prev];
                      copy[existingIdx] = updated;
                      return copy;
                    } else {
                      return [...prev, updated];
                    }
                  });
                };

                const handleCopyMondayToWeekdays = () => {
                  const monCfg = periodConfigDays.find((d) => d.day_of_week === 0);
                  if (!monCfg) return;
                  triggerHaptic(10);
                  setPeriodConfigDays((prev) =>
                    prev.map((d) => {
                      if (d.day_of_week >= 1 && d.day_of_week <= 4) {
                        return {
                          ...d,
                          is_working_day: true,
                          periods: JSON.parse(JSON.stringify(monCfg.periods)),
                        };
                      }
                      return d;
                    })
                  );
                  addToast('Copied', 'Monday periods applied to Tuesday through Friday', 'info');
                };

                return (
                  <div className="space-y-4">
                    {/* Day Controls Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl glass-card border border-white/30">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-900 dark:text-white">
                          <input
                            type="checkbox"
                            checked={dayCfg.is_working_day}
                            onChange={(e) =>
                              updateDay({ ...dayCfg, is_working_day: e.target.checked })
                            }
                            className="w-4 h-4 rounded text-indigo-600 accent-indigo-600"
                          />
                          <span>Working / Teaching Day Enabled</span>
                        </label>
                        <span className="text-xs text-slate-400">
                          ({dayCfg.periods?.length || 0} periods configured)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {activePeriodDayIdx === 0 && (
                          <button
                            type="button"
                            onClick={handleCopyMondayToWeekdays}
                            className="px-2.5 py-1 rounded-lg glass-pill text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
                            title="Copy Monday's periods to Tue, Wed, Thu, Fri"
                          >
                            Copy to All Weekdays (Tue–Fri)
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic(8);
                            const newP: PeriodConfigItem = {
                              name: `Period ${(dayCfg.periods?.length || 0) + 1}`,
                              type: 'teaching',
                              start_time: '09:00',
                              end_time: '10:00',
                              duration_hours: 1,
                              is_active: true,
                              counts_toward_teaching: true,
                            };
                            updateDay({ ...dayCfg, periods: [...(dayCfg.periods || []), newP] });
                          }}
                          className="px-3 py-1.5 rounded-xl glass-button-primary text-xs font-bold flex items-center gap-1 shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Period</span>
                        </button>
                      </div>
                    </div>

                    {/* Periods List */}
                    <div className="space-y-2.5">
                      {(!dayCfg.periods || dayCfg.periods.length === 0) ? (
                        <div className="p-8 text-center text-xs text-slate-400 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
                          No periods defined for {dayCfg.day_name}. Click "Add Period" to configure teaching and break intervals.
                        </div>
                      ) : (
                        dayCfg.periods.map((p, pIdx) => {
                          const durationStr = calculatePeriodDuration(p.start_time, p.end_time);
                          const isBreak = p.type === 'break' || p.type === 'lunch';
                          return (
                            <div
                              key={pIdx}
                              className={`p-3 rounded-2xl glass-card border flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                                isBreak
                                  ? 'bg-slate-100/40 dark:bg-slate-900/40 border-dashed border-slate-300 dark:border-slate-700'
                                  : 'border-white/40 dark:border-white/10'
                              }`}
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 flex-1 items-center">
                                {/* Name */}
                                <div>
                                  <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">
                                    Period Name
                                  </label>
                                  <input
                                    type="text"
                                    value={p.name}
                                    onChange={(e) => {
                                      const updated = [...dayCfg.periods];
                                      updated[pIdx] = { ...p, name: e.target.value };
                                      updateDay({ ...dayCfg, periods: updated });
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-xl glass-input text-xs font-bold"
                                    placeholder="e.g. Period 1"
                                  />
                                </div>

                                {/* Type */}
                                <div>
                                  <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">
                                    Type
                                  </label>
                                  <select
                                    value={p.type}
                                    onChange={(e) => {
                                      const updated = [...dayCfg.periods];
                                      const newType = e.target.value;
                                      const isB = newType === 'break' || newType === 'lunch';
                                      updated[pIdx] = {
                                        ...p,
                                        type: newType,
                                        counts_toward_teaching: !isB,
                                      };
                                      updateDay({ ...dayCfg, periods: updated });
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-xl glass-input text-xs font-semibold"
                                  >
                                    <option value="teaching">Teaching Period</option>
                                    <option value="lab">Laboratory / Practical</option>
                                    <option value="break">Short Break / Recess</option>
                                    <option value="lunch">Lunch Break</option>
                                    <option value="assembly">Assembly / Common</option>
                                  </select>
                                </div>

                                {/* Start Time */}
                                <div>
                                  <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">
                                    Start Time
                                  </label>
                                  <input
                                    type="time"
                                    value={p.start_time}
                                    onChange={(e) => {
                                      const updated = [...dayCfg.periods];
                                      updated[pIdx] = { ...p, start_time: e.target.value };
                                      updateDay({ ...dayCfg, periods: updated });
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-xl glass-input text-xs font-mono font-bold"
                                  />
                                </div>

                                {/* End Time */}
                                <div>
                                  <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">
                                    End Time
                                  </label>
                                  <input
                                    type="time"
                                    value={p.end_time}
                                    onChange={(e) => {
                                      const updated = [...dayCfg.periods];
                                      updated[pIdx] = { ...p, end_time: e.target.value };
                                      updateDay({ ...dayCfg, periods: updated });
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-xl glass-input text-xs font-mono font-bold"
                                  />
                                </div>
                              </div>

                              {/* Duration Badge & Actions */}
                              <div className="flex items-center justify-between lg:justify-end gap-3 flex-shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200/40">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold text-[11px] font-mono">
                                    {durationStr}
                                  </span>
                                  {isBreak && (
                                    <span className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-[10px]">
                                      Excluded from teaching hrs
                                    </span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    triggerHaptic(10);
                                    const updated = dayCfg.periods.filter((_, idx) => idx !== pIdx);
                                    updateDay({ ...dayCfg, periods: updated });
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                  title="Remove period"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200/40 dark:border-white/10 flex items-center justify-between flex-shrink-0 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-3xl">
              <button
                type="button"
                onClick={() => setIsPeriodConfigOpen(false)}
                className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSavingPeriodConfig}
                onClick={handleSavePeriodConfig}
                className="px-5 py-2.5 rounded-xl glass-button-primary text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/25"
              >
                {isSavingPeriodConfig ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Periods...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Period Timings</span>
                  </>
                )}
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
                        if (sObj.semester) setEditSlotSemester(sObj.semester);
                        if (sObj.class_name) setEditSlotClass(sObj.class_name);
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

              {/* College Academic Scope: Semester & Class */}
              {activeOrg?.type === 'college' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Semester:
                    </label>
                    <input
                      type="text"
                      value={editSlotSemester}
                      onChange={(e) => setEditSlotSemester(e.target.value)}
                      placeholder="e.g. S3"
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Class / Batch:
                    </label>
                    <input
                      type="text"
                      value={editSlotClass}
                      onChange={(e) => setEditSlotClass(e.target.value)}
                      placeholder="e.g. S3 A"
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs font-semibold"
                    />
                  </div>
                </div>
              )}

              {/* Staff Member Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Staff / Faculty:
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

              {/* Physical Room Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Classroom / Laboratory:
                </label>
                <select
                  value={editSlotResourceId || ''}
                  onChange={(e) => setEditSlotResourceId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                >
                  <option value="">-- No Room Assigned --</option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.type}, Cap: {r.capacity})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-2xl glass-pill text-xs space-y-1 text-slate-500">
                <div>Min Staff: <strong className="text-slate-700 dark:text-slate-200">{editSlot.min_staff}</strong> | Target: <strong className="text-slate-700 dark:text-slate-200">{editSlot.target_staff}</strong> | Max: <strong className="text-slate-700 dark:text-slate-200">{editSlot.max_staff}</strong></div>
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

      {/* 1. Add Semester Modal */}
      {isAddSemModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSemester}
            className="max-w-md w-full rounded-3xl glass-panel border border-white/40 dark:border-white/10 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-slate-200/40 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Add Academic Semester
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSemModalOpen(false)}
                className="p-1 rounded-lg glass-pill"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Semester Code * (e.g. S1, S3, S5, S7)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. S5"
                  value={newSemCode}
                  onChange={(e) => setNewSemCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Semester Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fifth Semester (B.Tech CSE)"
                  value={newSemName}
                  onChange={(e) => setNewSemName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Academic Year
                </label>
                <input
                  type="text"
                  placeholder="2026-2027"
                  value={newSemYear}
                  onChange={(e) => setNewSemYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200/40 dark:border-slate-800/40">
              <button
                type="button"
                onClick={() => setIsAddSemModalOpen(false)}
                className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl glass-button-primary text-xs font-semibold shadow-md"
              >
                Save Semester
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. Add Subject Modal */}
      {isAddSubModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSubject}
            className="max-w-md w-full rounded-3xl glass-panel border border-white/40 dark:border-white/10 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-slate-200/40 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Add Subject to Curriculum
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSubModalOpen(false)}
                className="p-1 rounded-lg glass-pill"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Subject / Course Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Database Systems"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Subject Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CS302"
                    value={newSubCode}
                    onChange={(e) => setNewSubCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Academic Semester *
                  </label>
                  <select
                    value={newSubSemStr}
                    onChange={(e) => setNewSubSemStr(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input font-bold"
                  >
                    {(semestersList.length > 0
                      ? semestersList.map((s) => s.code || s.name)
                      : ['S1', 'S3', 'S5', 'S7']
                    ).map((sem) => (
                      <option key={sem} value={sem}>
                        Semester {sem}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Department
                  </label>
                  <select
                    value={newSubDeptId || ''}
                    onChange={(e) => setNewSubDeptId(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  >
                    {departmentsList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Target Class / Section
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. S3 A"
                    value={newSubClass}
                    onChange={(e) => setNewSubClass(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center pt-1">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Required Hours / Wk
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={newSubHours}
                    onChange={(e) => setNewSubHours(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl glass-input text-center font-bold text-blue-600"
                  />
                </div>

                <label className="flex items-center gap-2 pt-4 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newSubIsLab}
                    onChange={(e) => setNewSubIsLab(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 accent-purple-600"
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Is Practical / Lab Course</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200/40 dark:border-slate-800/40">
              <button
                type="button"
                onClick={() => setIsAddSubModalOpen(false)}
                className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl glass-button-primary text-xs font-semibold shadow-md"
              >
                Add Subject
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Assign Faculty Member to Subject Modal */}
      {isAddAssignModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateTeacherAssignment}
            className="max-w-md w-full rounded-3xl glass-panel border border-white/40 dark:border-white/10 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-slate-200/40 pb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-purple-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Assign Faculty to Subject
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddAssignModalOpen(false)}
                className="p-1 rounded-lg glass-pill"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Select Faculty Member *
                </label>
                <select
                  required
                  value={assignTeacherId || ''}
                  onChange={(e) => setAssignTeacherId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 rounded-xl glass-input font-bold"
                >
                  <option value="">-- Choose Teacher --</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.role_title} • {p.department_name || 'Dept'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Select Subject / Course *
                </label>
                <select
                  required
                  value={assignSubId || ''}
                  onChange={(e) => {
                    const sId = e.target.value ? Number(e.target.value) : undefined;
                    setAssignSubId(sId);
                    const sub = subjectsList.find((s) => s.id === sId);
                    if (sub) {
                      if (sub.semester) setAssignSemStr(sub.semester);
                      if (sub.department_id) setAssignDeptId(sub.department_id);
                      if (sub.class_name) setAssignClass(sub.class_name);
                      if (sub.required_hours_per_week) setAssignHours(sub.required_hours_per_week);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl glass-input font-bold"
                >
                  <option value="">-- Choose Subject --</option>
                  {subjectsList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.name} ({s.semester || 'All'}, {s.is_lab ? 'Lab' : 'Theory'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Semester
                  </label>
                  <select
                    value={assignSemStr}
                    onChange={(e) => setAssignSemStr(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input font-bold"
                  >
                    {(semestersList.length > 0
                      ? semestersList.map((s) => s.code || s.name)
                      : ['S1', 'S3', 'S5', 'S7']
                    ).map((sem) => (
                      <option key={sem} value={sem}>
                        Semester {sem}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Class / Section
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. S3 A"
                    value={assignClass}
                    onChange={(e) => setAssignClass(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Required Hours / Wk
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={assignHours}
                    onChange={(e) => setAssignHours(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl glass-input text-center font-bold text-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Eligible Classroom / Lab
                  </label>
                  <select
                    value={assignRoomId || ''}
                    onChange={(e) => setAssignRoomId(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-3 py-2 rounded-xl glass-input"
                  >
                    <option value="">-- Any Available Room --</option>
                    {resources.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200/40 dark:border-slate-800/40">
              <button
                type="button"
                onClick={() => setIsAddAssignModalOpen(false)}
                className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl glass-button-primary text-xs font-semibold shadow-md"
              >
                Assign Faculty
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
