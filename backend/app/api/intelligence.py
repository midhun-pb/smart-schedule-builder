from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import Person, RequirementSlot
from app.services.skill_engine import SkillEngine

router = APIRouter(prefix="/intelligence", tags=["intelligence"])

@router.get("/skills")
def get_skill_intelligence(org_id: int, db: Session = Depends(get_db)):
    people = db.query(Person).filter(Person.org_id == org_id, Person.status == "active").all()
    slots = db.query(RequirementSlot).filter(RequirementSlot.org_id == org_id).all()

    slot_dicts = [{"required_skills": s.required_skills or []} for s in slots]
    people_dicts = [{"id": p.id, "name": p.name, "skills": p.skills or []} for p in people]

    # Analyze gaps
    gap_analysis = SkillEngine.analyze_skill_gaps(slot_dicts, people_dicts)

    # Inferred skills overview
    inferred_list = []
    for p in people:
        for inf in (p.inferred_skills or []):
            inferred_list.append({
                "person_name": p.name,
                "skill": inf.get("name"),
                "confidence": inf.get("confidence", 0.8),
                "source": inf.get("source_skill", "Experience"),
                "category": inf.get("category", "General"),
                "reason": inf.get("reason", "")
            })

    return {
        "gap_analysis": gap_analysis,
        "relationships": SkillEngine.SKILL_RELATIONSHIPS,
        "inferred_skills": inferred_list[:25],
        "total_active_staff": len(people)
    }
