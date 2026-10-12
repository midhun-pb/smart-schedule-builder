import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { PresetOrg, Department, Person, Subject } from '../../types';
import { triggerHaptic } from '../../utils/haptics';
import {
  GraduationCap,
  Building2,
  Plane,
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
  Trash2,
  Edit2,
  Sparkles,
  BookOpen,
  Briefcase,
  ShieldCheck,
  Save,
  CheckCircle2,
  RotateCcw,
  Upload,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  college: GraduationCap,
  company: Building2,
  airline: Plane,
  GraduationCap,
  Building2,
  Plane,
};

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const OrgSelectionModule: React.FC = () => {
  const { activeOrg, switchOrg, refreshOrgList, setActiveTab, addToast } = useApp();
  const [presets, setPresets] = useState<PresetOrg[]>([]);
  const [existingOrgs, setExistingOrgs] = useState<any[]>([]);

  // Wizard Navigation
  // Mode: 'list' (choose existing org or start new) | 'wizard' (guided 6-step setup)
  const [viewState, setViewState] = useState<'list' | 'wizard'>('list');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // STEP 1 State: Organization Details
  const [selectedType, setSelectedType] = useState<'college' | 'company' | 'airline'>('college');
  const [orgName, setOrgName] = useState<string>('');
  const [orgCode, setOrgCode] = useState<string>('');
  const [orgDesc, setOrgDesc] = useState<string>('');
  const [orgTimezone, setOrgTimezone] = useState<string>('UTC / Local Time');
  const [workingDays, setWorkingDays] = useState<number[]>([0, 1, 2, 3, 4]); // Mon-Fri
  const [dailyStartTime, setDailyStartTime] = useState<string>('09:00');
  const [dailyEndTime, setDailyEndTime] = useState<string>('17:00');
  const [createdOrgId, setCreatedOrgId] = useState<number | null>(null);

  // STEP 2 State: Departments
  const [departmentsList, setDepartmentsList] = useState<Department[]>([]);
  const [deptName, setDeptName] = useState<string>('');
  const [deptCode, setDeptCode] = useState<string>('');
  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);

  // STEP 3 State: Employees / Teachers
  const [peopleList, setPeopleList] = useState<Person[]>([]);
  const [personName, setPersonName] = useState<string>('');
  const [personEmail, setPersonEmail] = useState<string>('');
  const [personRole, setPersonRole] = useState<string>('Assistant Professor');
  const [personDeptId, setPersonDeptId] = useState<number | undefined>(undefined);
  const [personQuals, setPersonQuals] = useState<string>('M.Tech');
  const [personSemesters, setPersonSemesters] = useState<string>('S5');
  const [personClasses, setPersonClasses] = useState<string>('CSE-A');
  const [personWeeklyHours, setPersonWeeklyHours] = useState<number>(36);

  // STEP 4 State: Subjects / Duties
  const [subjectsList, setSubjectsList] = useState<Subject[]>([]);
  const [subName, setSubName] = useState<string>('');
  const [subCode, setSubCode] = useState<string>('');
  const [subSemester, setSubSemester] = useState<string>('S5');
  const [subClass, setSubClass] = useState<string>('CSE-A');
  const [subDeptId, setSubDeptId] = useState<number | undefined>(undefined);
  const [subIsLab, setSubIsLab] = useState<boolean>(false);
  const [subHours, setSubHours] = useState<number>(4);

  // STEP 5 State: Timetable Configuration & Breaks
  const [weeklySchedule, setWeeklySchedule] = useState<Record<string, any>>({});
  const [breakStartTime, setBreakStartTime] = useState<string>('11:00');
  const [breakEndTime, setBreakEndTime] = useState<string>('11:15');
  const [lunchStartTime, setLunchStartTime] = useState<string>('13:00');
  const [lunchEndTime, setLunchEndTime] = useState<string>('14:00');
  const [periodDuration, setPeriodDuration] = useState<number>(60);
  const [minRestHours, setMinRestHours] = useState<number>(11);

  // STEP 6 State: Generation & Preview
  const [readiness, setReadiness] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedPreview, setGeneratedPreview] = useState<any>(null);

  // Load Presets and Organizations on mount
  useEffect(() => {
    api.getPresets()
      .then((data) => {
        const allowed = data.filter((p) => ['college', 'company', 'airline'].includes(p.type));
        setPresets(allowed.length > 0 ? allowed : data);
      })
      .catch(console.error);

    loadExistingOrgs();
  }, []);

  const loadExistingOrgs = () => {
    api.getOrganizations()
      .then((data) => setExistingOrgs(data || []))
      .catch(console.error);
  };

  // Check if activeOrg has an incomplete setup
  useEffect(() => {
    if (activeOrg && activeOrg.id) {
      setCreatedOrgId(activeOrg.id);
      const step = activeOrg.settings_json?.setup_step;
      const completed = activeOrg.settings_json?.setup_completed;
      if (step && !completed) {
        // Can resume
      }
    }
  }, [activeOrg]);

  // Load data when step changes
  useEffect(() => {
    if (!createdOrgId) return;

    if (currentStep === 2 || currentStep === 3 || currentStep === 4) {
      api.getDepartments(createdOrgId).then(setDepartmentsList).catch(console.error);
    }
    if (currentStep === 3) {
      api.getPeople({ org_id: createdOrgId }).then(setPeopleList).catch(console.error);
    }
    if (currentStep === 4) {
      api.getSubjects(createdOrgId).then(setSubjectsList).catch(console.error);
    }
    if (currentStep === 6) {
      api.getRosterReadiness(createdOrgId).then(setReadiness).catch(console.error);
    }
  }, [currentStep, createdOrgId]);

  // Resume setup for an existing organization
  const handleResumeSetup = (org: any) => {
    triggerHaptic(15);
    switchOrg(org);
    setCreatedOrgId(org.id);
    setSelectedType((org.type as any) || 'college');
    setOrgName(org.name);
    setOrgCode(org.code || '');
    setOrgDesc(org.description || '');

    const savedStep = org.settings_json?.setup_step || 1;
    setCurrentStep(savedStep);
    setViewState('wizard');
    addToast('Resumed Setup', `Continuing configuration for ${org.name} at Step ${savedStep}`, 'info');
  };

  // Start fresh setup wizard
  const handleStartNewOrg = () => {
    triggerHaptic(15);
    setCreatedOrgId(null);
    setCurrentStep(1);
    setSelectedType('college');
    setOrgName('');
    setOrgCode('');
    setOrgDesc('');
    setWorkingDays([0, 1, 2, 3, 4]);
    setDepartmentsList([]);
    setPeopleList([]);
    setSubjectsList([]);
    setGeneratedPreview(null);
    setViewState('wizard');
  };

  // Build default weekly schedule based on selected days and hours
  const buildWorkingSchedule = (type: string, days: number[], start: string, end: string) => {
    const sched: Record<string, any> = {};
    for (let i = 0; i < 7; i++) {
      const isWorking = days.includes(i);
      const dayName = DAY_NAMES[i];
      if (isWorking) {
        if (type === 'college') {
          sched[String(i)] = {
            day_name: dayName,
            is_working_day: true,
            periods: [
              { name: 'Morning Lecture Period 1', type: 'work', start_time: start, end_time: '10:30', min_staff: 1, target_staff: 1 },
              { name: 'Morning Break', type: 'break', start_time: breakStartTime, end_time: breakEndTime, min_staff: 0, target_staff: 0 },
              { name: 'Mid-Day Lecture Period 2', type: 'work', start_time: breakEndTime, end_time: lunchStartTime, min_staff: 1, target_staff: 1 },
              { name: 'Lunch Interval', type: 'lunch', start_time: lunchStartTime, end_time: lunchEndTime, min_staff: 0, target_staff: 0 },
              { name: 'Afternoon Practical / Lecture', type: 'work', start_time: lunchEndTime, end_time: end, min_staff: 1, target_staff: 1 },
            ],
          };
        } else if (type === 'airline') {
          sched[String(i)] = {
            day_name: dayName,
            is_working_day: true,
            periods: [
              { name: 'Flight Duty Period 1', type: 'work', start_time: '06:00', end_time: '14:00', min_staff: 2, target_staff: 3 },
              { name: 'Duty Handover & Rest', type: 'break', start_time: '14:00', end_time: '15:00', min_staff: 0, target_staff: 0 },
              { name: 'Flight Duty Period 2', type: 'work', start_time: '15:00', end_time: '23:00', min_staff: 2, target_staff: 3 },
              { name: 'Overnight Long-Haul Duty', type: 'work', start_time: '23:00', end_time: '07:00', min_staff: 2, target_staff: 2 },
            ],
          };
        } else {
          // Company / Office
          sched[String(i)] = {
            day_name: dayName,
            is_working_day: true,
            periods: [
              { name: 'Core Work Session 1', type: 'work', start_time: start, end_time: '12:00', min_staff: 1, target_staff: 2 },
              { name: 'Lunch Break', type: 'lunch', start_time: '12:00', end_time: '13:00', min_staff: 0, target_staff: 0 },
              { name: 'Operational Session 2', type: 'work', start_time: '13:00', end_time: end, min_staff: 1, target_staff: 2 },
            ],
          };
        }
      } else {
        sched[String(i)] = {
          day_name: dayName,
          is_working_day: false,
          periods: [],
        };
      }
    }
    return sched;
  };

  // STEP 1: Save Organization Details -> Automatically Advance to Step 2
  const handleSaveStep1 = async () => {
    triggerHaptic(15);
    if (!orgName.trim()) {
      addToast('Validation Error', 'Organization Name is required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const schedule = buildWorkingSchedule(selectedType, workingDays, dailyStartTime, dailyEndTime);
      setWeeklySchedule(schedule);

      const payload = {
        name: orgName.trim(),
        type: selectedType,
        code: orgCode.trim() || orgName.replace(/\s+/g, '-').slice(0, 15).toUpperCase(),
        description: orgDesc.trim() || undefined,
        working_days_schedule: schedule,
        settings_json: {
          timezone: orgTimezone,
          working_days: workingDays,
          daily_start_time: dailyStartTime,
          daily_end_time: dailyEndTime,
          setup_step: 2,
          setup_completed: false,
        },
      };

      let orgResult;
      if (createdOrgId) {
        orgResult = await api.updateOrganization(createdOrgId, payload);
      } else {
        orgResult = await api.createOrganization(payload);
        setCreatedOrgId(orgResult.id);
      }

      await refreshOrgList();
      switchOrg(orgResult);
      addToast('Step 1 Saved', `${orgResult.name} details stored. Moving to Step 2: Departments`, 'success');
      setCurrentStep(2);
    } catch (err: any) {
      addToast('Error', err.message || 'Failed to save organization', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // STEP 2: Add Department
  const handleAddDepartment = async () => {
    triggerHaptic(10);
    if (!deptName.trim() || !createdOrgId) return;

    try {
      const newDept = await api.createDepartment(createdOrgId, {
        name: deptName.trim(),
        code: deptCode.trim() || deptName.slice(0, 4).toUpperCase(),
      });
      setDepartmentsList([...departmentsList, newDept]);
      setDeptName('');
      setDeptCode('');
      addToast('Department Added', `${newDept.name} created successfully`, 'success');
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  const handleDeleteDepartment = async (id: number) => {
    triggerHaptic(15);
    if (!createdOrgId) return;
    try {
      await api.deleteDepartment(createdOrgId, id);
      setDepartmentsList(departmentsList.filter((d) => d.id !== id));
      addToast('Deleted', 'Department removed', 'info');
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  const handleSeedSuggestedDepts = async () => {
    if (!createdOrgId) return;
    triggerHaptic(15);
    const defaults =
      selectedType === 'college'
        ? [
            { name: 'Computer Science & Eng', code: 'CSE' },
            { name: 'Electronics & Comm', code: 'ECE' },
            { name: 'Mathematics', code: 'MATH' },
          ]
        : selectedType === 'airline'
        ? [
            { name: 'Flight Operations', code: 'FLT' },
            { name: 'Cabin Crew', code: 'CBN' },
            { name: 'Maintenance Dispatch', code: 'MNT' },
          ]
        : [
            { name: 'Engineering', code: 'ENG' },
            { name: 'Product & Design', code: 'PRD' },
            { name: 'Operations & HR', code: 'OPS' },
          ];

    try {
      for (const d of defaults) {
        await api.createDepartment(createdOrgId, d);
      }
      const updated = await api.getDepartments(createdOrgId);
      setDepartmentsList(updated);
      addToast('Departments Created', `Added ${defaults.length} suggested operational departments`, 'success');
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  const handleSaveStep2 = async () => {
    triggerHaptic(15);
    if (createdOrgId) {
      await api.updateOrganization(createdOrgId, {
        settings_json: { setup_step: 3 },
      });
    }
    addToast('Step 2 Complete', 'Departments saved. Moving to Step 3: Employees & Teachers', 'success');
    setCurrentStep(3);
  };

  // STEP 3: Add Employee / Teacher
  const handleAddPerson = async () => {
    triggerHaptic(10);
    if (!personName.trim() || !createdOrgId) return;

    try {
      const skillsArray =
        selectedType === 'college'
          ? [{ name: subName || 'Teaching', level: 'Expert', verified: true, years: 5 }]
          : [{ name: 'Operations', level: 'Intermediate', verified: true, years: 3 }];

      const payload = {
        org_id: createdOrgId,
        name: personName.trim(),
        email: personEmail.trim() || `${personName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        role_title: personRole,
        employee_code: `EMP-${Math.floor(100 + Math.random() * 900)}`,
        department_id: personDeptId || (departmentsList[0]?.id ?? undefined),
        profession_type: selectedType,
        qualifications: personQuals ? personQuals.split(',').map((s) => s.trim()) : ['B.Tech'],
        skills: skillsArray,
        profession_metadata: {
          semesters: [personSemesters],
          classes: [personClasses],
        },
        max_hours_per_week: personWeeklyHours,
        status: 'active',
      };

      const newP = await api.createPerson(payload);
      setPeopleList([...peopleList, newP]);
      setPersonName('');
      setPersonEmail('');
      addToast('Person Registered', `${newP.name} added to roster`, 'success');
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  const handleSeedSampleStaff = async () => {
    if (!createdOrgId) return;
    triggerHaptic(15);
    const deptId = departmentsList[0]?.id;

    const samples =
      selectedType === 'college'
        ? [
            { name: 'Dr. Alan Turing', role: 'Professor', quals: ['Ph.D CSE'], sem: 'S5', cls: 'CSE-A', hrs: 36 },
            { name: 'Prof. Ada Lovelace', role: 'Associate Professor', quals: ['M.Tech CSE'], sem: 'S3', cls: 'CSE-B', hrs: 36 },
            { name: 'Dr. Grace Hopper', role: 'Assistant Professor', quals: ['Ph.D Networks'], sem: 'S7', cls: 'CSE-A', hrs: 32 },
          ]
        : selectedType === 'airline'
        ? [
            { name: 'Captain James Kirk', role: 'Captain', quals: ['ATPL B737'], sem: '', cls: '', hrs: 36 },
            { name: 'First Officer Spock', role: 'First Officer', quals: ['CPL Instrument'], sem: '', cls: '', hrs: 36 },
            { name: 'Uhura Nyota', role: 'Lead Flight Attendant', quals: ['Safety Cert'], sem: '', cls: '', hrs: 40 },
          ]
        : [
            { name: 'Sarah Connor', role: 'Senior Tech Lead', quals: ['B.S. CS'], sem: '', cls: '', hrs: 40 },
            { name: 'John Doe', role: 'Full Stack Engineer', quals: ['B.S. IT'], sem: '', cls: '', hrs: 40 },
            { name: 'Elena Rostova', role: 'Product Manager', quals: ['MBA'], sem: '', cls: '', hrs: 40 },
          ];

    try {
      for (const s of samples) {
        await api.createPerson({
          org_id: createdOrgId,
          name: s.name,
          email: `${s.name.toLowerCase().replace(/[^a-z]/g, '')}@org.io`,
          role_title: s.role,
          employee_code: `STAFF-${Math.floor(1000 + Math.random() * 9000)}`,
          department_id: deptId,
          profession_type: selectedType,
          qualifications: s.quals,
          skills: [{ name: 'Core Skill', level: 'Expert', verified: true, years: 5 }],
          profession_metadata: { semesters: [s.sem], classes: [s.cls] },
          max_hours_per_week: s.hrs,
          status: 'active',
        });
      }
      const updated = await api.getPeople({ org_id: createdOrgId });
      setPeopleList(updated);
      addToast('Staff Seeded', `Added ${samples.length} team members`, 'success');
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  const handleSaveStep3 = async () => {
    triggerHaptic(15);
    if (createdOrgId) {
      await api.updateOrganization(createdOrgId, {
        settings_json: { setup_step: 4 },
      });
    }
    addToast('Step 3 Complete', 'Staff profiles saved. Moving to Step 4: Subjects & Duties', 'success');
    setCurrentStep(4);
  };

  // STEP 4: Add Subject / Duty
  const handleAddSubject = async () => {
    triggerHaptic(10);
    if (!subName.trim() || !createdOrgId) return;

    try {
      const newSub = await api.createSubject(createdOrgId, {
        name: subName.trim(),
        code: subCode.trim() || subName.slice(0, 4).toUpperCase(),
        department_id: subDeptId || (departmentsList[0]?.id ?? undefined),
        semester: subSemester,
        class_name: subClass,
        required_hours_per_week: subHours,
        is_lab: subIsLab,
      });
      setSubjectsList([...subjectsList, newSub]);
      setSubName('');
      setSubCode('');
      addToast('Subject Added', `${newSub.name} added to curriculum`, 'success');
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  const handleDeleteSubject = async (id: number) => {
    triggerHaptic(15);
    if (!createdOrgId) return;
    try {
      await api.deleteSubject(createdOrgId, id);
      setSubjectsList(subjectsList.filter((s) => s.id !== id));
      addToast('Subject Deleted', 'Removed from curriculum', 'info');
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  const handleSeedDefaultSubjects = async () => {
    if (!createdOrgId) return;
    triggerHaptic(15);
    const deptId = departmentsList[0]?.id;
    const defaults = [
      { name: 'Database Management Systems', code: 'CS301', sem: 'S5', cls: 'CSE-A', hrs: 4, lab: false },
      { name: 'Data Structures & Algorithms', code: 'CS201', sem: 'S3', cls: 'CSE-A', hrs: 4, lab: false },
      { name: 'Database Systems Lab', code: 'CS304L', sem: 'S5', cls: 'CSE-A', hrs: 2, lab: true },
    ];

    try {
      for (const d of defaults) {
        await api.createSubject(createdOrgId, {
          name: d.name,
          code: d.code,
          department_id: deptId,
          semester: d.sem,
          class_name: d.cls,
          required_hours_per_week: d.hrs,
          is_lab: d.lab,
        });
      }
      const updated = await api.getSubjects(createdOrgId);
      setSubjectsList(updated);
      addToast('Curriculum Configured', `Added ${defaults.length} foundational courses`, 'success');
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  const handleSaveStep4 = async () => {
    triggerHaptic(15);
    if (createdOrgId) {
      await api.updateOrganization(createdOrgId, {
        settings_json: { setup_step: 5 },
      });
    }
    addToast('Step 4 Complete', 'Curriculum saved. Moving to Step 5: Working Hours & Shifts', 'success');
    setCurrentStep(5);
  };

  // STEP 5: Save Working Hours & Breaks
  const handleSaveStep5 = async () => {
    triggerHaptic(15);
    if (!createdOrgId) return;

    try {
      const schedule = buildWorkingSchedule(selectedType, workingDays, dailyStartTime, dailyEndTime);
      await api.updateOrganization(createdOrgId, {
        working_days_schedule: schedule,
        settings_json: {
          setup_step: 6,
          working_days: workingDays,
          daily_start_time: dailyStartTime,
          daily_end_time: dailyEndTime,
          break_start_time: breakStartTime,
          break_end_time: breakEndTime,
          lunch_start_time: lunchStartTime,
          lunch_end_time: lunchEndTime,
          min_rest_hours: minRestHours,
        },
      });

      addToast('Step 5 Complete', 'Shift timing rules saved. Moving to Step 6: Timetable Generation', 'success');
      setCurrentStep(6);
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  // STEP 6: Run Smart Roster Generator & Preview Confirmation
  const handleRunRosterGenerator = async () => {
    if (!createdOrgId) return;
    triggerHaptic(20);
    setIsGenerating(true);

    try {
      const today = new Date();
      const nextMon = new Date(today);
      nextMon.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));
      const endSun = new Date(nextMon);
      endSun.setDate(nextMon.getDate() + 6);

      const periodStart = nextMon.toISOString().split('T')[0];
      const periodEnd = endSun.toISOString().split('T')[0];

      const res = await api.generateSchedule({
        org_id: createdOrgId,
        title: `${orgName || activeOrg?.name || 'Academic'} Master Timetable`,
        period_start: periodStart,
        period_end: periodEnd,
        fairness_weight: 1.0,
        preference_weight: 1.0,
        overtime_penalty_weight: 1.0,
      });

      setGeneratedPreview(res);
      addToast('Optimization Complete', `Generated ${res.total_assigned} assignments (Fairness: ${res.fairness_score}%)`, 'success');
    } catch (err: any) {
      addToast('Solver Error', err.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Explicit Final Confirmation
  const handleConfirmAndPublish = async () => {
    triggerHaptic(25);
    if (!createdOrgId) return;

    try {
      await api.updateOrganization(createdOrgId, {
        settings_json: {
          setup_step: 6,
          setup_completed: true,
        },
      });
      await refreshOrgList();
      addToast('Timetable Active', 'Setup completed successfully! Opening interactive timetable.', 'success');
      setActiveTab('schedule');
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  // Wizard Step Header Pill Bar
  const renderStepIndicator = () => {
    const steps = [
      { num: 1, label: 'Details' },
      { num: 2, label: 'Departments' },
      { num: 3, label: selectedType === 'college' ? 'Teachers' : 'Employees' },
      { num: 4, label: selectedType === 'college' ? 'Subjects' : 'Duties' },
      { num: 5, label: 'Working Hours' },
      { num: 6, label: 'Generate' },
    ];

    return (
      <div className="flex items-center justify-between gap-1 overflow-x-auto pb-4 border-b border-white/20 dark:border-white/10 mb-6">
        {steps.map((st) => {
          const isCurrent = currentStep === st.num;
          const isDone = currentStep > st.num;
          return (
            <button
              key={st.num}
              onClick={() => {
                if (createdOrgId && st.num <= 6) {
                  triggerHaptic(10);
                  setCurrentStep(st.num);
                }
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                isCurrent
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : isDone
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
                  : 'bg-slate-200/50 dark:bg-slate-800/50 text-slate-400'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                isCurrent ? 'bg-white text-blue-600' : isDone ? 'bg-emerald-500 text-white' : 'bg-slate-300 dark:bg-slate-700'
              }`}>
                {isDone ? <Check className="w-3 h-3" /> : st.num}
              </span>
              <span>{st.label}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
      {/* Top Banner & Mode Toggle */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-2 border border-blue-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            Simple Guided Setup
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white">
            {viewState === 'wizard' ? 'Setup Your Organization' : 'Organizations Directory'}
          </h1>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1">
            {viewState === 'wizard'
              ? 'Complete the guided steps to configure departments, staff, subjects, and generate your timetable.'
              : 'Switch between existing organizations or create a new one with guided setup.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {viewState === 'wizard' ? (
            <button
              onClick={() => {
                triggerHaptic(10);
                setViewState('list');
              }}
              className="px-4 py-2 rounded-xl glass-pill hover:bg-white/60 dark:hover:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300/40"
            >
              View All Organizations
            </button>
          ) : (
            <button
              onClick={handleStartNewOrg}
              className="px-4 py-2 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Organization</span>
            </button>
          )}
        </div>
      </div>

      {/* MODE 1: Organizations List & Resume Cards */}
      {viewState === 'list' && (
        <div className="space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
            Active Organizations
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {existingOrgs.map((org) => {
              const Icon = ICON_MAP[org.type] || Building2;
              const isSelected = activeOrg?.id === org.id;
              const isSetupDone = org.settings_json?.setup_completed;
              const currentStepNum = org.settings_json?.setup_step || 1;

              return (
                <div
                  key={org.id}
                  className={`p-5 rounded-3xl glass-card border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-blue-500 shadow-md shadow-blue-500/10'
                      : 'border-white/40 dark:border-white/10 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isSetupDone
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      }`}>
                        {isSetupDone ? 'Active Timetable' : `Setup Step ${currentStepNum}/6`}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                      {org.name}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                      {org.description || `${org.type.toUpperCase()} organization instance.`}
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/20 dark:border-white/10 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        triggerHaptic(10);
                        switchOrg(org);
                        addToast('Organization Switched', `Active: ${org.name}`, 'info');
                        setActiveTab('dashboard');
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-200/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors"
                    >
                      {isSelected ? 'Open Dashboard' : 'Select'}
                    </button>

                    <button
                      onClick={() => handleResumeSetup(org)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors flex items-center gap-1"
                    >
                      <span>{isSetupDone ? 'Edit Setup' : 'Continue Setup'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE 2: Guided 6-Step Setup Wizard */}
      {viewState === 'wizard' && (
        <div className="p-6 md:p-8 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-6">
          {renderStepIndicator()}

          {/* ============================================================== */}
          {/* STEP 1: ORGANIZATION DETAILS                                   */}
          {/* ============================================================== */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Step 1: Organization Details</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select your organization type and configure your foundational operating hours.
                </p>
              </div>

              {/* 3 Selectable Organization Types */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Select Organization Type
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    {
                      type: 'college',
                      title: 'University / College',
                      desc: 'Semester timetable, faculty workloads, lectures, and laboratory practical sessions.',
                      icon: GraduationCap,
                    },
                    {
                      type: 'company',
                      title: 'Company / Office',
                      desc: 'Standard office shifts, project teams, sprint allocations, and on-call rotations.',
                      icon: Building2,
                    },
                    {
                      type: 'airline',
                      title: 'Aviation / Airline',
                      desc: 'Flight crew pairing, FAA rest limits, captain certifications, and cabin staff.',
                      icon: Plane,
                    },
                  ].map((t) => {
                    const Icon = t.icon;
                    const isPicked = selectedType === t.type;
                    return (
                      <div
                        key={t.type}
                        onClick={() => {
                          triggerHaptic(10);
                          setSelectedType(t.type as any);
                          if (!orgName || orgName.includes('Instance')) {
                            setOrgName(t.title);
                          }
                          if (t.type === 'airline') {
                            setWorkingDays([0, 1, 2, 3, 4, 5, 6]);
                          } else {
                            setWorkingDays([0, 1, 2, 3, 4]);
                          }
                        }}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                          isPicked
                            ? 'bg-blue-500/10 border-blue-500 shadow-md shadow-blue-500/10'
                            : 'glass-card border-white/40 dark:border-white/10 hover:border-slate-300'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
                          <Icon className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{t.title}</h4>
                        <p className="text-[11px] text-slate-500 mt-1">{t.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Basic Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Organization Name *
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Stanford University or Apex Technologies"
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Short Code
                  </label>
                  <input
                    type="text"
                    value={orgCode}
                    onChange={(e) => setOrgCode(e.target.value)}
                    placeholder="e.g. STAN-UNIV"
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs uppercase"
                  />
                </div>
              </div>

              {/* Working Days */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Operating Working Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAY_NAMES.map((dName, idx) => {
                    const isChecked = workingDays.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          triggerHaptic(5);
                          if (isChecked) {
                            setWorkingDays(workingDays.filter((x) => x !== idx));
                          } else {
                            setWorkingDays([...workingDays, idx].sort());
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                          isChecked
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'glass-pill text-slate-600 dark:text-slate-400 hover:bg-slate-200/50'
                        }`}
                      >
                        {dName}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Working Hours */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Daily Start Time
                  </label>
                  <input
                    type="time"
                    value={dailyStartTime}
                    onChange={(e) => setDailyStartTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Daily Finish Time
                  </label>
                  <input
                    type="time"
                    value={dailyEndTime}
                    onChange={(e) => setDailyEndTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Time Zone
                  </label>
                  <input
                    type="text"
                    value={orgTimezone}
                    onChange={(e) => setOrgTimezone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              {/* Step 1 Actions */}
              <div className="pt-4 border-t border-white/20 dark:border-white/10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setViewState('list')}
                  className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold"
                >
                  Cancel & Exit
                </button>
                <button
                  type="button"
                  onClick={handleSaveStep1}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <span>Save & Continue to Departments</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 2: DEPARTMENTS AND TEAMS                                  */}
          {/* ============================================================== */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Step 2: Departments & Operational Teams</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Organize staff and duties into academic departments or functional divisions.
                  </p>
                </div>
                {departmentsList.length === 0 && (
                  <button
                    onClick={handleSeedSuggestedDepts}
                    className="px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Add Suggested Defaults</span>
                  </button>
                )}
              </div>

              {/* Add Department Input */}
              <div className="p-4 rounded-2xl glass-card border border-white/40 dark:border-white/10 flex flex-col md:flex-row items-center gap-3">
                <div className="flex-1 w-full">
                  <input
                    type="text"
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    placeholder="Department Name (e.g. Computer Science & Eng)"
                    className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
                  />
                </div>
                <div className="w-full md:w-32">
                  <input
                    type="text"
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value)}
                    placeholder="Code (CSE)"
                    className="w-full px-3.5 py-2 rounded-xl glass-input text-xs uppercase"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddDepartment}
                  className="px-4 py-2 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-1.5 w-full md:w-auto justify-center"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Dept</span>
                </button>
              </div>

              {/* Department Badges */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Configured Departments ({departmentsList.length})
                </div>
                {departmentsList.length === 0 ? (
                  <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-400">
                    No departments added yet. You can add suggested defaults above or continue without departments.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {departmentsList.map((d) => (
                      <div
                        key={d.id}
                        className="p-3 rounded-xl glass-card border border-white/40 dark:border-white/10 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 font-bold text-[10px]">
                            {d.code || 'DEPT'}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white">{d.name}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteDepartment(d.id)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Step 2 Actions */}
              <div className="pt-4 border-t border-white/20 dark:border-white/10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveStep2}
                  className="px-5 py-2.5 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <span>Save & Continue to Staff</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 3: EMPLOYEES OR TEACHERS                                  */}
          {/* ============================================================== */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Step 3: {selectedType === 'college' ? 'Faculty & Teachers' : 'Staff & Personnel'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Add educators or employees with their qualifications, department, and teaching limits.
                  </p>
                </div>
                {peopleList.length === 0 && (
                  <button
                    onClick={handleSeedSampleStaff}
                    className="px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Add Sample Staff</span>
                  </button>
                )}
              </div>

              {/* Add Person Form */}
              <div className="p-5 rounded-2xl glass-card border border-white/40 dark:border-white/10 space-y-4">
                <div className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  Register New {selectedType === 'college' ? 'Faculty Member' : 'Employee'}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      placeholder="e.g. Dr. Eleanor Vance"
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Role / Title</label>
                    <input
                      type="text"
                      value={personRole}
                      onChange={(e) => setPersonRole(e.target.value)}
                      placeholder="e.g. Associate Professor"
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Department</label>
                    <select
                      value={personDeptId || ''}
                      onChange={(e) => setPersonDeptId(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                    >
                      <option value="">General (No Dept)</option>
                      {departmentsList.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedType === 'college' ? (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Qualifications</label>
                      <input
                        type="text"
                        value={personQuals}
                        onChange={(e) => setPersonQuals(e.target.value)}
                        placeholder="M.Tech, Ph.D"
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Semester(s)</label>
                      <input
                        type="text"
                        value={personSemesters}
                        onChange={(e) => setPersonSemesters(e.target.value)}
                        placeholder="S3, S5"
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Class / Section</label>
                      <input
                        type="text"
                        value={personClasses}
                        onChange={(e) => setPersonClasses(e.target.value)}
                        placeholder="CSE-A"
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Max Weekly Hours</label>
                      <input
                        type="number"
                        value={personWeeklyHours}
                        onChange={(e) => setPersonWeeklyHours(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Qualifications / Skills</label>
                      <input
                        type="text"
                        value={personQuals}
                        onChange={(e) => setPersonQuals(e.target.value)}
                        placeholder="e.g. Certified Engineer / ATPL"
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Max Weekly Hours</label>
                      <input
                        type="number"
                        value={personWeeklyHours}
                        onChange={(e) => setPersonWeeklyHours(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddPerson}
                    className="px-4 py-2 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add {selectedType === 'college' ? 'Teacher' : 'Employee'}</span>
                  </button>
                </div>
              </div>

              {/* Staff List */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Registered Staff Members ({peopleList.length})
                </div>
                {peopleList.length === 0 ? (
                  <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-400">
                    No employees added yet. Click 'Add Sample Staff' or register teachers using the form above.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {peopleList.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 rounded-xl glass-card border border-white/40 dark:border-white/10 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{p.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {p.role_title} • {p.department_name || 'General'} • Max {p.max_hours_per_week}h/wk
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-600 font-semibold">
                          Active
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Step 3 Actions */}
              <div className="pt-4 border-t border-white/20 dark:border-white/10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveStep3}
                  className="px-5 py-2.5 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <span>Save & Continue to {selectedType === 'college' ? 'Subjects' : 'Duties'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 4: SUBJECTS, DUTIES, AND REQUIREMENTS                     */}
          {/* ============================================================== */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Step 4: {selectedType === 'college' ? 'Subjects & Academic Curriculum' : 'Operational Duties & Tasks'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedType === 'college'
                      ? 'Configure course subjects, semester codes, sections, and practical lab designations.'
                      : 'Define shift requirements, necessary competencies, and operational task roles.'}
                  </p>
                </div>
                {selectedType === 'college' && subjectsList.length === 0 && (
                  <button
                    onClick={handleSeedDefaultSubjects}
                    className="px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Add Sample Curriculum</span>
                  </button>
                )}
              </div>

              {/* Add Subject Form */}
              {selectedType === 'college' ? (
                <div className="p-5 rounded-2xl glass-card border border-white/40 dark:border-white/10 space-y-4">
                  <div className="font-bold text-xs text-slate-700 dark:text-slate-300">
                    Add Academic Course / Subject
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Subject Title *</label>
                      <input
                        type="text"
                        value={subName}
                        onChange={(e) => setSubName(e.target.value)}
                        placeholder="e.g. Database Management Systems"
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Course Code</label>
                      <input
                        type="text"
                        value={subCode}
                        onChange={(e) => setSubCode(e.target.value)}
                        placeholder="CS301"
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Department</label>
                      <select
                        value={subDeptId || ''}
                        onChange={(e) => setSubDeptId(e.target.value ? Number(e.target.value) : undefined)}
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      >
                        <option value="">General</option>
                        {departmentsList.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Semester</label>
                      <input
                        type="text"
                        value={subSemester}
                        onChange={(e) => setSubSemester(e.target.value)}
                        placeholder="S5"
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Class / Section</label>
                      <input
                        type="text"
                        value={subClass}
                        onChange={(e) => setSubClass(e.target.value)}
                        placeholder="CSE-A"
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Weekly Periods</label>
                      <input
                        type="number"
                        value={subHours}
                        onChange={(e) => setSubHours(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                      <input
                        type="checkbox"
                        id="isLabCheck"
                        checked={subIsLab}
                        onChange={(e) => setSubIsLab(e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="isLabCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Is Practical Laboratory
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddSubject}
                      className="px-4 py-2 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Subject</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-2xl glass-card border border-white/40 dark:border-white/10 text-xs text-slate-500">
                  Operational duties and roles will automatically be generated from your configured shift requirements in Step 5.
                </div>
              )}

              {/* Subject List */}
              {selectedType === 'college' && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Configured Subjects ({subjectsList.length})
                  </div>
                  {subjectsList.length === 0 ? (
                    <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-400">
                      No subjects configured yet. Click 'Add Sample Curriculum' above to get started quickly.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {subjectsList.map((s) => (
                        <div
                          key={s.id}
                          className="p-3 rounded-xl glass-card border border-white/40 dark:border-white/10 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white">{s.name}</span>
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-bold text-[10px]">
                                {s.code}
                              </span>
                              {s.is_lab && (
                                <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 font-bold text-[10px]">
                                  LAB
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {s.semester || 'S5'} • Class {s.class_name || 'All'} • {s.department_name || 'General'}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteSubject(s.id)}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 4 Actions */}
              <div className="pt-4 border-t border-white/20 dark:border-white/10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveStep4}
                  className="px-5 py-2.5 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <span>Save & Continue to Working Hours</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 5: TIMETABLE CONFIGURATION & BREAKS                       */}
          {/* ============================================================== */}
          {currentStep === 5 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Step 5: Timetable Configuration & Shift Rules</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure daily lecture durations, designated lunch/refreshment breaks, and minimum rest periods.
                </p>
              </div>

              {/* Breaks and Rest Intervals */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl glass-card border border-white/40 dark:border-white/10 space-y-3">
                  <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span>Designated Refreshment & Lunch Breaks</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Morning Break</label>
                      <input
                        type="time"
                        value={breakStartTime}
                        onChange={(e) => setBreakStartTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Break End</label>
                      <input
                        type="time"
                        value={breakEndTime}
                        onChange={(e) => setBreakEndTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Lunch Start</label>
                      <input
                        type="time"
                        value={lunchStartTime}
                        onChange={(e) => setLunchStartTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Lunch End</label>
                      <input
                        type="time"
                        value={lunchEndTime}
                        onChange={(e) => setLunchEndTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl glass-card border border-white/40 dark:border-white/10 space-y-3">
                  <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Fatigue & Rest Regulations</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Minimum Rest Period Between Shifts (Hours)
                    </label>
                    <input
                      type="number"
                      value={minRestHours}
                      onChange={(e) => setMinRestHours(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Prevents scheduling back-to-back shifts without mandatory rest (e.g. 11 hours standard).
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Overnight Shifts Handling
                    </label>
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Modulo-1440 minute cross-midnight arithmetic enabled</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 5 Actions */}
              <div className="pt-4 border-t border-white/20 dark:border-white/10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveStep5}
                  className="px-5 py-2.5 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <span>Save & Continue to Generation</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 6: GENERATE TIMETABLE                                     */}
          {/* ============================================================== */}
          {currentStep === 6 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Step 6: Smart Roster Generator</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify configuration completeness and run the automated constraint satisfaction optimizer.
                </p>
              </div>

              {/* Pre-generation Checklist */}
              {readiness && (
                <div className="p-5 rounded-2xl glass-card border border-white/40 dark:border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      Configuration Readiness Checklist
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      readiness.can_generate
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-amber-500/10 text-amber-600'
                    }`}>
                      {readiness.can_generate ? 'Ready to Generate' : 'Action Required'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {readiness.checklist?.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-xs ${
                          item.is_ready
                            ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                            : 'bg-amber-500/5 border-amber-500/20 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {item.is_ready ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold">{item.title}</div>
                          <div className="text-[10px] text-slate-500">{item.details}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {!readiness.can_generate && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200">
                      <strong>Missing Requirements:</strong> {readiness.missing_items?.join(', ')}. Please return to earlier steps to complete them.
                    </div>
                  )}
                </div>
              )}

              {/* Big Smart Roster Generator Button */}
              <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 border border-blue-500/20 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-500/30">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Google OR-Tools Constraint Optimization Engine
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    Solves teacher-subject compatibility, prevents overlapping slots, enforces working hour limits, and minimizes workload variance.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRunRosterGenerator}
                  disabled={isGenerating || (readiness && !readiness.can_generate)}
                  className={`px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 mx-auto transition-all shadow-xl ${
                    isGenerating
                      ? 'bg-blue-400 text-white cursor-wait'
                      : 'glass-button-primary shadow-blue-500/30 hover:scale-105'
                  }`}
                >
                  <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>{isGenerating ? 'Optimizing Schedule with CP-SAT...' : 'Smart Roster Generator'}</span>
                </button>
              </div>

              {/* Generation Preview Modal / Card */}
              {generatedPreview && (
                <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-4 animate-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <span>Timetable Generated Successfully!</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-white">
                      Version {generatedPreview.version}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-700 dark:text-slate-300">
                    <div className="p-3 rounded-xl bg-white/50 dark:bg-slate-900/50">
                      <div className="text-[10px] text-slate-400">Total Assigned</div>
                      <div className="text-lg font-bold text-blue-600">{generatedPreview.total_assigned}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/50 dark:bg-slate-900/50">
                      <div className="text-[10px] text-slate-400">Gini Fairness</div>
                      <div className="text-lg font-bold text-emerald-600">{generatedPreview.fairness_score}%</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/50 dark:bg-slate-900/50">
                      <div className="text-[10px] text-slate-400">Conflicts Detected</div>
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        {generatedPreview.conflicts?.length || 0}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/50 dark:bg-slate-900/50">
                      <div className="text-[10px] text-slate-400">Unfilled Slots</div>
                      <div className="text-lg font-bold text-slate-500">{generatedPreview.unfilled_count || 0}</div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleRunRosterGenerator}
                      className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      Re-run Generator
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmAndPublish}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                    >
                      <Check className="w-4 h-4" />
                      <span>Confirm & Open Interactive Timetable</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 6 Bottom Navigation */}
              <div className="pt-4 border-t border-white/20 dark:border-white/10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back to Working Hours</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    setActiveTab('dashboard');
                  }}
                  className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold"
                >
                  Save & Exit to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
