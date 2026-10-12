from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import datetime
from app.core.database import get_db
from app.models.models import Organization, Department, ShiftTemplate, Resource, Schedule, RequirementSlot, User, AuditLog
from app.schemas.schemas import OrganizationCreate, OrganizationResponse
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
