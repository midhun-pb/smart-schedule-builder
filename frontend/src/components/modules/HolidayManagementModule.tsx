import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { Holiday, HolidayImpactItem, Department } from '../../types';
import { triggerHaptic } from '../../utils/haptics';
import {
  CalendarDays,
  Plus,
  Upload,
  Download,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building,
  ShieldAlert,
  ShieldCheck,
  Edit2,
  Trash2,
  X,
  FileSpreadsheet,
  BookmarkCheck,
  Sparkles,
  Info,
  CalendarCheck,
  Layers,
  ArrowRight
} from 'lucide-react';

const HOLIDAY_TYPES = [
  { value: 'all', label: 'All Holidays' },
  { value: 'public', label: 'Public' },
  { value: 'regional', label: 'Regional' },
  { value: 'organization', label: 'Organization' },
  { value: 'department_specific', label: 'Department-Specific' },
  { value: 'optional', label: 'Optional' },
  { value: 'emergency_closure', label: 'Emergency Closure' },
  { value: 'special_working_day', label: 'Special Working Day' },
];

export const HolidayManagementModule: React.FC = () => {
  const { activeOrg, addToast } = useApp();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [impactData, setImpactData] = useState<{
    total_holidays: number;
    total_impacted_assignments: number;
    total_conflicts: number;
    conflicts: HolidayImpactItem[];
    impacted_assignments: HolidayImpactItem[];
  } | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState(false);
  const [isImpactModalOpen, setIsImpactModalOpen] = useState(false);
  const [isExceptionModalOpen, setIsExceptionModalOpen] = useState(false);
  const [selectedHolidayForException, setSelectedHolidayForException] = useState<Holiday | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('public');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formIsPartial, setFormIsPartial] = useState(false);
  const [formPartialStart, setFormPartialStart] = useState('13:00');
  const [formPartialEnd, setFormPartialEnd] = useState('18:00');
  const [formDeptId, setFormDeptId] = useState<string>('none');
  const [formLocation, setFormLocation] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formEssentialAllowed, setFormEssentialAllowed] = useState(false);
  const [formAuthorizedRoles, setFormAuthorizedRoles] = useState('');

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Presets State
  const [presets, setPresets] = useState<any[]>([]);

  // Exception Form State
  const [exceptionPersonId, setExceptionPersonId] = useState<number | undefined>(undefined);
  const [exceptionReason, setExceptionReason] = useState('Essential continuity operations');
  const [orgPeople, setOrgPeople] = useState<any[]>([]);

  const fetchData = async () => {
    if (!activeOrg) return;
    setIsLoading(true);
    try {
      const [hList, depts, impact, staff] = await Promise.all([
        api.getHolidays(activeOrg.id, {
          holiday_type: selectedType,
          department_id: selectedDeptId !== 'all' ? Number(selectedDeptId) : undefined,
          search: searchQuery || undefined,
        }),
        api.getDepartments(activeOrg.id),
        api.getHolidayImpact(activeOrg.id),
        api.getPeople({ org_id: activeOrg.id })
      ]);

      setHolidays(hList);
      setDepartments(depts);
      setImpactData(impact);
      setOrgPeople(staff);
    } catch (err: any) {
      console.error(err);
      addToast('Error', err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeOrg, selectedType, selectedDeptId, searchQuery]);

  const loadPresets = async () => {
    try {
      const list = await api.getHolidayPresets();
      setPresets(list);
      setIsPresetsModalOpen(true);
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  const handleApplyPreset = async (presetId: string) => {
    if (!activeOrg) return;
    triggerHaptic(15);
    try {
      const res = await api.loadHolidayPreset(activeOrg.id, presetId);
      addToast('Calendar Loaded', res.message, 'success');
      setIsPresetsModalOpen(false);
      fetchData();
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  const handleOpenCreateModal = (holiday?: Holiday) => {
    triggerHaptic(10);
    if (holiday) {
      setEditingHoliday(holiday);
      setFormName(holiday.name);
      setFormType(holiday.holiday_type);
      setFormStartDate(holiday.start_date);
      setFormEndDate(holiday.end_date);
      setFormIsPartial(holiday.is_partial_day);
      setFormPartialStart(holiday.partial_start_time || '13:00');
      setFormPartialEnd(holiday.partial_end_time || '18:00');
      setFormDeptId(holiday.department_id ? String(holiday.department_id) : 'none');
      setFormLocation(holiday.location || '');
      setFormDescription(holiday.description || '');
      setFormEssentialAllowed(holiday.essential_staffing_allowed);
      setFormAuthorizedRoles((holiday.authorized_roles || []).join(', '));
    } else {
      setEditingHoliday(null);
      const today = new Date().toISOString().split('T')[0];
      setFormName('');
      setFormType('public');
      setFormStartDate(today);
      setFormEndDate(today);
      setFormIsPartial(false);
      setFormPartialStart('13:00');
      setFormPartialEnd('18:00');
      setFormDeptId('none');
      setFormLocation('');
      setFormDescription('');
      setFormEssentialAllowed(false);
      setFormAuthorizedRoles('');
    }
    setIsCreateModalOpen(true);
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) return;
    if (!formName.trim() || !formStartDate || !formEndDate) {
      addToast('Validation Error', 'Name, start date, and end date are required.', 'error');
      return;
    }

    triggerHaptic(20);
    const rolesArray = formAuthorizedRoles
      .split(',')
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    const payload = {
      org_id: activeOrg.id,
      department_id: formDeptId !== 'none' ? Number(formDeptId) : null,
      name: formName.trim(),
      holiday_type: formType,
      start_date: formStartDate,
      end_date: formEndDate,
      is_partial_day: formIsPartial,
      partial_start_time: formIsPartial ? formPartialStart : null,
      partial_end_time: formIsPartial ? formPartialEnd : null,
      is_recurring: false,
      location: formLocation.trim() || null,
      description: formDescription.trim() || null,
      essential_staffing_allowed: formEssentialAllowed,
      authorized_roles: rolesArray,
    };

    try {
      if (editingHoliday) {
        await api.updateHoliday(editingHoliday.id, payload);
        addToast('Holiday Updated', `Holiday '${formName}' saved successfully.`, 'success');
      } else {
        const res = await api.createHoliday(payload);
        const conflicts = res.impact_analysis?.conflicts_count || 0;
        if (conflicts > 0) {
          addToast(
            'Holiday Added with Impact',
            `Saved '${formName}'. Identified ${conflicts} schedule shift conflict(s) that require review or essential authorization.`,
            'info'
          );
        } else {
          addToast('Holiday Created', `Holiday '${formName}' added to calendar.`, 'success');
        }
      }

      setIsCreateModalOpen(false);
      fetchData();
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  const handleDeleteHoliday = async (id: number, name: string) => {
    triggerHaptic(15);
    if (!window.confirm(`Delete holiday '${name}'? This removes its scheduling restrictions.`)) return;

    try {
      await api.deleteHoliday(id);
      addToast('Holiday Removed', `Holiday '${name}' deleted successfully.`, 'info');
      fetchData();
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  // Import preview & commit
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !activeOrg) return;
    const file = e.target.files[0];
    setImportFile(file);
    setIsImporting(true);
    try {
      const res = await api.previewHolidayImport(activeOrg.id, file);
      setImportPreview(res);
      addToast('File Analyzed', `Parsed ${res.total_rows} rows (${res.valid_rows} valid, ${res.duplicate_rows} duplicates detected).`, 'info');
    } catch (err: any) {
      addToast('Import Error', err.message, 'error');
      setImportFile(null);
    } finally {
      setIsImporting(false);
    }
  };

  const handleCommitImport = async () => {
    if (!activeOrg || !importPreview || !importPreview.preview) return;
    triggerHaptic(20);
    try {
      const res = await api.commitHolidayImport(activeOrg.id, importPreview.preview);
      addToast('Import Successful', res.message, 'success');
      setIsImportModalOpen(false);
      setImportFile(null);
      setImportPreview(null);
      fetchData();
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  // Authorized Exception
  const handleAuthorizeException = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !selectedHolidayForException || !exceptionPersonId) {
      addToast('Validation', 'Please select a team member to exempt.', 'error');
      return;
    }

    triggerHaptic(15);
    try {
      await api.createHolidayException(selectedHolidayForException.id, {
        org_id: activeOrg.id,
        holiday_id: selectedHolidayForException.id,
        person_id: exceptionPersonId,
        reason: exceptionReason,
        authorized_by: 'Authorized Manager'
      });
      addToast('Exception Granted', 'Authorized essential staffing clearance registered for this holiday.', 'success');
      setIsExceptionModalOpen(false);
      fetchData();
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  const getTypeBadgeStyle = (type: string) => {
    switch (type) {
      case 'public':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'regional':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'organization':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'emergency_closure':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 font-semibold';
      case 'special_working_day':
        return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20 font-semibold';
      case 'department_specific':
        return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
      default:
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Module 15
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Continuous Staffing & Calendar Governance
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Holiday Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Configure public, regional, institutional, and emergency holidays with partial-day schedules, essential continuity clearances, and schedule conflict protections.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleOpenCreateModal()}
            className="px-4 py-2 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Holiday</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic(10);
              setIsImportModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl glass-pill hover:bg-white/60 dark:hover:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300/40 dark:border-white/10 flex items-center gap-1.5 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-blue-500" />
            <span>Import (CSV/XLSX)</span>
          </button>

          <button
            onClick={loadPresets}
            className="px-3.5 py-2 rounded-xl glass-pill hover:bg-white/60 dark:hover:bg-slate-800/60 text-xs font-semibold text-purple-600 dark:text-purple-400 border border-purple-500/30 flex items-center gap-1.5 transition-colors"
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            <span>Verified Calendars</span>
          </button>

          <a
            href={activeOrg ? api.getHolidayExportUrl(activeOrg.id) : '#'}
            download
            className="px-3 py-2 rounded-xl glass-pill hover:bg-white/60 dark:hover:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-300/40 dark:border-white/10 flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-3xl glass-card">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Total Holidays
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {holidays.length}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            <CalendarDays className="w-3 h-3 text-blue-500" />
            <span>Configured for {activeOrg?.name}</span>
          </div>
        </div>

        <div className="p-4 rounded-3xl glass-card">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Public & Regional
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {holidays.filter((h) => h.holiday_type === 'public' || h.holiday_type === 'regional').length}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>Statutory observances</span>
          </div>
        </div>

        <div className="p-4 rounded-3xl glass-card">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Closures & Special Days
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {holidays.filter((h) => h.holiday_type === 'emergency_closure' || h.holiday_type === 'special_working_day').length}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-amber-500" />
            <span>Operational overrides</span>
          </div>
        </div>

        <div
          onClick={() => setIsImpactModalOpen(true)}
          className="p-4 rounded-3xl glass-card cursor-pointer hover:border-blue-500/40 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Timetable Impact
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-blue-500 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-2">
            <span>{impactData?.total_conflicts || 0}</span>
            {impactData && impactData.total_conflicts > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-semibold border border-red-500/20">
                Needs Review
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Click to inspect timetable overlap
          </div>
        </div>
      </div>

      {/* Schedule Impact Alert Banner if conflicts exist */}
      {impactData && impactData.total_conflicts > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-amber-700 dark:text-amber-300">
                Holiday Restriction Notice: {impactData.total_conflicts} Timetable Shift(s) Overlap with Configured Holidays
              </div>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                Assignments on holidays block timetable publication unless essential staffing is permitted or authorized exceptions are granted.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsImpactModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 font-semibold text-xs transition-colors shrink-0"
          >
            Review & Authorize
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-3xl glass-panel border border-white/40 dark:border-white/10 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search holidays or locations..."
            className="w-full pl-9 pr-3 py-2 rounded-xl glass-input text-xs"
          />
        </div>

        {/* Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto overflow-x-auto">
          {HOLIDAY_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                triggerHaptic(8);
                setSelectedType(t.value);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedType === t.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'glass-pill hover:bg-white/60 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Department Filter */}
        <select
          value={selectedDeptId}
          onChange={(e) => setSelectedDeptId(e.target.value)}
          className="px-3 py-2 rounded-xl glass-input text-xs font-medium w-full md:w-48"
        >
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={String(d.id)}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Holiday Cards Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-slate-400 glass-card">
          Loading holiday records...
        </div>
      ) : holidays.length === 0 ? (
        <div className="p-12 text-center glass-panel rounded-3xl border border-white/20 dark:border-white/10 space-y-3">
          <CalendarDays className="w-10 h-10 text-slate-400 mx-auto opacity-50" />
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No holidays matching your criteria
          </div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You can add holidays manually, load verified national calendars, or import an Excel/CSV spreadsheet.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => handleOpenCreateModal()}
              className="px-4 py-2 rounded-xl glass-button-primary text-xs font-semibold"
            >
              Create Holiday
            </button>
            <button
              onClick={loadPresets}
              className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold text-purple-600 dark:text-purple-400 border border-purple-500/30"
            >
              Load Verified Calendar
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {holidays.map((h) => {
            const isSingleDay = h.start_date === h.end_date;
            const hasExceptions = (h.exceptions_count || 0) > 0;

            return (
              <div
                key={h.id}
                className="p-5 rounded-3xl glass-card flex flex-col justify-between group hover:border-blue-500/40 transition-all duration-200"
              >
                <div>
                  {/* Top Header: Badge & Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${getTypeBadgeStyle(
                        h.holiday_type
                      )}`}
                    >
                      {h.holiday_type.replace('_', ' ')}
                    </span>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenCreateModal(h)}
                        className="p-1.5 rounded-lg glass-pill hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-500 hover:text-blue-500"
                        title="Edit Holiday"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteHoliday(h.id, h.name)}
                        className="p-1.5 rounded-lg glass-pill hover:bg-red-500/20 text-slate-500 hover:text-red-500"
                        title="Delete Holiday"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Holiday Title & Description */}
                  <div className="mt-3">
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                      {h.name}
                    </h3>
                    {h.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {h.description}
                      </p>
                    )}
                  </div>

                  {/* Date & Details */}
                  <div className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="font-medium">
                        {isSingleDay ? h.start_date : `${h.start_date} → ${h.end_date}`}
                      </span>
                    </div>

                    {h.is_partial_day && (
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Partial Day: {h.partial_start_time} - {h.partial_end_time}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                      <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{h.department_name || 'All Departments'}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Tags & Clearance Status */}
                <div className="pt-4 mt-4 border-t border-slate-200/50 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  {h.essential_staffing_allowed ? (
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Essential Staffing Allowed</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <span>Strict Non-Working</span>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setSelectedHolidayForException(h);
                      setIsExceptionModalOpen(true);
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                      hasExceptions
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                        : 'glass-pill text-slate-500 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    {hasExceptions ? `${h.exceptions_count} Exemption(s)` : '+ Exemption'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- Add / Edit Holiday Modal --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel rounded-3xl p-6 border border-white/30 dark:border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-500" />
                <span>{editingHoliday ? 'Edit Holiday' : 'Create Holiday'}</span>
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg glass-pill text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveHoliday} className="space-y-4 pt-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Holiday Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Independence Day, Campus Convocation"
                  className="w-full mt-1 p-2.5 rounded-xl glass-input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    Category Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full mt-1 p-2.5 rounded-xl glass-input text-xs"
                  >
                    <option value="public">Public Holiday</option>
                    <option value="regional">Regional Observance</option>
                    <option value="organization">Organization Holiday</option>
                    <option value="department_specific">Department-Specific</option>
                    <option value="optional">Optional Holiday</option>
                    <option value="emergency_closure">Emergency Closure</option>
                    <option value="special_working_day">Special Working Day</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    Department Applicability
                  </label>
                  <select
                    value={formDeptId}
                    onChange={(e) => setFormDeptId(e.target.value)}
                    className="w-full mt-1 p-2.5 rounded-xl glass-input text-xs"
                  >
                    <option value="none">All Departments (Entire Org)</option>
                    {departments.map((d) => (
                      <option key={d.id} value={String(d.id)}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => {
                      setFormStartDate(e.target.value);
                      if (!formEndDate || formEndDate < e.target.value) {
                        setFormEndDate(e.target.value);
                      }
                    }}
                    className="w-full mt-1 p-2.5 rounded-xl glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    min={formStartDate}
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full mt-1 p-2.5 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              {/* Partial Day Schedule Checkbox */}
              <div className="p-3 rounded-2xl glass-panel border border-white/20 dark:border-white/10 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={formIsPartial}
                    onChange={(e) => setFormIsPartial(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Partial-Day Holiday (Specific Hours Only)</span>
                </label>

                {formIsPartial && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <span className="text-[10px] text-slate-500">From Time</span>
                      <input
                        type="time"
                        value={formPartialStart}
                        onChange={(e) => setFormPartialStart(e.target.value)}
                        className="w-full mt-1 p-2 rounded-xl glass-input text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">To Time</span>
                      <input
                        type="time"
                        value={formPartialEnd}
                        onChange={(e) => setFormPartialEnd(e.target.value)}
                        className="w-full mt-1 p-2 rounded-xl glass-input text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Essential Staffing Allowed */}
              <div className="p-3 rounded-2xl glass-panel border border-white/20 dark:border-white/10 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={formEssentialAllowed}
                    onChange={(e) => setFormEssentialAllowed(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Permit Authorized Essential Staffing</span>
                </label>
                <p className="text-[10px] text-slate-400">
                  Allows critical roles (e.g. emergency room clinicians, apparatus crews, flight dispatch) to continue continuous shifts on this holiday.
                </p>

                {formEssentialAllowed && (
                  <div className="pt-2">
                    <span className="text-[10px] text-slate-500">
                      Authorized Roles (Comma-separated)
                    </span>
                    <input
                      type="text"
                      value={formAuthorizedRoles}
                      onChange={(e) => setFormAuthorizedRoles(e.target.value)}
                      placeholder="e.g. Physician, RN Nurse, Security, Supervisor"
                      className="w-full mt-1 p-2 rounded-xl glass-input text-xs"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Description / Institutional Notes
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Official details or closure guidance..."
                  className="w-full mt-1 p-2.5 rounded-xl glass-input text-xs resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200/50 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl glass-button-primary text-xs font-semibold"
                >
                  {editingHoliday ? 'Save Changes' : 'Create Holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Import Modal --- */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl glass-panel rounded-3xl p-6 border border-white/30 dark:border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                <span>Import Holiday Calendar (CSV / XLSX)</span>
              </h2>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportFile(null);
                  setImportPreview(null);
                }}
                className="p-1 rounded-lg glass-pill text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 pt-4">
              <div className="p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                <Upload className="w-8 h-8 text-blue-500 mx-auto" />
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Select a CSV or Excel (.xlsx) file to upload
                </div>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                />
              </div>

              {importPreview && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Validation Summary:
                    </span>
                    <span className="text-slate-500">
                      {importPreview.valid_rows} of {importPreview.total_rows} rows valid
                      {importPreview.duplicate_rows > 0 && ` (${importPreview.duplicate_rows} duplicates detected)`}
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 text-[11px]">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 font-semibold">
                        <tr>
                          <th className="p-2">Name</th>
                          <th className="p-2">Type</th>
                          <th className="p-2">Dates</th>
                          <th className="p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {importPreview.preview.map((row: any, i: number) => (
                          <tr key={i} className={row.is_valid ? '' : 'bg-red-500/10'}>
                            <td className="p-2 font-medium">{row.name}</td>
                            <td className="p-2 capitalize">{row.holiday_type}</td>
                            <td className="p-2">{row.start_date}</td>
                            <td className="p-2">
                              {row.is_valid ? (
                                <span className="text-emerald-500 font-semibold">Ready</span>
                              ) : (
                                <span className="text-red-500 font-semibold">
                                  {row.errors.join(', ')}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsImportModalOpen(false)}
                      className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold text-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCommitImport}
                      disabled={importPreview.valid_rows === 0}
                      className="px-5 py-2 rounded-xl glass-button-primary text-xs font-semibold disabled:opacity-50"
                    >
                      Commit {importPreview.valid_rows} Holidays to Database
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- Verified Calendar Presets Modal --- */}
      {isPresetsModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl glass-panel rounded-3xl p-6 border border-white/30 dark:border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BookmarkCheck className="w-4 h-4 text-purple-500" />
                <span>Verified Official Calendars</span>
              </h2>
              <button
                onClick={() => setIsPresetsModalOpen(false)}
                className="p-1 rounded-lg glass-pill text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-2">
              Select verified standard national or sector calendar templates. Avoids inventing official holidays and imports authentic dates with essential staffing flags.
            </p>

            <div className="space-y-3 pt-3">
              {presets.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl glass-card border border-white/30 dark:border-white/10 hover:border-purple-500/40 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                        {p.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>
                      <span className="inline-block mt-2 text-[10px] font-semibold text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                        {p.holiday_count} Official Holidays
                      </span>
                    </div>

                    <button
                      onClick={() => handleApplyPreset(p.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-md shadow-purple-500/20 transition-all shrink-0"
                    >
                      Load into Org
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- Schedule Impact & Conflicts Review Modal --- */}
      {isImpactModalOpen && impactData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl glass-panel rounded-3xl p-6 border border-white/30 dark:border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span>Timetable Impact & Conflict Analysis</span>
              </h2>
              <button
                onClick={() => setIsImpactModalOpen(false)}
                className="p-1 rounded-lg glass-pill text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 pt-3">
              <p className="text-xs text-slate-500">
                Identifies existing timetable assignments that overlap with holiday restrictions.
                Never silently delete assignments or override mandatory rules: review affected shifts below.
              </p>

              {impactData.impacted_assignments.length === 0 ? (
                <div className="p-8 text-center glass-card text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>No timetable assignments conflict with configured holidays!</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {impactData.impacted_assignments.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl glass-card flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {item.slot_title}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({item.date_str} {item.start_time}-{item.end_time})
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Assigned Staff: <span className="font-semibold text-slate-700 dark:text-slate-300">{item.person_name}</span> ({item.person_role})
                        </div>
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                          Falls on: {item.holiday_name} ({item.holiday_type})
                        </div>
                      </div>

                      <div className="shrink-0">
                        {item.status_tag === 'authorized_exception' ? (
                          <span className="text-[10px] px-2 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20">
                            Exemption Authorized
                          </span>
                        ) : item.status_tag === 'essential_clearance' ? (
                          <span className="text-[10px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                            Essential Clearance
                          </span>
                        ) : item.status_tag === 'special_working_day' ? (
                          <span className="text-[10px] px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold border border-cyan-500/20">
                            Working Day Override
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-1 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 font-bold border border-red-500/20">
                            Holiday Conflict
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- Authorize Essential Staffing Exception Modal --- */}
      {isExceptionModalOpen && selectedHolidayForException && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel rounded-3xl p-6 border border-white/30 dark:border-white/10 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Authorize Essential Staffing</span>
              </h2>
              <button
                onClick={() => setIsExceptionModalOpen(false)}
                className="p-1 rounded-lg glass-pill text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAuthorizeException} className="space-y-4 pt-3">
              <p className="text-xs text-slate-500">
                Grant authorized essential staffing exception for{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedHolidayForException.name}
                </span>{' '}
                ({selectedHolidayForException.start_date}).
              </p>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Select Team Member *
                </label>
                <select
                  required
                  value={exceptionPersonId || ''}
                  onChange={(e) => setExceptionPersonId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full mt-1 p-2.5 rounded-xl glass-input text-xs"
                >
                  <option value="">Select staff member...</option>
                  {orgPeople.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.role_title} ({p.employee_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Authorization Reason *
                </label>
                <input
                  type="text"
                  required
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  placeholder="e.g. Mandatory emergency ward coverage clearance"
                  className="w-full mt-1 p-2.5 rounded-xl glass-input text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200/50 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsExceptionModalOpen(false)}
                  className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl glass-button-primary text-xs font-semibold"
                >
                  Authorize Exemption
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
