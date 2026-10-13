export interface Organization {
  id: number;
  name: string;
  type: string;
  code?: string;
  description?: string;
  settings_json?: Record<string, any>;
  created_at?: string;
}

export interface PresetOrg {
  type: string;
  name: string;
  icon: string;
  description: string;
  default_departments: string[];
  default_roles: string[];
  profession_label: string;
  resource_types: string[];
  default_working_days_schedule?: Record<string, any>;
  default_profession_settings?: Record<string, any>;
}

export interface Department {
  id: number;
  org_id: number;
  name: string;
  code?: string;
  description?: string;
}

export interface Subject {
  id: number;
  org_id: number;
  department_id?: number;
  department_name?: string;
  semester_id?: number;
  semester_name?: string;
  name: string;
  code: string;
  semester?: string;
  class_name?: string;
  required_hours_per_week?: number;
  is_lab?: boolean;
  description?: string;
  assigned_teachers?: any[];
  created_at?: string;
}

export interface Semester {
  id: number;
  org_id: number;
  name: string;
  code: string;
  academic_year?: string;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  subject_count?: number;
  created_at?: string;
}

export interface TeacherSubjectAssignment {
  id: number;
  org_id: number;
  person_id: number;
  teacher_name?: string;
  subject_id: number;
  subject_name?: string;
  subject_code?: string;
  department_id?: number;
  department_name?: string;
  semester_id?: number;
  semester?: string;
  class_name?: string;
  required_hours: number;
  required_periods?: number;
  period_duration?: string;
  allowed_working_days?: number[];
  preferred_periods?: string[];
  unavailable_periods?: string[];
  max_periods_per_day?: number;
  eligible_rooms?: number[];
  is_primary?: boolean;
  assignment_status?: string;
  created_at?: string;
}

export interface PeriodConfigItem {
  name: string;
  type: string;
  start_time: string;
  end_time: string;
  duration_minutes?: number;
  duration_hours?: number;
  is_active?: boolean;
  is_break?: boolean;
  counts_toward_teaching?: boolean;
  min_staff?: number;
  target_staff?: number;
  max_staff?: number;
}

export interface DayPeriodConfig {
  day_name: string;
  day_of_week: number;
  is_working_day: boolean;
  periods: PeriodConfigItem[];
}

export interface PeriodConfigPayload {
  days: DayPeriodConfig[];
}


export interface GlixonAssignment {
  slot_id: number;
  teacher_id: number;
  teacher_name: string;
  department_id?: number;
  department_name?: string;
  semester: string;
  subject_id?: number;
  subject_name: string;
  subject_code?: string;
  class_name: string;
  day_of_week: number;
  day_name: string;
  date_str?: string;
  start_time: string;
  end_time: string;
  duration_minutes?: number;
  duration_hours: number;
  resource_id?: number;
  resource_name?: string;
  title?: string;
}

export interface GlixonPreviewResponse {
  success: boolean;
  preview: boolean;
  schedule_id: number;
  period_start?: string;
  period_end?: string;
  fairness_score: number;
  total_assignments: number;
  assignments: GlixonAssignment[];

  teacher_timetables: Record<string, GlixonAssignment[]>;
  class_timetables: Record<string, GlixonAssignment[]>;
  semester_timetables: Record<string, GlixonAssignment[]>;
  department_timetables: Record<string, GlixonAssignment[]>;
  teacher_workloads: Record<string, any>;
  unfilled_slots: number[];
  conflicts: string[];
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'employee';
  org_id?: number;
  person_id?: number;
}

export interface SkillItem {
  name: string;
  level: string;
  verified: boolean;
  years: number;
}

export interface InferredSkillItem {
  name: string;
  confidence: number;
  category?: string;
  source_skill?: string;
  reason?: string;
}

