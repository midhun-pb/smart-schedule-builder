from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from app.core.database import get_db
from app.models.models import Person, Department, AuditLog, Subject, TeacherSubjectAssignment
from app.schemas.schemas import PersonCreate, PersonBase, PersonUpdate
from app.services.skill_engine import SkillEngine

router = APIRouter(prefix="/profiles", tags=["profiles"])

def _format_ta(a: TeacherSubjectAssignment) -> Dict[str, Any]:
    return {
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
        "required_hours": a.required_hours or 4.0,
        "required_periods": getattr(a, "required_periods", 4) or 4,
        "period_duration": getattr(a, "period_duration", "1 hour") or "1 hour",
        "allowed_working_days": getattr(a, "allowed_working_days", [0, 1, 2, 3, 4]) or [0, 1, 2, 3, 4],
        "preferred_periods": getattr(a, "preferred_periods", []) or [],
        "unavailable_periods": getattr(a, "unavailable_periods", []) or [],
        "max_periods_per_day": getattr(a, "max_periods_per_day", 2) or 2,
        "eligible_rooms": a.eligible_rooms or [],
        "is_primary": a.is_primary if a.is_primary is not None else True,
        "assignment_status": getattr(a, "assignment_status", "active") or "active",
        "created_at": a.created_at.isoformat() if a.created_at else None
    }

