import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { Person, Semester, Subject, Department, TeacherSubjectAssignment, SkillItem } from '../../types';
import { triggerHaptic } from '../../utils/haptics';
import {
  Users,
  UserPlus,
  Upload,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Trash2,
  Edit2,
  Sparkles,
  Award,
  BookOpen,
  Briefcase,
  Layers,
  X,
  ChevronDown,
  ChevronRight,
  Plus,
  Calendar,
  Clock,
  Check,
  Shield,
  GraduationCap,
  Plane,
} from 'lucide-react';

interface FormAssignmentRow {
  id?: number;
  semester: string;
  subject_id?: number;
  new_subject_name?: string;
  new_subject_code?: string;
  is_creating_new?: boolean;
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

export const ProfilesModule: React.FC = () => {
  const { activeOrg, addToast } = useApp();
  const [people, setPeople] = useState<Person[]>([]);
  const [qualityStats, setQualityStats] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'roster' | 'add' | 'import' | 'quality'>('roster');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Academic metadata lists
  const [semestersList, setSemestersList] = useState<Semester[]>([]);
  const [subjectsList, setSubjectsList] = useState<Subject[]>([]);
  const [departmentsList, setDepartmentsList] = useState<Department[]>([]);

  // Add teacher form state
  const [formName, setFormName] = useState('');
  const [formDeptId, setFormDeptId] = useState<number | undefined>(undefined);
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formSkillsStr, setFormSkillsStr] = useState('');
  const [formQualsStr, setFormQualsStr] = useState('');
  const [formHoursLimit, setFormHoursLimit] = useState(40);
  const [formTheoryLab, setFormTheoryLab] = useState('both');
  const [formAssignments, setFormAssignments] = useState<FormAssignmentRow[]>([]);

