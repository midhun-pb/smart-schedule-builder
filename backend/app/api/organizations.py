from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import datetime
from app.core.database import get_db
from app.models.models import Organization, Department, ShiftTemplate, Resource, Schedule, RequirementSlot, User, AuditLog, Subject, Person, Semester, TeacherSubjectAssignment
from app.schemas.schemas import (
    OrganizationCreate, OrganizationResponse,
    DepartmentCreate, DepartmentUpdate, DepartmentResponse,
    SubjectCreate, SubjectUpdate, SubjectResponse,
    SemesterCreate, SemesterUpdate, SemesterResponse,
    TeacherAssignmentCreate, TeacherAssignmentUpdate, TeacherAssignmentResponse
)
from pydantic import BaseModel

router = APIRouter(prefix="/organizations", tags=["organizations"])

def get_default_working_days_schedule(org_type: str) -> Dict[str, Any]:
    """
    Generates realistic independent Monday to Sunday working schedule
    with customizable periods, breaks, and lunches for each profession.
    """
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    is_24_7 = org_type in ["hospital", "factory", "airline", "railway", "hotel", "police", "fire_department", "logistics"]

    schedule = {}
    for day_idx, day_name in enumerate(day_names):
        if is_24_7:
            # 24/7 rotating three-shift schedule
            schedule[str(day_idx)] = {
                "day_name": day_name,
                "is_working_day": True,
                "periods": [
                    {"name": "Morning Shift (Shift 1)", "type": "work", "start_time": "07:00", "end_time": "15:00", "min_staff": 2, "target_staff": 3},
                    {"name": "Shift Handover & Meal Break", "type": "break", "start_time": "15:00", "end_time": "15:30", "min_staff": 0, "target_staff": 0},
                    {"name": "Evening Shift (Shift 2)", "type": "work", "start_time": "15:30", "end_time": "23:00", "min_staff": 2, "target_staff": 3},
                    {"name": "Night Graveyard (Shift 3)", "type": "work", "start_time": "23:00", "end_time": "07:00", "min_staff": 1, "target_staff": 2},
                ]
            }
        elif day_idx < 5:
            # Monday through Friday standard professional schedule with work periods & breaks
            schedule[str(day_idx)] = {
                "day_name": day_name,
                "is_working_day": True,
                "periods": [
                    {"name": "Morning Work Period 1", "type": "work", "start_time": "09:00", "end_time": "11:00", "min_staff": 1, "target_staff": 1},
                    {"name": "Morning Refreshment Break", "type": "break", "start_time": "11:00", "end_time": "11:15", "min_staff": 0, "target_staff": 0},
                    {"name": "Mid-Day Work Period 2", "type": "work", "start_time": "11:15", "end_time": "13:00", "min_staff": 1, "target_staff": 1},
                    {"name": "Lunch Break", "type": "lunch", "start_time": "13:00", "end_time": "14:00", "min_staff": 0, "target_staff": 0},
                    {"name": "Afternoon Work Period 3", "type": "work", "start_time": "14:00", "end_time": "16:30", "min_staff": 1, "target_staff": 1},
                ]
            }
        elif day_idx == 5 and org_type in ["college", "retail", "restaurant"]:
            # Saturday half-day or retail shift
            schedule[str(day_idx)] = {
                "day_name": day_name,
                "is_working_day": True,
                "periods": [
                    {"name": "Saturday Morning Session", "type": "work", "start_time": "09:00", "end_time": "13:00", "min_staff": 1, "target_staff": 1}
                ]
            }
        else:
            # Weekend Day Off
            schedule[str(day_idx)] = {
                "day_name": day_name,
                "is_working_day": False,
                "periods": []
            }

    return schedule

