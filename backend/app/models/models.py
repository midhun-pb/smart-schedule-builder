from sqlalchemy import Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    type = Column(String(50), nullable=False)  # college, company, hospital, factory, airline, etc.
    code = Column(String(50), unique=True, index=True)
    description = Column(Text, nullable=True)
    settings_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utc_now)

    departments = relationship("Department", back_populates="organization", cascade="all, delete-orphan")
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    people = relationship("Person", back_populates="organization", cascade="all, delete-orphan")
    resources = relationship("Resource", back_populates="organization", cascade="all, delete-orphan")
    schedules = relationship("Schedule", back_populates="organization", cascade="all, delete-orphan")
    holidays = relationship("Holiday", back_populates="organization", cascade="all, delete-orphan")


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(150), nullable=False)
    code = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)

    organization = relationship("Organization", back_populates="departments")
    people = relationship("Person", back_populates="department")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    email = Column(String(200), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False)
    role = Column(String(50), default="employee")  # admin, manager, employee
    is_active = Column(Boolean, default=True)
    person_id = Column(Integer, ForeignKey("people.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=utc_now)

    organization = relationship("Organization", back_populates="users")
    person = relationship("Person", back_populates="user_account", foreign_keys=[person_id])


class Person(Base):
    __tablename__ = "people"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(150), nullable=False)
    email = Column(String(200), index=True, nullable=False)
    phone = Column(String(50), nullable=True)
    role_title = Column(String(100), nullable=True)  # Assistant Professor, Lead Dev, RN Nurse, etc.
    employee_code = Column(String(50), index=True, nullable=False)
    profession_type = Column(String(50), default="custom")
    
    # Qualifications & Skills
    qualifications = Column(JSON, default=list)  # ["M.Tech CSE", "Ph.D AI"]
    skills = Column(JSON, default=list)  # [{"name": "DBMS", "level": "Expert", "verified": true, "years": 5}]
    inferred_skills = Column(JSON, default=list)  # [{"name": "SQL Tuning", "confidence": 0.88, "reason": "Associated with DBMS"}]
    
    # Preferences & Limits
    preferences = Column(JSON, default=dict)  # {"preferred_shifts": ["morning"], "max_hours_per_day": 8, "avoid_days": []}
    profession_metadata = Column(JSON, default=dict)  # {"semesters": ["S5"], "theory_lab": "both", "classes": ["CSE-A"]}
    
    status = Column(String(50), default="active")  # active, inactive, on_leave
    max_hours_per_week = Column(Float, default=40.0)
    data_quality_score = Column(Float, default=100.0)
    hire_date = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=utc_now)

    organization = relationship("Organization", back_populates="people")
    department = relationship("Department", back_populates="people")
    user_account = relationship("User", back_populates="person", uselist=False, foreign_keys=[User.person_id])
    availability_rules = relationship("AvailabilityRule", back_populates="person", cascade="all, delete-orphan")
    leave_requests = relationship("LeaveRequest", back_populates="person", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="person", foreign_keys="Assignment.person_id")


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    type = Column(String(50), default="room")  # room, lab, ward, vehicle, equipment
    capacity = Column(Integer, default=30)
    location = Column(String(100), nullable=True)
    status = Column(String(50), default="available")  # available, maintenance

    organization = relationship("Organization", back_populates="resources")


class ShiftTemplate(Base):
    __tablename__ = "shift_templates"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    start_time = Column(String(10), nullable=False)  # "09:00"
    end_time = Column(String(10), nullable=False)    # "17:00"
    day_of_week = Column(Integer, default=-1)        # -1 = any day, 0=Mon, 6=Sun
    profession_type = Column(String(50), default="all")
    default_slots = Column(Integer, default=1)


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    period_start = Column(String(20), nullable=False)  # "2026-10-12"
    period_end = Column(String(20), nullable=False)    # "2026-10-18"
    status = Column(String(50), default="draft")       # draft, published, archived
    version = Column(Integer, default=1)
    fairness_score = Column(Float, default=95.0)
    total_assignments = Column(Integer, default=0)
    conflict_count = Column(Integer, default=0)
    created_by = Column(String(150), default="System")
    created_at = Column(DateTime, default=utc_now)

    organization = relationship("Organization", back_populates="schedules")
    slots = relationship("RequirementSlot", back_populates="schedule", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="schedule", cascade="all, delete-orphan")
    versions = relationship("ScheduleVersion", back_populates="schedule", cascade="all, delete-orphan")


