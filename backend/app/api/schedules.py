import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from app.core.database import get_db
from app.models.models import (
    Organization, Schedule, RequirementSlot, Assignment, Person, Resource,
    Department, LeaveRequest, ScheduleVersion, AuditLog, Notification,
    Holiday, HolidayException, Subject, Semester, TeacherSubjectAssignment
)
from app.schemas.schemas import (
    ScheduleGenerateRequest, SlotCreate, SlotUpdate,
    AssignmentUpdate, DragDropAssignRequest, CopyWeekRequest,
    GlixonGenerateRequest, GlixonCommitRequest
)
from app.services.scheduling_engine import SchedulingEngine
from app.core.time_utils import (
    calculate_shift_duration_minutes,
    calculate_shift_duration_hours,
    is_overnight_shift,
    get_slot_datetime_interval,
    is_overlapping_interval,
    is_valid_shift_time,
)

router = APIRouter(prefix="/schedules", tags=["schedules"])

@router.get("")
def list_schedules(org_id: int, db: Session = Depends(get_db)):
    schedules = db.query(Schedule).filter(Schedule.org_id == org_id).order_by(Schedule.created_at.desc()).all()
    return schedules

@router.get("/{schedule_id}")
@router.get("/{schedule_id}/details")
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
    
    # Pre-map person and entity details
    people = {p.id: p for p in db.query(Person).filter(Person.org_id == sched.org_id).all()}
    resources = {r.id: r for r in db.query(Resource).filter(Resource.org_id == sched.org_id).all()}
    departments = {d.id: d for d in db.query(Department).filter(Department.org_id == sched.org_id).all()}
    subjects = {sub.id: sub for sub in db.query(Subject).filter(Subject.org_id == sched.org_id).all()}
    semesters = {sem.id: sem for sem in db.query(Semester).filter(Semester.org_id == sched.org_id).all()}

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

        # Determine subject, semester, class, and department details
        sub = None
        if getattr(s, "subject_id", None) and s.subject_id in subjects:
            sub = subjects[s.subject_id]
        elif getattr(s, "subject", None):
            sub = s.subject
        elif s.profession_metadata and s.profession_metadata.get("subject_id") and s.profession_metadata.get("subject_id") in subjects:
            sub = subjects[s.profession_metadata["subject_id"]]
        elif s.profession_metadata and s.profession_metadata.get("subject"):
            meta_name = str(s.profession_metadata.get("subject")).lower()
            for cand in subjects.values():
                if cand.name.lower() == meta_name or cand.code.lower() == meta_name:
                    sub = cand
                    break

        subject_name = None
        subject_code = None
        semester_val = None
        class_val = None

        if sub:
            subject_name = sub.name
            subject_code = sub.code
            semester_val = sub.semester
            class_val = sub.class_name

        # Fallbacks to profession_metadata
        prof_meta = s.profession_metadata or {}
        if not semester_val:
            semester_val = prof_meta.get("semester")
        if not class_val:
            class_val = prof_meta.get("class") or prof_meta.get("class_name")
        if not subject_name and prof_meta.get("subject"):
            subject_name = prof_meta.get("subject")
        elif not subject_name and s.title and (" Lecture" in s.title or " Lab" in s.title):
            subject_name = s.title.split("(")[0].replace(" Lecture", "").replace(" Lab", "").strip()

        # Department name
        dept = departments.get(s.department_id) if s.department_id else (departments.get(sub.department_id) if sub and sub.department_id else None)
        dept_name = dept.name if dept else (sub.department.name if sub and sub.department else None)

        org_type = sched.organization.type if sched.organization else ""
        if not subject_name and p_type == "work" and org_type in ["college", "university"]:
            subject_name = "Subject not assigned"

        slot_cards.append({
            "slot_id": s.id,
            "title": s.title,
            "subject": subject_name,
            "subject_name": subject_name,
            "subject_code": subject_code,
            "subject_id": sub.id if sub else getattr(s, "subject_id", None),
            "semester": semester_val,
            "class_name": class_val,
            "date_str": s.date_str,
            "day_of_week": s.day_of_week,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "resource_id": s.resource_id,
            "resource_name": res.name if res else "Not Assigned",
            "department_id": s.department_id or (sub.department_id if sub else None),
            "department_name": dept_name,
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
            "duration_minutes": calculate_shift_duration_minutes(s.start_time, s.end_time),
            "duration_hours": calculate_shift_duration_hours(s.start_time, s.end_time),
            # Overnight detection: start > end or explicit night designation
            "is_overnight": bool(is_overnight_shift(s.start_time, s.end_time) or ("night" in s.title.lower()) or ("overnight" in s.title.lower())),
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
            "is_emergency_closure": getattr(h, "is_emergency_closure", h.holiday_type == "emergency_closure"),
            "is_special_working_day": getattr(h, "is_special_working_day", h.holiday_type == "special_working_day"),
            "is_partial_day": getattr(h, "is_partial_day", False),
            "partial_start_time": getattr(h, "partial_start_time", None),
            "partial_end_time": getattr(h, "partial_end_time", None),
            "department_id": getattr(h, "department_id", None),
            "requires_continuous_ops": getattr(h, "requires_continuous_ops", getattr(h, "essential_staffing_allowed", False))
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
    valid_time, time_msg = is_valid_shift_time(slot_data.start_time, slot_data.end_time)
    if not valid_time:
        raise HTTPException(status_code=400, detail=time_msg)

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

    meta = dict(slot_data.profession_metadata or {})
    if slot_data.subject_name:
        meta["subject"] = slot_data.subject_name

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
        subject_id=slot_data.subject_id,
        required_skills=slot_data.required_skills or ([slot_data.subject_name] if slot_data.subject_name else []),
        required_qualifications=slot_data.required_qualifications,
        min_experience_years=slot_data.min_experience_years,
        profession_metadata=meta,
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
    return {
        "success": True,
        "id": new_slot.id,
        "slot": {
            "id": new_slot.id,
            "schedule_id": new_slot.schedule_id,
            "title": new_slot.title,
            "day_of_week": new_slot.day_of_week,
            "start_time": new_slot.start_time,
            "end_time": new_slot.end_time,
            "period_type": new_slot.period_type,
            "subject_id": new_slot.subject_id,
            "profession_metadata": new_slot.profession_metadata
        }
    }

@router.put("/slots/{slot_id}")
def update_slot(slot_id: int, payload: SlotUpdate, db: Session = Depends(get_db)):
    """
    Edits custom slot parameters (title, times, min/target/max staff, skills, lock, subject).
    """
    slot = db.query(RequirementSlot).filter(RequirementSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    new_start = payload.start_time or slot.start_time
    new_end = payload.end_time or slot.end_time
    if payload.start_time or payload.end_time:
        valid_time, time_msg = is_valid_shift_time(new_start, new_end)
        if not valid_time:
            raise HTTPException(status_code=400, detail=time_msg)

    update_data = payload.dict(exclude_unset=True)
    if "subject_name" in update_data and update_data["subject_name"]:
        meta = dict(slot.profession_metadata or {})
        meta["subject"] = update_data["subject_name"]
        slot.profession_metadata = meta
        if not slot.required_skills or slot.required_skills == ["Any Subject"]:
            slot.required_skills = [update_data["subject_name"]]

    for field, value in update_data.items():
        if field != "subject_name":
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

    # Check hard conflicts (double-bookings) using concrete datetime intervals across dates & overnight shifts
    person_slots: Dict[int, List[Assignment]] = {}
    for a in assignments:
        if a.person_id and a.start_time and a.end_time:
            person_slots.setdefault(a.person_id, []).append(a)

    conflicts = []
    for p_id, a_list in person_slots.items():
        if len(a_list) > 1:
            for i in range(len(a_list)):
                a1 = a_list[i]
                s1_start, s1_end, _ = get_slot_datetime_interval(a1.date_str, a1.start_time, a1.end_time)
                for j in range(i + 1, len(a_list)):
                    a2 = a_list[j]
                    s2_start, s2_end, _ = get_slot_datetime_interval(a2.date_str, a2.start_time, a2.end_time)
                    if is_overlapping_interval(s1_start, s1_end, s2_start, s2_end):
                        p_name = people[p_id].name if p_id in people else "Staff"
                        conflicts.append({
                            "person_name": p_name,
                            "date": f"{a1.date_str} / {a2.date_str}",
                            "time_conflict": f"{a1.date_str} {a1.start_time}-{a1.end_time} vs {a2.date_str} {a2.start_time}-{a2.end_time}"
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
        
        # Check if subjects exist to provision academic timetable slots
        subjects = db.query(Subject).filter(Subject.org_id == req.org_id).order_by(Subject.semester.asc(), Subject.name.asc()).all()
        sub_idx = 0
        slot_objects = []
        slot_order_idx = 0
        while curr <= end_d:
            day_idx = curr.weekday()
            day_cfg = working_sched.get(str(day_idx))
            if day_cfg and day_cfg.get("is_working_day"):
                for p in day_cfg.get("periods", []):
                    p_type = p.get("type", "work")
                    slot_sub_id = None
                    slot_title = f"{p.get('name', 'Duty Block')}"
                    slot_meta = {}
                    slot_dept_id = dept_id
                    if p_type == "work" and subjects:
                        chosen_sub = subjects[sub_idx % len(subjects)]
                        slot_sub_id = chosen_sub.id
                        slot_title = f"{chosen_sub.name} ({chosen_sub.code})"
                        slot_dept_id = chosen_sub.department_id or dept_id
                        slot_meta = {
                            "subject": chosen_sub.name,
                            "semester": chosen_sub.semester,
                            "class": chosen_sub.class_name,
                            "subject_id": chosen_sub.id,
                            "lab": chosen_sub.is_lab
                        }
                        sub_idx += 1

                    s_obj = RequirementSlot(
                        org_id=req.org_id,
                        schedule_id=sched.id,
                        subject_id=slot_sub_id,
                        title=slot_title,
                        date_str=curr.strftime("%Y-%m-%d"),
                        day_of_week=day_idx,
                        start_time=p.get("start_time", "09:00"),
                        end_time=p.get("end_time", "11:00"),
                        resource_id=res_id,
                        department_id=slot_dept_id,
                        min_staff=p.get("min_staff", 1) if p_type == "work" else 0,
                        target_staff=p.get("target_staff", 1) if p_type == "work" else 0,
                        max_staff=p.get("max_staff", 1) if p_type == "work" else 0,
                        slot_order=slot_order_idx,
                        period_type=p_type,
                        is_locked=False,
                        profession_metadata=slot_meta,
                        required_skills=[chosen_sub.name] if (p_type == "work" and subjects) else []
                    )
                    db.add(s_obj)
                    slot_objects.append(s_obj)
                    slot_order_idx += 1
            curr += datetime.timedelta(days=1)
        db.commit()
        all_slots = slot_objects

    # Link existing slots to subjects if matched
    org_subs = db.query(Subject).filter(Subject.org_id == req.org_id).all()
    if org_subs:
        for sl in all_slots:
            if getattr(sl, "period_type", "work") == "work" and not sl.subject_id:
                for s in org_subs:
                    if (s.name.lower() in sl.title.lower()) or (sl.profession_metadata and sl.profession_metadata.get("subject", "").lower() in s.name.lower()):
                        sl.subject_id = s.id
                        sl.department_id = s.department_id or sl.department_id
                        meta = dict(sl.profession_metadata or {})
                        meta["subject"] = s.name
                        meta["semester"] = s.semester
                        meta["class"] = s.class_name
                        meta["subject_id"] = s.id
                        sl.profession_metadata = meta
                        break
        db.commit()

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
            "subject_id": s.subject_id,
            "class_name": s.subject.class_name if s.subject else (s.profession_metadata or {}).get("class"),
            "semester": s.subject.semester if s.subject else (s.profession_metadata or {}).get("semester"),
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

    # Fetch teacher-subject assignments
    teacher_assignments = db.query(TeacherSubjectAssignment).filter(TeacherSubjectAssignment.org_id == req.org_id).all()
    teacher_assign_dicts = [
        {
            "person_id": ta.person_id,
            "subject_id": ta.subject_id,
            "semester": ta.semester,
            "class_name": ta.class_name,
            "required_periods": getattr(ta, "required_periods", 4) or 4,
            "allowed_working_days": getattr(ta, "allowed_working_days", [0, 1, 2, 3, 4]) or [0, 1, 2, 3, 4],
            "preferred_periods": getattr(ta, "preferred_periods", []) or [],
            "unavailable_periods": getattr(ta, "unavailable_periods", []) or [],
            "max_periods_per_day": getattr(ta, "max_periods_per_day", 2) or 2,
        }
        for ta in teacher_assignments
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
        holiday_exceptions=exception_dicts,
        teacher_assignments=teacher_assign_dicts
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

from pydantic import BaseModel

class AddLabRequest(BaseModel):
    teacher_id: int
    subject: str
    date_str: str
    start_time: str
    end_time: str
    resource_id: Optional[int] = None
    department_id: Optional[int] = None
    semester: Optional[str] = "S5"
    class_name: Optional[str] = "CSE-A"

@router.post("/{schedule_id}/add-lab")
def add_lab_session(schedule_id: int, req: AddLabRequest, db: Session = Depends(get_db)):
    """
    Schedules a specialized laboratory session for University/College faculty.
    Validates times, teacher qualifications, leave, teacher conflicts, and laboratory double-bookings.
    """
    sched = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")

    org = sched.organization
    if org and org.type not in ["college", "university"]:
        raise HTTPException(status_code=400, detail="Laboratory scheduling is only available for University/College organizations.")

    valid_time, time_msg = is_valid_shift_time(req.start_time, req.end_time)
    if not valid_time:
        raise HTTPException(status_code=400, detail=time_msg)

    teacher = db.query(Person).filter(Person.id == req.teacher_id, Person.org_id == sched.org_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Faculty member not found")

    lab_start_dt, lab_end_dt, dur_m = get_slot_datetime_interval(req.date_str, req.start_time, req.end_time)

    # 1. Check teacher leave
    leaves = db.query(LeaveRequest).filter(
        LeaveRequest.person_id == teacher.id,
        LeaveRequest.status.in_(["approved", "emergency_recorded"])
    ).all()
    for l in leaves:
        try:
            l_start = datetime.datetime.strptime(f"{l.start_date} {l.start_time or '00:00'}", "%Y-%m-%d %H:%M")
            l_end = datetime.datetime.strptime(f"{l.end_date or l.start_date} {l.end_time or '23:59'}", "%Y-%m-%d %H:%M")
            if is_overlapping_interval(lab_start_dt, lab_end_dt, l_start, l_end):
                raise HTTPException(
                    status_code=400,
                    detail=f"{teacher.name} is on approved {l.leave_type} leave during this lab time."
                )
        except HTTPException:
            raise
        except Exception:
            pass

    # 2. Check teacher schedule conflicts
    teacher_assignments = db.query(Assignment).filter(
        Assignment.schedule_id == schedule_id,
        Assignment.person_id == teacher.id,
        Assignment.status == "assigned"
    ).all()
    for ta in teacher_assignments:
        ta_start, ta_end, _ = get_slot_datetime_interval(ta.date_str, ta.start_time, ta.end_time)
        if is_overlapping_interval(lab_start_dt, lab_end_dt, ta_start, ta_end):
            ta_title = ta.slot.title if ta.slot else "Assignment"
            raise HTTPException(
                status_code=400,
                detail=f"{teacher.name} already has a conflicting class '{ta_title}' at {ta.start_time}-{ta.end_time} on {ta.date_str}."
            )

    # 3. Check laboratory resource conflict (if resource specified)
    if req.resource_id:
        res = db.query(Resource).filter(Resource.id == req.resource_id, Resource.org_id == sched.org_id).first()
        if not res:
            raise HTTPException(status_code=404, detail="Laboratory resource not found")

        res_slots = db.query(RequirementSlot).filter(
            RequirementSlot.schedule_id == schedule_id,
            RequirementSlot.resource_id == req.resource_id
        ).all()
        for rs in res_slots:
            rs_start, rs_end, _ = get_slot_datetime_interval(rs.date_str, rs.start_time, rs.end_time, rs.day_of_week)
            if is_overlapping_interval(lab_start_dt, lab_end_dt, rs_start, rs_end):
                raise HTTPException(
                    status_code=400,
                    detail=f"Laboratory '{res.name}' is already booked for '{rs.title}' ({rs.start_time}-{rs.end_time}) on {rs.date_str}."
                )

    # 4. Create slot & assignment
    try:
        dt_obj = datetime.datetime.strptime(req.date_str.strip(), "%Y-%m-%d")
        dow = dt_obj.weekday()
    except Exception:
        dow = 0

    dept_id = req.department_id or teacher.department_id
    sub_title = req.subject.strip()
    slot_title = f"{sub_title} Lab ({req.class_name})" if req.class_name else f"{sub_title} Lab"

    new_slot = RequirementSlot(
        org_id=sched.org_id,
        schedule_id=sched.id,
        title=slot_title,
        date_str=req.date_str,
        day_of_week=dow,
        start_time=req.start_time,
        end_time=req.end_time,
        department_id=dept_id,
        resource_id=req.resource_id,
        required_skills=[sub_title],
        required_qualifications=["B.Tech", "M.Tech"],
        profession_metadata={
            "subject": sub_title,
            "semester": req.semester or "S5",
            "class": req.class_name or "CSE-A",
            "lab": True
        },
        min_staff=1,
        target_staff=1,
        max_staff=2,
        period_type="work",
        is_locked=True
    )
    db.add(new_slot)
    db.flush()

    new_assign = Assignment(
        schedule_id=sched.id,
        slot_id=new_slot.id,
        person_id=teacher.id,
        original_person_id=teacher.id,
        date_str=req.date_str,
        start_time=req.start_time,
        end_time=req.end_time,
        status="assigned"
    )
    db.add(new_assign)

    audit = AuditLog(
        org_id=sched.org_id,
        action="LAB_SESSION_SCHEDULED",
        entity_type="slot",
        entity_id=str(new_slot.id),
        details={
            "teacher": teacher.name,
            "subject": sub_title,
            "date": req.date_str,
            "time": f"{req.start_time}-{req.end_time}"
        }
    )
    db.add(audit)

    notif = Notification(
        org_id=sched.org_id,
        title="Lab Session Scheduled",
        message=f"{sub_title} Lab scheduled with {teacher.name} on {req.date_str} ({req.start_time}-{req.end_time}).",
        category="schedule",
        link_url="/schedule"
    )
    db.add(notif)
    db.commit()

    return {
        "success": True,
        "message": f"Successfully scheduled {slot_title} for {teacher.name}.",
        "slot_id": new_slot.id,
        "assignment_id": new_assign.id
    }

# ==============================================================================
# GLIXON — Intelligent Timetable Generator Endpoints (Preview & Commit)
# ==============================================================================

@router.post("/glixon-generate")
def glixon_generate_schedule(req: GlixonGenerateRequest, db: Session = Depends(get_db)):
    """
    GLIXON Intelligent Timetable Generator:
    Reads teacher configurations, multi-semester assignments, department subjects,
    working days, periods, teacher availability, and resource constraints.
    Executes Google OR-Tools CP-SAT constraint optimization.
    Returns preview without overwriting unless preview=False.
    """
    org = db.query(Organization).filter(Organization.id == req.org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Locate or create draft schedule
    sched = None
    if req.schedule_id:
        sched = db.query(Schedule).filter(Schedule.id == req.schedule_id, Schedule.org_id == req.org_id).first()
    if not sched:
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

    # Fetch active teachers and teacher-subject assignments
    people_query = db.query(Person).filter(Person.org_id == req.org_id, Person.status == "active")
    if req.selected_teacher_ids:
        people_query = people_query.filter(Person.id.in_(req.selected_teacher_ids))
    people = people_query.all()

    ta_query = db.query(TeacherSubjectAssignment).filter(
        TeacherSubjectAssignment.org_id == req.org_id,
        TeacherSubjectAssignment.assignment_status == "active"
    )
    if req.selected_teacher_ids:
        ta_query = ta_query.filter(TeacherSubjectAssignment.person_id.in_(req.selected_teacher_ids))
    if req.selected_semesters:
        ta_query = ta_query.filter(TeacherSubjectAssignment.semester.in_(req.selected_semesters))
    teacher_assignments = ta_query.all()

    # Provision requirement slots from working_days_schedule if none exist
    all_slots = db.query(RequirementSlot).filter(RequirementSlot.schedule_id == sched.id).all()
    from app.api.organizations import get_default_working_days_schedule
    working_sched = (org.settings_json.get("working_days_schedule") if org.settings_json else None) or get_default_working_days_schedule(org.type)
    resources = db.query(Resource).filter(Resource.org_id == req.org_id).all()
    departments = db.query(Department).filter(Department.org_id == req.org_id).all()
    res_id = resources[0].id if resources else None
    dept_id = departments[0].id if departments else None

    if not all_slots:
        curr = datetime.datetime.strptime(req.period_start, "%Y-%m-%d").date()
        end_d = datetime.datetime.strptime(req.period_end, "%Y-%m-%d").date()
        slot_objects = []
        slot_order_idx = 0

        # Collect distinct class cohorts from teacher assignments or subjects
        classes_in_org = list({ta.class_name for ta in teacher_assignments if ta.class_name})
        if not classes_in_org:
            subs = db.query(Subject).filter(Subject.org_id == req.org_id).all()
            classes_in_org = list({s.class_name for s in subs if s.class_name}) or ["Section A"]

        while curr <= end_d:
            day_idx = curr.weekday()
            day_cfg = working_sched.get(str(day_idx))
            if day_cfg and day_cfg.get("is_working_day"):
                for p in day_cfg.get("periods", []):
                    p_type = p.get("type", "lecture")
                    is_break = p_type in ["break", "lunch", "assembly"]

                    for c_name in classes_in_org:
                        # Find matching subject for this class
                        matched_ta = next((ta for ta in teacher_assignments if ta.class_name == c_name), None)
                        chosen_sub_id = matched_ta.subject_id if matched_ta else None
                        chosen_sub = matched_ta.subject if matched_ta else None
                        chosen_dept_id = matched_ta.department_id if matched_ta else dept_id
                        chosen_sem = matched_ta.semester if matched_ta else None

                        slot_title = f"{chosen_sub.name if chosen_sub else p.get('name', 'Lecture')} ({c_name})"
                        slot_meta = {
                            "subject": chosen_sub.name if chosen_sub else None,
                            "semester": chosen_sem,
                            "class": c_name,
                            "class_name": c_name,
                            "subject_id": chosen_sub_id,
                            "lab": chosen_sub.is_lab if chosen_sub else False
                        }

                        s_obj = RequirementSlot(
                            org_id=req.org_id,
                            schedule_id=sched.id,
                            subject_id=chosen_sub_id,
                            title=slot_title,
                            date_str=curr.strftime("%Y-%m-%d"),
                            day_of_week=day_idx,
                            start_time=p.get("start_time", "09:00"),
                            end_time=p.get("end_time", "10:00"),
                            resource_id=res_id,
                            department_id=chosen_dept_id,
                            min_staff=0 if is_break else 1,
                            target_staff=0 if is_break else 1,
                            max_staff=0 if is_break else 1,
                            slot_order=slot_order_idx,
                            period_type="break" if is_break else "work",
                            is_locked=False,
                            profession_metadata=slot_meta,
                            required_skills=[chosen_sub.name] if (chosen_sub and not is_break) else []
                        )
                        db.add(s_obj)
                        slot_objects.append(s_obj)
                        slot_order_idx += 1
            curr += datetime.timedelta(days=1)
        db.commit()
        all_slots = slot_objects

    # Filter teaching slots
    slots_to_solve = [s for s in all_slots if getattr(s, "period_type", "work") == "work"]

    slot_dicts = [
        {
            "id": s.id,
            "title": s.title,
            "subject_id": s.subject_id or (s.profession_metadata or {}).get("subject_id"),
            "class_name": s.subject.class_name if s.subject else (s.profession_metadata or {}).get("class"),
            "semester": s.subject.semester if s.subject else (s.profession_metadata or {}).get("semester"),
            "date_str": s.date_str,
            "day_of_week": s.day_of_week,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "resource_id": s.resource_id,
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

    leaves = db.query(LeaveRequest).filter(
        LeaveRequest.org_id == req.org_id,
        LeaveRequest.status.in_(["approved", "emergency_recorded"])
    ).all()
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

    teacher_assign_dicts = [
        {
            "person_id": ta.person_id,
            "subject_id": ta.subject_id,
            "semester": ta.semester,
            "class_name": ta.class_name,
            "required_periods": getattr(ta, "required_periods", 4) or 4,
            "allowed_working_days": getattr(ta, "allowed_working_days", [0, 1, 2, 3, 4]) or [0, 1, 2, 3, 4],
            "preferred_periods": getattr(ta, "preferred_periods", []) or [],
            "unavailable_periods": getattr(ta, "unavailable_periods", []) or [],
            "max_periods_per_day": getattr(ta, "max_periods_per_day", 2) or 2,
        }
        for ta in teacher_assignments
    ]

    # Run GLIXON OR-Tools optimization engine
    engine = SchedulingEngine()
    solution = engine.solve(
        slots=slot_dicts,
        people=people_dicts,
        leave_records=leave_dicts,
        fairness_weight=req.fairness_weight,
        preference_weight=req.preference_weight,
        overtime_penalty_weight=req.overtime_penalty_weight,
        holidays=holiday_dicts,
        holiday_exceptions=exception_dicts,
        teacher_assignments=teacher_assign_dicts
    )

    # Build entity lookups
    people_map = {p.id: p for p in people}
    slots_map = {s.id: s for s in all_slots}
    dept_map = {d.id: d for d in departments}
    res_map = {r.id: r for r in resources}
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    # Enrich generated preview assignments
    enriched_assignments = []
    for a in solution["assignments"]:
        slot = slots_map.get(a["slot_id"])
        teacher = people_map.get(a["person_id"])
        if not slot or not teacher:
            continue

        sub = slot.subject
        sub_name = sub.name if sub else (slot.profession_metadata or {}).get("subject", slot.title)
        sub_code = sub.code if sub else (slot.profession_metadata or {}).get("code", "")
        sem_code = (slot.profession_metadata or {}).get("semester") or (sub.semester if sub else None)
        c_name = (slot.profession_metadata or {}).get("class") or (sub.class_name if sub else None)
        dept = dept_map.get(slot.department_id or teacher.department_id)
        room = res_map.get(slot.resource_id)

        dur_m = calculate_shift_duration_minutes(slot.start_time, slot.end_time)
        dur_h = calculate_shift_duration_hours(slot.start_time, slot.end_time)

        enriched_assignments.append({
            "slot_id": slot.id,
            "teacher_id": teacher.id,
            "teacher_name": teacher.name,
            "department_id": dept.id if dept else None,
            "department_name": dept.name if dept else "General",
            "semester": sem_code or "S1",
            "subject_id": slot.subject_id,
            "subject_name": sub_name,
            "subject_code": sub_code,
            "class_name": c_name or "General",
            "day_of_week": slot.day_of_week,
            "day_name": day_names[slot.day_of_week] if 0 <= slot.day_of_week < 7 else "Day",
            "date_str": slot.date_str or a.get("date_str"),
            "start_time": slot.start_time,
            "end_time": slot.end_time,
            "duration_minutes": dur_m,
            "duration_hours": dur_h,
            "resource_id": slot.resource_id,
            "resource_name": room.name if room else "Classroom",
            "title": slot.title
        })

    # Groupings for multi-perspective inspection
    teacher_timetables: Dict[str, List[Dict[str, Any]]] = {}
    class_timetables: Dict[str, List[Dict[str, Any]]] = {}
    semester_timetables: Dict[str, List[Dict[str, Any]]] = {}
    department_timetables: Dict[str, List[Dict[str, Any]]] = {}

    for item in enriched_assignments:
        teacher_timetables.setdefault(str(item["teacher_id"]), []).append(item)
        class_timetables.setdefault(item["class_name"], []).append(item)
        semester_timetables.setdefault(item["semester"], []).append(item)
        department_timetables.setdefault(item["department_name"], []).append(item)

    # Calculate workload analytics per teacher
    teacher_workloads = {}
    for p in people:
        t_assigned = [item for item in enriched_assignments if item["teacher_id"] == p.id]
        t_tas = [ta for ta in teacher_assignments if ta.person_id == p.id]
        total_req_periods = sum(getattr(ta, "required_periods", 4) or 4 for ta in t_tas)
        scheduled_periods = len(t_assigned)
        weekly_hours = sum(item["duration_hours"] for item in t_assigned)
        daily_hours = round(weekly_hours / 5.0, 1) if weekly_hours > 0 else 0.0

        teacher_workloads[str(p.id)] = {
            "teacher_id": p.id,
            "teacher_name": p.name,
            "daily_hours": daily_hours,
            "weekly_hours": round(weekly_hours, 1),
            "monthly_hours": round(weekly_hours * 4.0, 1),
            "required_periods": total_req_periods,
            "scheduled_periods": scheduled_periods,
            "unassigned_periods": max(0, total_req_periods - scheduled_periods),
            "assigned_semesters": list({item["semester"] for item in t_assigned}),
            "assigned_subjects": list({item["subject_name"] for item in t_assigned}),
            "free_periods": max(0, 20 - scheduled_periods),
            "break_hours": 2.5
        }

    # If preview is False, directly persist to database
    if not req.preview:
        db.query(Assignment).filter(
            Assignment.schedule_id == sched.id
        ).delete(synchronize_session=False)

        for a in enriched_assignments:
            db_assign = Assignment(
                schedule_id=sched.id,
                slot_id=a["slot_id"],
                person_id=a["teacher_id"],
                original_person_id=a["teacher_id"],
                date_str=a["date_str"],
                start_time=a["start_time"],
                end_time=a["end_time"],
                is_replacement=False,
                replacement_type="none",
                status="assigned"
            )
            db.add(db_assign)

        sched.fairness_score = solution.get("fairness_score", 95.0)
        sched.version += 1
        sched.total_assignments = len(enriched_assignments)
        db.commit()

        # Audit and notification
        audit = AuditLog(
            org_id=req.org_id,
            action="GLIXON_TIMETABLE_GENERATED",
            entity_type="schedule",
            entity_id=str(sched.id),
            details={"assignments": len(enriched_assignments), "fairness": sched.fairness_score}
        )
        db.add(audit)
        db.commit()

    return {
        "success": True,
        "preview": req.preview,
        "schedule_id": sched.id,
        "fairness_score": solution.get("fairness_score", 95.0),
        "total_assignments": len(enriched_assignments),
        "assignments": enriched_assignments,
        "teacher_timetables": teacher_timetables,
        "class_timetables": class_timetables,
        "semester_timetables": semester_timetables,
        "department_timetables": department_timetables,
        "teacher_workloads": teacher_workloads,
        "unfilled_slots": solution.get("unfilled_slots", []),
        "conflicts": solution.get("conflicts", []),
    }

@router.post("/glixon-commit")
def glixon_commit_schedule(req: GlixonCommitRequest, db: Session = Depends(get_db)):
    """
    Commits GLIXON generated preview assignments into the database.
    Updates schedule version, audit history, and marks slots filled.
    """
    sched = None
    if req.schedule_id:
        sched = db.query(Schedule).filter(Schedule.id == req.schedule_id, Schedule.org_id == req.org_id).first()
    if not sched:
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

    # Delete existing unpinned assignments
    db.query(Assignment).filter(
        Assignment.schedule_id == sched.id
    ).delete(synchronize_session=False)

    committed_count = 0
    for a in req.assignments:
        s_id = a.get("slot_id")
        t_id = a.get("teacher_id") or a.get("person_id")
        if not s_id or not t_id:
            continue

        slot = db.query(RequirementSlot).filter(RequirementSlot.id == s_id).first()
        if not slot:
            continue

        # Sync slot subject and teacher metadata
        if a.get("subject_id"):
            slot.subject_id = a.get("subject_id")
        meta = dict(slot.profession_metadata or {})
        if a.get("subject_name"):
            meta["subject"] = a.get("subject_name")
        if a.get("semester"):
            meta["semester"] = a.get("semester")
        if a.get("class_name"):
            meta["class"] = a.get("class_name")
        slot.profession_metadata = meta

        db_assign = Assignment(
            schedule_id=sched.id,
            slot_id=s_id,
            person_id=t_id,
            original_person_id=t_id,
            date_str=a.get("date_str") or slot.date_str,
            start_time=a.get("start_time") or slot.start_time,
            end_time=a.get("end_time") or slot.end_time,
            is_replacement=False,
            replacement_type="none",
            status="assigned"
        )
        db.add(db_assign)
        committed_count += 1

    sched.version += 1
    sched.total_assignments = committed_count
    db.commit()

    # Create history snapshot
    v_record = ScheduleVersion(
        org_id=req.org_id,
        schedule_id=sched.id,
        version_number=sched.version,
        snapshot_json={"total_assignments": committed_count, "committed_at": datetime.datetime.now(datetime.timezone.utc).isoformat()},
        change_summary=f"GLIXON generated {committed_count} timetable assignments"
    )
    db.add(v_record)

    audit = AuditLog(
        org_id=req.org_id,
        action="GLIXON_TIMETABLE_COMMITTED",
        entity_type="schedule",
        entity_id=str(sched.id),
        details={"committed_assignments": committed_count, "version": sched.version}
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "message": f"GLIXON successfully saved {committed_count} assignments to the database.",
        "schedule_id": sched.id,
        "version": sched.version,
        "total_assignments": committed_count
    }