def _format_person(p: Person, dept_name: str = "General", assignments: List[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {
        "id": p.id,
        "org_id": p.org_id,
        "name": p.name,
        "email": p.email,
        "phone": p.phone,
        "role_title": p.role_title,
        "employee_code": p.employee_code,
        "profession_type": p.profession_type,
        "department_id": p.department_id,
        "department_name": dept_name,
        "qualifications": p.qualifications or [],
        "skills": p.skills or [],
        "inferred_skills": p.inferred_skills or [],
        "preferences": p.preferences or {},
        "profession_metadata": p.profession_metadata or {},
        "status": p.status,
        "max_hours_per_week": p.max_hours_per_week,
        "data_quality_score": p.data_quality_score or 95.0,
        "hire_date": p.hire_date,
        "teacher_assignments": assignments if assignments is not None else []
    }

def _sync_teacher_assignments(person: Person, assignments_data: Optional[List[Dict[str, Any]]], db: Session) -> List[Dict[str, Any]]:
    if assignments_data is None:
        existing = db.query(TeacherSubjectAssignment).filter(
            TeacherSubjectAssignment.person_id == person.id
        ).all()
        return [_format_ta(a) for a in existing]

    existing = db.query(TeacherSubjectAssignment).filter(
        TeacherSubjectAssignment.person_id == person.id
    ).all()
    existing_map = {a.id: a for a in existing}
    retained_ids = set()

    for item in assignments_data:
        if not isinstance(item, dict):
            continue
        subj_id = item.get("subject_id")
        if not subj_id:
            continue

        subject = db.query(Subject).filter(Subject.id == subj_id).first()
        if not subject:
            continue

        sem_val = item.get("semester") or subject.semester
        sem_id = item.get("semester_id") or subject.semester_id
        dept_id = item.get("department_id") or subject.department_id or person.department_id
        req_periods = int(item.get("required_periods", 4) or 4)
        req_hours = float(item.get("required_hours") or req_periods or 4.0)
        p_duration = str(item.get("period_duration") or "1 hour")
        work_days = item.get("allowed_working_days")
        if work_days is None:
            work_days = [0, 1, 2, 3, 4]
        pref_periods = item.get("preferred_periods") or []
        unavail_periods = item.get("unavailable_periods") or []
        max_p_day = int(item.get("max_periods_per_day", 2) or 2)
        c_name = item.get("class_name") or subject.class_name or None
        is_prim = bool(item.get("is_primary", True))
        status = item.get("assignment_status", "active") or "active"

        assign_id = item.get("id")
        if assign_id and assign_id in existing_map:
            assign = existing_map[assign_id]
            assign.subject_id = subj_id
            assign.semester = sem_val
            assign.semester_id = sem_id
            assign.department_id = dept_id
            assign.class_name = c_name
            assign.required_periods = req_periods
            assign.required_hours = req_hours
            assign.period_duration = p_duration
            assign.allowed_working_days = work_days
            assign.preferred_periods = pref_periods
            assign.unavailable_periods = unavail_periods
            assign.max_periods_per_day = max_p_day
            assign.is_primary = is_prim
            assign.assignment_status = status
            retained_ids.add(assign_id)
        else:
            new_assign = TeacherSubjectAssignment(
                org_id=person.org_id,
                person_id=person.id,
                subject_id=subj_id,
                department_id=dept_id,
                semester_id=sem_id,
                semester=sem_val,
                class_name=c_name,
                required_hours=req_hours,
                required_periods=req_periods,
                period_duration=p_duration,
                allowed_working_days=work_days,
                preferred_periods=pref_periods,
                unavailable_periods=unavail_periods,
                max_periods_per_day=max_p_day,
                is_primary=is_prim,
                assignment_status=status
            )
            db.add(new_assign)

    for a_id, a_obj in existing_map.items():
        if a_id not in retained_ids:
            db.delete(a_obj)

    db.commit()

    current = db.query(TeacherSubjectAssignment).filter(
        TeacherSubjectAssignment.person_id == person.id
    ).all()
    return [_format_ta(a) for a in current]

@router.get("")
def list_people(
    org_id: int,
    department_id: Optional[int] = None,
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Person).filter(Person.org_id == org_id)
    if department_id:
        query = query.filter(Person.department_id == department_id)
    if status:
        query = query.filter(Person.status == status)
    if search:
        s = f"%{search}%"
        query = query.filter((Person.name.ilike(s)) | (Person.employee_code.ilike(s)) | (Person.role_title.ilike(s)))

    people = query.order_by(Person.name.asc()).all()
    
    # Enrich with department name
    dept_map = {d.id: d.name for d in db.query(Department).filter(Department.org_id == org_id).all()}
    
    # Pre-fetch all teacher assignments for this org
    tas = db.query(TeacherSubjectAssignment).filter(TeacherSubjectAssignment.org_id == org_id).all()
    ta_by_person: Dict[int, List[Dict[str, Any]]] = {}
    for a in tas:
        ta_by_person.setdefault(a.person_id, []).append(_format_ta(a))

    results = []
    for p in people:
        results.append(_format_person(
            p,
            dept_name=dept_map.get(p.department_id, "General"),
            assignments=ta_by_person.get(p.id, [])
        ))
    return results

@router.get("/quality-stats")
def get_data_quality_stats(org_id: int, db: Session = Depends(get_db)):
    people = db.query(Person).filter(Person.org_id == org_id).all()
    if not people:
        return {"average_score": 100.0, "total_profiles": 0, "needs_attention": 0, "breakdown": {}}

    scores = [p.data_quality_score or 90.0 for p in people]
    avg = round(sum(scores) / len(scores), 1)
    needs_attention = sum(1 for s in scores if s < 80.0)
    
    missing_skills = sum(1 for p in people if not p.skills)
    missing_quals = sum(1 for p in people if not p.qualifications)
    missing_phone = sum(1 for p in people if not p.phone)

    return {
        "average_score": avg,
        "total_profiles": len(people),
        "needs_attention": needs_attention,
        "metrics": {
            "missing_skills": missing_skills,
            "missing_qualifications": missing_quals,
            "missing_phone": missing_phone,
            "verified_rate": round(100.0 - (needs_attention / len(people) * 100), 1)
        }
    }

@router.get("/{person_id}")
def get_person(person_id: int, db: Session = Depends(get_db)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    dept = db.query(Department).filter(Department.id == person.department_id).first() if person.department_id else None
    tas = db.query(TeacherSubjectAssignment).filter(TeacherSubjectAssignment.person_id == person.id).all()
    return _format_person(person, dept_name=dept.name if dept else "General", assignments=[_format_ta(a) for a in tas])

@router.post("")
def create_person(data: PersonCreate, db: Session = Depends(get_db)):
    inferred = SkillEngine.infer_hidden_skills(data.skills)

    quality = 100.0
    if not data.role_title:
        quality -= 10
    if not data.skills:
        quality -= 25
    if not data.qualifications:
        quality -= 15
    if not data.phone:
        quality -= 10
    quality = max(20.0, quality)

    person = Person(
        org_id=data.org_id,
        department_id=data.department_id,
        name=data.name,
        email=data.email,
        phone=data.phone,
        role_title=data.role_title,
        employee_code=data.employee_code,
        profession_type=data.profession_type,
        qualifications=data.qualifications,
        skills=data.skills,
        inferred_skills=inferred,
        preferences=data.preferences,
        profession_metadata=data.profession_metadata,
        max_hours_per_week=data.max_hours_per_week,
        data_quality_score=quality,
        status=data.status,
        hire_date=data.hire_date
    )
    db.add(person)
    db.commit()
    db.refresh(person)

    # Sync teacher assignments if provided
    saved_assignments = []
    if data.teacher_assignments is not None:
        saved_assignments = _sync_teacher_assignments(person, data.teacher_assignments, db)

    # Audit log
    audit = AuditLog(
        org_id=data.org_id,
        action="PERSON_CREATED",
        entity_type="person",
        entity_id=str(person.id),
        details={"name": person.name, "email": person.email, "role": person.role_title, "assignments_count": len(saved_assignments)}
    )
    db.add(audit)
    db.commit()

    dept = db.query(Department).filter(Department.id == person.department_id).first() if person.department_id else None
    return _format_person(person, dept_name=dept.name if dept else "General", assignments=saved_assignments)

@router.put("/{person_id}")
def update_person(person_id: int, data: PersonUpdate, db: Session = Depends(get_db)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    if data.name is not None:
        person.name = data.name
    if data.email is not None:
        person.email = data.email
    if data.phone is not None:
        person.phone = data.phone
    if data.role_title is not None:
        person.role_title = data.role_title
    if data.employee_code is not None:
        person.employee_code = data.employee_code
    if data.department_id is not None:
        person.department_id = data.department_id
    if data.qualifications is not None:
        person.qualifications = data.qualifications
    if data.skills is not None:
        person.skills = data.skills
        person.inferred_skills = SkillEngine.infer_hidden_skills(data.skills)
    if data.preferences is not None:
        person.preferences = data.preferences
    if data.profession_metadata is not None:
        person.profession_metadata = data.profession_metadata
    if data.max_hours_per_week is not None:
        person.max_hours_per_week = data.max_hours_per_week
    if data.status is not None:
        person.status = data.status
    if data.hire_date is not None:
        person.hire_date = data.hire_date

    quality = 100.0
    if not (person.skills or []):
        quality -= 25
    if not (person.qualifications or []):
        quality -= 15
    if not person.phone:
        quality -= 10
    person.data_quality_score = max(20.0, quality)

    db.commit()
    db.refresh(person)

    # Sync teacher assignments if provided
    saved_assignments = None
    if data.teacher_assignments is not None:
        saved_assignments = _sync_teacher_assignments(person, data.teacher_assignments, db)
    else:
        tas = db.query(TeacherSubjectAssignment).filter(TeacherSubjectAssignment.person_id == person.id).all()
        saved_assignments = [_format_ta(a) for a in tas]

    dept = db.query(Department).filter(Department.id == person.department_id).first() if person.department_id else None
    return _format_person(person, dept_name=dept.name if dept else "General", assignments=saved_assignments)

@router.post("/{person_id}/assignments/sync")
def sync_person_assignments(person_id: int, payload: Dict[str, Any], db: Session = Depends(get_db)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    assignments_data = payload.get("assignments", [])
    updated = _sync_teacher_assignments(person, assignments_data, db)
    return {"success": True, "assignments": updated}

@router.delete("/{person_id}")
def delete_person(person_id: int, db: Session = Depends(get_db)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    # Soft delete / deactivation
    person.status = "inactive"
    db.commit()
    return {"success": True, "message": "Person deactivated"}
