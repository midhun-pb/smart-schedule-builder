import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { PresetOrg } from '../../types';
import { triggerHaptic } from '../../utils/haptics';
import {
  GraduationCap,
  Building2,
  Activity,
  Factory,
  Plane,
  Train,
  Hotel,
  Utensils,
  Shield,
  Flame,
  Truck,
  ShoppingBag,
  HardHat,
  Code,
  Sparkles,
  Check,
  Plus,
  ArrowRight,
  ChevronLeft,
  X,
  Clock,
  Users,
  Settings,
  Calendar,
  AlertCircle,
  Copy,
  Trash2,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  GraduationCap,
  Building2,
  Activity,
  Factory,
  Plane,
  Train,
  Hotel,
  Utensils,
  Shield,
  Flame,
  Truck,
  ShoppingBag,
  HardHat,
  Code,
  Sparkles,
};

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const OrgSelectionModule: React.FC = () => {
  const { activeOrg, switchOrg, refreshOrgList, setActiveTab, addToast } = useApp();
  const [presets, setPresets] = useState<PresetOrg[]>([]);
  const [configuringPreset, setConfiguringPreset] = useState<PresetOrg | null>(null);
  const [isEditingActive, setIsEditingActive] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State
  const [formName, setFormName] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formDesc, setFormDesc] = useState<string>('');
  const [formLocation, setFormLocation] = useState<string>('Main Campus / Headquarters');
  const [departments, setDepartments] = useState<string[]>([]);
  const [newDeptInput, setNewDeptInput] = useState<string>('');
  const [roles, setRoles] = useState<string[]>([]);
  const [newRoleInput, setNewRoleInput] = useState<string>('');
  const [resources, setResources] = useState<string[]>([]);
  const [newResourceInput, setNewResourceInput] = useState<string>('');

  // Weekly Timetable & Staffing Requirements (Monday to Sunday)
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);
  const [weeklySchedule, setWeeklySchedule] = useState<Record<string, any>>({});
  
  // Specific profession settings
  const [professionSettings, setProfessionSettings] = useState<Record<string, any>>({});
  const [maxWeeklyHours, setMaxWeeklyHours] = useState<number>(40);
  const [overtimeAllowed, setOvertimeAllowed] = useState<boolean>(true);
  const [autoApproveReplacements, setAutoApproveReplacements] = useState<boolean>(false);

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    api.getPresets().then((data) => {
      setPresets(data);
    }).catch(console.error);
  }, []);

  // When user selects a preset card to configure
  const handleOpenSetupForm = (preset: PresetOrg) => {
    triggerHaptic(15);
    setConfiguringPreset(preset);
    setIsEditingActive(false);

    setFormName(`${preset.name} Instance`);
    setFormCode(preset.type.toUpperCase().replace('_', '-'));
    setFormDesc(preset.description);
    setDepartments([...preset.default_departments]);
    setRoles([...preset.default_roles]);
    setResources([...preset.resource_types]);

    // Use default working days schedule from preset
    const defaultSchedule = preset.default_working_days_schedule || {
      '0': { day_name: 'Monday', is_working_day: true, periods: [
        { name: 'Morning Core Shift', type: 'work', start_time: '09:00', end_time: '12:00', min_staff: 2, target_staff: 3, max_staff: 4 },
        { name: 'Lunch Break', type: 'lunch', start_time: '12:00', end_time: '13:00', min_staff: 0, target_staff: 0, max_staff: 0 },
        { name: 'Afternoon Operational Shift', type: 'work', start_time: '13:00', end_time: '17:00', min_staff: 2, target_staff: 3, max_staff: 4 },
      ]},
      '1': { day_name: 'Tuesday', is_working_day: true, periods: [
        { name: 'Morning Core Shift', type: 'work', start_time: '09:00', end_time: '12:00', min_staff: 2, target_staff: 3, max_staff: 4 },
        { name: 'Lunch Break', type: 'lunch', start_time: '12:00', end_time: '13:00', min_staff: 0, target_staff: 0, max_staff: 0 },
        { name: 'Afternoon Operational Shift', type: 'work', start_time: '13:00', end_time: '17:00', min_staff: 2, target_staff: 3, max_staff: 4 },
      ]},
      '2': { day_name: 'Wednesday', is_working_day: true, periods: [
        { name: 'Morning Core Shift', type: 'work', start_time: '09:00', end_time: '12:00', min_staff: 2, target_staff: 3, max_staff: 4 },
        { name: 'Lunch Break', type: 'lunch', start_time: '12:00', end_time: '13:00', min_staff: 0, target_staff: 0, max_staff: 0 },
        { name: 'Afternoon Operational Shift', type: 'work', start_time: '13:00', end_time: '17:00', min_staff: 2, target_staff: 3, max_staff: 4 },
      ]},
      '3': { day_name: 'Thursday', is_working_day: true, periods: [
        { name: 'Morning Core Shift', type: 'work', start_time: '09:00', end_time: '12:00', min_staff: 2, target_staff: 3, max_staff: 4 },
        { name: 'Lunch Break', type: 'lunch', start_time: '12:00', end_time: '13:00', min_staff: 0, target_staff: 0, max_staff: 0 },
        { name: 'Afternoon Operational Shift', type: 'work', start_time: '13:00', end_time: '17:00', min_staff: 2, target_staff: 3, max_staff: 4 },
      ]},
      '4': { day_name: 'Friday', is_working_day: true, periods: [
        { name: 'Morning Core Shift', type: 'work', start_time: '09:00', end_time: '12:00', min_staff: 2, target_staff: 3, max_staff: 4 },
        { name: 'Lunch Break', type: 'lunch', start_time: '12:00', end_time: '13:00', min_staff: 0, target_staff: 0, max_staff: 0 },
        { name: 'Afternoon Operational Shift', type: 'work', start_time: '13:00', end_time: '16:00', min_staff: 2, target_staff: 3, max_staff: 4 },
      ]},
      '5': { day_name: 'Saturday', is_working_day: false, periods: [] },
      '6': { day_name: 'Sunday', is_working_day: false, periods: [] },
    };

    setWeeklySchedule(JSON.parse(JSON.stringify(defaultSchedule)));
    setProfessionSettings(preset.default_profession_settings || {});
    setMaxWeeklyHours(preset.type === 'college' ? 36 : 40);
    setValidationErrors([]);
  };

  // Add Department Chip
  const handleAddDept = () => {
    if (!newDeptInput.trim()) return;
    if (!departments.includes(newDeptInput.trim())) {
      setDepartments([...departments, newDeptInput.trim()]);
    }
    setNewDeptInput('');
  };

  // Add Role Chip
  const handleAddRole = () => {
    if (!newRoleInput.trim()) return;
    if (!roles.includes(newRoleInput.trim())) {
      setRoles([...roles, newRoleInput.trim()]);
    }
    setNewRoleInput('');
  };

  // Add Resource Chip
  const handleAddResource = () => {
    if (!newResourceInput.trim()) return;
    if (!resources.includes(newResourceInput.trim())) {
      setResources([...resources, newResourceInput.trim()]);
    }
    setNewResourceInput('');
  };

  // Day toggle
  const toggleWorkingDay = (dayIdx: number) => {
    const updated = { ...weeklySchedule };
    const current = updated[String(dayIdx)] || { day_name: DAY_NAMES[dayIdx], is_working_day: false, periods: [] };
    const nextState = !current.is_working_day;
    updated[String(dayIdx)] = {
      ...current,
      is_working_day: nextState,
      periods: nextState && (!current.periods || current.periods.length === 0)
        ? [
            { name: 'Standard Duty', type: 'work', start_time: '09:00', end_time: '12:00', min_staff: 1, target_staff: 2, max_staff: 3 },
            { name: 'Break', type: 'break', start_time: '12:00', end_time: '13:00', min_staff: 0, target_staff: 0, max_staff: 0 },
            { name: 'Afternoon Shift', type: 'work', start_time: '13:00', end_time: '17:00', min_staff: 1, target_staff: 2, max_staff: 3 }
          ]
        : current.periods
    };
    setWeeklySchedule(updated);
  };

  // Update Period Field
  const updatePeriod = (dayIdx: number, pIdx: number, field: string, val: any) => {
    const updated = { ...weeklySchedule };
    const day = updated[String(dayIdx)];
    if (!day || !day.periods) return;
    day.periods[pIdx] = { ...day.periods[pIdx], [field]: val };
    setWeeklySchedule(updated);
  };

  // Add Period to Day
  const handleAddPeriod = (dayIdx: number) => {
    const updated = { ...weeklySchedule };
    const day = updated[String(dayIdx)] || { day_name: DAY_NAMES[dayIdx], is_working_day: true, periods: [] };
    const newPeriod = {
      name: 'Custom Time Slot',
      type: 'work',
      start_time: '17:00',
      end_time: '19:00',
      min_staff: 1,
      target_staff: 1,
      max_staff: 2
    };
    day.periods = [...(day.periods || []), newPeriod];
    updated[String(dayIdx)] = day;
    setWeeklySchedule(updated);
  };

  // Remove Period
  const handleRemovePeriod = (dayIdx: number, pIdx: number) => {
    const updated = { ...weeklySchedule };
    const day = updated[String(dayIdx)];
    if (!day) return;
    day.periods = day.periods.filter((_: any, i: number) => i !== pIdx);
    setWeeklySchedule(updated);
  };

  // Copy Day Schedule to all other working days
  const handleCopyDaySchedule = (srcDayIdx: number) => {
    triggerHaptic(15);
    const srcDay = weeklySchedule[String(srcDayIdx)];
    if (!srcDay) return;
    const updated = { ...weeklySchedule };
    for (let i = 0; i < 7; i++) {
      if (i !== srcDayIdx && updated[String(i)]?.is_working_day) {
        updated[String(i)] = {
          ...updated[String(i)],
          periods: JSON.parse(JSON.stringify(srcDay.periods || []))
        };
      }
    }
    setWeeklySchedule(updated);
    addToast('Schedule Copied', `Applied ${srcDay.day_name} periods to all active working days`, 'info');
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: string[] = [];
    if (!formName.trim()) {
      errors.push('Organization Name is required.');
    }
    if (departments.length === 0) {
      errors.push('At least one department must be configured.');
    }
    if (roles.length === 0) {
      errors.push('At least one professional role must be defined.');
    }

    // Check periods validation across all active working days
    for (let i = 0; i < 7; i++) {
      const day = weeklySchedule[String(i)];
      if (day?.is_working_day) {
        if (!day.periods || day.periods.length === 0) {
          errors.push(`${DAY_NAMES[i]} is marked as a working day but has no scheduled periods.`);
        } else {
          for (const p of day.periods) {
            if (!p.start_time || !p.end_time || p.start_time === p.end_time) {
              errors.push(`Invalid hours for "${p.name}" on ${DAY_NAMES[i]}: Start time and end time cannot be identical.`);
            }
          }
        }
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Initialize Setup & Save to Database
  const handleInitializeSetup = async () => {
    triggerHaptic(20);
    if (!validateForm()) {
      addToast('Validation Error', 'Please resolve configuration errors before initializing', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formName.trim(),
        type: configuringPreset ? configuringPreset.type : 'custom',
        code: formCode.trim() || undefined,
        description: formDesc.trim() || undefined,
        departments,
        roles,
        resource_types: resources,
        working_days_schedule: weeklySchedule,
        profession_settings: professionSettings,
        settings_json: {
          location: formLocation,
          max_weekly_hours: maxWeeklyHours,
          overtime_allowed: overtimeAllowed,
          auto_approve_replacements: autoApproveReplacements,
        }
      };

      const newOrg = await api.createOrganization(payload);
      await refreshOrgList();
      switchOrg(newOrg);

      addToast(
        'Organization Initialized',
        `Successfully initialized ${newOrg.name} with custom timetable and departments`,
        'success'
      );

      // Open dashboard
      setActiveTab('dashboard');
    } catch (err: any) {
      addToast('Setup Failed', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* If in setup form mode */}
      {configuringPreset ? (
        <div className="space-y-6">
          {/* Header & Back Button */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setConfiguringPreset(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-pill text-xs font-semibold hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Organization Types</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-bold uppercase tracking-wider">
                {configuringPreset.name} Setup
              </span>
            </div>
          </div>

          {/* Validation Banner */}
          {validationErrors.length > 0 && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Please correct the following before initializing:</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Section 1: Organization Details */}
          <div className="p-6 md:p-8 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              <span>1. Organization Details</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Unique Code / Slug
                </label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Location / Campus
                </label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Operational Mission / Description
                </label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Departments & Teams */}
          <div className="p-6 md:p-8 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-500" />
              <span>2. Departments & Operational Teams</span>
            </h3>
            <p className="text-xs text-slate-500">
              Define the organizational units or faculties that staff and schedule slots will be assigned to.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              {departments.map((dept, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  <span>{dept}</span>
                  <button
                    onClick={() => setDepartments(departments.filter((_, idx) => idx !== i))}
                    className="p-0.5 rounded-md hover:bg-red-500/10 text-slate-400 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2 max-w-md pt-2">
              <input
                type="text"
                placeholder="Add Department (e.g. Artificial Intelligence)"
                value={newDeptInput}
                onChange={(e) => setNewDeptInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddDept(); } }}
                className="flex-1 px-3.5 py-2 rounded-xl glass-input text-xs"
              />
              <button
                type="button"
                onClick={handleAddDept}
                className="px-4 py-2 rounded-xl glass-pill font-semibold text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
              >
                Add Dept
              </button>
            </div>
          </div>

          {/* Section 3: Professional Roles & Resources */}
          <div className="p-6 md:p-8 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-500" />
              <span>3. Professional Roles & Rooms / Resources</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Roles */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Staff Designations / Roles:
                </label>
                <div className="flex flex-wrap gap-2">
                  {roles.map((role, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-300 text-xs font-semibold"
                    >
                      <span>{role}</span>
                      <button
                        onClick={() => setRoles(roles.filter((_, idx) => idx !== i))}
                        className="p-0.5 rounded hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="New role title"
                    value={newRoleInput}
                    onChange={(e) => setNewRoleInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddRole(); } }}
                    className="flex-1 px-3.5 py-2 rounded-xl glass-input text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddRole}
                    className="px-3 py-2 rounded-xl glass-pill text-xs font-semibold text-purple-600"
                  >
                    Add Role
                  </button>
                </div>
              </div>

              {/* Resources */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Rooms, Laboratories & Physical Assets:
                </label>
                <div className="flex flex-wrap gap-2">
                  {resources.map((res, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-300 text-xs font-semibold"
                    >
                      <span>{res}</span>
                      <button
                        onClick={() => setResources(resources.filter((_, idx) => idx !== i))}
                        className="p-0.5 rounded hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="New room or resource"
                    value={newResourceInput}
                    onChange={(e) => setNewResourceInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddResource(); } }}
                    className="flex-1 px-3.5 py-2 rounded-xl glass-input text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddResource}
                    className="px-3 py-2 rounded-xl glass-pill text-xs font-semibold text-blue-600"
                  >
                    Add Resource
                  </button>
                </div>
              </div>
            </div>

            {/* Profession Specific Rules */}
            {configuringPreset.type === 'college' && (
              <div className="p-4 rounded-2xl glass-pill border border-blue-500/20 text-xs space-y-2 mt-2">
                <div className="font-bold text-blue-600 dark:text-blue-400">Academic Structure:</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Active Semesters:</span>
                    <strong className="text-slate-800 dark:text-slate-200">S1, S2, S3, S4, S5, S6, S7, S8</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Class Sections:</span>
                    <strong className="text-slate-800 dark:text-slate-200">Section A, Section B</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Lecture : Lab Ratio:</span>
                    <strong className="text-slate-800 dark:text-slate-200">70% Theory / 30% Practical</strong>
                  </div>
                </div>
              </div>
            )}

            {configuringPreset.type === 'hospital' && (
              <div className="p-4 rounded-2xl glass-pill border border-emerald-500/20 text-xs space-y-2 mt-2">
                <div className="font-bold text-emerald-600 dark:text-emerald-400">Clinical Scheduling Rules:</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Shift Rotation:</span>
                    <strong className="text-slate-800 dark:text-slate-200">24/7 (Day, Evening, Graveyard)</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Nurse-Patient Ratio:</span>
                    <strong className="text-slate-800 dark:text-slate-200">1:4 (Ward), 1:2 (ICU)</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Mandatory Rest Interval:</span>
                    <strong className="text-slate-800 dark:text-slate-200">Minimum 11 Hours Between Shifts</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Fully Customizable Weekly Timetable & Staffing Requirements */}
          <div className="p-6 md:p-8 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>4. Weekly Timetable & Staffing Requirements (Monday to Sunday)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure independent working hours, custom work periods, breaks, and staffing targets for every day.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleCopyDaySchedule(selectedDayIdx)}
                className="px-3.5 py-1.5 rounded-xl glass-pill hover:bg-white/60 dark:hover:bg-slate-800/60 text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy {DAY_NAMES[selectedDayIdx]} to All Working Days</span>
              </button>
            </div>

            {/* Day Selector Pills */}
            <div className="flex flex-wrap gap-1.5 p-1 rounded-2xl glass-panel border border-white/20 dark:border-white/10">
              {DAY_NAMES.map((name, idx) => {
                const dayConfig = weeklySchedule[String(idx)];
                const isWorking = dayConfig?.is_working_day;
                const isSelected = selectedDayIdx === idx;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      triggerHaptic(10);
                      setSelectedDayIdx(idx);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm'
                        : isWorking
                        ? 'bg-white/40 dark:bg-slate-800/40 text-slate-800 dark:text-slate-200'
                        : 'text-slate-400 hover:bg-white/20'
                    }`}
                  >
                    <span>{name}</span>
                    <span className={`w-2 h-2 rounded-full ${isWorking ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                  </button>
                );
              })}
            </div>

            {/* Selected Day Configuration View */}
            {(() => {
              const dayCfg = weeklySchedule[String(selectedDayIdx)] || { is_working_day: false, periods: [] };
              const periods = dayCfg.periods || [];

              return (
                <div className="p-4 rounded-2xl glass-card space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {DAY_NAMES[selectedDayIdx]}
                      </span>
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={dayCfg.is_working_day}
                          onChange={() => toggleWorkingDay(selectedDayIdx)}
                          className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                        />
                        <span>{dayCfg.is_working_day ? 'Active Working Day' : 'Day Off / Closed'}</span>
                      </label>
                    </div>

                    {dayCfg.is_working_day && (
                      <button
                        type="button"
                        onClick={() => handleAddPeriod(selectedDayIdx)}
                        className="px-3 py-1 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Slot / Shift</span>
                      </button>
                    )}
                  </div>

                  {dayCfg.is_working_day ? (
                    <div className="space-y-3">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200/40">
                              <th className="py-2 px-2">Slot Title</th>
                              <th className="py-2 px-2">Type</th>
                              <th className="py-2 px-2">Start</th>
                              <th className="py-2 px-2">End</th>
                              <th className="py-2 px-2">Min Staff</th>
                              <th className="py-2 px-2">Target</th>
                              <th className="py-2 px-2">Max Staff</th>
                              <th className="py-2 px-2 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/30 dark:divide-slate-800">
                            {periods.map((p: any, pIdx: number) => (
                              <tr key={pIdx}>
                                <td className="py-2 px-2">
                                  <input
                                    type="text"
                                    value={p.name}
                                    onChange={(e) => updatePeriod(selectedDayIdx, pIdx, 'name', e.target.value)}
                                    className="w-full px-2 py-1 rounded-lg glass-input text-xs font-medium"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <select
                                    value={p.type || 'work'}
                                    onChange={(e) => updatePeriod(selectedDayIdx, pIdx, 'type', e.target.value)}
                                    className="px-2 py-1 rounded-lg glass-input text-xs"
                                  >
                                    <option value="work">Work Duty</option>
                                    <option value="break">Short Break</option>
                                    <option value="lunch">Lunch Meal</option>
                                  </select>
                                </td>
                                <td className="py-2 px-2">
                                  <input
                                    type="time"
                                    value={p.start_time}
                                    onChange={(e) => updatePeriod(selectedDayIdx, pIdx, 'start_time', e.target.value)}
                                    className="px-2 py-1 rounded-lg glass-input text-xs"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <input
                                    type="time"
                                    value={p.end_time}
                                    onChange={(e) => updatePeriod(selectedDayIdx, pIdx, 'end_time', e.target.value)}
                                    className="px-2 py-1 rounded-lg glass-input text-xs"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <input
                                    type="number"
                                    min="0"
                                    max="20"
                                    disabled={p.type !== 'work'}
                                    value={p.min_staff ?? 1}
                                    onChange={(e) => updatePeriod(selectedDayIdx, pIdx, 'min_staff', Number(e.target.value))}
                                    className="w-14 px-2 py-1 rounded-lg glass-input text-xs text-center"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <input
                                    type="number"
                                    min="0"
                                    max="20"
                                    disabled={p.type !== 'work'}
                                    value={p.target_staff ?? 1}
                                    onChange={(e) => updatePeriod(selectedDayIdx, pIdx, 'target_staff', Number(e.target.value))}
                                    className="w-14 px-2 py-1 rounded-lg glass-input text-xs text-center font-bold text-blue-600"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <input
                                    type="number"
                                    min="0"
                                    max="30"
                                    disabled={p.type !== 'work'}
                                    value={p.max_staff ?? 2}
                                    onChange={(e) => updatePeriod(selectedDayIdx, pIdx, 'max_staff', Number(e.target.value))}
                                    className="w-14 px-2 py-1 rounded-lg glass-input text-xs text-center"
                                  />
                                </td>
                                <td className="py-2 px-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePeriod(selectedDayIdx, pIdx)}
                                    className="p-1 rounded-lg hover:bg-red-500/10 text-red-500"
                                    title="Delete period"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-slate-400">
                      {DAY_NAMES[selectedDayIdx]} is configured as non-working day. Staff will not be scheduled on this day.
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Section 5: Governance & Hour Caps */}
          <div className="p-6 md:p-8 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-500" />
              <span>5. Operating Policies & Maximum Hours</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Max Weekly Hours Per Person:</label>
                <input
                  type="number"
                  min="10"
                  max="80"
                  value={maxWeeklyHours}
                  onChange={(e) => setMaxWeeklyHours(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl glass-input text-xs font-semibold"
                />
              </div>

              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="overtime-check"
                  checked={overtimeAllowed}
                  onChange={(e) => setOvertimeAllowed(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                />
                <label htmlFor="overtime-check" className="font-semibold cursor-pointer">
                  Allow Overtime Assignments
                </label>
              </div>

              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="auto-rep-check"
                  checked={autoApproveReplacements}
                  onChange={(e) => setAutoApproveReplacements(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                />
                <label htmlFor="auto-rep-check" className="font-semibold cursor-pointer">
                  Auto-Approve Certified Replacements
                </label>
              </div>
            </div>
          </div>

          {/* Bottom Initialize Action */}
          <div className="p-6 rounded-3xl glass-panel border border-blue-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                Ready to Initialize {formName || 'Organization'}?
              </div>
              <div className="text-xs text-slate-500">
                This will validate and persist all configuration, seed departments, resources, and timetable slots.
              </div>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleInitializeSetup}
              className="px-8 py-3.5 rounded-2xl glass-button-primary text-xs font-bold shadow-xl shadow-blue-500/25 flex items-center gap-2 flex-shrink-0"
            >
              <span>{isSubmitting ? 'Validating & Initializing...' : 'Initialize Setup & Open Dashboard'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Presets Grid View (Prompt Requirement 3: 15 Organization Types) */
        <div className="space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-pill border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Specialized Organization Rostering
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Select Your Organization Type
            </h1>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400">
              Select University / College, Company / Office, or Aviation / Airline to configure tailored schedules,
              operational roles, physical facilities, and individual staff timetables.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {presets
              .filter((preset) => ['college', 'company', 'airline'].includes(preset.type))
              .map((preset) => {
              const IconComponent = ICON_MAP[preset.icon] || Building2;
              const isCurrentlyActive = activeOrg?.type === preset.type;

              return (
                <div
                  key={preset.type}
                  onClick={() => handleOpenSetupForm(preset)}
                  className="relative p-5 rounded-3xl glass-card cursor-pointer border border-white/30 dark:border-white/10 hover:border-blue-500 hover:shadow-glass-glow transition-all duration-200 flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      {isCurrentlyActive && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
                      {preset.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {preset.description}
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-200/40 dark:border-slate-800/60 space-y-1.5 text-[11px]">
                      <div className="text-slate-600 dark:text-slate-300 flex items-center justify-between">
                        <span className="font-medium text-slate-400">Profession:</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">{preset.profession_label}</span>
                      </div>
                      <div className="text-slate-600 dark:text-slate-300 flex items-center justify-between">
                        <span className="font-medium text-slate-400">Default Units:</span>
                        <span className="truncate max-w-[150px]">{preset.default_departments.slice(0, 2).join(', ')}...</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSetupForm(preset);
                      }}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold glass-button-primary flex items-center justify-center gap-1.5"
                    >
                      <span>Configure Setup Form</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