  // Company and Airline specific form state
  const [formDuty, setFormDuty] = useState('');
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('17:00');
  const [formWorkDays, setFormWorkDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [formRestHours, setFormRestHours] = useState(12);

  // Edit teacher modal state
  const [isEditingInModal, setIsEditingInModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDeptId, setEditDeptId] = useState<number | undefined>(undefined);
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editHoursLimit, setEditHoursLimit] = useState(40);
  const [editQualsStr, setEditQualsStr] = useState('');
  const [editQualsList, setEditQualsList] = useState<string[]>([]);
  const [editSkills, setEditSkills] = useState<SkillItem[]>([]);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillLevel, setNewSkillLevel] = useState('Intermediate');
  const [newSkillYears, setNewSkillYears] = useState(2);
  const [newQualText, setNewQualText] = useState('');
  const [editAssignments, setEditAssignments] = useState<FormAssignmentRow[]>([]);
  const [isSavingTeacher, setIsSavingTeacher] = useState(false);

  // Company and Airline specific edit state
  const [editDuty, setEditDuty] = useState('');
  const [editStartTime, setEditStartTime] = useState('09:00');
  const [editEndTime, setEditEndTime] = useState('17:00');
  const [editWorkDays, setEditWorkDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [editRestHours, setEditRestHours] = useState(12);

  // Excel/CSV import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Teaching Assignments state for selected person (overview view)
  const [personAssignments, setPersonAssignments] = useState<TeacherSubjectAssignment[]>([]);
  const [expandedSemesters, setExpandedSemesters] = useState<Record<string, boolean>>({});

  // Fetch people list and stats
  const fetchPeople = async () => {
    if (!activeOrg) return;
    try {
      setIsLoading(true);
      const data = await api.getPeople({ org_id: activeOrg.id, search: searchQuery || undefined });
      setPeople(data);
      const qStats = await api.getDataQualityStats(activeOrg.id);
      setQualityStats(qStats);
    } catch (err) {
      console.error('Failed to fetch people:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load departments, semesters, and subjects for the active org
  const loadOrgMetadata = async () => {
    if (!activeOrg) return;
    try {
      const [sems, subs, depts] = await Promise.all([
        api.getSemesters(activeOrg.id),
        api.getSubjects(activeOrg.id),
        api.getDepartments(activeOrg.id),
      ]);
      setSemestersList(sems || []);
      setSubjectsList(subs || []);
      setDepartmentsList(depts || []);

      if (depts && depts.length > 0 && !formDeptId) {
        setFormDeptId(depts[0].id);
      }
    } catch (err) {
      console.error('Failed to load organization metadata:', err);
    }
  };

  useEffect(() => {
    fetchPeople();
    loadOrgMetadata();
  }, [activeOrg, searchQuery]);

  // When a person is selected, initialize the modal data
  const loadPersonAssignments = async (personId: number) => {
    if (!activeOrg) return;
    try {
      const [resGroup, sems, subs, depts] = await Promise.all([
        api.getTeacherAssignments(activeOrg.id, { person_id: personId }),
        api.getSemesters(activeOrg.id),
        api.getSubjects(activeOrg.id),
        api.getDepartments(activeOrg.id),
      ]);
      setPersonAssignments(resGroup || []);
      setSemestersList(sems || []);
      setSubjectsList(subs || []);
      setDepartmentsList(depts || []);

      // Auto expand all semesters with assignments
      const exp: Record<string, boolean> = {};
      (resGroup || []).forEach((a: TeacherSubjectAssignment) => {
        if (a.semester) exp[a.semester] = true;
      });
      (sems || []).forEach((s: Semester) => {
        if (!(s.code in exp)) exp[s.code] = true;
      });
      setExpandedSemesters(exp);

      // Populate edit assignments state for modal
      const editRows: FormAssignmentRow[] = (resGroup || []).map((a: TeacherSubjectAssignment) => ({
        id: a.id,
        semester: a.semester || (sems && sems[0] ? sems[0].code : 'S1'),
        subject_id: a.subject_id,
        new_subject_name: '',
        new_subject_code: '',
        is_creating_new: false,
        required_periods: a.required_periods || 4,
        period_duration: a.period_duration || '1 hour',
        allowed_working_days: a.allowed_working_days || DEFAULT_DAYS,
        preferred_periods: Array.isArray(a.preferred_periods) ? a.preferred_periods.join(', ') : '',
        class_name: a.class_name || '',
      }));
      setEditAssignments(editRows);
    } catch (err) {
      console.error('Failed to load teacher assignments', err);
    }
  };

  useEffect(() => {
    if (selectedPerson) {
      setEditName(selectedPerson.name || '');
      setEditDeptId(selectedPerson.department_id);
      setEditEmail(selectedPerson.email || '');
      setEditPhone(selectedPerson.phone || '');
      setEditRole(selectedPerson.role_title || '');
      setEditCode(selectedPerson.employee_code || '');
      setEditHoursLimit(selectedPerson.max_hours_per_week || 40);
      setEditQualsStr((selectedPerson.qualifications || []).join(', '));
      setEditQualsList(selectedPerson.qualifications || []);
      setEditSkills(selectedPerson.skills || []);

      const prefs = selectedPerson.preferences || {};
      setEditDuty(prefs.duty || '');
      setEditStartTime(prefs.start_time || (activeOrg?.type === 'airline' ? '06:00' : '09:00'));
      setEditEndTime(prefs.end_time || (activeOrg?.type === 'airline' ? '14:00' : '17:00'));
      setEditWorkDays(prefs.working_days || [0, 1, 2, 3, 4]);
      setEditRestHours(prefs.min_rest_hours || 12);

      setIsEditingInModal(false);
      loadPersonAssignments(selectedPerson.id);
    }
  }, [selectedPerson]);

  const handleAddEditSkill = (skillNameToAdd?: string) => {
    const rawName = skillNameToAdd || newSkillName;
    if (!rawName.trim()) return;
    triggerHaptic(10);
    const trimmed = rawName.trim();
    if (editSkills.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      addToast('Skill already exists', `"${trimmed}" is already added.`, 'error');
      return;
    }
    setEditSkills((prev) => [
      ...prev,
      {
        name: trimmed,
        level: newSkillLevel,
        verified: true,
        years: Number(newSkillYears) || 2.0,
      },
    ]);
    setNewSkillName('');
    addToast('Skill Added', `Added "${trimmed}" (${newSkillLevel})`, 'success');
  };

  const handleRemoveEditSkill = (skillIndex: number) => {
    triggerHaptic(12);
    setEditSkills((prev) => prev.filter((_, idx) => idx !== skillIndex));
  };

  const handleUpdateEditSkillLevel = (skillIndex: number, level: string) => {
    setEditSkills((prev) => {
      const copy = [...prev];
      copy[skillIndex] = { ...copy[skillIndex], level };
      return copy;
    });
  };

  const handleAddQual = () => {
    if (!newQualText.trim()) return;
    triggerHaptic(10);
    const trimmed = newQualText.trim();
    if (!editQualsList.includes(trimmed)) {
      setEditQualsList((prev) => [...prev, trimmed]);
    }
    setNewQualText('');
  };

  const handleRemoveQual = (index: number) => {
    triggerHaptic(12);
    setEditQualsList((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Handlers for Add Form Assignment Rows
  const handleAddFormAssignment = () => {
    triggerHaptic(10);
    const defaultSem = semestersList.length > 0 ? semestersList[0].code : 'S1';
    setFormAssignments((prev) => [
      ...prev,
      {
        semester: defaultSem,
        subject_id: undefined,
        new_subject_name: '',
        new_subject_code: '',
        is_creating_new: false,
        required_periods: 4,
        period_duration: '1 hour',
        allowed_working_days: DEFAULT_DAYS,
        preferred_periods: '',
        class_name: '',
      },
    ]);
  };

  const handleUpdateFormAssignment = (index: number, updates: Partial<FormAssignmentRow>) => {
    setFormAssignments((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const handleRemoveFormAssignment = (index: number) => {
    triggerHaptic(12);
    setFormAssignments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCreateSubjectForFormRow = async (idx: number) => {
    const row = formAssignments[idx];
    if (!activeOrg || !row || !row.new_subject_name?.trim()) return;
    try {
      const created = await api.createSubject(activeOrg.id, {
        name: row.new_subject_name.trim(),
        code: row.new_subject_code?.trim() || undefined,
        semester: row.semester || 'S1',
        department_id: formDeptId || undefined,
        required_hours_per_week: row.required_periods || 4,
      });
      setSubjectsList((prev) => {
        if (prev.some((s) => s.id === created.id)) return prev;
        return [...prev, created];
      });
      handleUpdateFormAssignment(idx, {
        subject_id: created.id,
        is_creating_new: false,
        new_subject_name: '',
        new_subject_code: '',
      });
      addToast('Subject Created', `Added "${created.name}" for ${row.semester}`, 'success');
    } catch (err: any) {
      addToast('Failed to create subject', err.message || 'Error creating subject', 'error');
    }
  };

  // Handlers for Edit Modal Assignment Rows
  const handleAddEditAssignment = () => {
    triggerHaptic(10);
    const defaultSem = semestersList.length > 0 ? semestersList[0].code : 'S1';
    setEditAssignments((prev) => [
      ...prev,
      {
        semester: defaultSem,
        subject_id: undefined,
        new_subject_name: '',
        new_subject_code: '',
        is_creating_new: false,
        required_periods: 4,
        period_duration: '1 hour',
        allowed_working_days: DEFAULT_DAYS,
        preferred_periods: '',
        class_name: '',
      },
    ]);
  };

  const handleUpdateEditAssignment = (index: number, updates: Partial<FormAssignmentRow>) => {
    setEditAssignments((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const handleRemoveEditAssignment = (index: number) => {
    triggerHaptic(12);
    setEditAssignments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCreateSubjectForEditRow = async (idx: number) => {
    const row = editAssignments[idx];
    if (!activeOrg || !row || !row.new_subject_name?.trim()) return;
    try {
      const created = await api.createSubject(activeOrg.id, {
        name: row.new_subject_name.trim(),
        code: row.new_subject_code?.trim() || undefined,
        semester: row.semester || 'S1',
        department_id: editDeptId || undefined,
        required_hours_per_week: row.required_periods || 4,
      });
      setSubjectsList((prev) => {
        if (prev.some((s) => s.id === created.id)) return prev;
        return [...prev, created];
      });
      handleUpdateEditAssignment(idx, {
        subject_id: created.id,
        is_creating_new: false,
        new_subject_name: '',
        new_subject_code: '',
      });
      addToast('Subject Created', `Added "${created.name}" for ${row.semester}`, 'success');
    } catch (err: any) {
      addToast('Failed to create subject', err.message || 'Error creating subject', 'error');
    }
  };

  // Submit Create Teacher + Assignments
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) return;
    if (!formName.trim()) {
      addToast('Validation Error', 'Please enter Teacher Name', 'error');
      return;
    }
    triggerHaptic(15);
    setIsLoading(true);

    try {
      // Auto-create any pending new subjects first
      let currentSubjects = [...subjectsList];
      const updatedRows = [...formAssignments];
      for (let i = 0; i < updatedRows.length; i++) {
        const r = updatedRows[i];
        if (!r.subject_id && r.new_subject_name?.trim()) {
          try {
            const created = await api.createSubject(activeOrg.id, {
              name: r.new_subject_name.trim(),
              code: r.new_subject_code?.trim() || undefined,
              semester: r.semester || 'S1',
              department_id: formDeptId || undefined,
              required_hours_per_week: r.required_periods || 4,
            });
            if (!currentSubjects.some((s) => s.id === created.id)) {
              currentSubjects.push(created);
            }
            updatedRows[i] = {
              ...r,
              subject_id: created.id,
              is_creating_new: false,
            };
          } catch (subErr) {
            console.warn('Failed to auto-create subject:', subErr);
          }
        }
      }
      setSubjectsList(currentSubjects);

      const skillsArray = formSkillsStr
        ? formSkillsStr
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((name) => ({
              name,
              level: 'Expert',
              verified: true,
              years: 4.0,
            }))
        : [];

      // Automatically add selected subjects to skills array for seamless compatibility
      const assignedSubjIds = updatedRows.map((a) => a.subject_id).filter(Boolean);
      const assignedSubjects = currentSubjects.filter((s) => assignedSubjIds.includes(s.id));
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

      const qualsArray = formQualsStr
        ? formQualsStr.split(',').map((q) => q.trim()).filter(Boolean)
        : [];

      // Build assignments payload
      const assignmentsPayload = updatedRows
        .filter((r) => r.subject_id)
        .map((r) => {
          const sub = currentSubjects.find((s) => s.id === r.subject_id);
          const semObj = semestersList.find((s) => s.code === r.semester);
          const prefList = r.preferred_periods
            ? r.preferred_periods.split(',').map((p) => p.trim()).filter(Boolean)
            : [];

          return {
            id: r.id,
            subject_id: r.subject_id,
            semester: r.semester || sub?.semester || 'S1',
            semester_id: semObj?.id || sub?.semester_id,
            department_id: formDeptId || sub?.department_id,
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

      const personPrefs = {
        duty: formDuty || (activeOrg.type === 'airline' ? 'Flight Duty' : activeOrg.type === 'company' ? 'Standard Shift' : undefined),
        start_time: formStartTime,
        end_time: formEndTime,
        working_days: formWorkDays,
        min_rest_hours: formRestHours,
        skills: formSkillsStr ? formSkillsStr.split(',').map((s) => s.trim()).filter(Boolean) : [],
      };

      await api.createPerson({
        org_id: activeOrg.id,
        name: formName,
        email: formEmail || `${formName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@${activeOrg.type === 'airline' ? 'airline.aero' : activeOrg.type === 'company' ? 'company.com' : 'institution.edu'}`,
        phone: formPhone || undefined,
        role_title: formRole || (activeOrg.type === 'college' ? 'Teacher / Professor' : activeOrg.type === 'airline' ? 'Flight Crew' : 'Staff Member'),
        employee_code: formCode || `${activeOrg.type === 'airline' ? 'CREW' : activeOrg.type === 'company' ? 'EMP' : 'FAC'}-${Date.now().toString().slice(-4)}`,
        profession_type: activeOrg.type,
        department_id: formDeptId,
        qualifications: qualsArray,
        skills: skillsArray,
        max_hours_per_week: formHoursLimit || 40,
        preferences: personPrefs,
        profession_metadata: {
          semesters: Array.from(new Set(updatedRows.map((a) => a.semester).filter(Boolean))),
          theory_lab: formTheoryLab,
        },
        status: 'active',
        teacher_assignments: activeOrg.type === 'college' ? assignmentsPayload : [],
      });

      addToast(
        `${activeOrg.type === 'college' ? 'Teacher' : activeOrg.type === 'airline' ? 'Crew Member' : 'Employee'} Saved Successfully`,
        `Saved ${formName}${activeOrg.type === 'college' ? ` with ${assignmentsPayload.length} semester assignment(s)` : ''}.`,
        'success'
      );

      // Reset form fields
      setFormName('');
      setFormEmail('');
      setFormPhone('');
      setFormRole('');
      setFormCode('');
      setFormSkillsStr('');
      setFormQualsStr('');
      setFormAssignments([]);
      setActiveTab('roster');
      fetchPeople();
    } catch (err: any) {
      addToast('Save Failed', err.message || 'Could not save teacher', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Save Changes on Edit Modal
  const handleSaveEditTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !selectedPerson) return;
    triggerHaptic(15);
    setIsSavingTeacher(true);

    try {
      // Auto-create any pending new subjects first
      let currentSubjects = [...subjectsList];
      const updatedRows = [...editAssignments];
      for (let i = 0; i < updatedRows.length; i++) {
        const r = updatedRows[i];
        if (!r.subject_id && r.new_subject_name?.trim()) {
          try {
            const created = await api.createSubject(activeOrg.id, {
              name: r.new_subject_name.trim(),
              code: r.new_subject_code?.trim() || undefined,
              semester: r.semester || 'S1',
              department_id: editDeptId || undefined,
              required_hours_per_week: r.required_periods || 4,
            });
            if (!currentSubjects.some((s) => s.id === created.id)) {
              currentSubjects.push(created);
            }
            updatedRows[i] = {
              ...r,
              subject_id: created.id,
              is_creating_new: false,
            };
          } catch (subErr) {
            console.warn('Failed to auto-create subject in edit modal:', subErr);
          }
        }
      }
      setSubjectsList(currentSubjects);

      const qualsArray = editQualsStr
        ? editQualsStr.split(',').map((q) => q.trim()).filter(Boolean)
        : [];

      // Build updated assignments payload
      const assignmentsPayload = updatedRows
        .filter((r) => r.subject_id)
        .map((r) => {
          const sub = currentSubjects.find((s) => s.id === r.subject_id);
          const semObj = semestersList.find((s) => s.code === r.semester);
          const prefList = r.preferred_periods
            ? r.preferred_periods.split(',').map((p) => p.trim()).filter(Boolean)
            : [];

          return {
            id: r.id,
            subject_id: r.subject_id,
            semester: r.semester || sub?.semester || 'S1',
            semester_id: semObj?.id || sub?.semester_id,
            department_id: editDeptId || sub?.department_id,
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

      const finalQuals = editQualsList.length > 0
        ? editQualsList
        : (editQualsStr ? editQualsStr.split(',').map((q) => q.trim()).filter(Boolean) : []);

      const editPrefs = {
        ...(selectedPerson.preferences || {}),
        duty: editDuty || undefined,
        start_time: editStartTime,
        end_time: editEndTime,
        working_days: editWorkDays,
        min_rest_hours: editRestHours,
      };

      await api.updatePerson(selectedPerson.id, {
        name: editName,
        email: editEmail,
        phone: editPhone || undefined,
        role_title: editRole,
        employee_code: editCode,
        department_id: editDeptId,
        qualifications: finalQuals,
        skills: editSkills,
        max_hours_per_week: editHoursLimit,
        preferences: editPrefs,
        status: selectedPerson.status || 'active',
        profession_metadata: {
          ...(selectedPerson.profession_metadata || {}),
          semesters: Array.from(new Set(updatedRows.map((a) => a.semester).filter(Boolean))),
        },
        teacher_assignments: activeOrg.type === 'college' ? assignmentsPayload : [],
      });

      addToast(
        `${activeOrg.type === 'college' ? 'Teacher' : activeOrg.type === 'airline' ? 'Crew Member' : 'Employee'} Updated`,
        `Updated details for ${editName}.`,
        'success'
      );
      setIsEditingInModal(false);
      loadPersonAssignments(selectedPerson.id);
      fetchPeople();
    } catch (err: any) {
      addToast('Update Failed', err.message || 'Could not update teacher', 'error');
    } finally {
      setIsSavingTeacher(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm('Deactivate this staff profile?')) return;
    try {
      await api.deletePerson(id);
      addToast('Profile Deactivated', 'Person marked as inactive', 'info');
      fetchPeople();
    } catch (err) {
      addToast('Deactivation Failed', 'Could not deactivate person', 'error');
    }
  };

  // Excel/CSV File Upload and Commit Handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeOrg || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setImportFile(file);
    try {
      setIsImporting(true);
      const preview = await api.previewFile(activeOrg.id, file);
      setImportPreview(preview);
      addToast('File Analyzed', `Parsed ${preview.total_rows} rows from ${file.name}`, 'info');
    } catch (err: any) {
      addToast('Parse Failed', err.message || 'Could not read file', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCommitImport = async () => {
    if (!activeOrg || !importFile) return;
    try {
      setIsImporting(true);
      const result = await api.commitImport(activeOrg.id, importPreview?.preview || []);
      addToast('Import Complete', `Successfully imported ${result?.imported_count || 'all'} staff profiles`, 'success');
      setImportFile(null);
      setImportPreview(null);
      setActiveTab('roster');
      fetchPeople();
    } catch (err: any) {
      addToast('Import Failed', err.message || 'Commit failed', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-blue-600" />
            <span>{activeOrg?.type === 'college' ? 'Faculty & Teacher Management' : 'Staff Directory'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeOrg?.type === 'college'
              ? 'Configure individual teachers, semester-wise subjects, teaching periods, and working hours.'
              : 'Manage employee profiles, role configurations, and schedule qualifications.'}
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl glass-card border border-white/40 dark:border-white/10 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('roster')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'roster'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/40'
            }`}
          >
            {activeOrg?.type === 'college' ? `All Teachers (${people.length})` : `All Staff (${people.length})`}
          </button>
          <button
            onClick={() => {
              setActiveTab('add');
              if (formAssignments.length === 0) {
                handleAddFormAssignment();
              }
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
              activeTab === 'add'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/40'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{activeOrg?.type === 'college' ? 'Add Teacher' : 'Add Staff'}</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
              activeTab === 'import'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/40'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV/Excel</span>
          </button>
          <button
            onClick={() => setActiveTab('quality')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
              activeTab === 'quality'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/40'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Data Quality ({qualityStats?.average_score || 95}%)</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Staff Roster */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          {/* Search bar & quick action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative max-w-md w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by teacher name, department, semester, or subject..."
                className="w-full pl-10 pr-4 py-2 rounded-xl glass-input text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400"
              />
            </div>

            <button
              onClick={() => {
                setActiveTab('add');
                if (formAssignments.length === 0) handleAddFormAssignment();
              }}
              className="px-4 py-2 rounded-xl glass-button-primary text-xs font-bold flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{activeOrg?.type === 'college' ? 'New Teacher & Assignments' : 'New Staff Profile'}</span>
            </button>
          </div>

          {/* Roster Table */}
          <div className="rounded-3xl glass-panel border border-white/40 dark:border-white/10 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/50 dark:border-slate-800/80 bg-slate-100/40 dark:bg-slate-900/40 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                    <th className="py-3 px-4">{activeOrg?.type === 'college' ? 'Teacher' : 'Staff Member'}</th>
                    <th className="py-3 px-4">Department & Role</th>
                    <th className="py-3 px-4">Assigned Semesters & Subjects</th>
                    <th className="py-3 px-4">Qualifications</th>
                    <th className="py-3 px-4">Weekly Load</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/40">
                  {people.map((p) => {
                    const assigns = p.teacher_assignments || [];
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedPerson(p)}
                        className="hover:bg-blue-500/5 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{p.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/50 dark:bg-slate-800/50 text-slate-500">
                              {p.employee_code}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{p.email}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {p.department_name || 'General Dept'}
                          </div>
                          <div className="text-[10px] text-blue-500 font-medium">{p.role_title}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          {assigns.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 max-w-md">
                              {assigns.map((as, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[10px] font-semibold border border-blue-500/20 flex items-center gap-1"
                                  title={`${as.semester || 'Sem'} - ${as.subject_name} (${as.required_periods || 4} periods/wk, ${as.period_duration || '1 hr'})`}
                                >
                                  <strong className="text-blue-600 dark:text-blue-400">{as.semester || 'Sem'}:</strong>
                                  <span>{as.subject_name}</span>
                                  <span className="text-slate-400">({as.required_periods || 4}p)</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">No subjects assigned yet</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-[11px] text-slate-700 dark:text-slate-300">
                            {p.qualifications?.join(', ') || 'N/A'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {assigns.reduce((acc, a) => acc + (a.required_periods || 4), 0)} periods/wk
                          </div>
                          <div className="text-[10px] text-slate-400">Limit: {p.max_hours_per_week}h</div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPerson(p);
                                setIsEditingInModal(true);
                              }}
                              className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-500 transition-colors"
                              title="Edit Teacher & Assignments"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeactivate(p.id);
                              }}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
                              title="Deactivate Profile"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {people.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-xs italic">
                        No profiles found. Click "Add Teacher" above to create a teacher with semester-wise subjects.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Add Teacher with Dynamic Multi-Semester Subject Assignments */}
      {activeTab === 'add' && (
        <form
          onSubmit={handleCreateTeacher}
          className="p-6 md:p-8 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-6 max-w-4xl mx-auto shadow-sm"
        >
          {/* Form Header */}
          <div className="border-b border-slate-200/50 dark:border-slate-800/80 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-blue-600" />
                <span>TEACHER DETAILS</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure teacher personal info and assign their individual semester subjects directly below.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
              {activeOrg?.name}
            </span>
          </div>

          {/* Section 1: Teacher Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Teacher Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Dr. Arthur Pendelton"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Department *
              </label>
              <select
                required
                value={formDeptId || ''}
                onChange={(e) => setFormDeptId(Number(e.target.value) || undefined)}
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
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="arthur@institution.edu"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Designation / Job Role
              </label>
              <input
                type="text"
                placeholder="e.g. Assistant Professor"
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Employee Code / Badge
              </label>
              <input
                type="text"
                placeholder="e.g. FAC-201"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Max Weekly Working Hours Limit
              </label>
              <input
                type="number"
                min="5"
                max="60"
                value={formHoursLimit}
                onChange={(e) => setFormHoursLimit(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-medium"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Educational Qualifications / Certifications (comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g. M.Tech CSE, Ph.D, AWS Certified"
                value={formQualsStr}
                onChange={(e) => setFormQualsStr(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-medium"
              />
            </div>
          </div>

          {/* Section 2: SUBJECTS AND SEMESTERS ASSIGNED TO THIS TEACHER */}
          {activeOrg?.type === 'college' && (
            <div className="border-t border-slate-200/50 dark:border-slate-800/80 pt-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-500/5 p-4 rounded-2xl border border-blue-500/20">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>SUBJECTS AND SEMESTERS ASSIGNED TO THIS TEACHER</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Assign multiple semester subjects with required weekly periods, duration, and preferred working days.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddFormAssignment}
                className="px-4 py-2 rounded-xl glass-button-primary text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>+ ADD SEMESTER ASSIGNMENT</span>
              </button>
            </div>

            {/* Assignment Rows List */}
            {formAssignments.length === 0 ? (
              <div className="p-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  No semester assignments added yet.
                </div>
                <p className="text-[11px] text-slate-400">
                  Click the <strong>"+ ADD SEMESTER ASSIGNMENT"</strong> button above to configure subjects and periods for this teacher.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {formAssignments.map((row, idx) => {
                  // Dynamic subject filtering for this row's selected semester
                  const rowSemesterSubjects = subjectsList.filter(
                    (s) => !row.semester || !s.semester || s.semester === row.semester
                  );

                  return (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/60 space-y-4 relative shadow-sm"
                    >
                      {/* Row Header */}
                      <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/80 pb-2">
                        <div className="flex items-center gap-2">
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
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveFormAssignment(idx)}
                          className="px-2.5 py-1 rounded-lg text-red-500 hover:bg-red-500/10 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          title="Remove this assignment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>

                      {/* Row Controls */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        {/* 1. Semester */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            1. Semester *
                          </label>
                          <select
                            required
                            value={row.semester}
                            onChange={(e) => {
                              const newSem = e.target.value;
                              handleUpdateFormAssignment(idx, { semester: newSem, subject_id: undefined });
                            }}
                            className="w-full px-3 py-2 rounded-xl glass-input text-xs font-semibold"
                          >
                            {semestersList.map((sem) => (
                              <option key={sem.id} value={sem.code}>
                                {sem.code} ({sem.name})
                              </option>
                            ))}
                            {semestersList.length === 0 && (
                              <>
                                <option value="S1">S1 (Semester 1)</option>
                                <option value="S2">S2 (Semester 2)</option>
                                <option value="S3">S3 (Semester 3)</option>
                                <option value="S4">S4 (Semester 4)</option>
                                <option value="S5">S5 (Semester 5)</option>
                                <option value="S6">S6 (Semester 6)</option>
                                <option value="S7">S7 (Semester 7)</option>
                                <option value="S8">S8 (Semester 8)</option>
                              </>
                            )}
                          </select>
                        </div>

                        {/* 2. Subject (Filtered dynamically by this row's semester) */}
                        <div className="sm:col-span-2 md:col-span-2">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              2. Subject *
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateFormAssignment(idx, {
                                  is_creating_new: !row.is_creating_new,
                                  subject_id: row.is_creating_new ? row.subject_id : undefined,
                                })
                              }
                              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {row.is_creating_new ? '← Choose Existing' : '+ New Subject'}
                            </button>
                          </div>

                          {row.is_creating_new ? (
                            <div className="flex gap-2 items-center">
                              <input
                                type="text"
                                placeholder="Subject Name (e.g. Data Structures)"
                                value={row.new_subject_name || ''}
                                onChange={(e) =>
                                  handleUpdateFormAssignment(idx, { new_subject_name: e.target.value })
                                }
                                className="flex-1 px-3 py-2 rounded-xl glass-input text-xs font-semibold"
                                required
                              />
                              <input
                                type="text"
                                placeholder="Code (e.g. CS301)"
                                value={row.new_subject_code || ''}
                                onChange={(e) =>
                                  handleUpdateFormAssignment(idx, { new_subject_code: e.target.value.toUpperCase() })
                                }
                                className="w-24 px-2 py-2 rounded-xl glass-input text-xs font-semibold uppercase"
                              />
                              <button
                                type="button"
                                onClick={() => handleCreateSubjectForFormRow(idx)}
                                disabled={!row.new_subject_name?.trim()}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <select
                              required
                              value={row.subject_id || ''}
                              onChange={(e) => {
                                if (e.target.value === '__new__') {
                                  handleUpdateFormAssignment(idx, { is_creating_new: true, subject_id: undefined });
                                  return;
                                }
                                const chosenId = Number(e.target.value) || undefined;
                                const chosenSub = subjectsList.find((s) => s.id === chosenId);
                                handleUpdateFormAssignment(idx, {
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
                              <option value="__new__">+ Create new subject...</option>
                            </select>
                          )}
                        </div>

                        {/* 3. Required periods per week */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            3. Required Periods/Wk *
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="25"
                            required
                            value={row.required_periods}
                            onChange={(e) =>
                              handleUpdateFormAssignment(idx, { required_periods: Number(e.target.value) || 4 })
                            }
                            className="w-full px-3 py-2 rounded-xl glass-input text-xs font-semibold"
                          />
                        </div>

                        {/* 4. Period duration */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            4. Period Duration
                          </label>
                          <select
                            value={row.period_duration}
                            onChange={(e) => handleUpdateFormAssignment(idx, { period_duration: e.target.value })}
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
                            onChange={(e) => handleUpdateFormAssignment(idx, { class_name: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                          />
                        </div>

                        {/* 6. Preferred periods/times */}
                        <div className="sm:col-span-2 md:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            6. Preferred Periods / Times (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Period 1, Period 2, 09:00-11:00"
                            value={row.preferred_periods}
                            onChange={(e) => handleUpdateFormAssignment(idx, { preferred_periods: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                          />
                        </div>
                      </div>

                      {/* 5. Preferred working days */}
                      <div className="pt-1">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          5. Preferred Working Days for this Subject:
                        </label>
                        <div className="flex flex-wrap gap-2">
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
                                  handleUpdateFormAssignment(idx, { allowed_working_days: updatedDays });
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
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
                  );
                })}
              </div>
            )}
            </div>
          )}

          {/* Section 2: COMPANY EMPLOYEE SHIFT & DUTY DETAILS */}
          {activeOrg?.type === 'company' && (
            <div className="border-t border-slate-200/50 dark:border-slate-800/80 pt-6 space-y-4">
              <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/20">
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  <span>COMPANY SHIFT, DUTY & WORKING HOURS CONFIGURATION</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Configure employee working hours, primary duty assignment, and weekly active days.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Primary Duty / Shift Title *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Core Product Engineering / Operations"
                    value={formDuty}
                    onChange={(e) => setFormDuty(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Daily Shift Start Time
                  </label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Daily Shift End Time
                  </label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Professional Skills (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Python, SQL, Incident Response, Customer Support"
                    value={formSkillsStr}
                    onChange={(e) => setFormSkillsStr(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Minimum Rest Period Between Shifts (Hours)
                  </label>
                  <input
                    type="number"
                    min="8"
                    max="24"
                    value={formRestHours}
                    onChange={(e) => setFormRestHours(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Assigned Working Days:
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAY_LABELS.map(({ label, day }) => {
                    const isSelected = formWorkDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const updated = isSelected
                            ? formWorkDays.filter((d) => d !== day)
                            : [...formWorkDays, day].sort();
                          setFormWorkDays(updated);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
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
                <p className="text-[10px] text-slate-400 mt-1">
                  GLIXON schedules this employee strictly during their configured working days and working hours ({formStartTime}–{formEndTime}).
                </p>
              </div>
            </div>
          )}

          {/* Section 2: AVIATION CREW FLIGHT DUTY & SAFETY CONFIGURATION */}
          {activeOrg?.type === 'airline' && (
            <div className="border-t border-slate-200/50 dark:border-slate-800/80 pt-6 space-y-4">
              <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/20">
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Plane className="w-4 h-4 text-blue-600" />
                  <span>AVIATION CREW DUTIES & SAFETY REST REGULATIONS</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Configure flight crew member duties, verified ratings, operational timing windows, and FAA/ICAO mandatory rest periods.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Flight Duty Assignment *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Domestic Flight Ops / B737 Routes"
                    value={formDuty}
                    onChange={(e) => setFormDuty(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Flight Duty Window Start
                  </label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Flight Duty Window End
                  </label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Verified Ratings & Type Certificates (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ATP, B737-800 Type Rating, FAA First Class Medical"
                    value={formSkillsStr}
                    onChange={(e) => setFormSkillsStr(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mandatory Rest Interval (Hours)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="24"
                    value={formRestHours}
                    onChange={(e) => setFormRestHours(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Operating Flight Days:
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAY_LABELS.map(({ label, day }) => {
                    const isSelected = formWorkDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const updated = isSelected
                            ? formWorkDays.filter((d) => d !== day)
                            : [...formWorkDays, day].sort();
                          setFormWorkDays(updated);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
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
                <p className="text-[10px] text-slate-400 mt-1">
                  GLIXON strictly enforces FAA/ICAO mandatory minimum {formRestHours}-hour rest periods between flights.
                </p>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/50 dark:border-slate-800/80">
            <button
              type="button"
              onClick={() => setActiveTab('roster')}
              className="px-5 py-2.5 rounded-xl glass-pill text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-7 py-2.5 rounded-xl glass-button-primary text-xs font-bold shadow-md hover:shadow-lg transition-all"
            >
              {isLoading
                ? 'Saving...'
                : activeOrg?.type === 'college'
                ? 'Save Teacher'
                : activeOrg?.type === 'airline'
                ? 'Save Crew Member'
                : 'Save Employee'}
            </button>
          </div>
        </form>
      )}

      {/* Tab 3: Real Excel / CSV Import */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          <div className="p-6 md:p-8 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Real Excel / CSV Profile Importer
                </h3>
                <p className="text-xs text-slate-500">
                  Upload an .xlsx or .csv spreadsheet. Column mapping, duplicate validation, and data quality check execute immediately.
                </p>
              </div>

              <a
                href="/api/data-import/template"
                download="staff_import_template.csv"
                className="px-3.5 py-2 rounded-xl glass-pill hover:bg-white/60 dark:hover:bg-slate-800/60 text-xs font-semibold flex items-center gap-1.5 text-blue-600 dark:text-blue-400"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Sample CSV Template</span>
              </a>
            </div>

            {/* Drag & Drop Area */}
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-8 text-center hover:border-blue-500 transition-colors relative">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <FileSpreadsheet className="w-12 h-12 text-blue-500 mx-auto mb-2" />
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {importFile ? importFile.name : 'Click or drop spreadsheet file here'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Supports Microsoft Excel (.xlsx) and Comma-Separated Values (.csv)
              </p>
            </div>
          </div>

          {/* Import Preview Table */}
          {importPreview && (
            <div className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Validation Summary:</span>
                    <span className="text-emerald-500 font-extrabold">{importPreview.valid_rows} Valid Rows</span>
                    <span className="text-slate-400">/ {importPreview.total_rows} Total</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Calculated Overall Quality Score: <strong className="text-blue-500">{importPreview.overall_quality_score}%</strong>
                  </div>
                </div>

                <button
                  disabled={isImporting || importPreview.valid_rows === 0}
                  onClick={handleCommitImport}
                  className="px-6 py-2.5 rounded-xl glass-button-primary text-xs font-semibold disabled:opacity-50"
                >
                  {isImporting ? 'Importing...' : `Commit ${importPreview.valid_rows} Profiles to Database`}
                </button>
              </div>

              {/* Column Mapping Chips */}
              <div className="p-3 rounded-2xl glass-pill">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Detected Column Mappings:
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {Object.entries(importPreview.column_mapping || {}).map(([raw, std]: any) => (
                    <span key={raw} className="px-2 py-1 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-slate-500">"{raw}"</span> → <strong className="text-blue-500">{std}</strong>
                    </span>
                  ))}
                </div>
              </div>

              {/* Preview Rows */}
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/50 text-[10px] uppercase font-semibold text-slate-400">
                      <th className="py-2 px-3">Row</th>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Email</th>
                      <th className="py-2 px-3">Role</th>
                      <th className="py-2 px-3">Skills</th>
                      <th className="py-2 px-3">Validation Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/40">
                    {importPreview.preview.map((row: any, i: number) => (
                      <tr key={i} className={row.is_valid ? '' : 'bg-red-500/5'}>
                        <td className="py-2.5 px-3 text-slate-400">{row.row_number}</td>
                        <td className="py-2.5 px-3 font-semibold">{row.name}</td>
                        <td className="py-2.5 px-3 text-slate-500">{row.email}</td>
                        <td className="py-2.5 px-3">{row.role_title}</td>
                        <td className="py-2.5 px-3">
                          <span className="text-blue-500 font-medium">
                            {row.skills.map((s: any) => s.name).join(', ') || 'None'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {row.is_valid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-500 font-semibold text-[11px]" title={row.errors.join('; ')}>
                              <AlertCircle className="w-3.5 h-3.5" /> {row.errors[0]}
                            </span>
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
      )}

      {/* Tab 4: Data Quality Audit */}
      {activeTab === 'quality' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl glass-card flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 rounded-full border-4 border-blue-500/20 border-t-blue-500 flex items-center justify-center text-2xl font-black text-slate-900 dark:text-white mb-3">
              {qualityStats?.average_score || 95}%
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Overall Roster Data Quality
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Evaluated across completeness of skills, verified credentials, and contact records.
            </p>
          </div>

          <div className="md:col-span-2 p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Data Integrity Metrics
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">Verified Profiles Ratio:</span>
                <strong className="text-emerald-500 font-bold">{qualityStats?.metrics?.verified_rate || 100}%</strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">Missing Direct Skills Tagging:</span>
                <span className="text-slate-500">{qualityStats?.metrics?.missing_skills || 0} profiles</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">Missing Degree / Qualifications:</span>
                <span className="text-slate-500">{qualityStats?.metrics?.missing_qualifications || 0} profiles</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail & Edit Modal with Dynamic Multi-Semester Teaching Assignments */}
      {selectedPerson && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-4xl w-full rounded-3xl glass-panel border border-white/40 dark:border-white/10 p-6 md:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-black text-lg shadow-md">
                  {selectedPerson.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedPerson.name}</h3>
                  <div className="text-xs text-blue-500 font-semibold flex items-center gap-2">
                    <span>{selectedPerson.role_title}</span>
                    <span>•</span>
                    <span>{selectedPerson.employee_code}</span>
                    <span>•</span>
                    <span className="text-slate-500">{selectedPerson.department_name || 'General Dept'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditingInModal(!isEditingInModal)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                    isEditingInModal
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'glass-pill hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-blue-600'
                  }`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{isEditingInModal ? 'Viewing Overview' : 'Edit Teacher & Assignments'}</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedPerson(null);
                    setIsEditingInModal(false);
                  }}
                  className="p-1.5 rounded-xl glass-pill hover:bg-slate-500/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal View Mode 1: Edit Mode */}
            {isEditingInModal ? (
              <form onSubmit={handleSaveEditTeacher} className="space-y-6">
                <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/20">
                  <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    Edit Teacher Details
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Update information and manage all semester assignments together.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Teacher Name *</label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Department *</label>
                    <select
                      value={editDeptId || ''}
                      onChange={(e) => setEditDeptId(Number(e.target.value) || undefined)}
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs"
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
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Designation</label>
                    <input
                      type="text"
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Employee Code</label>
                    <input
                      type="text"
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Weekly Hours Limit</label>
                    <input
                      type="number"
                      value={editHoursLimit}
                      onChange={(e) => setEditHoursLimit(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                    />
                  </div>
                </div>

                {/* Section: EDITABLE SKILLS & QUALIFICATIONS */}
                <div className="border-t border-slate-200/50 dark:border-slate-800/80 pt-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span>Skills & Qualifications (Subject & Duty Eligibility)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Manage professional skills, certifications, and formal academic eligibility. Real skills are used by Intelligent Search and GLIXON.
                      </p>
                    </div>
                  </div>

                  {/* Skills Editor Grid */}
                  <div className="p-4 rounded-2xl glass-panel border border-white/40 dark:border-white/10 space-y-3">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      Add New Skill & Proficiency:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                      <div className="sm:col-span-5">
                        <input
                          type="text"
                          placeholder="e.g. Machine Learning, Data Structures, Customer Support"
                          value={newSkillName}
                          onChange={(e) => setNewSkillName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddEditSkill();
                            }
                          }}
                          className="w-full px-3 py-2 rounded-xl glass-input text-xs font-semibold"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <select
                          value={newSkillLevel}
                          onChange={(e) => setNewSkillLevel(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl glass-input text-xs font-semibold"
                        >
                          <option value="Beginner">Beginner</option>
                          <option value="Intermediate">Intermediate</option>
                          <option value="Advanced">Advanced</option>
                          <option value="Expert">Expert</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          min="0"
                          max="40"
                          step="0.5"
                          placeholder="Years"
                          value={newSkillYears}
                          onChange={(e) => setNewSkillYears(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl glass-input text-xs text-center"
                          title="Years of experience"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          onClick={() => handleAddEditSkill()}
                          className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-sm transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>

                    {/* Quick Suggestions */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-400 font-semibold mr-1">Quick Add:</span>
                      {(activeOrg?.type === 'college'
                        ? ['Machine Learning', 'Data Structures', 'Database Systems', 'Artificial Intelligence', 'Computer Networks']
                        : ['Customer Support', 'Inventory Management', 'Equipment Operation', 'Emergency Response']
                      ).map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => handleAddEditSkill(sug)}
                          className="px-2 py-0.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-semibold border border-blue-500/20 transition-colors"
                        >
                          + {sug}
                        </button>
                      ))}
                    </div>

                    {/* Current Skills List */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-200/40 dark:border-slate-800/40">
                      <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Current Skills ({editSkills.length}):
                      </div>
                      {editSkills.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No skills listed yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {editSkills.map((sk, skIdx) => (
                            <div
                              key={skIdx}
                              className="px-2.5 py-1.5 rounded-xl glass-card border border-white/40 dark:border-white/10 flex items-center gap-2 text-xs"
                            >
                              <span className="font-bold text-slate-800 dark:text-slate-200">{sk.name}</span>
                              <select
                                value={sk.level}
                                onChange={(e) => handleUpdateEditSkillLevel(skIdx, e.target.value)}
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 border-none cursor-pointer"
                              >
                                <option value="Beginner">Beginner</option>
                                <option value="Intermediate">Intermediate</option>
                                <option value="Advanced">Advanced</option>
                                <option value="Expert">Expert</option>
                              </select>
                              <span className="text-[10px] text-slate-400">{sk.years}y</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveEditSkill(skIdx)}
                                className="p-0.5 text-slate-400 hover:text-red-500 transition-colors"
                                title="Remove skill"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Qualifications Editor */}
                  <div className="p-4 rounded-2xl glass-panel border border-white/40 dark:border-white/10 space-y-3">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      Formal Academic Qualifications & Certifications:
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. Ph.D. in Computer Science, M.Tech, AWS Certified"
                        value={newQualText}
                        onChange={(e) => setNewQualText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddQual();
                          }
                        }}
                        className="flex-1 px-3 py-2 rounded-xl glass-input text-xs font-semibold"
                      />
                      <button
                        type="button"
                        onClick={handleAddQual}
                        className="py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Qual</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {editQualsList.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No formal qualifications entered.</p>
                      ) : (
                        editQualsList.map((q, qIdx) => (
                          <div
                            key={qIdx}
                            className="px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-xs font-semibold flex items-center gap-1.5"
                          >
                            <Award className="w-3 h-3 text-purple-500" />
                            <span>{q}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveQual(qIdx)}
                              className="text-slate-400 hover:text-red-500 transition-colors ml-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Section: SUBJECTS AND SEMESTERS ASSIGNED TO THIS TEACHER */}
                {activeOrg?.type === 'college' && (
                  <div className="border-t border-slate-200/50 dark:border-slate-800/80 pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-blue-600" />
                        <span>SUBJECTS AND SEMESTERS ASSIGNED TO THIS TEACHER</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Add, modify, or remove semester subject assignments for {selectedPerson.name}.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddEditAssignment}
                      className="px-3.5 py-1.5 rounded-xl glass-button-primary text-xs font-bold flex items-center gap-1 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ ADD SEMESTER ASSIGNMENT</span>
                    </button>
                  </div>

                  {editAssignments.length === 0 ? (
                    <div className="p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-400">
                      No assignments configured. Click "+ ADD SEMESTER ASSIGNMENT" to add one.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {editAssignments.map((row, idx) => {
                        const rowSubjects = subjectsList.filter(
                          (s) => !row.semester || !s.semester || s.semester === row.semester
                        );

                        return (
                          <div
                            key={idx}
                            className="p-4 rounded-2xl glass-panel border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 space-y-3 text-xs"
                          >
                            <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">
                                  {idx + 1}
                                </span>
                                <span>Assignment {idx + 1}: {row.semester}</span>
                              </span>

                              <button
                                type="button"
                                onClick={() => handleRemoveEditAssignment(idx)}
                                className="text-red-500 hover:bg-red-500/10 p-1 rounded-lg transition-colors"
                                title="Remove assignment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Semester</label>
                                <select
                                  value={row.semester}
                                  onChange={(e) => {
                                    handleUpdateEditAssignment(idx, { semester: e.target.value, subject_id: undefined });
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-semibold"
                                >
                                  {semestersList.map((s) => (
                                    <option key={s.id} value={s.code}>
                                      {s.code}
                                    </option>
                                  ))}
                                  {semestersList.length === 0 && (
                                    <>
                                      <option value="S1">S1</option>
                                      <option value="S3">S3</option>
                                      <option value="S5">S5</option>
                                      <option value="S7">S7</option>
                                    </>
                                  )}
                                </select>
                              </div>

                              <div className="sm:col-span-2">
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[10px] font-bold text-slate-500">Subject *</label>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateEditAssignment(idx, {
                                        is_creating_new: !row.is_creating_new,
                                        subject_id: row.is_creating_new ? row.subject_id : undefined,
                                      })
                                    }
                                    className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                                  >
                                    {row.is_creating_new ? '← Choose Existing' : '+ New Subject'}
                                  </button>
                                </div>
                                {row.is_creating_new ? (
                                  <div className="flex gap-1.5 items-center">
                                    <input
                                      type="text"
                                      placeholder="Subject Name"
                                      value={row.new_subject_name || ''}
                                      onChange={(e) =>
                                        handleUpdateEditAssignment(idx, { new_subject_name: e.target.value })
                                      }
                                      className="flex-1 px-2.5 py-1.5 rounded-lg glass-input text-xs font-semibold"
                                      required
                                    />
                                    <input
                                      type="text"
                                      placeholder="Code"
                                      value={row.new_subject_code || ''}
                                      onChange={(e) =>
                                        handleUpdateEditAssignment(idx, { new_subject_code: e.target.value.toUpperCase() })
                                      }
                                      className="w-20 px-2 py-1.5 rounded-lg glass-input text-xs font-semibold uppercase"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleCreateSubjectForEditRow(idx)}
                                      disabled={!row.new_subject_name?.trim()}
                                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition"
                                    >
                                      Save
                                    </button>
                                  </div>
                                ) : (
                                  <select
                                    value={row.subject_id || ''}
                                    onChange={(e) => {
                                      if (e.target.value === '__new__') {
                                        handleUpdateEditAssignment(idx, { is_creating_new: true, subject_id: undefined });
                                        return;
                                      }
                                      const chosenId = Number(e.target.value) || undefined;
                                      const chosenSub = subjectsList.find((s) => s.id === chosenId);
                                      handleUpdateEditAssignment(idx, {
                                        subject_id: chosenId,
                                        required_periods: chosenSub?.required_hours_per_week ? Math.round(chosenSub.required_hours_per_week) : row.required_periods,
                                      });
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-bold text-blue-600 dark:text-blue-400"
                                  >
                                    <option value="">-- Choose Subject --</option>
                                    {rowSubjects.map((sub) => (
                                      <option key={sub.id} value={sub.id}>
                                        {sub.name} {sub.code ? `(${sub.code})` : ''} • {sub.required_hours_per_week}h/wk
                                      </option>
                                    ))}
                                    <option value="__new__">+ Create new subject...</option>
                                  </select>
                                )}
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Periods/Wk</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="25"
                                  value={row.required_periods}
                                  onChange={(e) =>
                                    handleUpdateEditAssignment(idx, { required_periods: Number(e.target.value) || 4 })
                                  }
                                  className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs font-semibold"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Period Duration</label>
                                <select
                                  value={row.period_duration}
                                  onChange={(e) => handleUpdateEditAssignment(idx, { period_duration: e.target.value })}
                                  className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs"
                                >
                                  {DURATION_OPTIONS.map((d) => (
                                    <option key={d} value={d}>
                                      {d}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="sm:col-span-3">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Preferred Periods/Times</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Period 1, Period 2"
                                  value={row.preferred_periods}
                                  onChange={(e) => handleUpdateEditAssignment(idx, { preferred_periods: e.target.value })}
                                  className="w-full px-2.5 py-1.5 rounded-lg glass-input text-xs"
                                />
                              </div>
                            </div>

                            {/* Working Days */}
                            <div className="pt-1">
                              <span className="text-[10px] font-bold text-slate-500 block mb-1">Allowed Working Days:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {DAY_LABELS.map(({ label, day }) => {
                                  const isSel = row.allowed_working_days.includes(day);
                                  return (
                                    <button
                                      key={day}
                                      type="button"
                                      onClick={() => {
                                        const nextDays = isSel
                                          ? row.allowed_working_days.filter((d) => d !== day)
                                          : [...row.allowed_working_days, day].sort();
                                        handleUpdateEditAssignment(idx, { allowed_working_days: nextDays });
                                      }}
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                        isSel
                                          ? 'bg-blue-600 text-white border-blue-600'
                                          : 'bg-white/40 dark:bg-slate-800/40 text-slate-400 border-slate-200 dark:border-slate-700'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

                {/* Section: COMPANY EMPLOYEE SHIFT & DUTY DETAILS */}
                {activeOrg?.type === 'company' && (
                  <div className="border-t border-slate-200/50 dark:border-slate-800/80 pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-blue-600" />
                          <span>COMPANY SHIFT & WORKING HOURS</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Update daily working hours, primary duty assignment, and active days for {selectedPerson.name}.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Primary Duty / Shift Title</label>
                        <input
                          type="text"
                          value={editDuty}
                          onChange={(e) => setEditDuty(e.target.value)}
                          placeholder="e.g. Operations / Customer Support"
                          className="w-full px-3 py-2 rounded-xl glass-input text-xs font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Daily Shift Start Time</label>
                        <input
                          type="time"
                          value={editStartTime}
                          onChange={(e) => setEditStartTime(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl glass-input text-xs font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Daily Shift End Time</label>
                        <input
                          type="time"
                          value={editEndTime}
                          onChange={(e) => setEditEndTime(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl glass-input text-xs font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Min Rest Between Shifts (Hours)</label>
                        <input
                          type="number"
                          min="8"
                          max="24"
                          value={editRestHours}
                          onChange={(e) => setEditRestHours(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl glass-input text-xs font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5">Assigned Working Days:</label>
                        <div className="flex flex-wrap gap-2">
                          {DAY_LABELS.map(({ label, day }) => {
                            const isSel = editWorkDays.includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => {
                                  const updated = isSel
                                    ? editWorkDays.filter((d) => d !== day)
                                    : [...editWorkDays, day].sort();
                                  setEditWorkDays(updated);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                                  isSel
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

                {/* Section: AVIATION CREW FLIGHT DUTY & SAFETY REGULATIONS */}
                {activeOrg?.type === 'airline' && (
                  <div className="border-t border-slate-200/50 dark:border-slate-800/80 pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                          <Plane className="w-4 h-4 text-blue-600" />
                          <span>FLIGHT DUTY & SAFETY REST REGULATIONS</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Update flight duty assignment, operating window, and mandatory rest periods for {selectedPerson.name}.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Flight Duty Assignment</label>
                        <input
                          type="text"
                          value={editDuty}
                          onChange={(e) => setEditDuty(e.target.value)}
                          placeholder="e.g. Domestic Flight Ops / B737 Routes"
                          className="w-full px-3 py-2 rounded-xl glass-input text-xs font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Flight Duty Window Start</label>
                        <input
                          type="time"
                          value={editStartTime}
                          onChange={(e) => setEditStartTime(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl glass-input text-xs font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Flight Duty Window End</label>
                        <input
                          type="time"
                          value={editEndTime}
                          onChange={(e) => setEditEndTime(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl glass-input text-xs font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Mandatory Rest Interval (Hours)</label>
                        <input
                          type="number"
                          min="10"
                          max="24"
                          value={editRestHours}
                          onChange={(e) => setEditRestHours(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl glass-input text-xs font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5">Operating Flight Days:</label>
                        <div className="flex flex-wrap gap-2">
                          {DAY_LABELS.map(({ label, day }) => {
                            const isSel = editWorkDays.includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => {
                                  const updated = isSel
                                    ? editWorkDays.filter((d) => d !== day)
                                    : [...editWorkDays, day].sort();
                                  setEditWorkDays(updated);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                                  isSel
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

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/50">
                  <button
                    type="button"
                    onClick={() => setIsEditingInModal(false)}
                    className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingTeacher}
                    className="px-6 py-2 rounded-xl glass-button-primary text-xs font-bold shadow-md"
                  >
                    {isSavingTeacher
                      ? 'Saving...'
                      : activeOrg?.type === 'college'
                      ? 'Save Teacher Changes'
                      : activeOrg?.type === 'airline'
                      ? 'Save Crew Changes'
                      : 'Save Employee Changes'}
                  </button>
                </div>
              </form>
            ) : (
              /* Modal View Mode 2: Overview View */
              <div className="space-y-6">
                {/* Stats Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-2xl glass-pill">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Weekly Limit</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {selectedPerson.max_hours_per_week}h / week
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl glass-pill">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Data Quality</span>
                    <span className="font-bold text-emerald-500">{selectedPerson.data_quality_score}% Verified</span>
                  </div>
                  <div className="p-3 rounded-2xl glass-pill">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                      {activeOrg?.type === 'college' ? 'Active Semesters' : activeOrg?.type === 'airline' ? 'Assigned Duty' : 'Primary Duty'}
                    </span>
                    <span className="font-bold text-blue-500">
                      {activeOrg?.type === 'college'
                        ? `${Array.from(new Set(personAssignments.map((a) => a.semester).filter(Boolean))).length} Semesters`
                        : selectedPerson.preferences?.duty || 'Standard Duty'}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl glass-pill">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                      {activeOrg?.type === 'college' ? 'Teaching Load' : activeOrg?.type === 'airline' ? 'Duty Window' : 'Work Shift'}
                    </span>
                    <span className="font-bold text-purple-500">
                      {activeOrg?.type === 'college'
                        ? `${personAssignments.reduce((acc, a) => acc + (a.required_periods || 4), 0)} Periods/wk`
                        : `${selectedPerson.preferences?.start_time || (activeOrg?.type === 'airline' ? '06:00' : '09:00')}–${selectedPerson.preferences?.end_time || (activeOrg?.type === 'airline' ? '14:00' : '17:00')}`}
                    </span>
                  </div>
                </div>

                {/* Skills & Qualifications Section in Overview View */}
                <div className="p-4 rounded-2xl glass-panel border border-white/40 dark:border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>Skills & Qualifications</span>
                    </h4>
                    <button
                      onClick={() => setIsEditingInModal(true)}
                      className="text-xs font-bold text-blue-500 hover:underline flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit Skills</span>
                    </button>
                  </div>

                  {/* Skills Grid */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Verified Skills ({selectedPerson.skills?.length || 0})
                    </span>
                    {(!selectedPerson.skills || selectedPerson.skills.length === 0) ? (
                      <p className="text-xs text-slate-400 italic">No skills registered.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedPerson.skills.map((sk, idx) => (
                          <div
                            key={idx}
                            className="px-2.5 py-1 rounded-xl glass-card border border-white/40 dark:border-white/10 text-xs flex items-center gap-1.5"
                          >
                            <span className="font-bold text-slate-800 dark:text-slate-200">{sk.name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                              sk.level === 'Expert' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' :
                              sk.level === 'Advanced' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' :
                              'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            }`}>
                              {sk.level}
                            </span>
                            <span className="text-[10px] text-slate-400">{sk.years}y</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Qualifications Grid */}
                  {selectedPerson.qualifications && selectedPerson.qualifications.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/40 dark:border-slate-800/40">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Formal Qualifications
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {selectedPerson.qualifications.map((q, idx) => (
                          <div
                            key={idx}
                            className="px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-xs font-semibold flex items-center gap-1.5"
                          >
                            <Award className="w-3 h-3 text-purple-500" />
                            <span>{q}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inferred Skills */}
                  {selectedPerson.inferred_skills && selectedPerson.inferred_skills.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/40 dark:border-slate-800/40">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Inferred Capabilities (AI Skill Engine)
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedPerson.inferred_skills.map((inf, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-lg bg-slate-100/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-[11px] font-medium border border-slate-200/50 dark:border-slate-700/50"
                          >
                            {inf.name} ({Math.round(inf.confidence * 100)}%)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Collapsible Semester Sections (Only for College) */}
                {activeOrg?.type === 'college' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-slate-800/80 pb-2">
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-blue-500" />
                      <span>Configured Semester Assignments</span>
                    </h4>
                    <button
                      onClick={() => setIsEditingInModal(true)}
                      className="text-xs font-bold text-blue-500 hover:underline flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit Assignments</span>
                    </button>
                  </div>

                  {Array.from(
                    new Set([
                      ...semestersList.map((s) => s.code),
                      ...personAssignments.map((a) => a.semester).filter(Boolean),
                    ])
                  )
                    .filter(Boolean)
                    .map((semCode) => {
                      const semAssignments = personAssignments.filter((a) => a.semester === semCode);
                      const isExpanded = expandedSemesters[semCode as string] ?? true;

                      return (
                        <div
                          key={semCode}
                          className="rounded-2xl glass-panel border border-white/40 dark:border-white/10 overflow-hidden"
                        >
                          <div
                            onClick={() => {
                              setExpandedSemesters((prev) => ({
                                ...prev,
                                [semCode as string]: !isExpanded,
                              }));
                            }}
                            className="px-4 py-3 bg-slate-100/50 dark:bg-slate-900/50 flex items-center justify-between cursor-pointer hover:bg-blue-500/5 transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-blue-500" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                              <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                                {semCode}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                (Semester {semCode?.replace('S', '')})
                              </span>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                semAssignments.length > 0
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                  : 'bg-slate-200/50 dark:bg-slate-800/50 text-slate-400'
                              }`}
                            >
                              {semAssignments.length} {semAssignments.length === 1 ? 'Subject' : 'Subjects'}
                            </span>
                          </div>

                          {isExpanded && (
                            <div className="p-3 space-y-2">
                              {semAssignments.length === 0 ? (
                                <div className="py-3 text-center text-xs text-slate-400 italic">
                                  No subject assigned for {semCode}.
                                </div>
                              ) : (
                                semAssignments.map((assign) => (
                                  <div
                                    key={assign.id}
                                    className="p-3 rounded-xl bg-white/40 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                                  >
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <strong className="text-sm font-bold text-slate-900 dark:text-white">
                                          {assign.subject_name}
                                        </strong>
                                        {assign.subject_code && (
                                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-bold">
                                            {assign.subject_code}
                                          </span>
                                        )}
                                        <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold">
                                          {assign.period_duration || '1 hour'}
                                        </span>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                                        <span>
                                          Dept: <strong>{assign.department_name || 'General Dept'}</strong>
                                        </span>
                                        <span>•</span>
                                        <span>
                                          Required:{' '}
                                          <strong className="text-blue-500">
                                            {assign.required_periods || 4} periods/wk
                                          </strong>
                                        </span>
                                        {assign.preferred_periods && assign.preferred_periods.length > 0 && (
                                          <>
                                            <span>•</span>
                                            <span className="text-amber-500 font-medium">
                                              Pref: {assign.preferred_periods.join(', ')}
                                            </span>
                                          </>
                                        )}
                                      </div>

                                      {assign.allowed_working_days && assign.allowed_working_days.length > 0 && (
                                        <div className="flex items-center gap-1 text-[10px] pt-1">
                                          <span className="text-slate-400">Allowed Days:</span>
                                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName, idx) => (
                                            <span
                                              key={idx}
                                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                                assign.allowed_working_days?.includes(idx)
                                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                                  : 'text-slate-300 dark:text-slate-600'
                                              }`}
                                            >
                                              {dayName}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Company Shift & Working Hours Overview */}
                {activeOrg?.type === 'company' && (
                  <div className="p-4 rounded-2xl glass-panel border border-white/40 dark:border-white/10 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-slate-800/80 pb-2">
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-blue-500" />
                        <span>Company Work Shift & Duty Assignments</span>
                      </h4>
                      <button
                        onClick={() => setIsEditingInModal(true)}
                        className="text-xs font-bold text-blue-500 hover:underline flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit Shift & Duties</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-white/40 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Primary Operational Duty</span>
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          {selectedPerson.preferences?.duty || selectedPerson.role_title || 'General Operations'}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-white/40 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Configured Working Hours</span>
                        <div className="font-extrabold text-blue-600 dark:text-blue-400">
                          {selectedPerson.preferences?.start_time || '09:00'} – {selectedPerson.preferences?.end_time || '17:00'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Configured Working Days</span>
                      <div className="flex flex-wrap gap-1.5">
                        {DAY_LABELS.map(({ label, day }) => {
                          const isAssigned = (selectedPerson.preferences?.working_days || [0, 1, 2, 3, 4]).includes(day);
                          return (
                            <span
                              key={day}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                isAssigned
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                  : 'bg-white/40 dark:bg-slate-800/40 text-slate-400 border-slate-200/40 dark:border-slate-700/40'
                              }`}
                            >
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Airline Flight Duties & Safety Regulations Overview */}
                {activeOrg?.type === 'airline' && (
                  <div className="p-4 rounded-2xl glass-panel border border-white/40 dark:border-white/10 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-slate-800/80 pb-2">
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Plane className="w-4 h-4 text-blue-500" />
                        <span>Aviation Crew Flight Operations & Safety</span>
                      </h4>
                      <button
                        onClick={() => setIsEditingInModal(true)}
                        className="text-xs font-bold text-blue-500 hover:underline flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit Flight Duty</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-white/40 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Assigned Flight Duty</span>
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          {selectedPerson.preferences?.duty || 'Standard Flight Ops'}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-white/40 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Duty Window</span>
                        <div className="font-extrabold text-blue-600 dark:text-blue-400">
                          {selectedPerson.preferences?.start_time || '06:00'} – {selectedPerson.preferences?.end_time || '14:00'}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-white/40 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Rest Regulations</span>
                        <div className="font-extrabold text-purple-600 dark:text-purple-400">
                          Min {selectedPerson.preferences?.min_rest_hours || 12}h Rest
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Operating Flight Days</span>
                      <div className="flex flex-wrap gap-1.5">
                        {DAY_LABELS.map(({ label, day }) => {
                          const isAssigned = (selectedPerson.preferences?.working_days || [0, 1, 2, 3, 4]).includes(day);
                          return (
                            <span
                              key={day}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                isAssigned
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                  : 'bg-white/40 dark:bg-slate-800/40 text-slate-400 border-slate-200/40 dark:border-slate-700/40'
                              }`}
                            >
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer Qualifications */}
                <div className="pt-4 border-t border-slate-200/40 dark:border-slate-800/80 text-xs space-y-1">
                  <span className="font-bold text-slate-400">Qualifications:</span>
                  <div className="text-slate-800 dark:text-slate-200">
                    {selectedPerson.qualifications?.join(', ') || 'None recorded'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
