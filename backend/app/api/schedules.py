import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from app.core.database import get_db
from app.models.models import (
    Organization, Schedule, RequirementSlot, Assignment, Person, Resource,
    Department, LeaveRequest, ScheduleVersion, AuditLog, Notification,
    Holiday, HolidayException
)
from app.schemas.schemas import (
    ScheduleGenerateRequest, SlotCreate, SlotUpdate,
    AssignmentUpdate, DragDropAssignRequest, CopyWeekRequest
)
from app.services.scheduling_engine import SchedulingEngine

router = APIRouter(prefix="/schedules", tags=["schedules"])

@router.get("")
def list_schedules(org_id: int, db: Session = Depends(get_db)):
    schedules = db.query(Schedule).filter(Schedule.org_id == org_id).order_by(Schedule.created_at.desc()).all()
    return schedules

@router.get("/{schedule_id}")
def get_schedule_details(schedule_id: int, db: Session = Depends(get_db)):
    sched = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")

    slots = (
        db.query(RequirementSlot)
        .filter(RequirementSlot.schedule_id == schedule_id)
        .order_by(RequirementSlot.day_of_week.asc(), RequirementSlot.start_time.asc(), RequirementSlot.slot_order.asc())
        .all()
    )
    assignments = db.query(Assignment).filter(Assignment.schedule_id == schedule_id).all()
    
    # Pre-map person details
    people = {p.id: p for p in db.query(Person).filter(Person.org_id == sched.org_id).all()}
    resources = {r.id: r for r in db.query(Resource).filter(Resource.org_id == sched.org_id).all()}

    # Group assignments by slot_id to support multi-staff requirements
    assignments_by_slot: Dict[int, List[Assignment]] = {}
    for a in assignments:
        assignments_by_slot.setdefault(a.slot_id, []).append(a)

    slot_cards = []
    for s in slots:
        slot_assigns = assignments_by_slot.get(s.id, [])
        primary_assign = slot_assigns[0] if slot_assigns else None
        
        assigned_staff_list = []
        for a in slot_assigns:
            p = people.get(a.person_id) if a.person_id else None
            orig_p = people.get(a.original_person_id) if a.original_person_id else None
            assigned_staff_list.append({
                "assignment_id": a.id,
                "person_id": p.id if p else None,
                "person_name": p.name if p else "Unassigned",
                "person_role": p.role_title if p else "",
                "is_replacement": a.is_replacement,
                "replacement_type": a.replacement_type,
                "replacement_reason": a.replacement_reason,
                "original_person_id": orig_p.id if orig_p else None,
                "original_person_name": orig_p.name if orig_p else None,
                "status": a.status
            })

        assigned_p = people.get(primary_assign.person_id) if primary_assign and primary_assign.person_id else None
        orig_p = people.get(primary_assign.original_person_id) if primary_assign and primary_assign.original_person_id else None
        res = resources.get(s.resource_id) if s.resource_id else None

        # Determine staffing status
        active_count = len([st for st in assigned_staff_list if st["person_id"]])
        p_type = getattr(s, "period_type", "work") or "work"
        if p_type in ["break", "lunch"]:
            staffing_status = "break"
        elif p_type == "holiday":
            staffing_status = "holiday"
        elif active_count < (s.min_staff or 1):
            staffing_status = "understaffed"
        elif active_count > (s.max_staff or 1):
            staffing_status = "overstaffed"
        else:
            staffing_status = "adequate"

        slot_cards.append({
            "slot_id": s.id,
            "title": s.title,
            "date_str": s.date_str,
            "day_of_week": s.day_of_week,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "resource_id": s.resource_id,
            "resource_name": res.name if res else "Not Assigned",
            "department_id": s.department_id,
            "required_skills": s.required_skills or [],
            "required_qualifications": s.required_qualifications or [],
            "profession_metadata": s.profession_metadata or {},
            "min_staff": s.min_staff or 1,
            "target_staff": s.target_staff or 1,
            "max_staff": s.max_staff or 1,
            "slot_order": s.slot_order or 0,
            "is_locked": s.is_locked or False,
            "period_type": p_type,
            "staffing_status": staffing_status,
            "assigned_count": active_count,
            "assigned_staff": assigned_staff_list,
            # Overnight detection: start > end or explicit night designation
            "is_overnight": bool((s.start_time > s.end_time) or ("night" in s.title.lower()) or ("overnight" in s.title.lower())),
            "assignment_id": primary_assign.id if primary_assign else None,
            "person_id": assigned_p.id if assigned_p else None,
            "person_name": assigned_p.name if assigned_p else "Unfilled",
            "person_role": assigned_p.role_title if assigned_p else "",
            "is_replacement": primary_assign.is_replacement if primary_assign else False,
            "replacement_type": primary_assign.replacement_type if primary_assign else "none",
            "replacement_reason": primary_assign.replacement_reason if primary_assign else None,
            "original_person_id": orig_p.id if orig_p else None,
            "original_person_name": orig_p.name if orig_p else None,
            "status": primary_assign.status if primary_assign else "unfilled"
        })

    work_slots = [sc for sc in slot_cards if sc["period_type"] == "work"]
    filled_count = sum(1 for sc in work_slots if sc["assigned_count"] >= sc["min_staff"])
    unfilled_count = len(work_slots) - filled_count

    # Fetch holidays for this organization to inform timetable views
    holidays = db.query(Holiday).filter(Holiday.org_id == sched.org_id).order_by(Holiday.start_date.asc()).all()
    holiday_cards = [
        {
            "id": h.id,
            "name": h.name,
            "holiday_type": h.holiday_type,
            "start_date": h.start_date,
            "end_date": h.end_date,
            "is_emergency_closure": h.is_emergency_closure,
            "is_special_working_day": h.is_special_working_day,
            "is_partial_day": h.is_partial_day,
            "partial_start_time": h.partial_start_time,
            "partial_end_time": h.partial_end_time,
            "department_id": h.department_id,
            "requires_continuous_ops": h.requires_continuous_ops
        }
        for h in holidays
    ]

    return {
        "schedule": sched,
        "slots": slot_cards,
        "total_slots": len(slot_cards),
        "work_slots_count": len(work_slots),
        "filled_slots": filled_count,
        "unfilled_slots": unfilled_count,
        "replacement_count": sum(1 for sc in slot_cards if sc["is_replacement"]),
        "resources": [{"id": r.id, "name": r.name, "type": r.type} for r in resources.values()],
        "holidays": holiday_cards
    }

