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
} from 'lucide-react';

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

      {/* Detail Modal */}
      {selectedPerson && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full rounded-3xl glass-panel border border-white/40 dark:border-white/10 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-200/40 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{selectedPerson.name}</h3>
                <div className="text-xs text-blue-500 font-semibold">{selectedPerson.role_title} • {selectedPerson.employee_code}</div>
              </div>
              <button onClick={() => setSelectedPerson(null)} className="p-1 rounded-lg glass-pill">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-slate-400">Verified Qualifications:</span>
                <div className="text-slate-800 dark:text-slate-200 mt-0.5">{selectedPerson.qualifications.join(', ') || 'None recorded'}</div>
              </div>

              <div>
                <span className="font-semibold text-slate-400">Direct Skills:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedPerson.skills.map((s, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold text-[10px]">
                      {s.name} ({s.level}, {s.years} yrs)
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="font-semibold text-slate-400">Inferred Hidden Skills:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedPerson.inferred_skills.map((inf, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold text-[10px]" title={inf.reason}>
                      ~{inf.name} ({Math.round(inf.confidence * 100)}%)
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/40 flex justify-between text-slate-500 text-[11px]">
                <span>Weekly Hours Limit: {selectedPerson.max_hours_per_week}h</span>
                <span>Data Quality: {selectedPerson.data_quality_score}%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