def get_default_profession_settings(org_type: str) -> Dict[str, Any]:
    defaults = {
        "college": {
            "semesters": ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"],
            "period_duration_minutes": 60,
            "theory_lab_ratio": "70:30",
            "max_daily_lectures_per_faculty": 4
        },
        "company": {
            "core_hours_start": "10:00",
            "core_hours_end": "16:00",
            "flex_time_allowed": True,
            "on_call_rotation": "Weekly"
        },
        "hospital": {
            "shift_rotation": "24/7",
            "min_nurse_patient_ratio": "1:4",
            "on_call_required": True,
            "min_rest_hours_between_shifts": 11
        },
        "factory": {
            "shifts_per_day": 3,
            "safety_briefing_minutes": 15,
            "maintenance_window": "Sunday 00:00-08:00"
        },
        "airline": {
            "max_flight_duty_hours": 12,
            "min_rest_hours": 10,
            "captain_first_officer_pairing": True
        },
        "railway": {
            "locomotive_pilot_continuous_hours": 8,
            "station_master_shift": "8-hour rotational"
        },
        "hotel": {
            "front_desk_rotation": "24/7",
            "housekeeping_turnover_window": "09:00-15:00"
        },
        "restaurant": {
            "kitchen_prep_start": "08:00",
            "peak_dinner_rush": "18:00-22:00"
        },
        "police": {
            "watch_rotation": "Alpha/Bravo/Charlie",
            "patrol_shift_hours": 8
        },
        "fire_department": {
            "shift_pattern": "24/48 Rotation",
            "apparatus_check_hour": "07:00"
        },
        "logistics": {
            "fleet_dispatch_window": "05:00-23:00",
            "driver_rest_interval_hours": 4.5
        },
        "retail": {
            "store_opening_time": "10:00",
            "store_closing_time": "21:00",
            "peak_weekend_staffing": True
        },
        "construction": {
            "site_work_window": "07:00-16:00",
            "safety_toolbox_talk_hour": "07:00"
        },
        "it_team": {
            "sprint_duration_weeks": 2,
            "scrum_ceremonies": ["Daily Standup", "Sprint Planning", "Retrospective"]
        },
        "custom": {
            "custom_operating_model": "Flexible"
        }
    }
    return defaults.get(org_type, {"custom_operating_model": "Flexible"})

PRESET_ORGANIZATIONS = [
    {
        "type": "college",
        "name": "University / College",
        "icon": "GraduationCap",
        "description": "Semester-based timetable, theory vs lab periods, faculty workload limits, and subject specializations.",
        "default_departments": ["Computer Science & Eng", "Electronics & Comm", "Mechanical Eng", "Mathematics", "Humanities"],
        "default_roles": ["Professor", "Associate Professor", "Assistant Professor", "Lab Instructor"],
        "profession_label": "Faculty / Teacher",
        "resource_types": ["Lecture Hall 101", "Computer Lab A", "Seminar Hall", "Electronics Lab"]
    },
    {
        "type": "company",
        "name": "Company / Office",
        "icon": "Building2",
        "description": "Standard business shifts, project teams, sprint allocations, and on-call rotations.",
        "default_departments": ["Engineering", "Product Design", "Marketing", "Customer Success", "Human Resources"],
        "default_roles": ["Senior Engineer", "Product Manager", "Tech Lead", "UX Specialist", "DevOps Engineer"],
        "profession_label": "Employee",
        "resource_types": ["Conference Room Alpha", "Boardroom", "Podcast Studio", "Quiet Pod"]
    },
    {
        "type": "airline",
        "name": "Aviation / Airline",
        "icon": "Plane",
        "description": "Flight crew pairing, FAA rest regulations, captain/first-officer certifications, and cabin attendants.",
        "default_departments": ["Flight Operations", "Cabin Crew", "Ground Operations", "Maintenance Dispatch"],
        "default_roles": ["Captain", "First Officer", "Lead Flight Attendant", "Cabin Crew Member", "Dispatcher"],
        "profession_label": "Flight Crew / Pilot",
        "resource_types": ["Boeing 737-800 Gate A1", "Airbus A320 Gate B4", "Crew Briefing Room"]
    }
]

@router.get("/presets")
def get_preset_organizations():
    # Enrich presets with working_days_schedule and profession_settings
    results = []
    for p in PRESET_ORGANIZATIONS:
        copy_p = p.copy()
        copy_p["default_working_days_schedule"] = get_default_working_days_schedule(p["type"])
        copy_p["default_profession_settings"] = get_default_profession_settings(p["type"])
        results.append(copy_p)
    return results

@router.get("")
def list_organizations(db: Session = Depends(get_db)):
    orgs = db.query(Organization).order_by(Organization.created_at.desc()).all()
    return [
        {
            "id": o.id,
            "name": o.name,
            "type": o.type,
            "code": o.code,
            "description": o.description,
            "settings_json": o.settings_json or {},
            "created_at": o.created_at.isoformat() if o.created_at else None
        }
        for o in orgs
    ]