# --- Slot CRUD Endpoints ---

@router.post("/slots")
def create_slot(slot_data: SlotCreate, db: Session = Depends(get_db)):
    """
    Creates a new custom time slot / period in the timetable.
    """
    if not slot_data.schedule_id:
        # Pick the active schedule for the org
        sched = db.query(Schedule).filter(Schedule.org_id == slot_data.org_id).order_by(Schedule.created_at.desc()).first()
        if not sched:
            raise HTTPException(status_code=400, detail="No active schedule found for organization")
        sched_id = sched.id
        org_id = sched.org_id
    else:
        sched = db.query(Schedule).filter(Schedule.id == slot_data.schedule_id).first()
        sched_id = slot_data.schedule_id
        org_id = sched.org_id if sched else (slot_data.org_id or 1)

    new_slot = RequirementSlot(
        org_id=org_id,
        schedule_id=sched_id,
        title=slot_data.title.strip(),
        date_str=slot_data.date_str,
        day_of_week=slot_data.day_of_week,
        start_time=slot_data.start_time,
        end_time=slot_data.end_time,
        department_id=slot_data.department_id,
        resource_id=slot_data.resource_id,
        required_skills=slot_data.required_skills,
        required_qualifications=slot_data.required_qualifications,
        min_experience_years=slot_data.min_experience_years,
        profession_metadata=slot_data.profession_metadata,
        min_staff=slot_data.min_staff,
        target_staff=slot_data.target_staff,
        max_staff=slot_data.max_staff,
        slot_order=slot_data.slot_order,
        is_locked=slot_data.is_locked,
        period_type=slot_data.period_type
    )
    db.add(new_slot)
    db.commit()
    db.refresh(new_slot)

    # If work period with target_staff > 0, create unassigned placeholder assignment
    if new_slot.period_type == "work":
        assign = Assignment(
            schedule_id=sched_id,
            slot_id=new_slot.id,
            person_id=None,
            original_person_id=None,
            date_str=new_slot.date_str,
            start_time=new_slot.start_time,
            end_time=new_slot.end_time,
            status="unfilled"
        )
        db.add(assign)
        db.commit()

    return {"success": True, "slot": new_slot}

