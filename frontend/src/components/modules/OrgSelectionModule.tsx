import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { PresetOrg, Department, Person, Subject, Semester } from '../../types';
import { triggerHaptic } from '../../utils/haptics';
import {
  GraduationCap,
  Building2,
  Plane,
  Check,
  Plus,
  ArrowRight,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
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

interface Step3AssignmentRow {
  id?: number;
  department_id?: number;
  semester: string;
  subject_id?: number;
  required_periods: number;
  period_duration: string;
  allowed_working_days: number[];
  preferred_periods: string;
  class_name?: string;
}

const DEFAULT_DAYS = [0, 1, 2, 3, 4];
const DAY_LABELS = [
  { label: 'Mon', day: 0 },
  { label: 'Tue', day: 1 },
  { label: 'Wed', day: 2 },
  { label: 'Thu', day: 3 },
  { label: 'Fri', day: 4 },
  { label: 'Sat', day: 5 },
  { label: 'Sun', day: 6 },
];
const DURATION_OPTIONS = ['1 hour', '45 mins', '50 mins', '1.5 hours', '2 hours'];

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
  const [semestersList, setSemestersList] = useState<Semester[]>([]);
  const [personName, setPersonName] = useState<string>('');
  const [personEmail, setPersonEmail] = useState<string>('');
  const [personRole, setPersonRole] = useState<string>('Assistant Professor');
  const [personDeptId, setPersonDeptId] = useState<number | undefined>(undefined);
  const [personQuals, setPersonQuals] = useState<string>('M.Tech');
  const [personClasses, setPersonClasses] = useState<string>('');
  const [personWeeklyHours, setPersonWeeklyHours] = useState<number>(36);
  const [step3Assignments, setStep3Assignments] = useState<Step3AssignmentRow[]>([]);
  const [editingPersonId, setEditingPersonId] = useState<number | null>(null);
  const [collapsedAssignments, setCollapsedAssignments] = useState<Record<number, boolean>>({});
  const [showQuickAddSub, setShowQuickAddSub] = useState<boolean>(false);
  const [quickSubName, setQuickSubName] = useState<string>('');
  const [quickSubSemester, setQuickSubSemester] = useState<string>('S1');
  const [quickSubDeptId, setQuickSubDeptId] = useState<number | undefined>(undefined);

  // STEP 4 State: Subjects / Duties
  const [subjectsList, setSubjectsList] = useState<Subject[]>([]);
  const [subName, setSubName] = useState<string>('');
  const [subCode, setSubCode] = useState<string>('');
  const [subSemester, setSubSemester] = useState<string>('S5');
  const [subClass, setSubClass] = useState<string>('CSE-A');
  const [subDeptId, setSubDeptId] = useState<number | undefined>(undefined);
  const [subIsLab, setSubIsLab] = useState<boolean>(false);
  const [subHours, setSubHours] = useState<number>(4);
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);

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
      api.getDepartments(createdOrgId).then((depts) => {
        setDepartmentsList(depts || []);
        if (depts && depts.length > 0 && !personDeptId) {
          setPersonDeptId(depts[0].id);
        }
      }).catch(console.error);
    }
    if (currentStep === 3) {
      api.getPeople({ org_id: createdOrgId }).then(setPeopleList).catch(console.error);
      api.getSemesters(createdOrgId).then((sems) => setSemestersList(sems || [])).catch(console.error);
      api.getSubjects(createdOrgId).then(async (subs) => {
        if ((!subs || subs.length === 0) && selectedType === 'college') {
          await ensureCollegeSubjects(createdOrgId);
        } else {
          setSubjectsList(subs || []);
        }
      }).catch(console.error);
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

  // Helper: Ensure college curriculum has foundational courses without duplicating
  const ensureCollegeSubjects = async (orgId: number) => {
    try {
      const existing = await api.getSubjects(orgId);
      if (existing && existing.length > 0) {
        setSubjectsList(existing);
        return;
      }
      const depts = await api.getDepartments(orgId);
      const deptId = depts && depts.length > 0 ? depts[0].id : undefined;
      const defaults = [
        { name: 'Data Structures & Algorithms', code: 'CS201', sem: 'S3', hrs: 4, lab: false },
        { name: 'Database Management Systems', code: 'CS301', sem: 'S5', hrs: 4, lab: false },
        { name: 'Machine Learning', code: 'CS401', sem: 'S7', hrs: 4, lab: false },
        { name: 'Programming in Python', code: 'CS101', sem: 'S1', hrs: 4, lab: false },
        { name: 'Computer Networks', code: 'CS302', sem: 'S5', hrs: 4, lab: false },
        { name: 'Artificial Intelligence', code: 'CS402', sem: 'S7', hrs: 3, lab: false },
        { name: 'Database Systems Lab', code: 'CS304L', sem: 'S5', hrs: 2, lab: true },
      ];
      for (const d of defaults) {
        await api.createSubject(orgId, {
          name: d.name,
          code: d.code,
          department_id: deptId,
          semester: d.sem,
          required_hours_per_week: d.hrs,
          is_lab: d.lab,
        });
      }
      const updated = await api.getSubjects(orgId);
      setSubjectsList(updated || []);
    } catch (e) {
      console.error('Failed to ensure college subjects', e);
    }
  };

  // STEP 3: Assignment Row Handlers
  const handleAddStep3Assignment = () => {
    triggerHaptic(10);
    const defaultSem = semestersList.length > 0 ? semestersList[0].code : 'S1';
    const defaultDept = personDeptId || (departmentsList.length > 0 ? departmentsList[0].id : undefined);
    setStep3Assignments((prev) => [
      ...prev,
      {
        semester: defaultSem,
        department_id: defaultDept,
        subject_id: undefined,
        required_periods: 4,
        period_duration: '1 hour',
        allowed_working_days: DEFAULT_DAYS,
        preferred_periods: '',
        class_name: '',
      },
    ]);
  };

  const handleUpdateStep3Assignment = (index: number, updates: Partial<Step3AssignmentRow>) => {
    setStep3Assignments((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const handleRemoveStep3Assignment = (index: number) => {
    triggerHaptic(12);
    setStep3Assignments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const toggleCollapseAssignment = (index: number) => {
    setCollapsedAssignments((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Quick Add Subject directly from Step 3 (shortcut to central curriculum)
  const handleQuickAddSubject = async () => {
    if (!createdOrgId || !quickSubName.trim()) return;
    try {
      const trimmedName = quickSubName.trim();
      const code = trimmedName.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase() || 'SUB';

      // Check if already in subjectsList
      const existing = subjectsList.find(
        (s) => (s.code && s.code.toUpperCase() === code) ||
               (s.name.toLowerCase() === trimmedName.toLowerCase() && (!quickSubSemester || s.semester === quickSubSemester))
      );

      if (existing) {
        addToast('Subject Already Exists', `Referencing existing course "${existing.name}" (${existing.code})`, 'info');
        setQuickSubName('');
        setShowQuickAddSub(false);
        return;
      }

      const newSub = await api.createSubject(createdOrgId, {
        name: trimmedName,
        code: code,
        department_id: quickSubDeptId || personDeptId || (departmentsList[0]?.id ?? undefined),
        semester: quickSubSemester || 'S1',
        required_hours_per_week: 4,
        is_lab: false,
      });
      const updated = await api.getSubjects(createdOrgId);
      setSubjectsList(updated || []);
      setQuickSubName('');
      setShowQuickAddSub(false);
      addToast(
        newSub.already_existed ? 'Subject Linked' : 'Subject Added',
        newSub.already_existed
          ? `Linked to existing curriculum record for ${newSub.name}`
          : `${newSub.name} registered in central curriculum`,
        'success'
      );
    } catch (err: any) {
      addToast('Error', err.message || 'Failed to add subject', 'error');
    }
  };

  // STEP 3: Add / Update Employee or Teacher
  const handleAddPerson = async () => {
    triggerHaptic(10);
    if (!personName.trim() || !createdOrgId) {
      addToast('Validation Error', 'Please enter Teacher / Employee Name', 'error');
      return;
    }

    try {
      const skillsArray =
        selectedType === 'college'
          ? [{ name: 'Teaching', level: 'Expert', verified: true, years: 5 }]
          : [{ name: 'Operations', level: 'Intermediate', verified: true, years: 3 }];

      // In college mode, automatically include assigned subjects in skills for compatibility
      const assignedSubjIds = step3Assignments.map((a) => a.subject_id).filter(Boolean);
      const assignedSubjects = subjectsList.filter((s) => assignedSubjIds.includes(s.id));
      for (const as of assignedSubjects) {
        if (!skillsArray.some((sk) => sk.name.toLowerCase() === as.name.toLowerCase())) {
          skillsArray.push({
            name: as.name,
            level: 'Expert',
            verified: true,
            years: 5.0,
          });
        }
      }

      // Build assignments payload
      const assignmentsPayload = step3Assignments
        .filter((r) => r.subject_id)
        .map((r) => {
          const sub = subjectsList.find((s) => s.id === r.subject_id);
          const semObj = semestersList.find((s) => s.code === r.semester);
          const prefList = r.preferred_periods
            ? r.preferred_periods.split(',').map((p) => p.trim()).filter(Boolean)
            : [];

          return {
            id: r.id,
            subject_id: r.subject_id,
            semester: r.semester || sub?.semester || 'S1',
            semester_id: semObj?.id || sub?.semester_id,
            department_id: r.department_id || personDeptId || sub?.department_id,
            class_name: r.class_name || sub?.class_name || null,
            required_periods: r.required_periods || 4,
            required_hours: (r.required_periods || 4) * 1.0,
            period_duration: r.period_duration || '1 hour',
            allowed_working_days: r.allowed_working_days || DEFAULT_DAYS,
            preferred_periods: prefList,
            max_periods_per_day: 2,
            assignment_status: 'active',
          };
        });

      const payload = {
        org_id: createdOrgId,
        name: personName.trim(),
        email: personEmail.trim() || `${personName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@institution.edu`,
        role_title: personRole || (selectedType === 'college' ? 'Assistant Professor' : 'Staff'),
        employee_code: `FAC-${Math.floor(100 + Math.random() * 900)}`,
        department_id: personDeptId || (departmentsList[0]?.id ?? undefined),
        profession_type: selectedType,
        qualifications: personQuals ? personQuals.split(',').map((s) => s.trim()).filter(Boolean) : ['B.Tech'],
        skills: skillsArray,
        profession_metadata: {
          semesters: Array.from(new Set(step3Assignments.map((a) => a.semester).filter(Boolean))),
        },
        max_hours_per_week: personWeeklyHours,
        status: 'active',
        teacher_assignments: assignmentsPayload,
      };

      if (editingPersonId) {
        await api.updatePerson(editingPersonId, payload);
        addToast(
          'Teacher Updated',
          `${personName} updated with ${assignmentsPayload.length} semester assignment(s).`,
          'success'
        );
      } else {
        const newP = await api.createPerson(payload);
        addToast(
          'Teacher Registered',
          `${newP.name} added with ${assignmentsPayload.length} semester assignment(s).`,
          'success'
        );
      }

      const updated = await api.getPeople({ org_id: createdOrgId });
      setPeopleList(updated);

      // Reset form
      setEditingPersonId(null);
      setPersonName('');
      setPersonEmail('');
      setPersonRole('Assistant Professor');
      setPersonQuals('M.Tech');
      setPersonWeeklyHours(36);
      setStep3Assignments([]);
      setCollapsedAssignments({});
    } catch (err: any) {
      addToast('Error', err.message || 'Failed to save teacher', 'error');
    }
  };

  const handleStartEditPerson = async (p: Person) => {
    triggerHaptic(10);
    setEditingPersonId(p.id);
    setPersonName(p.name || '');
    setPersonEmail(p.email || '');
    setPersonRole(p.role_title || 'Assistant Professor');
    setPersonDeptId(p.department_id);
    setPersonQuals((p.qualifications || []).join(', '));
    setPersonWeeklyHours(p.max_hours_per_week || 36);

    try {
      let assignments = p.teacher_assignments;
      if (!assignments || assignments.length === 0) {
        assignments = await api.getTeacherAssignments(createdOrgId!, { person_id: p.id });
      }
      if (assignments && assignments.length > 0) {
        setStep3Assignments(
          assignments.map((a: any) => ({
            id: a.id,
            department_id: a.department_id || p.department_id,
            semester: a.semester || 'S1',
            subject_id: a.subject_id,
            required_periods: a.required_periods || 4,
            period_duration: a.period_duration || '1 hour',
            allowed_working_days: a.allowed_working_days || DEFAULT_DAYS,
            preferred_periods: Array.isArray(a.preferred_periods) ? a.preferred_periods.join(', ') : (a.preferred_periods || ''),
            class_name: a.class_name || '',
          }))
        );
      } else {
        setStep3Assignments([]);
      }
    } catch (err) {
      console.error('Failed to load assignments for editing:', err);
      setStep3Assignments([]);
    }
  };

  const handleCancelEdit = () => {
    triggerHaptic(10);
    setEditingPersonId(null);
    setPersonName('');
    setPersonEmail('');
    setPersonRole('Assistant Professor');
    setPersonQuals('M.Tech');
    setPersonWeeklyHours(36);
    setStep3Assignments([]);
    setCollapsedAssignments({});
  };

  const handleDeletePerson = async (id: number) => {
    triggerHaptic(15);
    try {
      await api.deletePerson(id);
      setPeopleList((prev) => prev.filter((p) => p.id !== id));
      if (editingPersonId === id) {
        handleCancelEdit();
      }
      addToast('Profile Removed', 'Teacher removed from roster', 'info');
    } catch (err: any) {
      addToast('Error', err.message || 'Failed to delete teacher', 'error');
    }
  };

  const handleSeedSampleStaff = async () => {
    if (!createdOrgId) return;
    triggerHaptic(15);
    const deptId = departmentsList[0]?.id;

    const s3Sub = subjectsList.find((s) => s.semester === 'S3') || subjectsList[0];
    const s5Sub = subjectsList.find((s) => s.semester === 'S5') || subjectsList[1] || subjectsList[0];
    const s7Sub = subjectsList.find((s) => s.semester === 'S7') || subjectsList[2] || subjectsList[0];

    const samples =
      selectedType === 'college'
        ? [
            {
              name: 'Dr. Alan Turing',
              role: 'Professor',
              quals: ['Ph.D CSE'],
              assignments: s5Sub ? [{ subject_id: s5Sub.id, semester: 'S5', required_periods: 4, period_duration: '1 hour' }] : [],
              hrs: 36,
            },
            {
              name: 'Prof. Ada Lovelace',
              role: 'Associate Professor',
              quals: ['M.Tech CSE'],
              assignments: s3Sub ? [{ subject_id: s3Sub.id, semester: 'S3', required_periods: 4, period_duration: '1 hour' }] : [],
              hrs: 36,
            },
            {
              name: 'Dr. Grace Hopper',
              role: 'Assistant Professor',
              quals: ['Ph.D Networks'],
              assignments: s7Sub ? [{ subject_id: s7Sub.id, semester: 'S7', required_periods: 3, period_duration: '1 hour' }] : [],
              hrs: 32,
            },
          ]
        : selectedType === 'airline'
        ? [
            { name: 'Captain James Kirk', role: 'Captain', quals: ['ATPL B737'], assignments: [], hrs: 36 },
            { name: 'First Officer Spock', role: 'First Officer', quals: ['CPL Instrument'], assignments: [], hrs: 36 },
            { name: 'Uhura Nyota', role: 'Lead Flight Attendant', quals: ['Safety Cert'], assignments: [], hrs: 40 },
          ]
        : [
            { name: 'Sarah Connor', role: 'Senior Tech Lead', quals: ['B.S. CS'], assignments: [], hrs: 40 },
            { name: 'John Doe', role: 'Full Stack Engineer', quals: ['B.S. IT'], assignments: [], hrs: 40 },
            { name: 'Elena Rostova', role: 'Product Manager', quals: ['MBA'], assignments: [], hrs: 40 },
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
          profession_metadata: { semesters: s.assignments?.map((a: any) => a.semester) || [] },
          max_hours_per_week: s.hrs,
          status: 'active',
          teacher_assignments: (s as any).assignments || [],
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
    addToast('Step 3 Complete', 'Teacher assignments saved. Moving to Step 4: Subjects & Duties', 'success');
    setCurrentStep(4);
  };

  // STEP 4: Central Subject Curriculum Management Handlers
  const handleAddOrUpdateSubject = async () => {
    triggerHaptic(10);
    if (!subName.trim() || !createdOrgId) return;

    try {
      if (editingSubjectId) {
        await api.updateSubject(createdOrgId, editingSubjectId, {
          name: subName.trim(),
          code: subCode.trim().toUpperCase() || subName.slice(0, 4).toUpperCase(),
          department_id: subDeptId || undefined,
          semester: subSemester,
          class_name: subClass || undefined,
          required_hours_per_week: subHours,
          is_lab: subIsLab,
        });
        addToast('Subject Updated', `${subName} updated in central curriculum`, 'success');
        setEditingSubjectId(null);
      } else {
        const newSub = await api.createSubject(createdOrgId, {
          name: subName.trim(),
          code: subCode.trim().toUpperCase() || subName.slice(0, 4).toUpperCase(),
          department_id: subDeptId || (departmentsList[0]?.id ?? undefined),
          semester: subSemester,
          class_name: subClass || undefined,
          required_hours_per_week: subHours,
          is_lab: subIsLab,
        });
        addToast(
          newSub.already_existed ? 'Subject Linked' : 'Subject Added',
          newSub.already_existed
            ? `${newSub.name} already exists; updated curriculum record`
            : `${newSub.name} added to central curriculum`,
          'success'
        );
      }
      const updated = await api.getSubjects(createdOrgId);
      setSubjectsList(updated || []);
      setSubName('');
      setSubCode('');
      setSubHours(4);
      setSubIsLab(false);
    } catch (err: any) {
      addToast('Error', err.message || 'Failed to save subject', 'error');
    }
  };

  const handleStartEditSubject = (s: Subject) => {
    triggerHaptic(10);
    setEditingSubjectId(s.id);
    setSubName(s.name);
    setSubCode(s.code || '');
    setSubDeptId(s.department_id);
    setSubSemester(s.semester || 'S1');
    setSubClass(s.class_name || '');
    setSubHours(s.required_hours_per_week || 4);
    setSubIsLab(Boolean(s.is_lab));
  };

  const handleCancelEditSubject = () => {
    triggerHaptic(10);
    setEditingSubjectId(null);
    setSubName('');
    setSubCode('');
    setSubHours(4);
    setSubIsLab(false);
  };

  const handleDeleteSubject = async (id: number) => {
    triggerHaptic(15);
    if (!createdOrgId) return;
    try {
      await api.deleteSubject(createdOrgId, id);
      setSubjectsList(subjectsList.filter((s) => s.id !== id));
      if (editingSubjectId === id) {
        handleCancelEditSubject();
      }
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
      { name: 'Data Structures & Algorithms', code: 'CS201', sem: 'S3', cls: 'CSE-A', hrs: 4, lab: false },
      { name: 'Database Management Systems', code: 'CS301', sem: 'S5', cls: 'CSE-A', hrs: 4, lab: false },
      { name: 'Machine Learning', code: 'CS401', sem: 'S7', cls: 'CSE-A', hrs: 4, lab: false },
      { name: 'Programming in Python', code: 'CS101', sem: 'S1', cls: 'CSE-A', hrs: 4, lab: false },
      { name: 'Computer Networks', code: 'CS302', sem: 'S5', cls: 'CSE-A', hrs: 4, lab: false },
      { name: 'Artificial Intelligence', code: 'CS402', sem: 'S7', cls: 'CSE-A', hrs: 3, lab: false },
      { name: 'Database Systems Lab', code: 'CS304L', sem: 'S5', cls: 'CSE-A', hrs: 2, lab: true },
    ];

    try {
      const existingCodes = new Set(subjectsList.map((s) => s.code?.toUpperCase()));
      const existingNames = new Set(subjectsList.map((s) => `${s.name.toLowerCase()}__${s.semester || ''}`));

      let addedCount = 0;
      for (const d of defaults) {
        if (existingCodes.has(d.code.toUpperCase()) || existingNames.has(`${d.name.toLowerCase()}__${d.sem}`)) {
          continue; // Skip already existing subject
        }
        await api.createSubject(createdOrgId, {
          name: d.name,
          code: d.code,
          department_id: deptId,
          semester: d.sem,
          class_name: d.cls,
          required_hours_per_week: d.hrs,
          is_lab: d.lab,
        });
        addedCount++;
      }
      const updated = await api.getSubjects(createdOrgId);
      setSubjectsList(updated || []);
      if (addedCount > 0) {
        addToast('Curriculum Configured', `Added ${addedCount} foundational course(s) across semesters`, 'success');
      } else {
        addToast('Curriculum Up to Date', 'All foundational courses already exist in central curriculum', 'info');
      }
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
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-blue-600" />
                    <span>Step 3: {selectedType === 'college' ? 'Faculty & Teachers' : 'Staff & Personnel'}</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedType === 'college'
                      ? 'Register teachers and assign their semester-wise subjects, teaching periods, and working hours.'
                      : 'Add employees with their qualifications, department, and weekly work limits.'}
                  </p>
                </div>
                {peopleList.length === 0 && (
                  <button
                    type="button"
                    onClick={handleSeedSampleStaff}
                    className="px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Add Sample Staff</span>
                  </button>
                )}
              </div>

              {/* Add / Edit Person Form */}
              <div className="p-6 rounded-3xl glass-card border border-white/40 dark:border-white/10 space-y-5 shadow-sm">
                {editingPersonId && (
                  <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between text-xs text-blue-700 dark:text-blue-300">
                    <div className="flex items-center gap-2 font-bold">
                      <Edit2 className="w-4 h-4 text-blue-600" />
                      <span>Editing Teacher: {personName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-2.5 py-1 rounded-lg bg-white/60 dark:bg-slate-800/60 hover:bg-white text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all"
                    >
                      Cancel Edit
                    </button>
                  </div>
                )}

                <div className="border-b border-slate-200/50 dark:border-slate-800/80 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-blue-600" />
                      <span>{editingPersonId ? 'EDIT TEACHER DETAILS' : 'TEACHER DETAILS'}</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Configure teacher personal info and assign their individual semester subjects directly below.
                    </p>
                  </div>
                </div>

                {/* Section 1: Teacher Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Teacher Name *
                    </label>
                    <input
                      type="text"
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      placeholder="e.g. Dr. Eleanor Vance"
                      className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Department *
                    </label>
                    <select
                      value={personDeptId || ''}
                      onChange={(e) => setPersonDeptId(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-medium"
                    >
                      <option value="">-- Select Department --</option>
                      {departmentsList.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Designation / Role
                    </label>
                    <input
                      type="text"
                      value={personRole}
                      onChange={(e) => setPersonRole(e.target.value)}
                      placeholder="e.g. Assistant Professor"
                      className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={personEmail}
                      onChange={(e) => setPersonEmail(e.target.value)}
                      placeholder="e.g. teacher@institution.edu"
                      className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Qualifications
                    </label>
                    <input
                      type="text"
                      value={personQuals}
                      onChange={(e) => setPersonQuals(e.target.value)}
                      placeholder="e.g. M.Tech, Ph.D"
                      className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Max Weekly Hours
                    </label>
                    <input
                      type="number"
                      value={personWeeklyHours}
                      min="5"
                      max="60"
                      onChange={(e) => setPersonWeeklyHours(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-medium"
                    />
                  </div>
                </div>

                {/* Section 2: SUBJECTS AND SEMESTERS ASSIGNED TO THIS TEACHER */}
                {selectedType === 'college' && (
                  <div className="border-t border-slate-200/50 dark:border-slate-800/80 pt-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-500/5 p-4 rounded-2xl border border-blue-500/20">
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-blue-600" />
                          <span>SUBJECTS AND SEMESTERS ASSIGNED TO THIS TEACHER</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Assign multiple semester subjects with required weekly periods, duration, and preferred working days.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setShowQuickAddSub(!showQuickAddSub)}
                          className="px-3 py-1.5 rounded-xl glass-pill text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 flex items-center gap-1"
                          title="Create a new subject if not in list"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>New Subject</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleAddStep3Assignment}
                          className="px-4 py-2 rounded-xl glass-button-primary text-xs font-bold flex items-center gap-1.5 shadow-sm"
                        >
                          <Plus className="w-4 h-4" />
                          <span>+ ADD SEMESTER ASSIGNMENT</span>
                        </button>
                      </div>
                    </div>

                    {/* Quick Add Subject Inline Panel */}
                    {showQuickAddSub && (
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-blue-500/30 space-y-3 animate-in fade-in">
                        <div className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center justify-between">
                          <span>Quick Create Subject</span>
                          <button
                            type="button"
                            onClick={() => setShowQuickAddSub(false)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Subject Name *</label>
                            <input
                              type="text"
                              placeholder="e.g. Distributed Systems"
                              value={quickSubName}
                              onChange={(e) => setQuickSubName(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Semester</label>
                            <select
                              value={quickSubSemester}
                              onChange={(e) => setQuickSubSemester(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                            >
                              {semestersList.map((s) => (
                                <option key={s.id} value={s.code}>
                                  {s.code} ({s.name})
                                </option>
                              ))}
                              {semestersList.length === 0 &&
                                ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'].map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Department</label>
                            <select
                              value={quickSubDeptId || personDeptId || ''}
                              onChange={(e) => setQuickSubDeptId(e.target.value ? Number(e.target.value) : undefined)}
                              className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                            >
                              {departmentsList.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={handleQuickAddSubject}
                            disabled={!quickSubName.trim()}
                            className="px-3.5 py-1.5 rounded-xl glass-button-primary text-xs font-bold"
                          >
                            Save Subject
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Assignment Rows List */}
                    {step3Assignments.length === 0 ? (
                      <div className="p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                        <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          No semester assignments added yet.
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Click the <strong>"+ ADD SEMESTER ASSIGNMENT"</strong> button above to configure subjects, semesters, and periods for this teacher.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {step3Assignments.map((row, idx) => {
                          const isCollapsed = collapsedAssignments[idx];
                          const rowDeptId = row.department_id || personDeptId;
                          const filteredSubjects = subjectsList.filter((s) => {
                            const matchSem = !row.semester || !s.semester || s.semester === row.semester;
                            if (!rowDeptId || !s.department_id) return matchSem;
                            return matchSem && s.department_id === rowDeptId;
                          });
                          const rowSemesterSubjects =
                            filteredSubjects.length > 0
                              ? filteredSubjects
                              : subjectsList.filter((s) => !row.semester || !s.semester || s.semester === row.semester);

                          const selectedSubjectObj = subjectsList.find((s) => s.id === row.subject_id);

                          return (
                            <div
                              key={idx}
                              className="rounded-2xl glass-panel border border-slate-200 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/70 overflow-hidden shadow-sm"
                            >
                              {/* Collapsible Row Header */}
                              <div className="p-3.5 bg-slate-50/60 dark:bg-slate-800/40 border-b border-slate-200/50 dark:border-slate-800/80 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <button
                                    type="button"
                                    onClick={() => toggleCollapseAssignment(idx)}
                                    className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                                    title={isCollapsed ? 'Expand Assignment' : 'Collapse Assignment'}
                                  >
                                    {isCollapsed ? (
                                      <ChevronRight className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </button>
                                  <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                                    {idx + 1}
                                  </span>
                                  <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                                    Assignment {idx + 1}
                                  </span>
                                  {row.semester && (
                                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                                      {row.semester}
                                    </span>
                                  )}
                                  {selectedSubjectObj && (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold truncate max-w-[180px]">
                                      {selectedSubjectObj.name}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-400">
                                    • {row.required_periods} periods/wk ({row.period_duration})
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveStep3Assignment(idx)}
                                    className="px-2 py-1 rounded-lg text-red-500 hover:bg-red-500/10 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                                    title="Remove assignment"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Remove</span>
                                  </button>
                                </div>
                              </div>

                              {/* Collapsible Body */}
                              {!isCollapsed && (
                                <div className="p-4 space-y-4">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                    {/* 1. Department */}
                                    <div>
                                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        1. Department *
                                      </label>
                                      <select
                                        value={rowDeptId || ''}
                                        onChange={(e) => {
                                          const newDept = e.target.value ? Number(e.target.value) : undefined;
                                          handleUpdateStep3Assignment(idx, {
                                            department_id: newDept,
                                            subject_id: undefined,
                                          });
                                        }}
                                        className="w-full px-3 py-2 rounded-xl glass-input text-xs font-semibold"
                                      >
                                        <option value="">-- All / General Department --</option>
                                        {departmentsList.map((d) => (
                                          <option key={d.id} value={d.id}>
                                            {d.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* 2. Semester */}
                                    <div>
                                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        2. Semester *
                                      </label>
                                      <select
                                        required
                                        value={row.semester}
                                        onChange={(e) => {
                                          const newSem = e.target.value;
                                          handleUpdateStep3Assignment(idx, {
                                            semester: newSem,
                                            subject_id: undefined,
                                          });
                                        }}
                                        className="w-full px-3 py-2 rounded-xl glass-input text-xs font-semibold"
                                      >
                                        {semestersList.map((sem) => (
                                          <option key={sem.id} value={sem.code}>
                                            {sem.code} ({sem.name})
                                          </option>
                                        ))}
                                        {semestersList.length === 0 &&
                                          ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'].map((s) => (
                                            <option key={s} value={s}>
                                              {s}
                                            </option>
                                          ))}
                                      </select>
                                    </div>

                                    {/* 3. Subject (Filtered dynamically by department and semester) */}
                                    <div>
                                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        3. Subject *
                                      </label>
                                      <select
                                        required
                                        value={row.subject_id || ''}
                                        onChange={(e) => {
                                          const chosenId = Number(e.target.value) || undefined;
                                          const chosenSub = subjectsList.find((s) => s.id === chosenId);
                                          handleUpdateStep3Assignment(idx, {
                                            subject_id: chosenId,
                                            required_periods: chosenSub?.required_hours_per_week ? Math.round(chosenSub.required_hours_per_week) : row.required_periods,
                                          });
                                        }}
                                        className="w-full px-3 py-2 rounded-xl glass-input text-xs font-bold text-blue-600 dark:text-blue-400"
                                      >
                                        <option value="">-- Select Subject for {row.semester} --</option>
                                        {rowSemesterSubjects.map((sub) => (
                                          <option key={sub.id} value={sub.id}>
                                            {sub.name} {sub.code ? `(${sub.code})` : ''} • {sub.required_hours_per_week}h/wk
                                          </option>
                                        ))}
                                        {rowSemesterSubjects.length === 0 && (
                                          <option value="" disabled>
                                            No subjects available for {row.semester}
                                          </option>
                                        )}
                                      </select>
                                    </div>

                                    {/* 4. Required Periods/Wk */}
                                    <div>
                                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        4. Required Periods/Wk *
                                      </label>
                                      <input
                                        type="number"
                                        min="1"
                                        max="25"
                                        required
                                        value={row.required_periods}
                                        onChange={(e) =>
                                          handleUpdateStep3Assignment(idx, {
                                            required_periods: Number(e.target.value) || 4,
                                          })
                                        }
                                        className="w-full px-3 py-2 rounded-xl glass-input text-xs font-semibold"
                                      />
                                    </div>

                                    {/* 5. Period Duration */}
                                    <div>
                                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        5. Period Duration
                                      </label>
                                      <select
                                        value={row.period_duration}
                                        onChange={(e) =>
                                          handleUpdateStep3Assignment(idx, { period_duration: e.target.value })
                                        }
                                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                                      >
                                        {DURATION_OPTIONS.map((dur) => (
                                          <option key={dur} value={dur}>
                                            {dur}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Optional Class / Section */}
                                    <div>
                                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                        Class / Section (Optional)
                                      </label>
                                      <input
                                        type="text"
                                        placeholder="e.g. S3 A or CSE-A"
                                        value={row.class_name || ''}
                                        onChange={(e) =>
                                          handleUpdateStep3Assignment(idx, { class_name: e.target.value })
                                        }
                                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                                      />
                                    </div>
                                  </div>

                                  {/* Preferred Periods & Working Days */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                    <div>
                                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Preferred Periods / Times (Optional)
                                      </label>
                                      <input
                                        type="text"
                                        placeholder="e.g. Period 1, Period 2, 09:00-11:00"
                                        value={row.preferred_periods}
                                        onChange={(e) =>
                                          handleUpdateStep3Assignment(idx, { preferred_periods: e.target.value })
                                        }
                                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Preferred Working Days:
                                      </label>
                                      <div className="flex flex-wrap gap-1.5">
                                        {DAY_LABELS.map(({ label, day }) => {
                                          const isSelected = row.allowed_working_days.includes(day);
                                          return (
                                            <button
                                              key={day}
                                              type="button"
                                              onClick={() => {
                                                const updatedDays = isSelected
                                                  ? row.allowed_working_days.filter((d) => d !== day)
                                                  : [...row.allowed_working_days, day].sort();
                                                handleUpdateStep3Assignment(idx, {
                                                  allowed_working_days: updatedDays,
                                                });
                                              }}
                                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors ${
                                                isSelected
                                                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                  : 'bg-white/40 dark:bg-slate-800/40 text-slate-500 border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-100'
                                              }`}
                                            >
                                              {label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Form Submit Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200/50 dark:border-slate-800/80">
                  {editingPersonId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAddPerson}
                    className="px-5 py-2.5 rounded-xl glass-button-primary text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20"
                  >
                    {editingPersonId ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Update Teacher</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Add {selectedType === 'college' ? 'Teacher' : 'Employee'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Staff List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Registered Faculty & Staff Members ({peopleList.length})
                  </div>
                </div>

                {peopleList.length === 0 ? (
                  <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-400">
                    No employees added yet. Click 'Add Sample Staff' or register teachers using the form above.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {peopleList.map((p) => {
                      const assignments = p.teacher_assignments || [];
                      return (
                        <div
                          key={p.id}
                          className={`p-4 rounded-2xl glass-card border transition-all ${
                            editingPersonId === p.id
                              ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/5'
                              : 'border-white/40 dark:border-white/10'
                          } flex flex-col justify-between gap-3 text-xs`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span>{p.name}</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-600 font-semibold">
                                  Active
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {p.role_title} •{' '}
                                {p.department_name ||
                                  departmentsList.find((d) => d.id === p.department_id)?.name ||
                                  'General'}{' '}
                                • Max {p.max_hours_per_week}h/wk
                              </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEditPerson(p)}
                                className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 transition-colors"
                                title="Edit Teacher and Assignments"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePerson(p.id)}
                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
                                title="Remove Teacher"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Assignments Badges */}
                          {selectedType === 'college' && (
                            <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/80">
                              <div className="text-[10px] font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                                <BookOpen className="w-3 h-3 text-blue-500" />
                                <span>Assigned Semester Subjects ({assignments.length}):</span>
                              </div>
                              {assignments.length === 0 ? (
                                <span className="text-[10px] text-slate-400 italic">
                                  No semester assignments configured
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {assignments.map((a: any, aIdx: number) => (
                                    <span
                                      key={a.id || aIdx}
                                      className="px-2 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-medium border border-blue-500/20"
                                    >
                                      <strong>{a.semester || 'S1'}</strong>:{' '}
                                      {a.subject_name ||
                                        subjectsList.find((s) => s.id === a.subject_id)?.name ||
                                        'Subject'}{' '}
                                      ({a.required_periods || 4}p/wk)
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
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

              {/* Add / Edit Subject Form */}
              {selectedType === 'college' ? (
                <div className="p-5 rounded-2xl glass-card border border-white/40 dark:border-white/10 space-y-4">
                  {editingSubjectId && (
                    <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between text-xs text-blue-700 dark:text-blue-300">
                      <div className="flex items-center gap-2 font-bold">
                        <Edit2 className="w-4 h-4 text-blue-600" />
                        <span>Editing Course: {subName} {subCode ? `(${subCode})` : ''}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCancelEditSubject}
                        className="px-2.5 py-1 rounded-lg bg-white/60 dark:bg-slate-800/60 hover:bg-white text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all"
                      >
                        Cancel Edit
                      </button>
                    </div>
                  )}

                  <div className="font-bold text-xs text-slate-700 dark:text-slate-300">
                    {editingSubjectId ? 'Update Academic Course / Subject' : 'Add Academic Course / Subject'}
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
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Semester *</label>
                      <select
                        value={subSemester}
                        onChange={(e) => setSubSemester(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs font-semibold"
                      >
                        {semestersList.map((sem) => (
                          <option key={sem.id} value={sem.code}>
                            {sem.code} ({sem.name})
                          </option>
                        ))}
                        {semestersList.length === 0 &&
                          ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'].map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                      </select>
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

                  <div className="flex justify-end gap-2">
                    {editingSubjectId && (
                      <button
                        type="button"
                        onClick={handleCancelEditSubject}
                        className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleAddOrUpdateSubject}
                      className="px-4 py-2 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{editingSubjectId ? 'Update Subject' : 'Add Subject'}</span>
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
                              {s.semester || 'S1'} • {s.required_hours_per_week || 4} periods/wk • {s.department_name || 'General'}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditSubject(s)}
                              className="p-1.5 rounded-lg hover:bg-blue-500/10 text-slate-400 hover:text-blue-500 transition-colors"
                              title="Edit Subject"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubject(s.id)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors"
                              title="Delete Subject"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

              {/* Big GLIXON Timetable Generator Button */}
              <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 border border-blue-500/20 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-500/30">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    GLIXON
                  </h3>
                  <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                    Intelligent Timetable Generator
                  </div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    Solves teacher-subject compatibility, prevents overlapping slots, enforces working hour limits, and generates conflict-free schedules.
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
                  <span>{isGenerating ? 'Optimizing Schedule with GLIXON...' : 'GLIXON'}</span>
                </button>
                <div className="text-[11px] text-slate-500 font-medium">
                  Intelligent Timetable Generator
                </div>
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
