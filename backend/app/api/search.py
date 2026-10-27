from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.core.database import get_db
from app.models.models import Person, LeaveRequest, Department, TeacherSubjectAssignment
from app.schemas.schemas import NaturalLanguageSearchRequest
from app.services.search_engine import SearchEngine

router = APIRouter(prefix="/search", tags=["search"])

@router.post("")
def intelligent_search(req: NaturalLanguageSearchRequest, db: Session = Depends(get_db)):
    """
    Intelligent IR/NLP search endpoint. Extracts skills, qualifications,
    day, time, experience, role categories, and ranks real database candidates using TF-IDF
    and hard/soft constraint matching.
    """
    # Fetch active people in org
    people = db.query(Person).filter(
        Person.org_id == req.org_id,
        Person.status == "active"
    ).all()

    # Fetch departments
    dept_map = {d.id: d.name for d in db.query(Department).filter(Department.org_id == req.org_id).all()}

    # Fetch active teacher-subject assignments
    tas = db.query(TeacherSubjectAssignment).filter(
        TeacherSubjectAssignment.org_id == req.org_id,
        TeacherSubjectAssignment.assignment_status == "active"
    ).all()
    ta_by_person: Dict[int, List[Dict[str, Any]]] = {}
    for a in tas:
        ta_by_person.setdefault(a.person_id, []).append({
            "subject_id": a.subject_id,
            "subject_name": a.subject.name if a.subject else "",
            "subject_code": a.subject.code if a.subject else "",
            "semester": a.semester or (a.subject.semester if a.subject else ""),
            "class_name": a.class_name
        })

    # Fetch active leave records
    leaves = db.query(LeaveRequest).filter(
        LeaveRequest.org_id == req.org_id,
        LeaveRequest.status.in_(["approved", "emergency_recorded"])
    ).all()

    faculty_keywords = ["professor", "lecturer", "faculty", "teacher", "instructor", "dean", "hod", "chair", "tutor", "fellow"]
    candidates = []
    for p in people:
        p_tas = ta_by_person.get(p.id, [])
        role_l = (p.role_title or "").lower()
        is_fac = bool(p_tas or any(fk in role_l for fk in faculty_keywords) or (isinstance(p.profession_metadata, dict) and p.profession_metadata.get("is_faculty") is True))

        candidates.append({
            "id": p.id,
            "name": p.name,
            "email": p.email,
            "phone": p.phone,
            "role_title": p.role_title or ("Faculty" if is_fac else "Staff"),
            "employee_code": p.employee_code,
            "department_id": p.department_id,
            "department_name": dept_map.get(p.department_id, "General"),
            "is_faculty": is_fac,
            "assigned_subjects": p_tas,
            "assigned_subject_names": [a["subject_name"] for a in p_tas if a["subject_name"]],
            "assigned_subject_codes": [a["subject_code"] for a in p_tas if a["subject_code"]],
            "assigned_semesters": list(set([a["semester"] for a in p_tas if a["semester"]])),
            "qualifications": p.qualifications or [],
            "skills": p.skills or [],
            "inferred_skills": p.inferred_skills or [],
            "preferences": p.preferences or {},
            "profession_metadata": p.profession_metadata or {},
            "data_quality_score": p.data_quality_score or 95.0,
        })

    leave_records = [
        {
            "person_id": l.person_id,
            "start_date": l.start_date,
            "end_date": l.end_date,
            "start_time": l.start_time,
            "end_time": l.end_time
        }
        for l in leaves
    ]

    engine = SearchEngine()
    parsed_query = engine.parse_query(req.query)
    ranked = engine.rank_candidates(
        query=req.query,
        candidates=candidates,
        leave_records=leave_records,
        top_k=req.top_k
    )

    return {
        "query": req.query,
        "parsed_entities": parsed_query,
        "total_evaluated": len(candidates),
        "results": ranked
    }