@router.put("/slots/{slot_id}")
def update_slot(slot_id: int, payload: SlotUpdate, db: Session = Depends(get_db)):
    """
    Edits custom slot parameters (title, times, min/target/max staff, skills, lock).
    """
    slot = db.query(RequirementSlot).filter(RequirementSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    update_data = payload.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(slot, field, value)

    # Also update associated assignments time if changed
    if payload.start_time or payload.end_time or payload.date_str:
        for a in slot.assignments:
            if payload.start_time:
                a.start_time = payload.start_time
            if payload.end_time:
                a.end_time = payload.end_time
            if payload.date_str:
                a.date_str = payload.date_str

    db.commit()
    return {"success": True, "slot_id": slot.id}

@router.delete("/slots/{slot_id}")
def delete_slot(slot_id: int, db: Session = Depends(get_db)):
    """
    Deletes slot and cascades assignment removal.
    """
    slot = db.query(RequirementSlot).filter(RequirementSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    db.delete(slot)
    db.commit()
    return {"success": True, "message": "Slot deleted successfully"}

@router.post("/slots/{slot_id}/lock")
def toggle_slot_lock(slot_id: int, db: Session = Depends(get_db)):
    slot = db.query(RequirementSlot).filter(RequirementSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    slot.is_locked = not (slot.is_locked or False)
    db.commit()
    return {"success": True, "is_locked": slot.is_locked}

@router.post("/slots/reorder")
def reorder_slots(payload: List[Dict[str, int]], db: Session = Depends(get_db)):
    """
    Reorders slots based on payload: [{"slot_id": 1, "order": 0}, ...]
    """
    for item in payload:
        s_id = item.get("slot_id")
        order = item.get("order", 0)
        slot = db.query(RequirementSlot).filter(RequirementSlot.id == s_id).first()
        if slot:
            slot.slot_order = order
    db.commit()
    return {"success": True, "message": "Slots reordered successfully"}

# --- Drag & Drop Assignment with Conflict Validation ---

@router.post("/assign-drag-drop")
def assign_drag_drop(req: DragDropAssignRequest, db: Session = Depends(get_db)):
    """
    Drag-and-drop assign a staff member to a timetable slot.
    Validates for:
      1. Time overlap with other assignments for this person
      2. Leave conflicts (unavailability / approved absence)
    Allows override if requested by manager.
    """
    slot = db.query(RequirementSlot).filter(RequirementSlot.id == req.slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    person = db.query(Person).filter(Person.id == req.person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Staff member not found")

    slot_date = slot.date_str
    slot_start = slot.start_time
    slot_end = slot.end_time

    conflicts = []

    # 1. Overlapping assignments check
    existing_assignments = (
        db.query(Assignment)
        .filter(
            Assignment.person_id == person.id,
            Assignment.date_str == slot_date,
            Assignment.slot_id != slot.id,
            Assignment.status == "assigned"
        )
        .all()
    )
    for ea in existing_assignments:
        ea_start = ea.start_time or "00:00"
        ea_end = ea.end_time or "23:59"
        if not (ea_end <= slot_start or ea_start >= slot_end):
            conflicts.append(f"Overlap: {person.name} is already assigned from {ea_start} to {ea_end} on {slot_date}")

    # 2. Leave conflict check
    active_leave = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.person_id == person.id,
            LeaveRequest.start_date <= slot_date,
            LeaveRequest.end_date >= slot_date,
            LeaveRequest.status.in_(["approved", "emergency_recorded"])
        )
        .first()
    )
    if active_leave:
        conflicts.append(f"Leave: {person.name} has confirmed {active_leave.leave_type} leave on {slot_date}")

    if conflicts and not req.override_conflicts:
        return {
            "success": False,
            "has_conflict": True,
            "conflicts": conflicts,
            "message": " ; ".join(conflicts)
        }

    # Find or create assignment for this slot
    assignment = db.query(Assignment).filter(Assignment.slot_id == slot.id).first()
    if not assignment:
        assignment = Assignment(
            schedule_id=slot.schedule_id,
            slot_id=slot.id,
            date_str=slot.date_str,
            start_time=slot.start_time,
            end_time=slot.end_time,
        )
        db.add(assignment)

    assignment.person_id = person.id
    if not assignment.original_person_id:
        assignment.original_person_id = person.id
    assignment.status = "assigned"
    db.commit()

    return {
        "success": True,
        "has_conflict": False,
        "message": f"Successfully assigned {person.name} to {slot.title}.",
        "assignment_id": assignment.id,
        "person_name": person.name
    }

# --- Pre-Publish Review & Publishing Validation ---

@router.get("/{schedule_id}/validate")
@router.get("/{schedule_id}/pre-publish-check")
def pre_publish_check(schedule_id: int, db: Session = Depends(get_db)):
    """
    Comprehensive publication review:
    Evaluates staffing coverage, unfilled assignments, hard conflicts,
    working hour violations, and pending approvals.
    Prevents publication if hard constraints are violated!
    """
    sched = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")

    slots = db.query(RequirementSlot).filter(RequirementSlot.schedule_id == schedule_id).all()
    assignments = db.query(Assignment).filter(Assignment.schedule_id == schedule_id, Assignment.status == "assigned").all()
    people = {p.id: p for p in db.query(Person).filter(Person.org_id == sched.org_id).all()}

    # Group assignments by slot
    assign_by_slot: Dict[int, List[Assignment]] = {}
    for a in assignments:
        assign_by_slot.setdefault(a.slot_id, []).append(a)

    unfilled = []
    understaffed = []
    work_slots = [s for s in slots if getattr(s, "period_type", "work") == "work"]

    for s in work_slots:
        active_a = [a for a in assign_by_slot.get(s.id, []) if a.person_id]
        if not active_a:
            unfilled.append({
                "slot_id": s.id,
                "title": s.title,
                "date_str": s.date_str,
                "time": f"{s.start_time}-{s.end_time}",
                "required_skills": s.required_skills or []
            })
        elif len(active_a) < (s.min_staff or 1):
            understaffed.append({
                "slot_id": s.id,
                "title": s.title,
                "assigned": len(active_a),
                "required_min": s.min_staff or 1
            })

    # Check hard conflicts (double-bookings)
    person_day_slots: Dict[tuple, List[Assignment]] = {}
    for a in assignments:
        if a.person_id and a.date_str:
            person_day_slots.setdefault((a.person_id, a.date_str), []).append(a)

    conflicts = []
    for (p_id, d_str), a_list in person_day_slots.items():
        if len(a_list) > 1:
            for i in range(len(a_list)):
                for j in range(i + 1, len(a_list)):
                    a1 = a_list[i]
                    a2 = a_list[j]
                    if not (a1.end_time <= a2.start_time or a1.start_time >= a2.end_time):
                        p_name = people[p_id].name if p_id in people else "Staff"
                        conflicts.append({
                            "person_name": p_name,
                            "date": d_str,
                            "time_conflict": f"{a1.start_time}-{a1.end_time} vs {a2.start_time}-{a2.end_time}"
                        })

    # Holiday conflicts check
    holidays = db.query(Holiday).filter(Holiday.org_id == sched.org_id, Holiday.status == "active").all()
    holiday_conflicts = []
    if holidays:
        for a in assignments:
            if a.person_id and a.date_str:
                p = people.get(a.person_id)
                slot = db.query(RequirementSlot).filter(RequirementSlot.id == a.slot_id).first()
                for h in holidays:
                    h_start = h.start_date
                    h_end = h.end_date or h_start
                    if h_start <= a.date_str <= h_end:
                        if h.holiday_type == "special_working_day":
                            continue
                        if h.department_id and slot and slot.department_id and h.department_id != slot.department_id:
                            continue
                        if h.is_partial_day and h.partial_start_time and h.partial_end_time:
                            if not slot or (slot.end_time <= h.partial_start_time or slot.start_time >= h.partial_end_time):
                                continue
                        # Check authorized exception
                        exc = db.query(HolidayException).filter(
                            HolidayException.holiday_id == h.id,
                            (HolidayException.person_id == a.person_id) | (HolidayException.slot_id == a.slot_id)
                        ).first()
                        if exc:
                            continue
                        if h.essential_staffing_allowed and p and p.role_title:
                            auth_roles = h.authorized_roles or []
                            if any(r.lower() in p.role_title.lower() for r in auth_roles):
                                continue
                        holiday_conflicts.append({
                            "person_name": p.name if p else "Staff",
                            "holiday_name": h.name,
                            "date": a.date_str,
                            "slot_title": slot.title if slot else "Duty Slot"
                        })

    # Weekend staffing check
    weekend_slots = [s for s in work_slots if s.day_of_week in [5, 6]]
    weekend_unfilled = [s for s in weekend_slots if s.id in [u["slot_id"] for u in unfilled]]

    # Pending approvals check
    pending_leaves = db.query(LeaveRequest).filter(LeaveRequest.org_id == sched.org_id, LeaveRequest.status == "pending").count()

    coverage_rate = round((len(work_slots) - len(unfilled)) / max(1, len(work_slots)) * 100.0, 1) if work_slots else 100.0

    # Mandatory constraint failure prevents publication
    has_mandatory_failures = len(conflicts) > 0 or len(holiday_conflicts) > 0

    failure_reasons = []
    if len(conflicts) > 0:
        failure_reasons.append(f"{len(conflicts)} hard double-booking conflict(s) must be resolved.")
    if len(holiday_conflicts) > 0:
        failure_reasons.append(f"{len(holiday_conflicts)} unexempted holiday conflict(s) must be authorized or rescheduled.")

    return {
        "schedule_id": sched.id,
        "title": sched.title,
        "status": sched.status,
        "coverage_rate": coverage_rate,
        "total_work_slots": len(work_slots),
        "unfilled_count": len(unfilled),
        "unfilled_slots": unfilled,
        "understaffed_slots": understaffed,
        "conflicts_count": len(conflicts),
        "conflicts": conflicts,
        "holiday_conflicts_count": len(holiday_conflicts),
        "holiday_conflicts": holiday_conflicts,
        "weekend_slots_count": len(weekend_slots),
        "weekend_unfilled_count": len(weekend_unfilled),
        "pending_leave_approvals": pending_leaves,
        "can_publish": not has_mandatory_failures,
        "failure_reason": " ".join(failure_reasons) if failure_reasons else None
    }

# --- Copy Week / Recurring Schedules ---

@router.post("/{schedule_id}/copy-week")
def copy_week_schedule(schedule_id: int, req: CopyWeekRequest, db: Session = Depends(get_db)):
    """
    Copies current schedule slots and structure to another week.
    """
    source_sched = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not source_sched:
        raise HTTPException(status_code=404, detail="Source schedule not found")

    new_sched = Schedule(
        org_id=source_sched.org_id,
        title=f"{source_sched.title} (Recurring)",
        period_start=req.target_period_start,
        period_end=req.target_period_end,
        status="draft",
        version=1,
        fairness_score=source_sched.fairness_score
    )
    db.add(new_sched)
    db.flush()

    source_slots = db.query(RequirementSlot).filter(RequirementSlot.schedule_id == schedule_id).all()
    # Calculate date shift
    src_start = datetime.datetime.strptime(source_sched.period_start, "%Y-%m-%d").date()
    target_start = datetime.datetime.strptime(req.target_period_start, "%Y-%m-%d").date()
    date_delta = target_start - src_start

    for s in source_slots:
        new_date_str = None
        if s.date_str:
            try:
                s_d = datetime.datetime.strptime(s.date_str, "%Y-%m-%d").date()
                new_date_str = (s_d + date_delta).strftime("%Y-%m-%d")
            except Exception:
                new_date_str = s.date_str

        new_slot = RequirementSlot(
            org_id=s.org_id,
            schedule_id=new_sched.id,
            title=s.title,
            date_str=new_date_str,
            day_of_week=s.day_of_week,
            start_time=s.start_time,
            end_time=s.end_time,
            department_id=s.department_id,
            resource_id=s.resource_id,
            required_skills=s.required_skills,
            required_qualifications=s.required_qualifications,
            min_experience_years=s.min_experience_years,
            profession_metadata=s.profession_metadata,
            min_staff=s.min_staff,
            target_staff=s.target_staff,
            max_staff=s.max_staff,
            slot_order=s.slot_order,
            period_type=s.period_type,
            is_locked=False
        )
        db.add(new_slot)

    db.commit()
    return {"success": True, "new_schedule_id": new_sched.id}

# --- Schedule Generation with Google OR-Tools CP-SAT & Selective Regeneration ---

@router.post("/generate")
def generate_schedule(req: ScheduleGenerateRequest, db: Session = Depends(get_db)):
    """
    Executes Google OR-Tools CP-SAT optimization.
    Supports selective regeneration (regenerate selected days or only unassigned slots)
    while preserving locked assignments.
    """
    sched = db.query(Schedule).filter(
        Schedule.org_id == req.org_id,
        Schedule.title == req.title
    ).first()

    if not sched:
        sched = Schedule(
            org_id=req.org_id,
            title=req.title,
            period_start=req.period_start,
            period_end=req.period_end,
            status="draft",
            version=1
        )
        db.add(sched)
        db.commit()
        db.refresh(sched)

    # Fetch slots for this schedule
    all_slots = db.query(RequirementSlot).filter(RequirementSlot.schedule_id == sched.id).all()
    
    # If no slots exist yet, check the organization's custom working_days_schedule to provision slots
    if not all_slots:
        org = db.query(Organization).filter(Organization.id == req.org_id).first()
        from app.api.organizations import get_default_working_days_schedule
        working_sched = (org.settings_json.get("working_days_schedule") if org and org.settings_json else None) or get_default_working_days_schedule(org.type if org else "college")
        resources = db.query(Resource).filter(Resource.org_id == req.org_id).all()
        departments = db.query(Department).filter(Department.org_id == req.org_id).all()
        res_id = resources[0].id if resources else None
        dept_id = departments[0].id if departments else None

        curr = datetime.datetime.strptime(req.period_start, "%Y-%m-%d").date()
        end_d = datetime.datetime.strptime(req.period_end, "%Y-%m-%d").date()
        
        slot_objects = []
        slot_order_idx = 0
        while curr <= end_d:
            day_idx = curr.weekday()
            day_cfg = working_sched.get(str(day_idx))
            if day_cfg and day_cfg.get("is_working_day"):
                for p in day_cfg.get("periods", []):
                    p_type = p.get("type", "work")
                    s_obj = RequirementSlot(
                        org_id=req.org_id,
                        schedule_id=sched.id,
                        title=f"{p.get('name', 'Duty Block')}",
                        date_str=curr.strftime("%Y-%m-%d"),
                        day_of_week=day_idx,
                        start_time=p.get("start_time", "09:00"),
                        end_time=p.get("end_time", "11:00"),
                        resource_id=res_id,
                        department_id=dept_id,
                        min_staff=p.get("min_staff", 1) if p_type == "work" else 0,
                        target_staff=p.get("target_staff", 1) if p_type == "work" else 0,
                        max_staff=p.get("max_staff", 1) if p_type == "work" else 0,
                        slot_order=slot_order_idx,
                        period_type=p_type,
                        is_locked=False,
                        required_skills=[]
                    )
                    db.add(s_obj)
                    slot_objects.append(s_obj)
                    slot_order_idx += 1
            curr += datetime.timedelta(days=1)
        db.commit()
        all_slots = slot_objects

    # Filter slots based on selective regeneration parameters
    slots_to_solve = []
    locked_slots = []
    for s in all_slots:
        if getattr(s, "period_type", "work") != "work":
            continue
        if s.is_locked:
            locked_slots.append(s)
            continue
        if req.regenerate_days is not None and s.day_of_week not in req.regenerate_days:
            locked_slots.append(s)
            continue
        if req.only_unassigned and s.assignments and any(a.person_id for a in s.assignments):
            locked_slots.append(s)
            continue
        slots_to_solve.append(s)

    people = db.query(Person).filter(Person.org_id == req.org_id, Person.status == "active").all()
    leaves = db.query(LeaveRequest).filter(
        LeaveRequest.org_id == req.org_id,
        LeaveRequest.status.in_(["approved", "emergency_recorded"])
    ).all()

    # Prepare slot dicts
    slot_dicts = [
        {
            "id": s.id,
            "title": s.title,
            "date_str": s.date_str,
            "day_of_week": s.day_of_week,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "min_staff": s.min_staff or 1,
            "target_staff": s.target_staff or 1,
            "required_skills": s.required_skills or [],
            "required_qualifications": s.required_qualifications or [],
            "profession_metadata": s.profession_metadata or {},
        }
        for s in slots_to_solve
    ]

    people_dicts = [
        {
            "id": p.id,
            "name": p.name,
            "skills": p.skills or [],
            "inferred_skills": p.inferred_skills or [],
            "qualifications": p.qualifications or [],
            "preferences": p.preferences or {},
            "profession_metadata": p.profession_metadata or {},
            "max_hours_per_week": p.max_hours_per_week or 40.0,
        }
        for p in people
    ]

    leave_dicts = [
        {
            "person_id": l.person_id,
            "start_date": l.start_date,
            "end_date": l.end_date,
            "start_time": l.start_time,
            "end_time": l.end_time,
        }
        for l in leaves
    ]

    # Fetch holidays and exceptions for constraint enforcement
    holidays = db.query(Holiday).filter(Holiday.org_id == req.org_id, Holiday.status == "active").all()
    holiday_exceptions = db.query(HolidayException).filter(HolidayException.org_id == req.org_id).all()
    holiday_dicts = [
        {
            "id": h.id,
            "name": h.name,
            "holiday_type": h.holiday_type,
            "start_date": h.start_date,
            "end_date": h.end_date or h.start_date,
            "department_id": h.department_id,
            "is_partial_day": h.is_partial_day,
            "partial_start_time": h.partial_start_time,
            "partial_end_time": h.partial_end_time,
            "essential_staffing_allowed": h.essential_staffing_allowed,
            "authorized_roles": h.authorized_roles or [],
        }
        for h in holidays
    ]
    exception_dicts = [
        {
            "holiday_id": e.holiday_id,
            "person_id": e.person_id,
            "slot_id": e.slot_id
        }
        for e in holiday_exceptions
    ]

    # Run OR-Tools solver
    engine = SchedulingEngine()
    solution = engine.solve(
        slots=slot_dicts,
        people=people_dicts,
        leave_records=leave_dicts,
        fairness_weight=req.fairness_weight,
        preference_weight=req.preference_weight,
        overtime_penalty_weight=req.overtime_penalty_weight,
        holidays=holiday_dicts,
        holiday_exceptions=exception_dicts
    )

    # Delete only non-locked assignments belonging to solved slots
    solved_slot_ids = {s.id for s in slots_to_solve}
    db.query(Assignment).filter(
        Assignment.schedule_id == sched.id,
        Assignment.slot_id.in_(solved_slot_ids)
    ).delete(synchronize_session=False)

    for a in solution["assignments"]:
        db_assign = Assignment(
            schedule_id=sched.id,
            slot_id=a["slot_id"],
            person_id=a["person_id"],
            original_person_id=a["person_id"],
            date_str=a["date_str"],
            start_time=a["start_time"],
            end_time=a["end_time"],
            is_replacement=False,
            replacement_type="none",
            status="assigned"
        )
        db.add(db_assign)

    sched.fairness_score = solution["fairness_score"]
    sched.version += 1
    sched.total_assignments = db.query(Assignment).filter(Assignment.schedule_id == sched.id, Assignment.status == "assigned").count()
    db.commit()

    # Save version snapshot
    snapshot = {
        "schedule_id": sched.id,
        "assignments": solution["assignments"],
        "fairness_score": solution["fairness_score"],
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    v_record = ScheduleVersion(
        org_id=req.org_id,
        schedule_id=sched.id,
        version_number=sched.version,
        snapshot_json=snapshot,
        change_summary=f"Automated OR-Tools optimization (Fairness: {solution['fairness_score']}%)"
    )
    db.add(v_record)
    db.commit()

    return {
        "success": True,
        "schedule_id": sched.id,
        "version": sched.version,
        "fairness_score": solution["fairness_score"],
        "total_assigned": len(solution["assignments"]),
        "unfilled_count": len(solution["unfilled_slots"]),
        "conflicts": solution["conflicts"],
        "solver_status": solution.get("status")
    }

@router.put("/assignments/{assignment_id}")
def update_assignment_manual(assignment_id: int, payload: AssignmentUpdate, db: Session = Depends(get_db)):
    assign = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assign:
        raise HTTPException(status_code=404, detail="Assignment not found")

    assign.person_id = payload.person_id
    assign.is_replacement = payload.is_replacement
    assign.replacement_type = payload.replacement_type
    if payload.replacement_reason:
        assign.replacement_reason = payload.replacement_reason
    assign.status = "assigned" if payload.person_id else "unfilled"
    db.commit()
    return {"success": True, "assignment": assign}

@router.post("/{schedule_id}/publish")
def publish_schedule(schedule_id: int, db: Session = Depends(get_db)):
    sched = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")

    sched.status = "published"
    audit = AuditLog(
        org_id=sched.org_id,
        action="SCHEDULE_PUBLISHED",
        entity_type="schedule",
        entity_id=str(sched.id),
        details={"title": sched.title, "version": sched.version}
    )
    db.add(audit)

    notif = Notification(
        org_id=sched.org_id,
        title="Schedule Published",
        message=f"Schedule '{sched.title}' is officially published.",
        category="schedule",
        link_url="/schedule"
    )
    db.add(notif)
    db.commit()
    return {"success": True, "status": "published"}
