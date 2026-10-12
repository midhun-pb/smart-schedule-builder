from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, List, Tuple
from app.core.database import get_db
from app.models.models import RequirementSlot, Assignment, Person, LeaveRequest
from app.core.time_utils import get_slot_datetime_interval, is_overlapping_interval

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

    # Group assignments by person to detect double-booking across any dates/overnight shifts
    person_assignments: Dict[int, List[Tuple[Assignment, RequirementSlot]]] = {}

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
                person_assignments.setdefault(p.id, []).append((a, s))

    # Check double-booking conflicts using concrete datetime intervals
    for p_id, assign_list in person_assignments.items():
        if len(assign_list) > 1:
            for i in range(len(assign_list)):
                a1, s1 = assign_list[i]
                s1_start, s1_end, _ = get_slot_datetime_interval(s1.date_str or a1.date_str, s1.start_time, s1.end_time, s1.day_of_week)
                for j in range(i + 1, len(assign_list)):
                    a2, s2 = assign_list[j]
                    s2_start, s2_end, _ = get_slot_datetime_interval(s2.date_str or a2.date_str, s2.start_time, s2.end_time, s2.day_of_week)
                    if is_overlapping_interval(s1_start, s1_end, s2_start, s2_end):
                        conflicts.append({
                            "type": "overlap",
                            "severity": "critical",
                            "person_name": people[p_id].name,
                            "date_str": s1.date_str or a1.date_str or "Multi-day",
                            "slot1": f"{s1.title} ({s1.date_str} {s1.start_time}-{s1.end_time})",
                            "slot2": f"{s2.title} ({s2.date_str} {s2.start_time}-{s2.end_time})",
                            "message": f"{people[p_id].name} is scheduled simultaneously for '{s1.title}' and '{s2.title}'"
                        })

    # Check leave conflicts using concrete datetime intervals
    for l in leaves:
        p = people.get(l.person_id)
        if not p or not l.start_date:
            continue
        l_start_t = l.start_time or "00:00"
        l_end_t = l.end_time or "23:59"
        l_end_d = l.end_date or l.start_date
        try:
            import datetime
            l_start_dt = datetime.datetime.strptime(f"{l.start_date} {l_start_t}", "%Y-%m-%d %H:%M")
            l_end_dt = datetime.datetime.strptime(f"{l_end_d} {l_end_t}", "%Y-%m-%d %H:%M")
        except Exception:
            continue

        for a in assignments:
            if a.person_id == l.person_id and a.status == "assigned":
                slot = a.slot
                if not slot:
                    continue
                s_start, s_end, _ = get_slot_datetime_interval(slot.date_str or a.date_str, slot.start_time, slot.end_time, slot.day_of_week)
                if is_overlapping_interval(s_start, s_end, l_start_dt, l_end_dt):
                    affected_by_leave.append({
                        "assignment_id": a.id,
                        "slot_title": slot.title,
                        "person_name": p.name,
                        "date_str": a.date_str,
                        "leave_type": l.leave_type,
                        "severity": "critical" if l.leave_type == "emergency" else "warning",
                        "message": f"{p.name} has an active assignment during confirmed {l.leave_type} leave on {a.date_str}"
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
