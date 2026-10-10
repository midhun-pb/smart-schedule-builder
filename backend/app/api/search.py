from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.core.database import get_db
from app.models.models import Person, LeaveRequest
from app.schemas.schemas import NaturalLanguageSearchRequest
from app.services.search_engine import SearchEngine

router = APIRouter(prefix="/search", tags=["search"])

@router.post("")
def intelligent_search(req: NaturalLanguageSearchRequest, db: Session = Depends(get_db)):
    """
    Intelligent IR/NLP search endpoint. Extracts skills, qualifications,
    day, time, experience, and ranks real database candidates using TF-IDF
    and hard/soft constraint matching.
    """
    # Fetch active people in org
    people = db.query(Person).filter(
        Person.org_id == req.org_id,
        Person.status == "active"
    ).all()

    # Fetch active leave records
    leaves = db.query(LeaveRequest).filter(
        LeaveRequest.org_id == req.org_id,
        LeaveRequest.status.in_(["approved", "emergency_recorded"])
    ).all()

    candidates = [
        {
            "id": p.id,
            "name": p.name,
            "email": p.email,
            "phone": p.phone,
            "role_title": p.role_title,
            "employee_code": p.employee_code,
            "department_id": p.department_id,
            "qualifications": p.qualifications or [],
            "skills": p.skills or [],
            "inferred_skills": p.inferred_skills or [],
            "preferences": p.preferences or {},
            "profession_metadata": p.profession_metadata or {},
            "data_quality_score": p.data_quality_score or 95.0,
        }
        for p in people
    ]

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