export interface Person {
  id: number;
  org_id: number;
  department_id?: number;
  department_name?: string;
  name: string;
  email: string;
  phone?: string;
  role_title?: string;
  employee_code: string;
  profession_type?: string;
  qualifications: string[];
  skills: SkillItem[];
  inferred_skills: InferredSkillItem[];
  preferences: Record<string, any>;
  profession_metadata: Record<string, any>;
  max_hours_per_week: number;
  data_quality_score: number;
  status: 'active' | 'inactive' | 'on_leave';
  hire_date?: string;
  teacher_assignments?: TeacherSubjectAssignment[];
}

export interface Resource {
  id: number;
  org_id: number;
  name: string;
  type: string;
  capacity: number;
  location?: string;
  status: string;
}

export interface TimetableSlot {
  slot_id: number;
  title: string;
  date_str?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  resource_id?: number;
  resource_name?: string;
  department_id?: number;
  department_name?: string;
  subject_id?: number;
  subject?: string;
  subject_name?: string;
  subject_code?: string;
  semester?: string;
  class_name?: string;
  required_skills: string[];
  required_qualifications: string[];
  profession_metadata: Record<string, any>;
  assignment_id?: number;
  person_id?: number;
  person_name?: string;
  person_role?: string;
  is_replacement?: boolean;
  replacement_type?: string;
  replacement_reason?: string;
  original_person_id?: number;
  original_person_name?: string;
  status: string;
  period_type?: string;
  staffing_status?: string;
  is_locked?: boolean;
  min_staff?: number;
  target_staff?: number;
  max_staff?: number;
  slot_order?: number;
  assigned_count?: number;
  assigned_staff?: any[];
}

export interface Schedule {
  id: number;
  org_id: number;
  title: string;
  period_start: string;
  period_end: string;
  status: string;
  version: number;
  fairness_score: number;
  total_assignments: number;
  conflict_count: number;
  created_at: string;
}

export interface ActiveReplacement {
  id: number;
  assignment_id: number;
  slot_title: string;
  date_str: string;
  time_window: string;
  original_person_id: number;
  original_person_name: string;
  replacement_person_id: number;
  replacement_person_name: string;
  replacement_type: string;
  reason: string;
  match_score: number;
  created_at: string;
  can_restore: boolean;
}

export interface LeaveRequest {
  id: number;
  person_id: number;
  person_name?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  reason: string;
  status: string;
  affected_slots_count: number;
  replacement_search_started: boolean;
  return_confirmed: boolean;
  created_at: string;
}

export interface SearchCandidate {
  person: Person;
  match_percentage: number;
  score_components: {
    skill_match: number;
    qualification_match: number;
    availability_match: number;
    experience_match: number;
    text_similarity: number;
  };
  explanations: string[];
  missing_requirements: string[];
  rejection_reasons: string[];
  is_recommended: boolean;
}

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  category: string;
  is_read: boolean;
  link_url?: string;
  created_at: string;
}

export interface Holiday {
  id: number;
  org_id: number;
  department_id?: number;
  department_name?: string;
  name: string;
  holiday_type: 'public' | 'regional' | 'organization' | 'department_specific' | 'optional' | 'custom' | 'emergency_closure' | 'special_working_day';
  start_date: string;
  end_date: string;
  is_partial_day: boolean;
  partial_start_time?: string;
  partial_end_time?: string;
  is_recurring: boolean;
  location?: string;
  description?: string;
  essential_staffing_allowed: boolean;
  authorized_roles: string[];
  status: string;
  exceptions_count?: number;
  created_at?: string;
}

export interface HolidayException {
  id: number;
  holiday_id: number;
  person_id: number;
  person_name?: string;
  slot_id?: number;
  reason: string;
  authorized_by: string;
  created_at?: string;
}

export interface HolidayImpactItem {
  slot_id: number;
  slot_title: string;
  date_str: string;
  start_time: string;
  end_time: string;
  department_id?: number;
  assignment_id?: number;
  person_id?: number;
  person_name?: string;
  person_role?: string;
  status_tag: 'conflict' | 'essential_clearance' | 'authorized_exception' | 'special_working_day';
  has_exception: boolean;
  is_essential_covered: boolean;
  holiday_name: string;
  holiday_type: string;
}

