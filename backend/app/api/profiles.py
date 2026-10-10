from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from app.core.database import get_db
from app.models.models import Person, Department, AuditLog
from app.schemas.schemas import PersonCreate, PersonBase
from app.services.skill_engine import SkillEngine

router = APIRouter(prefix="/profiles", tags=["profiles"])

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
    
    results = []
    for p in people:
        results.append({
            "id": p.id,
            "org_id": p.org_id,
            "name": p.name,
            "email": p.email,
            "phone": p.phone,
            "role_title": p.role_title,
            "employee_code": p.employee_code,
            "profession_type": p.profession_type,
            "department_id": p.department_id,
            "department_name": dept_map.get(p.department_id, "General"),
            "qualifications": p.qualifications or [],
            "skills": p.skills or [],
            "inferred_skills": p.inferred_skills or [],
            "preferences": p.preferences or {},
            "profession_metadata": p.profession_metadata or {},
            "status": p.status,
            "max_hours_per_week": p.max_hours_per_week,
            "data_quality_score": p.data_quality_score or 95.0,
            "hire_date": p.hire_date
        })
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

@router.post("")
def create_person(data: PersonCreate, db: Session = Depends(get_db)):
    # Calculate inferred skills
    inferred = SkillEngine.infer_hidden_skills(data.skills)

    # Compute data quality score
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

    # Audit log
    audit = AuditLog(
        org_id=data.org_id,
        action="PERSON_CREATED",
        entity_type="person",
        entity_id=str(person.id),
        details={"name": person.name, "email": person.email, "role": person.role_title}
    )
    db.add(audit)
    db.commit()

    return person

@router.put("/{person_id}")
def update_person(person_id: int, data: PersonBase, db: Session = Depends(get_db)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    person.name = data.name
    person.email = data.email
    person.phone = data.phone
    person.role_title = data.role_title
    person.employee_code = data.employee_code
    person.department_id = data.department_id
    person.qualifications = data.qualifications
    person.skills = data.skills
    person.inferred_skills = SkillEngine.infer_hidden_skills(data.skills)
    person.preferences = data.preferences
    person.profession_metadata = data.profession_metadata
    person.max_hours_per_week = data.max_hours_per_week
    person.status = data.status
    if data.hire_date:
        person.hire_date = data.hire_date

    # Recalculate quality
    quality = 100.0
    if not data.skills:
        quality -= 25
    if not data.qualifications:
        quality -= 15
    if not data.phone:
        quality -= 10
    person.data_quality_score = max(20.0, quality)

    db.commit()
    return person

@router.delete("/{person_id}")
def delete_person(person_id: int, db: Session = Depends(get_db)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    # Soft delete / deactivation
    person.status = "inactive"
    db.commit()
    return {"success": True, "message": "Person deactivated"}