@router.get("/{org_id}")
def get_organization(org_id: int, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return {
        "id": org.id,
        "name": org.name,
        "type": org.type,
        "code": org.code,
        "description": org.description,
        "settings_json": org.settings_json or {},
        "created_at": org.created_at.isoformat() if org.created_at else None
    }

@router.get("/{org_id}/departments")
def list_organization_departments(org_id: int, db: Session = Depends(get_db)):
    depts = db.query(Department).filter(Department.org_id == org_id).all()
    return [
        {
            "id": d.id,
            "org_id": d.org_id,
            "name": d.name,
            "code": d.code,
            "description": d.description
        }
        for d in depts
    ]

@router.post("/{org_id}/departments")
def create_department(org_id: int, payload: DepartmentCreate, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    clean_name = payload.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Department name is required")

    clean_code = (payload.code.strip() if payload.code else clean_name[:4].upper()).replace(" ", "")
    dept = Department(
        org_id=org_id,
        name=clean_name,
        code=clean_code,
        description=payload.description or ""
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return {
        "id": dept.id,
        "org_id": dept.org_id,
        "name": dept.name,
        "code": dept.code,
        "description": dept.description
    }

@router.put("/{org_id}/departments/{dept_id}")
def update_department(org_id: int, dept_id: int, payload: DepartmentUpdate, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == dept_id, Department.org_id == org_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    if payload.name is not None and payload.name.strip():
        dept.name = payload.name.strip()
    if payload.code is not None and payload.code.strip():
        dept.code = payload.code.strip()
    if payload.description is not None:
        dept.description = payload.description.strip()

    db.commit()
    return {
        "id": dept.id,
        "org_id": dept.org_id,
        "name": dept.name,
        "code": dept.code,
        "description": dept.description
    }

@router.delete("/{org_id}/departments/{dept_id}")
def delete_department(org_id: int, dept_id: int, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == dept_id, Department.org_id == org_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    db.delete(dept)
    db.commit()
    return {"success": True, "message": "Department deleted"}

# --- Semester Management Endpoints ---

@router.get("/{org_id}/semesters")
def list_organization_semesters(org_id: int, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    semesters = db.query(Semester).filter(Semester.org_id == org_id).order_by(Semester.code.asc()).all()
    if not semesters and org.type in ["college", "university"]:
        default_sems = [
            ("Semester 1", "S1", "2026-2027"),
            ("Semester 3", "S3", "2026-2027"),
            ("Semester 5", "S5", "2026-2027"),
            ("Semester 7", "S7", "2026-2027"),
        ]
        for s_name, s_code, a_yr in default_sems:
            new_sem = Semester(
                org_id=org_id,
                name=s_name,
                code=s_code,
                academic_year=a_yr,
                is_active=True
            )
            db.add(new_sem)
        db.commit()
        semesters = db.query(Semester).filter(Semester.org_id == org_id).order_by(Semester.code.asc()).all()

    sub_counts = {}
    for sem in semesters:
        count = db.query(Subject).filter(
            Subject.org_id == org_id,
            (Subject.semester_id == sem.id) | (Subject.semester == sem.code)
        ).count()
        sub_counts[sem.id] = count

    return [
        {
            "id": sem.id,
            "org_id": sem.org_id,
            "name": sem.name,
            "code": sem.code,
            "academic_year": sem.academic_year,
            "start_date": sem.start_date,
            "end_date": sem.end_date,
            "is_active": sem.is_active,
            "subject_count": sub_counts.get(sem.id, 0),
            "created_at": sem.created_at.isoformat() if sem.created_at else None
        }
        for sem in semesters
    ]

@router.post("/{org_id}/semesters")
def create_semester(org_id: int, payload: SemesterCreate, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    clean_name = payload.name.strip()
    clean_code = (payload.code.strip() if payload.code else clean_name[:4].upper()).replace(" ", "")
    if not clean_name or not clean_code:
        raise HTTPException(status_code=400, detail="Semester name and code are required")

    sem = Semester(
        org_id=org_id,
        name=clean_name,
        code=clean_code,
        academic_year=payload.academic_year or "2026-2027",
        start_date=payload.start_date,
        end_date=payload.end_date,
        is_active=payload.is_active
    )
    db.add(sem)
    db.commit()
    db.refresh(sem)
    return {
        "id": sem.id,
        "org_id": sem.org_id,
        "name": sem.name,
        "code": sem.code,
        "academic_year": sem.academic_year,
        "start_date": sem.start_date,
        "end_date": sem.end_date,
        "is_active": sem.is_active,
        "subject_count": 0
    }

@router.put("/{org_id}/semesters/{semester_id}")
def update_semester(org_id: int, semester_id: int, payload: SemesterUpdate, db: Session = Depends(get_db)):
    sem = db.query(Semester).filter(Semester.id == semester_id, Semester.org_id == org_id).first()
    if not sem:
        raise HTTPException(status_code=404, detail="Semester not found")

    if payload.name is not None and payload.name.strip():
        sem.name = payload.name.strip()
    if payload.code is not None and payload.code.strip():
        sem.code = payload.code.strip()
    if payload.academic_year is not None:
        sem.academic_year = payload.academic_year.strip()
    if payload.start_date is not None:
        sem.start_date = payload.start_date
    if payload.end_date is not None:
        sem.end_date = payload.end_date
    if payload.is_active is not None:
        sem.is_active = payload.is_active

    db.commit()
    return {
        "id": sem.id,
        "org_id": sem.org_id,
        "name": sem.name,
        "code": sem.code,
        "academic_year": sem.academic_year,
        "start_date": sem.start_date,
        "end_date": sem.end_date,
        "is_active": sem.is_active
    }

@router.delete("/{org_id}/semesters/{semester_id}")
def delete_semester(org_id: int, semester_id: int, db: Session = Depends(get_db)):
    sem = db.query(Semester).filter(Semester.id == semester_id, Semester.org_id == org_id).first()
    if not sem:
        raise HTTPException(status_code=404, detail="Semester not found")

    db.delete(sem)
    db.commit()
    return {"success": True, "message": "Semester deleted successfully"}

# --- Subject Management Endpoints ---

@router.get("/{org_id}/subjects")
def list_organization_subjects(
    org_id: int,
    department_id: Optional[int] = None,
    semester: Optional[str] = None,
    semester_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Subject).filter(Subject.org_id == org_id)
    if department_id:
        query = query.filter(Subject.department_id == department_id)
    if semester:
        query = query.filter(Subject.semester == semester)
    if semester_id:
        query = query.filter(Subject.semester_id == semester_id)
    subjects = query.order_by(Subject.name.asc()).all()
    
    dept_map = {d.id: d.name for d in db.query(Department).filter(Department.org_id == org_id).all()}
    sem_map = {s.id: s.name for s in db.query(Semester).filter(Semester.org_id == org_id).all()}
    
    # Pre-fetch teacher-subject assignments
    teacher_assigns = db.query(TeacherSubjectAssignment).filter(TeacherSubjectAssignment.org_id == org_id).all()
    teacher_map = {}
    for ta in teacher_assigns:
        teacher_map.setdefault(ta.subject_id, []).append({
            "assignment_id": ta.id,
            "person_id": ta.person_id,
            "teacher_name": ta.teacher.name if ta.teacher else "Unassigned",
            "semester": ta.semester,
            "class_name": ta.class_name,
            "required_hours": ta.required_hours
        })

    return [
        {
            "id": s.id,
            "org_id": s.org_id,
            "department_id": s.department_id,
            "department_name": dept_map.get(s.department_id, "General"),
            "semester_id": s.semester_id,
            "semester_name": sem_map.get(s.semester_id, s.semester or "Semester"),
            "name": s.name,
            "code": s.code,
            "semester": s.semester,
            "class_name": s.class_name,
            "required_hours_per_week": s.required_hours_per_week,
            "is_lab": s.is_lab,
            "description": s.description,
            "assigned_teachers": teacher_map.get(s.id, []),
            "created_at": s.created_at.isoformat() if s.created_at else None
        }
        for s in subjects
    ]

@router.post("/{org_id}/subjects")
def create_subject(org_id: int, payload: SubjectCreate, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    clean_name = payload.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Subject name is required")

    clean_code = (payload.code.strip() if payload.code else clean_name[:4].upper()).replace(" ", "")

    sem_id = payload.semester_id
    sem_str = payload.semester.strip() if payload.semester else None
    if not sem_id and sem_str:
        sem_obj = db.query(Semester).filter(Semester.org_id == org_id, Semester.code == sem_str).first()
        if sem_obj:
            sem_id = sem_obj.id

    sub = Subject(
        org_id=org_id,
        department_id=payload.department_id,
        semester_id=sem_id,
        name=clean_name,
        code=clean_code,
        semester=sem_str,
        class_name=payload.class_name.strip() if payload.class_name else None,
        required_hours_per_week=payload.required_hours_per_week or 4.0,
        is_lab=bool(payload.is_lab),
        description=payload.description or ""
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return {
        "id": sub.id,
        "org_id": sub.org_id,
        "department_id": sub.department_id,
        "semester_id": sub.semester_id,
        "name": sub.name,
        "code": sub.code,
        "semester": sub.semester,
        "class_name": sub.class_name,
        "required_hours_per_week": sub.required_hours_per_week,
        "is_lab": sub.is_lab,
        "description": sub.description
    }

@router.put("/{org_id}/subjects/{subject_id}")
def update_subject(org_id: int, subject_id: int, payload: SubjectUpdate, db: Session = Depends(get_db)):
    sub = db.query(Subject).filter(Subject.id == subject_id, Subject.org_id == org_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")

    if payload.name is not None and payload.name.strip():
        sub.name = payload.name.strip()
    if payload.code is not None and payload.code.strip():
        sub.code = payload.code.strip()
    if payload.department_id is not None:
        sub.department_id = payload.department_id
    if payload.semester_id is not None:
        sub.semester_id = payload.semester_id
    if payload.semester is not None:
        sub.semester = payload.semester.strip()
    if payload.class_name is not None:
        sub.class_name = payload.class_name.strip()
    if payload.required_hours_per_week is not None:
        sub.required_hours_per_week = payload.required_hours_per_week
    if payload.is_lab is not None:
        sub.is_lab = payload.is_lab
    if payload.description is not None:
        sub.description = payload.description.strip()

    db.commit()
    return {
        "id": sub.id,
        "org_id": sub.org_id,
        "department_id": sub.department_id,
        "semester_id": sub.semester_id,
        "name": sub.name,
        "code": sub.code,
        "semester": sub.semester,
        "class_name": sub.class_name,
        "required_hours_per_week": sub.required_hours_per_week,
        "is_lab": sub.is_lab,
        "description": sub.description
    }

@router.delete("/{org_id}/subjects/{subject_id}")
def delete_subject(org_id: int, subject_id: int, db: Session = Depends(get_db)):
    sub = db.query(Subject).filter(Subject.id == subject_id, Subject.org_id == org_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")

    db.delete(sub)
    db.commit()
    return {"success": True, "message": "Subject deleted"}

# --- Teacher-Subject Assignment Endpoints ---

@router.get("/{org_id}/teacher-assignments")
def list_teacher_assignments(
    org_id: int,
    person_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    semester: Optional[str] = None,
    department_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(TeacherSubjectAssignment).filter(TeacherSubjectAssignment.org_id == org_id)
    if person_id:
        query = query.filter(TeacherSubjectAssignment.person_id == person_id)
    if subject_id:
        query = query.filter(TeacherSubjectAssignment.subject_id == subject_id)
    if semester:
        query = query.filter(TeacherSubjectAssignment.semester == semester)
    if department_id:
        query = query.filter(TeacherSubjectAssignment.department_id == department_id)

    assignments = query.all()
    return [
        {
            "id": a.id,
            "org_id": a.org_id,
            "person_id": a.person_id,
            "teacher_name": a.teacher.name if a.teacher else "Unknown",
            "subject_id": a.subject_id,
            "subject_name": a.subject.name if a.subject else "Unknown",
            "subject_code": a.subject.code if a.subject else "",
            "department_id": a.department_id,
            "department_name": a.department.name if a.department else "General",
            "semester_id": a.semester_id,
            "semester": a.semester or (a.semester_rel.code if a.semester_rel else None),
            "class_name": a.class_name,
            "required_hours": a.required_hours,
            "eligible_rooms": a.eligible_rooms or [],
            "is_primary": a.is_primary,
            "created_at": a.created_at.isoformat() if a.created_at else None
        }
        for a in assignments
    ]

@router.post("/{org_id}/teacher-assignments")
def create_teacher_assignment(org_id: int, payload: TeacherAssignmentCreate, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    teacher = db.query(Person).filter(Person.id == payload.person_id, Person.org_id == org_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    subject = db.query(Subject).filter(Subject.id == payload.subject_id, Subject.org_id == org_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Prevent duplicate assignment for same teacher + subject + class
    existing = db.query(TeacherSubjectAssignment).filter(
        TeacherSubjectAssignment.org_id == org_id,
        TeacherSubjectAssignment.person_id == payload.person_id,
        TeacherSubjectAssignment.subject_id == payload.subject_id,
        TeacherSubjectAssignment.class_name == payload.class_name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="This teacher is already assigned to this subject for this class")

    sem_val = payload.semester or subject.semester
    dept_id = payload.department_id or subject.department_id or teacher.department_id
    sem_id = payload.semester_id or subject.semester_id

    assign = TeacherSubjectAssignment(
        org_id=org_id,
        person_id=payload.person_id,
        subject_id=payload.subject_id,
        department_id=dept_id,
        semester_id=sem_id,
        semester=sem_val,
        class_name=payload.class_name or subject.class_name,
        required_hours=payload.required_hours or subject.required_hours_per_week or 4.0,
        eligible_rooms=payload.eligible_rooms or [],
        is_primary=payload.is_primary
    )
    db.add(assign)
    db.commit()
    db.refresh(assign)

    return {
        "id": assign.id,
        "org_id": assign.org_id,
        "person_id": assign.person_id,
        "teacher_name": teacher.name,
        "subject_id": assign.subject_id,
        "subject_name": subject.name,
        "subject_code": subject.code,
        "department_id": assign.department_id,
        "semester_id": assign.semester_id,
        "semester": assign.semester,
        "class_name": assign.class_name,
        "required_hours": assign.required_hours,
        "eligible_rooms": assign.eligible_rooms,
        "is_primary": assign.is_primary
    }

@router.put("/{org_id}/teacher-assignments/{assignment_id}")
def update_teacher_assignment(org_id: int, assignment_id: int, payload: TeacherAssignmentUpdate, db: Session = Depends(get_db)):
    assign = db.query(TeacherSubjectAssignment).filter(
        TeacherSubjectAssignment.id == assignment_id,
        TeacherSubjectAssignment.org_id == org_id
    ).first()
    if not assign:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if payload.person_id is not None:
        assign.person_id = payload.person_id
    if payload.subject_id is not None:
        assign.subject_id = payload.subject_id
    if payload.department_id is not None:
        assign.department_id = payload.department_id
    if payload.semester_id is not None:
        assign.semester_id = payload.semester_id
    if payload.semester is not None:
        assign.semester = payload.semester
    if payload.class_name is not None:
        assign.class_name = payload.class_name
    if payload.required_hours is not None:
        assign.required_hours = payload.required_hours
    if payload.eligible_rooms is not None:
        assign.eligible_rooms = payload.eligible_rooms
    if payload.is_primary is not None:
        assign.is_primary = payload.is_primary

    db.commit()
    return {"success": True, "id": assign.id}

@router.delete("/{org_id}/teacher-assignments/{assignment_id}")
def delete_teacher_assignment(org_id: int, assignment_id: int, db: Session = Depends(get_db)):
    assign = db.query(TeacherSubjectAssignment).filter(
        TeacherSubjectAssignment.id == assignment_id,
        TeacherSubjectAssignment.org_id == org_id
    ).first()
    if not assign:
        raise HTTPException(status_code=404, detail="Assignment not found")

    db.delete(assign)
    db.commit()
    return {"success": True, "message": "Teacher subject assignment deleted successfully"}

# --- Roster Readiness Checklist ---

@router.get("/{org_id}/roster-readiness")
def get_roster_readiness(org_id: int, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    people_count = db.query(Person).filter(Person.org_id == org_id, Person.status == "active").count()
    dept_count = db.query(Department).filter(Department.org_id == org_id).count()
    subjects_count = db.query(Subject).filter(Subject.org_id == org_id).count()

    settings = org.settings_json or {}
    sched_config = settings.get("working_days_schedule", {})
    working_days_count = sum(1 for d in sched_config.values() if d.get("is_working_day"))
    total_periods_count = sum(len(d.get("periods", [])) for d in sched_config.values() if d.get("is_working_day"))

    latest_sched = db.query(Schedule).filter(Schedule.org_id == org_id).order_by(Schedule.created_at.desc()).first()
    slots_count = 0
    if latest_sched:
        slots_count = db.query(RequirementSlot).filter(RequirementSlot.schedule_id == latest_sched.id).count()

    checklist = [
        {
            "key": "organization",
            "title": "Organization Configured",
            "is_ready": bool(org.name and org.type),
            "details": f"{org.name} ({org.type.capitalize()})"
        },
        {
            "key": "departments",
            "title": "Departments & Teams",
            "is_ready": dept_count > 0,
            "details": f"{dept_count} department(s) created" if dept_count > 0 else "No departments added yet"
        },
        {
            "key": "staff",
            "title": "Faculty / Teachers Added" if org.type in ["college", "university"] else "Employees Added",
            "is_ready": people_count > 0,
            "details": f"{people_count} active staff member(s)" if people_count > 0 else "No staff members registered"
        },
        {
            "key": "subjects_duties",
            "title": "Subjects & Curriculum Configured" if org.type in ["college", "university"] else "Duties & Roles Defined",
            "is_ready": (subjects_count > 0) if org.type in ["college", "university"] else True,
            "details": f"{subjects_count} subject(s) configured" if org.type in ["college", "university"] else "Operating duties mapped"
        },
        {
            "key": "working_hours",
            "title": "Working Hours & Schedule Rules",
            "is_ready": working_days_count > 0 and total_periods_count > 0,
            "details": f"{working_days_count} active working days, {total_periods_count} duty/shift periods"
        },
        {
            "key": "timetable_slots",
            "title": "Timetable Structure Provisioned",
            "is_ready": slots_count > 0 or total_periods_count > 0,
            "details": f"{slots_count} timetable slots ready for assignment" if slots_count > 0 else "Will be auto-generated from schedule periods"
        }
    ]

    can_generate = people_count > 0 and working_days_count > 0 and total_periods_count > 0
    missing_items = [item["title"] for item in checklist if not item["is_ready"]]

    return {
        "org_id": org.id,
        "org_type": org.type,
        "can_generate": can_generate,
        "checklist": checklist,
        "missing_items": missing_items,
        "latest_schedule_id": latest_sched.id if latest_sched else None,
        "setup_step": settings.get("setup_step", 6 if can_generate else 1),
        "setup_completed": settings.get("setup_completed", False)
    }

@router.get("/{org_id}/resources")
def list_organization_resources(org_id: int, db: Session = Depends(get_db)):
    res = db.query(Resource).filter(Resource.org_id == org_id).all()
    return [
        {
            "id": r.id,
            "org_id": r.org_id,
            "name": r.name,
            "type": r.type,
            "capacity": r.capacity,
            "status": r.status
        }
        for r in res
    ]

@router.post("")
@router.post("/setup")
def create_organization(data: OrganizationCreate, db: Session = Depends(get_db)):
    """
    Initializes a new organization instance with complete validation, custom
    working hours, departments, resources, and custom schedule slots.
    """
    preset = next((p for p in PRESET_ORGANIZATIONS if p["type"] == data.type), None)
    
    code = data.code or data.name.replace(" ", "-").lower()[:20]

    # Combine settings
    working_sched = data.working_days_schedule or get_default_working_days_schedule(data.type)
    prof_settings = data.profession_settings or get_default_profession_settings(data.type)
    
    merged_settings = {
        "profession_label": preset["profession_label"] if preset else "Staff",
        "overtime_allowed": True,
        "max_weekly_hours": 40.0,
        "auto_approve_replacements": False,
        "theme": "dark",
        "haptic_feedback_enabled": True,
        "working_days_schedule": working_sched,
        "profession_settings": prof_settings,
        "roles": data.roles or (preset["default_roles"] if preset else ["Team Lead", "Specialist"]),
    }
    if data.settings_json:
        merged_settings.update(data.settings_json)

    org = Organization(
        name=data.name.strip(),
        type=data.type,
        code=code.strip(),
        description=data.description or (preset["description"] if preset else ""),
        settings_json=merged_settings
    )
    db.add(org)
    db.commit()
    db.refresh(org)

    # 1. Seed departments
    dept_names = data.departments or (preset["default_departments"] if preset else ["Operations", "Administration"])
    created_depts = []
    for d_name in dept_names:
        clean_name = d_name.strip()
        if clean_name:
            dept = Department(
                org_id=org.id,
                name=clean_name,
                code=clean_name[:4].upper().replace(" ", "")
            )
            db.add(dept)
            created_depts.append(dept)

    # 2. Seed resources
    res_names = data.resource_types or (preset["resource_types"] if preset else ["Room 101", "Room 102"])
    created_resources = []
    for r_name in res_names:
        clean_res = r_name.strip()
        if clean_res:
            res = Resource(
                org_id=org.id,
                name=clean_res,
                type="room",
                capacity=40,
                status="available"
            )
            db.add(res)
            created_resources.append(res)

    db.flush()

    # 3. Create initial Schedule & Slots matching the configured working days & periods
    today = datetime.date.today()
    start_date = today + datetime.timedelta(days=(7 - today.weekday()) % 7)  # next Monday
    end_date = start_date + datetime.timedelta(days=6)  # Sunday

    initial_schedule = Schedule(
        org_id=org.id,
        title=f"{org.name} Master Timetable",
        period_start=start_date.strftime("%Y-%m-%d"),
        period_end=end_date.strftime("%Y-%m-%d"),
        status="draft",
        version=1,
        fairness_score=95.0
    )
    db.add(initial_schedule)
    db.flush()

    # Generate custom slots from the configured working_days_schedule
    res_id = created_resources[0].id if created_resources else None
    dept_id = created_depts[0].id if created_depts else None

    slot_order_counter = 0
    curr_date = start_date
    while curr_date <= end_date:
        day_idx = curr_date.weekday()
        day_config = working_sched.get(str(day_idx))
        if day_config and day_config.get("is_working_day"):
            periods = day_config.get("periods", [])
            for p in periods:
                p_type = p.get("type", "work")
                # Create RequirementSlot for both work periods and scheduled duty blocks
                slot_obj = RequirementSlot(
                    org_id=org.id,
                    schedule_id=initial_schedule.id,
                    title=f"{p.get('name', 'Duty Block')} ({org.name.split()[0]})",
                    date_str=curr_date.strftime("%Y-%m-%d"),
                    day_of_week=day_idx,
                    start_time=p.get("start_time", "09:00"),
                    end_time=p.get("end_time", "11:00"),
                    resource_id=res_id,
                    department_id=dept_id,
                    min_staff=p.get("min_staff", 1) if p_type == "work" else 0,
                    target_staff=p.get("target_staff", 1) if p_type == "work" else 0,
                    max_staff=p.get("max_staff", 1) if p_type == "work" else 0,
                    slot_order=slot_order_counter,
                    period_type=p_type,
                    is_locked=False,
                    required_skills=[],
                    profession_metadata={"period_type": p_type}
                )
                db.add(slot_obj)
                slot_order_counter += 1
        curr_date += datetime.timedelta(days=1)

    # Audit log
    audit = AuditLog(
        org_id=org.id,
        action="ORGANIZATION_INITIALIZED",
        entity_type="organization",
        entity_id=str(org.id),
        details={"name": org.name, "type": org.type, "departments_count": len(created_depts)}
    )
    db.add(audit)
    db.commit()

    return {
        "id": org.id,
        "name": org.name,
        "type": org.type,
        "code": org.code,
        "description": org.description,
        "settings_json": org.settings_json or {},
        "created_at": org.created_at.isoformat() if org.created_at else None
    }

@router.put("/{org_id}")
def update_organization(org_id: int, payload: Dict[str, Any], db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if "name" in payload:
        org.name = payload["name"]
    if "description" in payload:
        org.description = payload["description"]
    
    current_settings = org.settings_json or {}
    if "working_days_schedule" in payload:
        current_settings["working_days_schedule"] = payload["working_days_schedule"]
    if "profession_settings" in payload:
        current_settings["profession_settings"] = payload["profession_settings"]
    if "settings_json" in payload:
        current_settings.update(payload["settings_json"])

    org.settings_json = current_settings
    db.commit()
    return {
        "id": org.id,
        "name": org.name,
        "type": org.type,
        "code": org.code,
        "description": org.description,
        "settings_json": org.settings_json or {},
        "created_at": org.created_at.isoformat() if org.created_at else None
    }
