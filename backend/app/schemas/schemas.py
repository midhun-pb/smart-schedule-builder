from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# Token & Auth
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class LoginRequest(BaseModel):
    email: str
    password: str

class SwitchRoleRequest(BaseModel):
    role: str  # admin, manager, employee
    person_id: Optional[int] = None

# Organization
class OrganizationBase(BaseModel):
    name: str
    type: str  # college, company, hospital, etc.
    code: Optional[str] = None
    description: Optional[str] = None
    settings_json: Optional[Dict[str, Any]] = None

class OrganizationCreate(BaseModel):
    name: str
    type: str  # college, company, hospital, etc.
    code: Optional[str] = None
    description: Optional[str] = None
    departments: Optional[List[str]] = None
    roles: Optional[List[str]] = None
    resource_types: Optional[List[str]] = None
    working_days_schedule: Optional[Dict[str, Any]] = None
    shift_templates: Optional[List[Dict[str, Any]]] = None
    profession_settings: Optional[Dict[str, Any]] = None
    settings_json: Optional[Dict[str, Any]] = None

class OrganizationResponse(OrganizationBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

# Department
class DepartmentBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None

class DepartmentCreate(DepartmentBase):
    org_id: Optional[int] = None

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None

class DepartmentResponse(DepartmentBase):
    id: int
    org_id: int
    class Config:
        from_attributes = True

# Semester
class SemesterBase(BaseModel):
    name: str                               # e.g. "Semester 3"
    code: str                               # e.g. "S3"
    academic_year: Optional[str] = "2026-2027"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_active: bool = True

class SemesterCreate(SemesterBase):
    org_id: Optional[int] = None

class SemesterUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    academic_year: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_active: Optional[bool] = None

class SemesterResponse(SemesterBase):
    id: int
    org_id: int
    subject_count: Optional[int] = 0
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

# Subject
class SubjectBase(BaseModel):
    name: str
    code: str
    department_id: Optional[int] = None
    semester_id: Optional[int] = None
    semester: Optional[str] = None
    class_name: Optional[str] = None
    required_hours_per_week: float = 4.0
    is_lab: bool = False
    description: Optional[str] = None

class SubjectCreate(SubjectBase):
    org_id: Optional[int] = None

class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    department_id: Optional[int] = None
    semester_id: Optional[int] = None
    semester: Optional[str] = None
    class_name: Optional[str] = None
    required_hours_per_week: Optional[float] = None
    is_lab: Optional[bool] = None
    description: Optional[str] = None

class SubjectResponse(SubjectBase):
    id: int
    org_id: int
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

# Teacher-Subject Assignment
class TeacherAssignmentBase(BaseModel):
    person_id: int                          # teacher
    subject_id: int
    department_id: Optional[int] = None
    semester_id: Optional[int] = None
    semester: Optional[str] = None          # "S3"
    class_name: Optional[str] = None        # "S3 A"
    required_hours: float = 4.0
    required_periods: int = 4
    period_duration: Optional[str] = "1 hour"
    allowed_working_days: List[int] = [0, 1, 2, 3, 4]
    preferred_periods: List[str] = []
    unavailable_periods: List[str] = []
    max_periods_per_day: int = 2
    eligible_rooms: List[int] = []
    is_primary: bool = True
    assignment_status: str = "active"

class TeacherAssignmentCreate(TeacherAssignmentBase):
    org_id: Optional[int] = None

class TeacherAssignmentUpdate(BaseModel):
    person_id: Optional[int] = None
    subject_id: Optional[int] = None
    department_id: Optional[int] = None
    semester_id: Optional[int] = None
    semester: Optional[str] = None
    class_name: Optional[str] = None
    required_hours: Optional[float] = None
    required_periods: Optional[int] = None
    period_duration: Optional[str] = None
    allowed_working_days: Optional[List[int]] = None
    preferred_periods: Optional[List[str]] = None
    unavailable_periods: Optional[List[str]] = None
    max_periods_per_day: Optional[int] = None
    eligible_rooms: Optional[List[int]] = None
    is_primary: Optional[bool] = None
    assignment_status: Optional[str] = None

class TeacherAssignmentResponse(TeacherAssignmentBase):
    id: int
    org_id: int
    teacher_name: Optional[str] = None
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    department_name: Optional[str] = None
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

# Person
class SkillItem(BaseModel):
    name: str
    level: str = "Intermediate"  # Beginner, Intermediate, Expert
    verified: bool = True
    years: float = 1.0

class PersonBase(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    role_title: Optional[str] = None
    employee_code: str
    profession_type: str = "custom"
    qualifications: List[str] = []
    skills: List[Dict[str, Any]] = []
    inferred_skills: List[Dict[str, Any]] = []
    preferences: Dict[str, Any] = {}
    profession_metadata: Dict[str, Any] = {}
    department_id: Optional[int] = None
    max_hours_per_week: float = 40.0
    status: str = "active"
    hire_date: Optional[str] = None
    teacher_assignments: Optional[List[Dict[str, Any]]] = None

class PersonCreate(PersonBase):
    org_id: int

class PersonUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role_title: Optional[str] = None
    employee_code: Optional[str] = None
    profession_type: Optional[str] = None
    qualifications: Optional[List[str]] = None
    skills: Optional[List[Dict[str, Any]]] = None
    inferred_skills: Optional[List[Dict[str, Any]]] = None
    preferences: Optional[Dict[str, Any]] = None
    profession_metadata: Optional[Dict[str, Any]] = None
    department_id: Optional[int] = None
    max_hours_per_week: Optional[float] = None
    status: Optional[str] = None
    hire_date: Optional[str] = None
    teacher_assignments: Optional[List[Dict[str, Any]]] = None

class PersonResponse(PersonBase):
    id: int
    org_id: int
    data_quality_score: float
    created_at: datetime
    teacher_assignments: Optional[List[Dict[str, Any]]] = []
    class Config:
        from_attributes = True


# Resource
class ResourceBase(BaseModel):
    name: str
    type: str = "room"
    capacity: int = 30
    location: Optional[str] = None
    status: str = "available"

class ResourceCreate(ResourceBase):
    org_id: int

class ResourceResponse(ResourceBase):
    id: int
    org_id: int
    class Config:
        from_attributes = True

# Slot & Schedule
class SlotCreate(BaseModel):
    schedule_id: Optional[int] = None
    org_id: Optional[int] = None
    title: str
    date_str: Optional[str] = None
    day_of_week: int = 0
    start_time: str
    end_time: str
    department_id: Optional[int] = None
    resource_id: Optional[int] = None
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    required_skills: List[str] = []
    required_qualifications: List[str] = []
    min_experience_years: float = 0.0
    profession_metadata: Dict[str, Any] = {}
    min_staff: int = 1
    target_staff: int = 1
    max_staff: int = 1
    slot_order: int = 0
    is_locked: bool = False
    period_type: str = "work"

class SlotUpdate(BaseModel):
    title: Optional[str] = None
    date_str: Optional[str] = None
    day_of_week: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    department_id: Optional[int] = None
    resource_id: Optional[int] = None
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    required_skills: Optional[List[str]] = None
    required_qualifications: Optional[List[str]] = None
    profession_metadata: Optional[Dict[str, Any]] = None
    min_staff: Optional[int] = None
    target_staff: Optional[int] = None
    max_staff: Optional[int] = None
    slot_order: Optional[int] = None
    is_locked: Optional[bool] = None
    period_type: Optional[str] = None

class ScheduleGenerateRequest(BaseModel):
    org_id: int
    title: str
    period_start: str  # YYYY-MM-DD
    period_end: str    # YYYY-MM-DD
    fairness_weight: float = 1.0
    preference_weight: float = 1.0
    overtime_penalty_weight: float = 1.0
    regenerate_days: Optional[List[int]] = None
    only_unassigned: bool = False

class AssignmentUpdate(BaseModel):
    person_id: Optional[int] = None
    is_replacement: bool = False
    replacement_type: str = "manual"
    replacement_reason: Optional[str] = None

class DragDropAssignRequest(BaseModel):
    slot_id: int
    person_id: int
    override_conflicts: bool = False

class CopyWeekRequest(BaseModel):
    target_period_start: str
    target_period_end: str

# Leave
class LeaveRequestCreate(BaseModel):
    person_id: int
    org_id: int
    leave_type: str  # emergency, day_off, sick, mark_unavailable
    start_date: str
    end_date: str
    start_time: str = "00:00"
    end_time: str = "23:59"
    reason: str

class AvailabilityRuleUpdate(BaseModel):
    person_id: int
    rules: List[Dict[str, Any]]

# Search
class NaturalLanguageSearchRequest(BaseModel):
    org_id: int
    query: str
    top_k: int = 5

# Replacement
class ReplacementRecommendRequest(BaseModel):
    org_id: int
    assignment_id: int

class ReplacementApproveRequest(BaseModel):
    org_id: int
    assignment_id: int
    replacement_person_id: int
    replacement_type: str = "temporary"  # temporary, permanent
    reason: str

class ReturnToWorkRequest(BaseModel):
    org_id: int
    leave_request_id: int
    person_id: int

# Team Builder
class TeamBuilderRequest(BaseModel):
    org_id: int
    team_name: str
    required_roles: List[Dict[str, Any]]  # [{"title": "Frontend", "skills": ["React"], "count": 1}]
    min_complementarity: float = 0.7

# Holiday Management
class HolidayCreate(BaseModel):
    org_id: int
    department_id: Optional[int] = None
    name: str
    holiday_type: str = "public"  # public, regional, organization, department_specific, optional, custom, emergency_closure, special_working_day
    start_date: str
    end_date: str
    is_partial_day: bool = False
    partial_start_time: Optional[str] = None
    partial_end_time: Optional[str] = None
    is_recurring: bool = False
    location: Optional[str] = None
    description: Optional[str] = None
    essential_staffing_allowed: bool = False
    authorized_roles: List[str] = []

class HolidayUpdate(BaseModel):
    name: Optional[str] = None
    department_id: Optional[int] = None
    holiday_type: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_partial_day: Optional[bool] = None
    partial_start_time: Optional[str] = None
    partial_end_time: Optional[str] = None
    is_recurring: Optional[bool] = None
    location: Optional[str] = None
    description: Optional[str] = None
    essential_staffing_allowed: Optional[bool] = None
    authorized_roles: Optional[List[str]] = None
    status: Optional[str] = None

class HolidayExceptionCreate(BaseModel):
    org_id: int
    holiday_id: int
    person_id: int
    slot_id: Optional[int] = None
    reason: str
    authorized_by: str = "Administrator"

# Period Configuration
class PeriodConfigItem(BaseModel):
    name: str
    type: str = "lecture"  # lecture, lab, break, lunch, tutorial, other, work
    start_time: str
    end_time: str
    duration_minutes: Optional[int] = None
    duration_hours: Optional[float] = None
    is_active: bool = True
    min_staff: int = 1
    target_staff: int = 1
    max_staff: int = 1

class DayPeriodConfig(BaseModel):
    day_name: str
    is_working_day: bool = True
    periods: List[PeriodConfigItem] = []

class PeriodConfigPayload(BaseModel):
    working_days_schedule: Dict[str, Any]

# GLIXON Intelligent Timetable Generator
class GlixonGenerateRequest(BaseModel):
    org_id: int
    schedule_id: Optional[int] = None
    title: str = "GLIXON Optimized Timetable"
    period_start: str
    period_end: str
    preview: bool = True
    fairness_weight: float = 1.0
    preference_weight: float = 1.0
    overtime_penalty_weight: float = 1.0
    selected_teacher_ids: Optional[List[int]] = None
    selected_semesters: Optional[List[str]] = None

class GlixonCommitRequest(BaseModel):
    org_id: int
    schedule_id: Optional[int] = None
    title: str = "GLIXON Master Timetable"
    period_start: str
    period_end: str
    assignments: List[Dict[str, Any]]
