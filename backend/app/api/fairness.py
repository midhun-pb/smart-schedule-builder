from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import Person, Assignment
from app.services.fairness_engine import FairnessEngine

router = APIRouter(prefix="/fairness", tags=["fairness"])

@router.get("")
def get_fairness_analysis(org_id: int, schedule_id: int = None, db: Session = Depends(get_db)):
    people = db.query(Person).filter(Person.org_id == org_id, Person.status == "active").all()
    
    assign_query = db.query(Assignment).filter(Assignment.status == "assigned")
    if schedule_id:
        assign_query = assign_query.filter(Assignment.schedule_id == schedule_id)
    assignments = assign_query.all()

    people_dicts = [
        {
            "id": p.id,
            "name": p.name,
            "role_title": p.role_title,
            "max_hours_per_week": p.max_hours_per_week or 40.0
        }
        for p in people
    ]

    assign_dicts = [
        {
            "person_id": a.person_id,
            "start_time": a.start_time or "09:00",
            "end_time": a.end_time or "10:30",
            "day_of_week": a.slot.day_of_week if a.slot else 0
        }
        for a in assignments
    ]

    analysis = FairnessEngine.analyze_schedule_fairness(people_dicts, assign_dicts)
    return analysis
