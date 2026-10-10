from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import RequirementSlot, Assignment, Person, LeaveRequest

router = APIRouter(prefix="/issues", tags=["issues"])

@router.get("")
def get_schedule_issues(org_id: int, db: Session = Depends(get_db)):
    slots = db.query(RequirementSlot).filter(RequirementSlot.org_id == org_id).all()
    assignments = db.query(Assignment).all()
    people = {p.id: p for p in db.query(Person).filter(Person.org_id == org_id).all()}
    leaves = db.query(LeaveRequest).filter(
        LeaveRequest.org_id == org_id,
        LeaveRequest.status.in_(["approved", "emergency_recorded"])
    ).all()

    unfilled = []
    conflicts = []
    affected_by_leave = []
    shortages = []

    # Map slot_id to assignment
    slot_to_assign = {a.slot_id: a for a in assignments}

    # Group assignments by person and date to detect double-booking
    person_date_assignments = {}

    for s in slots:
        a = slot_to_assign.get(s.id)
        if not a or not a.person_id:
            unfilled.append({
                "slot_id": s.id,
                "title": s.title,
                "date_str": s.date_str,
                "time": f"{s.start_time} - {s.end_time}",
                "required_skills": s.required_skills or [],
                "severity": "critical",
                "message": f"Unassigned slot: '{s.title}' at {s.start_time}"
            })
        else:
            p = people.get(a.person_id)
            if p:
                key = (p.id, a.date_str)
                person_date_assignments.setdefault(key, []).append((a, s))

    # Check double-booking conflicts
    for (p_id, d_str), assign_list in person_date_assignments.items():
        if len(assign_list) > 1:
            for i in range(len(assign_list)):
                for j in range(i + 1, len(assign_list)):
                    a1, s1 = assign_list[i]
                    a2, s2 = assign_list[j]
                    if not (s1.end_time <= s2.start_time or s2.end_time <= s1.start_time):
                        conflicts.append({
                            "type": "overlap",
                            "severity": "critical",
                            "person_name": people[p_id].name,
                            "date_str": d_str,
                            "slot1": f"{s1.title} ({s1.start_time}-{s1.end_time})",
                            "slot2": f"{s2.title} ({s2.start_time}-{s2.end_time})",
                            "message": f"{people[p_id].name} is scheduled simultaneously for '{s1.title}' and '{s2.title}'"
                        })

    # Check leave conflicts
    for l in leaves:
        p = people.get(l.person_id)
        for a in assignments:
            if a.person_id == l.person_id and a.status == "assigned":
                if l.start_date <= (a.date_str or "") <= l.end_date:
                    affected_by_leave.append({
                        "assignment_id": a.id,
                        "slot_title": a.slot.title if a.slot else "Shift",
                        "person_name": p.name if p else "Staff",
                        "date_str": a.date_str,
                        "leave_type": l.leave_type,
                        "severity": "critical" if l.leave_type == "emergency" else "warning",
                        "message": f"{p.name if p else 'Staff'} has an active assignment during confirmed {l.leave_type} leave on {a.date_str}"
                    })

    return {
        "summary": {
            "total_issues": len(unfilled) + len(conflicts) + len(affected_by_leave),
            "unfilled_count": len(unfilled),
            "conflict_count": len(conflicts),
            "leave_affected_count": len(affected_by_leave)
        },
        "unfilled_assignments": unfilled,
        "scheduling_conflicts": conflicts,
        "leave_affected_assignments": affected_by_leave,
        "staff_shortages": shortages
    }
