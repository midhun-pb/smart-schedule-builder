from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.core.database import get_db
from app.models.models import LeaveRequest, AvailabilityRule, Person, Assignment, AuditLog, Notification
from app.schemas.schemas import LeaveRequestCreate, AvailabilityRuleUpdate, ReturnToWorkRequest
from app.services.replacement_engine import ReplacementEngine
from datetime import datetime, timezone

router = APIRouter(prefix="/leave", tags=["leave"])

@router.get("")
def list_leave_requests(org_id: int, db: Session = Depends(get_db)):
    leaves = db.query(LeaveRequest).filter(LeaveRequest.org_id == org_id).order_by(LeaveRequest.created_at.desc()).all()
    results = []
    for l in leaves:
        results.append({
            "id": l.id,
            "person_id": l.person_id,
            "person_name": l.person.name if l.person else "Unknown",
            "leave_type": l.leave_type,
            "start_date": l.start_date,
            "end_date": l.end_date,
            "start_time": l.start_time,
            "end_time": l.end_time,
            "reason": l.reason,
            "status": l.status,
            "affected_slots_count": l.affected_slots_count,
            "replacement_search_started": l.replacement_search_started,
            "return_confirmed": l.return_confirmed,
            "created_at": l.created_at
        })
    return results

@router.post("/emergency")
def submit_emergency_leave(req: LeaveRequestCreate, db: Session = Depends(get_db)):
    """
    Emergency Leave:
    1. Records sudden unavailability promptly.
    2. Identifies affected timetable assignments.
    3. Notifies managers.
    4. Initiates automated replacement workflow.
    """
    person = db.query(Person).filter(Person.id == req.person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # Step 1: Identify affected assignments
    affected_assignments = ReplacementEngine.identify_affected_assignments(
        db=db,
        person_id=req.person_id,
        start_date=req.start_date,
        end_date=req.end_date,
        start_time=req.start_time,
        end_time=req.end_time
    )

    leave_entry = LeaveRequest(
        org_id=req.org_id,
        person_id=req.person_id,
        leave_type="emergency",
        start_date=req.start_date,
        end_date=req.end_date,
        start_time=req.start_time,
        end_time=req.end_time,
        reason=req.reason,
        status="emergency_recorded",
        affected_slots_count=len(affected_assignments),
        replacement_search_started=True,
        return_confirmed=False
    )
    db.add(leave_entry)
    db.commit()
    db.refresh(leave_entry)

    # In-app notification
    notif = Notification(
        org_id=req.org_id,
        title="EMERGENCY LEAVE REPORTED",
        message=f"{person.name} reported emergency leave ({req.start_date} to {req.end_date}). {len(affected_assignments)} assignments affected. Immediate replacement coverage needed.",
        category="leave",
        link_url="/replacements"
    )
    db.add(notif)

    # Audit log
    audit = AuditLog(
        org_id=req.org_id,
        action="EMERGENCY_LEAVE_FILED",
        entity_type="leave_request",
        entity_id=str(leave_entry.id),
        details={"person_name": person.name, "affected_count": len(affected_assignments)}
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "leave_id": leave_entry.id,
        "status": "emergency_recorded",
        "affected_count": len(affected_assignments),
        "affected_assignments": [
            {
                "assignment_id": a.id,
                "slot_id": a.slot_id,
                "title": a.slot.title if a.slot else "Shift",
                "date_str": a.date_str,
                "time": f"{a.start_time} - {a.end_time}"
            }
            for a in affected_assignments
        ]
    }

@router.post("/request-day-off")
def request_day_off(req: LeaveRequestCreate, db: Session = Depends(get_db)):
    """
    Request a Day Off: Planned leave must NOT become approved automatically.
    Saved as 'pending' for manager review.
    """
    person = db.query(Person).filter(Person.id == req.person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    leave_entry = LeaveRequest(
        org_id=req.org_id,
        person_id=req.person_id,
        leave_type=req.leave_type or "day_off",
        start_date=req.start_date,
        end_date=req.end_date,
        start_time=req.start_time,
        end_time=req.end_time,
        reason=req.reason,
        status="pending"
    )
    db.add(leave_entry)
    db.commit()
    db.refresh(leave_entry)

    notif = Notification(
        org_id=req.org_id,
        title="New Leave Request Submitted",
        message=f"{person.name} submitted a planned leave request for {req.start_date}.",
        category="leave",
        link_url="/leave"
    )
    db.add(notif)
    db.commit()

    return {"success": True, "leave_id": leave_entry.id, "status": "pending"}

@router.post("/{leave_id}/approve")
def approve_leave(leave_id: int, db: Session = Depends(get_db)):
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")

    leave.status = "approved"
    
    # Check affected assignments
    affected = ReplacementEngine.identify_affected_assignments(
        db=db,
        person_id=leave.person_id,
        start_date=leave.start_date,
        end_date=leave.end_date,
        start_time=leave.start_time,
        end_time=leave.end_time
    )
    leave.affected_slots_count = len(affected)
    db.commit()

    return {"success": True, "status": "approved", "affected_slots": len(affected)}

@router.post("/{leave_id}/reject")
def reject_leave(leave_id: int, db: Session = Depends(get_db)):
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")

    leave.status = "rejected"
    db.commit()
    return {"success": True, "status": "rejected"}

@router.post("/return-to-work")
def confirm_return_to_work(req: ReturnToWorkRequest, db: Session = Depends(get_db)):
    """
    Return to Work: Confirms availability after leave and checks whether original
    assignments can be restored safely.
    """
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == req.leave_request_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")

    leave.return_confirmed = True
    leave.status = "returned"
    
    person = db.query(Person).filter(Person.id == req.person_id).first()
    if person:
        person.status = "active"

    db.commit()
    return {"success": True, "message": "Return to work confirmed. Active replacements can now be restored."}

@router.get("/rules/{person_id}")
def get_availability_rules(person_id: int, db: Session = Depends(get_db)):
    rules = db.query(AvailabilityRule).filter(AvailabilityRule.person_id == person_id).all()
    return rules

@router.post("/rules")
def update_availability_rules(payload: AvailabilityRuleUpdate, db: Session = Depends(get_db)):
    db.query(AvailabilityRule).filter(AvailabilityRule.person_id == payload.person_id).delete()
    for r in payload.rules:
        rule = AvailabilityRule(
            person_id=payload.person_id,
            day_of_week=r.get("day_of_week", 0),
            start_time=r.get("start_time", "09:00"),
            end_time=r.get("end_time", "17:00"),
            is_available=r.get("is_available", True),
            preference_level=r.get("preference_level", 5)
        )
        db.add(rule)
    db.commit()
    return {"success": True, "message": "Availability updated successfully"}
