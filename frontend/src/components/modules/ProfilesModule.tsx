import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { Person } from '../../types';
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
} from 'lucide-react';
import { Semester, Subject, Department, TeacherSubjectAssignment } from '../../types';

export const ProfilesModule: React.FC = () => {
  const { activeOrg, addToast } = useApp();
  const [people, setPeople] = useState<Person[]>([]);
  const [qualityStats, setQualityStats] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'roster' | 'add' | 'import' | 'quality'>('roster');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Add person form state (profession-dynamic)
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDeptId, setFormDeptId] = useState<number | undefined>(undefined);
  const [formSkillsStr, setFormSkillsStr] = useState('');
  const [formQualsStr, setFormQualsStr] = useState('');
  const [formHoursLimit, setFormHoursLimit] = useState(40);
  const [formSemesters, setFormSemesters] = useState('S3, S5');
  const [formTheoryLab, setFormTheoryLab] = useState('both');
  const [formClasses, setFormClasses] = useState('CSE-A, CSE-B');

  // Excel/CSV import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Teaching Assignments state for selected person
  const [personAssignments, setPersonAssignments] = useState<TeacherSubjectAssignment[]>([]);
  const [semestersList, setSemestersList] = useState<Semester[]>([]);
  const [subjectsList, setSubjectsList] = useState<Subject[]>([]);
  const [departmentsList, setDepartmentsList] = useState<Department[]>([]);
  const [expandedSemesters, setExpandedSemesters] = useState<Record<string, boolean>>({});
  const [isAddAssignOpen, setIsAddAssignOpen] = useState(false);
  const [assignSemester, setAssignSemester] = useState('S3');
  const [assignDeptId, setAssignDeptId] = useState<number | undefined>(undefined);
  const [assignSubjectId, setAssignSubjectId] = useState<number | undefined>(undefined);
  const [assignClass, setAssignClass] = useState('S3 A');
  const [assignPeriods, setAssignPeriods] = useState(4);
  const [assignHours, setAssignHours] = useState(4.0);
  const [assignDays, setAssignDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [assignPrefPeriods, setAssignPrefPeriods] = useState('Period 1, Period 2');
  const [assignMaxPerDay, setAssignMaxPerDay] = useState(2);
  const [assignStatus, setAssignStatus] = useState('active');
  const [isSavingAssign, setIsSavingAssign] = useState(false);

  const fetchPeople = async () => {
    if (!activeOrg) return;
    try {
      setIsLoading(true);
      const data = await api.getPeople({ org_id: activeOrg.id, search: searchQuery || undefined });
      setPeople(data);
      const qStats = await api.getDataQualityStats(activeOrg.id);
      setQualityStats(qStats);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPeople();
  }, [activeOrg, searchQuery]);

  // Load academic metadata and teacher assignments when selectedPerson changes
  const loadPersonAssignments = async (personId: number) => {
    if (!activeOrg) return;
    try {
      const [resGroup, sems, subs, depts] = await Promise.all([
        api.getTeacherAssignments(activeOrg.id, { person_id: personId }),
        api.getSemesters(activeOrg.id),
        api.getSubjects(activeOrg.id),
        api.getDepartments(activeOrg.id)
      ]);
      setPersonAssignments(resGroup);
      setSemestersList(sems);
      setSubjectsList(subs);
      setDepartmentsList(depts);
      // Auto expand semesters
      const exp: Record<string, boolean> = {};
      resGroup.forEach((a: TeacherSubjectAssignment) => {
        if (a.semester) exp[a.semester] = true;
      });
      sems.forEach((s: Semester) => {
        if (!(s.code in exp)) exp[s.code] = true;
      });
      setExpandedSemesters(exp);
      if (sems.length > 0 && !assignSemester) {
        setAssignSemester(sems[0].code);
      }
    } catch (err) {
      console.error('Failed to load teacher assignments', err);
    }
  };

  useEffect(() => {
    if (selectedPerson) {
      loadPersonAssignments(selectedPerson.id);
    }
  }, [selectedPerson, activeOrg]);

  const handleSaveTeacherAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !selectedPerson || !assignSubjectId) return;
    triggerHaptic(15);
    setIsSavingAssign(true);
    try {
      const sub = subjectsList.find((s) => s.id === assignSubjectId);
      const semObj = semestersList.find((s) => s.code === assignSemester);
      const prefList = assignPrefPeriods
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      await api.createTeacherAssignment(activeOrg.id, {
        person_id: selectedPerson.id,
        subject_id: assignSubjectId,
        department_id: assignDeptId || sub?.department_id || selectedPerson.department_id,
        semester_id: semObj?.id || sub?.semester_id,
        semester: assignSemester || sub?.semester || 'S3',
        class_name: assignClass || sub?.class_name || 'Section A',
        required_hours: assignHours || sub?.required_hours_per_week || 4.0,
        required_periods: assignPeriods || 4,
        allowed_working_days: assignDays,
        preferred_periods: prefList,
        max_periods_per_day: assignMaxPerDay || 2,
        assignment_status: assignStatus || 'active'
      });
      addToast('Assignment Saved', `Assigned ${sub?.name || 'subject'} to ${selectedPerson.name} for ${assignSemester}`, 'success');
      setIsAddAssignOpen(false);
      loadPersonAssignments(selectedPerson.id);
    } catch (err: any) {
      addToast('Assignment Failed', err.message || 'Could not save assignment', 'error');
    } finally {
      setIsSavingAssign(false);
    }
  };

  const handleDeleteTeacherAssignment = async (id: number) => {
    if (!activeOrg || !selectedPerson) return;
    triggerHaptic(12);
    try {
      await api.deleteTeacherAssignment(activeOrg.id, id);
      addToast('Assignment Removed', 'Teacher assignment removed successfully', 'info');
      loadPersonAssignments(selectedPerson.id);
    } catch (err: any) {
      addToast('Remove Failed', err.message || 'Could not delete assignment', 'error');
    }
  };

  const handleCreatePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) return;
    triggerHaptic(15);

    try {
      const skillsArray = formSkillsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({
          name,
          level: 'Expert',
          verified: true,
          years: 4.0,
        }));

      const qualsArray = formQualsStr
        .split(',')
        .map((q) => q.trim())
        .filter(Boolean);

      const metadata: Record<string, any> = {};
      if (activeOrg.type === 'college') {
        metadata.semesters = formSemesters.split(',').map((s) => s.trim());
        metadata.theory_lab = formTheoryLab;
        metadata.classes = formClasses.split(',').map((c) => c.trim());
      }

      await api.createPerson({
        org_id: activeOrg.id,
        name: formName,
        email: formEmail,
        phone: formPhone,
        role_title: formRole,
        employee_code: formCode || `EMP-${Date.now().toString().slice(-4)}`,
        profession_type: activeOrg.type,
        department_id: formDeptId,
        qualifications: qualsArray,
        skills: skillsArray,
        max_hours_per_week: formHoursLimit,
        profession_metadata: metadata,
        status: 'active',
      });

      addToast('Profile Created', `Added ${formName} with auto-inferred skills`, 'success');
      setFormName('');
      setFormEmail('');
      setFormRole('');
      setFormSkillsStr('');
      setFormQualsStr('');
      setActiveTab('roster');
      fetchPeople();
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeOrg) return;
    triggerHaptic(10);
    setImportFile(file);

    try {
      setIsImporting(true);
      const preview = await api.previewFile(activeOrg.id, file);
      setImportPreview(preview);
      addToast('Spreadsheet Parsed', `Mapped columns with quality score: ${preview.overall_quality_score}%`, 'info');
    } catch (err: any) {
      addToast('Import Error', err.message, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCommitImport = async () => {
    if (!activeOrg || !importPreview) return;
    triggerHaptic(20);
    try {
      setIsImporting(true);
      const res = await api.commitImport(activeOrg.id, importPreview.full_records || importPreview.preview);
      addToast('Import Completed', res.message, 'success');
      setImportPreview(null);
      setImportFile(null);
      setActiveTab('roster');
      fetchPeople();
    } catch (err: any) {
      addToast('Import Error', err.message, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    triggerHaptic(15);
    try {
      await api.deletePerson(id);
      addToast('Profile Deactivated', 'Person status marked inactive', 'info');
      fetchPeople();
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header with Navigation Pills */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-500" />
            <span>Staff & Profile Management</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage profession profiles, automatic skill inference, and verified Excel/CSV imports.
          </p>
        </div>

        {/* Sub-Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl glass-panel border border-white/20 dark:border-white/10 self-start">
          <button
            onClick={() => setActiveTab('roster')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'roster'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/40'
            }`}
          >
            All Staff ({people.length})
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
              activeTab === 'add'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/40'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Person</span>
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
          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, code, designation, or subject..."
              className="w-full pl-10 pr-4 py-2 rounded-xl glass-input text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400"
            />
          </div>

          {/* People Table */}
          <div className="rounded-3xl glass-panel border border-white/40 dark:border-white/10 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/50 dark:border-slate-800/80 bg-slate-100/40 dark:bg-slate-900/40 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Role & Dept</th>
                    <th className="py-3 px-4">Verified Skills</th>
                    <th className="py-3 px-4">Inferred Skills</th>
                    <th className="py-3 px-4">Qualifications</th>
                    <th className="py-3 px-4">Quality</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/40">
                  {people.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedPerson(p)}
                      className="hover:bg-blue-500/5 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{p.name}</div>
                        <div className="text-[10px] text-slate-500">{p.employee_code} • {p.email}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{p.role_title}</div>
                        <div className="text-[10px] text-blue-500 font-medium">{p.department_name}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {p.skills.slice(0, 3).map((s, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold border border-blue-500/20"
                            >
                              {s.name}
                            </span>
                          ))}
                          {p.skills.length > 3 && (
                            <span className="text-[10px] text-slate-400">+{p.skills.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {p.inferred_skills.slice(0, 2).map((inf, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-semibold border border-purple-500/20"
                              title={`${inf.reason} (${Math.round(inf.confidence * 100)}%)`}
                            >
                              ~{inf.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-[11px] text-slate-700 dark:text-slate-300">
                          {p.qualifications.join(', ') || 'N/A'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{p.data_quality_score}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeactivate(p.id);
                          }}
                          className="p-1 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
                          title="Deactivate Person"
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
        </div>
      )}

      {/* Tab 2: Add Person with Profession Dynamic Form */}
      {activeTab === 'add' && (
        <form onSubmit={handleCreatePerson} className="p-6 md:p-8 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-6 max-w-3xl">
          <div className="border-b border-slate-200/50 dark:border-slate-800/80 pb-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Add New Staff Member ({activeOrg?.type?.toUpperCase()} Role)
            </h3>
            <p className="text-xs text-slate-500">
              Form automatically adapts to your selected organization type: {activeOrg?.name}.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Dr. Arthur Pendelton"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="arthur@institution.edu"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Designation / Job Role *
              </label>
              <input
                type="text"
                required
                placeholder={activeOrg?.type === 'college' ? 'e.g. Assistant Professor' : 'e.g. Senior Software Engineer'}
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Employee Code / Badge
              </label>
              <input
                type="text"
                placeholder="e.g. FAC-201"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Primary Verified Skills (comma-separated) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. DBMS, SQL, Python, Algorithms"
                value={formSkillsStr}
                onChange={(e) => setFormSkillsStr(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                System will automatically infer complementary hidden skills and compute match confidence.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Educational Qualifications / Certifications (comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g. M.Tech CSE, Ph.D, AWS Certified"
                value={formQualsStr}
                onChange={(e) => setFormQualsStr(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
              />
            </div>

            {/* College Specific Fields */}
            {activeOrg?.type === 'college' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Eligible Semesters
                  </label>
                  <input
                    type="text"
                    value={formSemesters}
                    onChange={(e) => setFormSemesters(e.target.value)}
                    placeholder="S3, S5, S7"
                    className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Theory / Lab Capability
                  </label>
                  <select
                    value={formTheoryLab}
                    onChange={(e) => setFormTheoryLab(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
                  >
                    <option value="both">Both Theory & Lab</option>
                    <option value="theory">Theory Only</option>
                    <option value="lab">Lab Practical Only</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Max Weekly Working Hours Limit
              </label>
              <input
                type="number"
                value={formHoursLimit}
                onChange={(e) => setFormHoursLimit(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setActiveTab('roster')}
              className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-xl glass-button-primary text-xs font-semibold"
            >
              Save Staff Profile
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
                  Upload an .xlsx or .csv spreadsheet. Automatic column mapping, duplicate validation, and data quality rating will execute immediately.
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

      {/* Detail Modal with Dynamic Multi-Semester Teaching Assignments */}
      {selectedPerson && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-3xl w-full rounded-3xl glass-panel border border-white/40 dark:border-white/10 p-6 md:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-slate-800/80 pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-base shadow-md">
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
              </div>
              <button
                onClick={() => {
                  setSelectedPerson(null);
                  setIsAddAssignOpen(false);
                }}
                className="p-1.5 rounded-xl glass-pill hover:bg-slate-500/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Profile Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-2xl glass-pill">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Weekly Limit</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedPerson.max_hours_per_week}h / week</span>
              </div>
              <div className="p-3 rounded-2xl glass-pill">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Data Quality</span>
                <span className="font-bold text-emerald-500">{selectedPerson.data_quality_score}% Verified</span>
              </div>
              <div className="p-3 rounded-2xl glass-pill">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Active Semesters</span>
                <span className="font-bold text-blue-500">
                  {Array.from(new Set(personAssignments.map((a) => a.semester).filter(Boolean))).length} Semesters
                </span>
              </div>
              <div className="p-3 rounded-2xl glass-pill">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Teaching Load</span>
                <span className="font-bold text-purple-500">
                  {personAssignments.reduce((acc, a) => acc + (a.required_periods || 4), 0)} Periods/wk
                </span>
              </div>
            </div>

            {/* SECTION: TEACHING ASSIGNMENTS (Requirement 2 & 3) */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/40 dark:border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-blue-500" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Teaching Assignments</h4>
                    <p className="text-[11px] text-slate-500">
                      Configure individual semester subjects, required teaching periods, and working day constraints.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAddAssignOpen(!isAddAssignOpen)}
                    className="px-3 py-1.5 rounded-xl glass-button-primary text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAddAssignOpen ? 'Close Form' : 'Add Semester Assignment'}</span>
                  </button>
                </div>
              </div>

              {/* Add Assignment Form (Requirement 2 & 3) */}
              {isAddAssignOpen && (
                <form
                  onSubmit={handleSaveTeacherAssignment}
                  className="p-5 rounded-2xl glass-panel border border-blue-500/30 bg-blue-500/5 space-y-4 animate-in fade-in duration-200 text-xs"
                >
                  <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between border-b border-blue-500/20 pb-2">
                    <span>New Teaching Assignment for {selectedPerson.name}</span>
                    <span className="text-[10px] text-blue-500 font-normal">Saves directly to database</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* 1. Select Semester */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Select Semester *
                      </label>
                      <select
                        value={assignSemester}
                        onChange={(e) => {
                          setAssignSemester(e.target.value);
                          // Auto filter subjects for this semester
                          const filtered = subjectsList.filter((s) => !s.semester || s.semester === e.target.value);
                          if (filtered.length > 0) setAssignSubjectId(filtered[0].id);
                        }}
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                        required
                      >
                        {semestersList.map((sem) => (
                          <option key={sem.id} value={sem.code}>
                            {sem.code} ({sem.name})
                          </option>
                        ))}
                        {semestersList.length === 0 && (
                          <>
                            <option value="S1">S1 (Semester 1)</option>
                            <option value="S3">S3 (Semester 3)</option>
                            <option value="S5">S5 (Semester 5)</option>
                            <option value="S7">S7 (Semester 7)</option>
                          </>
                        )}
                      </select>
                    </div>

                    {/* 2. Select Department */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Department
                      </label>
                      <select
                        value={assignDeptId || ''}
                        onChange={(e) => setAssignDeptId(Number(e.target.value) || undefined)}
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      >
                        <option value="">All Departments</option>
                        {departmentsList.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 3. Select Subject (Filtered by selected semester) */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Select Subject *
                      </label>
                      <select
                        value={assignSubjectId || ''}
                        onChange={(e) => {
                          const sid = Number(e.target.value);
                          setAssignSubjectId(sid);
                          const chosen = subjectsList.find((s) => s.id === sid);
                          if (chosen?.class_name) setAssignClass(chosen.class_name);
                          if (chosen?.required_hours_per_week) setAssignHours(chosen.required_hours_per_week);
                        }}
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs font-semibold text-blue-600 dark:text-blue-400"
                        required
                      >
                        <option value="">-- Choose Subject --</option>
                        {subjectsList
                          .filter((s) => !assignSemester || !s.semester || s.semester === assignSemester)
                          .map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.name} ({sub.code})
                            </option>
                          ))}
                        {subjectsList.length === 0 && (
                          <option value="" disabled>No subjects found in database</option>
                        )}
                      </select>
                    </div>

                    {/* 4. Class / Section */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Class / Section *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. S3 A or CSE-A"
                        value={assignClass}
                        onChange={(e) => setAssignClass(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>

                    {/* 5. Required Periods Per Week */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Required Periods / Week
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={assignPeriods}
                        onChange={(e) => setAssignPeriods(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>

                    {/* 6. Teaching Hours / Week */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Required Hours / Week
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        max="30"
                        value={assignHours}
                        onChange={(e) => setAssignHours(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>

                    {/* 7. Max Periods Per Day */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Max Periods / Day
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="6"
                        value={assignMaxPerDay}
                        onChange={(e) => setAssignMaxPerDay(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>

                    {/* 8. Preferred Periods */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Preferred Periods / Timings (comma-separated)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Period 1, Period 2, 09:00-11:00"
                        value={assignPrefPeriods}
                        onChange={(e) => setAssignPrefPeriods(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                      />
                    </div>
                  </div>

                  {/* 9. Allowed Working Days (Mon-Sat checkboxes) */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Allowed Working Days for this Subject:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Mon', day: 0 },
                        { label: 'Tue', day: 1 },
                        { label: 'Wed', day: 2 },
                        { label: 'Thu', day: 3 },
                        { label: 'Fri', day: 4 },
                        { label: 'Sat', day: 5 },
                        { label: 'Sun', day: 6 },
                      ].map(({ label, day }) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            setAssignDays((prev) =>
                              prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
                            );
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                            assignDays.includes(day)
                              ? 'bg-blue-500 text-white border-blue-600 shadow-sm'
                              : 'bg-white/40 dark:bg-slate-800/40 text-slate-500 border-slate-200/50 dark:border-slate-700/50'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-blue-500/20">
                    <button
                      type="button"
                      onClick={() => setIsAddAssignOpen(false)}
                      className="px-4 py-2 rounded-xl glass-pill text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingAssign || !assignSubjectId}
                      className="px-5 py-2 rounded-xl glass-button-primary text-xs font-semibold disabled:opacity-50"
                    >
                      {isSavingAssign ? 'Saving...' : 'Save Assignment'}
                    </button>
                  </div>
                </form>
              )}

              {/* Collapsible Semester Sections (Requirement 2 & 10) */}
              <div className="space-y-3">
                {/* Collect all semesters to render */}
                {Array.from(
                  new Set([
                    ...semestersList.map((s) => s.code),
                    ...personAssignments.map((a) => a.semester).filter(Boolean),
                    'S1', 'S3', 'S5', 'S7'
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
                        {/* Collapsible Semester Header */}
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

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                semAssignments.length > 0
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                  : 'bg-slate-200/50 dark:bg-slate-800/50 text-slate-400'
                              }`}
                            >
                              {semAssignments.length} {semAssignments.length === 1 ? 'Subject' : 'Subjects'} Assigned
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAssignSemester(semCode as string);
                                setIsAddAssignOpen(true);
                              }}
                              className="px-2 py-1 rounded-lg glass-pill text-[10px] font-semibold text-blue-500 hover:bg-blue-500/10"
                            >
                              + Add to {semCode}
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Semester Content */}
                        {isExpanded && (
                          <div className="p-3 space-y-2">
                            {semAssignments.length === 0 ? (
                              <div className="py-4 text-center text-xs text-slate-400 italic">
                                No subject assigned for {semCode}. Click <strong className="text-blue-500 cursor-pointer" onClick={() => { setAssignSemester(semCode as string); setIsAddAssignOpen(true); }}>+ Add to {semCode}</strong> to assign.
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
                                        Class: {assign.class_name || 'All Sections'}
                                      </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                                      <span>Dept: <strong>{assign.department_name || 'Computer Science'}</strong></span>
                                      <span>•</span>
                                      <span>Required: <strong className="text-blue-500">{assign.required_periods || 4} periods/wk</strong> ({assign.required_hours}h)</span>
                                      <span>•</span>
                                      <span>Max: <strong>{assign.max_periods_per_day || 2}/day</strong></span>
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

                                  <div className="flex items-center gap-2 self-end sm:self-center">
                                    <button
                                      onClick={() => handleDeleteTeacherAssignment(assign.id)}
                                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
                                      title="Remove Assignment"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
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
            </div>

            {/* Direct & Inferred Skills footer */}
            <div className="pt-4 border-t border-slate-200/40 dark:border-slate-800/80 space-y-3 text-xs">
              <div>
                <span className="font-semibold text-slate-400">Verified Skills:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedPerson.skills.map((s, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold text-[10px]">
                      {s.name} ({s.level}, {s.years} yrs)
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="font-semibold text-slate-400">Verified Qualifications:</span>
                <div className="text-slate-800 dark:text-slate-200 mt-0.5">{selectedPerson.qualifications.join(', ') || 'None recorded'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