class RequirementSlot(Base):
    __tablename__ = "requirement_slots"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    schedule_id = Column(Integer, ForeignKey("schedules.id", ondelete="CASCADE"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    resource_id = Column(Integer, ForeignKey("resources.id", ondelete="SET NULL"), nullable=True)
    
    title = Column(String(200), nullable=False)  # "DBMS Lecture", "Emergency Ward Shift"
    date_str = Column(String(20), nullable=True)  # "2026-10-12"
    day_of_week = Column(Integer, default=0)     # 0=Monday, 6=Sunday
    start_time = Column(String(10), nullable=False)  # "10:00"
    end_time = Column(String(10), nullable=False)    # "11:00"
    
    required_skills = Column(JSON, default=list)  # ["DBMS", "SQL"]
    required_qualifications = Column(JSON, default=list)  # ["M.Tech"]
    min_experience_years = Column(Float, default=0.0)
    profession_metadata = Column(JSON, default=dict)  # {"subject": "DBMS", "semester": "S5", "class": "CSE", "lab": false}

    # Staffing requirements & slot customization
    min_staff = Column(Integer, default=1)
    target_staff = Column(Integer, default=1)
    max_staff = Column(Integer, default=1)
    slot_order = Column(Integer, default=0)
    is_locked = Column(Boolean, default=False)
    period_type = Column(String(50), default="work")  # work, break, lunch, meeting

    schedule = relationship("Schedule", back_populates="slots")
    department = relationship("Department")
    resource = relationship("Resource")
    assignments = relationship("Assignment", back_populates="slot", cascade="all, delete-orphan")

    @property
    def assignment(self):
        return self.assignments[0] if self.assignments else None


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False)
    slot_id = Column(Integer, ForeignKey("requirement_slots.id", ondelete="CASCADE"), nullable=False)
    person_id = Column(Integer, ForeignKey("people.id", ondelete="SET NULL"), nullable=True)
    original_person_id = Column(Integer, ForeignKey("people.id", ondelete="SET NULL"), nullable=True)
    
    is_replacement = Column(Boolean, default=False)
    replacement_type = Column(String(50), default="none")  # none, temporary, permanent, swap
    replacement_reason = Column(Text, nullable=True)
    
    status = Column(String(50), default="assigned")  # assigned, completed, cancelled, pending_return
    date_str = Column(String(20), nullable=True)
    start_time = Column(String(10), nullable=True)
    end_time = Column(String(10), nullable=True)

    schedule = relationship("Schedule", back_populates="assignments")
    slot = relationship("RequirementSlot", back_populates="assignments")
    person = relationship("Person", back_populates="assignments", foreign_keys=[person_id])
    original_person = relationship("Person", foreign_keys=[original_person_id])


class AvailabilityRule(Base):
    __tablename__ = "availability_rules"

    id = Column(Integer, primary_key=True, index=True)
    person_id = Column(Integer, ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0=Monday ... 6=Sunday
    start_time = Column(String(10), nullable=False)  # "09:00"
    end_time = Column(String(10), nullable=False)    # "17:00"
    is_available = Column(Boolean, default=True)
    preference_level = Column(Integer, default=5)   # 1=strongly avoid, 5=strongly prefer

    person = relationship("Person", back_populates="availability_rules")


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    person_id = Column(Integer, ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    leave_type = Column(String(50), nullable=False)  # emergency, day_off, sick, mark_unavailable
    start_date = Column(String(20), nullable=False)  # "2026-10-12"
    end_date = Column(String(20), nullable=False)    # "2026-10-12"
    start_time = Column(String(10), default="00:00")
    end_time = Column(String(10), default="23:59")
    reason = Column(Text, nullable=False)
    status = Column(String(50), default="pending")  # pending, approved, rejected, emergency_recorded, cancelled
    
    affected_slots_count = Column(Integer, default=0)
    replacement_search_started = Column(Boolean, default=False)
    return_confirmed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)

    person = relationship("Person", back_populates="leave_requests")


class SwapRequest(Base):
    __tablename__ = "swap_requests"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    requester_id = Column(Integer, ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    requester_assignment_id = Column(Integer, ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False)
    target_person_id = Column(Integer, ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    target_assignment_id = Column(Integer, ForeignKey("assignments.id", ondelete="CASCADE"), nullable=True)
    reason = Column(Text, nullable=True)
    status = Column(String(50), default="pending")  # pending, approved, rejected, cancelled
    approved_by = Column(String(150), nullable=True)
    created_at = Column(DateTime, default=utc_now)

    requester = relationship("Person", foreign_keys=[requester_id])
    target_person = relationship("Person", foreign_keys=[target_person_id])
    requester_assignment = relationship("Assignment", foreign_keys=[requester_assignment_id])
    target_assignment = relationship("Assignment", foreign_keys=[target_assignment_id])


class ReplacementLog(Base):
    __tablename__ = "replacement_logs"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    assignment_id = Column(Integer, ForeignKey("assignments.id", ondelete="SET NULL"), nullable=True)
    slot_id = Column(Integer, ForeignKey("requirement_slots.id", ondelete="SET NULL"), nullable=True)
    original_person_id = Column(Integer, ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    replacement_person_id = Column(Integer, ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    
    reason = Column(Text, nullable=True)
    replacement_type = Column(String(50), default="temporary")  # temporary, permanent, manual
    match_score = Column(Float, default=90.0)
    match_explanation = Column(JSON, default=dict)
    status = Column(String(50), default="active")  # active, restored, cancelled
    
    date_str = Column(String(20), nullable=True)
    original_start_time = Column(String(10), nullable=True)
    original_end_time = Column(String(10), nullable=True)
    can_restore = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=utc_now)
    restored_at = Column(DateTime, nullable=True)

    original_person = relationship("Person", foreign_keys=[original_person_id])
    replacement_person = relationship("Person", foreign_keys=[replacement_person_id])


class ScheduleVersion(Base):
    __tablename__ = "schedule_versions"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    schedule_id = Column(Integer, ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False)
    snapshot_json = Column(JSON, nullable=False)
    change_summary = Column(Text, nullable=True)
    created_by = Column(String(150), default="System")
    created_at = Column(DateTime, default=utc_now)

    schedule = relationship("Schedule", back_populates="versions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)  # e.g., "SCHEDULE_GENERATE", "EMERGENCY_LEAVE", "REPLACEMENT_APPROVE"
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(50), nullable=True)
    details = Column(JSON, default=dict)
    timestamp = Column(DateTime, default=utc_now)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)  # None = org-wide
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    category = Column(String(50), default="system")  # leave, replacement, conflict, schedule, swap, system
    is_read = Column(Boolean, default=False)
    link_url = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=utc_now)


class OrgSetting(Base):
    __tablename__ = "org_settings"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    key = Column(String(100), nullable=False)
    value = Column(JSON, nullable=False)


class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(200), nullable=False)
    holiday_type = Column(String(50), default="public")  # public, regional, organization, department_specific, optional, custom, emergency_closure, special_working_day
    start_date = Column(String(20), nullable=False)  # "2026-10-12"
    end_date = Column(String(20), nullable=False)    # "2026-10-12"
    is_partial_day = Column(Boolean, default=False)
    partial_start_time = Column(String(10), nullable=True)  # "13:00"
    partial_end_time = Column(String(10), nullable=True)    # "18:00"
    is_recurring = Column(Boolean, default=False)
    location = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    essential_staffing_allowed = Column(Boolean, default=False)
    authorized_roles = Column(JSON, default=list)  # ["RN Nurse", "Physician"]
    status = Column(String(50), default="active")  # active, archived
    created_at = Column(DateTime, default=utc_now)

    organization = relationship("Organization", back_populates="holidays")
    department = relationship("Department")
    exceptions = relationship("HolidayException", back_populates="holiday", cascade="all, delete-orphan")


class HolidayException(Base):
    __tablename__ = "holiday_exceptions"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    holiday_id = Column(Integer, ForeignKey("holidays.id", ondelete="CASCADE"), nullable=False)
    person_id = Column(Integer, ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    slot_id = Column(Integer, ForeignKey("requirement_slots.id", ondelete="SET NULL"), nullable=True)
    reason = Column(Text, nullable=False)
    authorized_by = Column(String(150), default="Administrator")
    created_at = Column(DateTime, default=utc_now)

    holiday = relationship("Holiday", back_populates="exceptions")
    person = relationship("Person")
