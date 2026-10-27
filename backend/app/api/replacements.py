from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from app.core.database import get_db
from app.models.models import Assignment, RequirementSlot, Person, ReplacementLog, SwapRequest, AuditLog, Notification, Organization, User, TeacherSubjectAssignment
from app.schemas.schemas import ReplacementRecommendRequest, ReplacementApproveRequest
from app.services.replacement_engine import ReplacementEngine
from app.api.auth import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/replacements", tags=["replacements"])

class CreateSwapRequest(BaseModel):
    org_id: int
    requester_id: int
    requester_assignment_id: int
    target_person_id: Optional[int] = None
    target_assignment_id: Optional[int] = None
    reason: str

class RejectSwapRequest(BaseModel):
    reason: Optional[str] = "Manager rejected swap request"

class TimetableSwapRequest(BaseModel):
    schedule_id: int
    source_slot_id: int
    target_slot_id: int
    reason: Optional[str] = "Timetable assignment swap"
    dry_run: Optional[bool] = False
    approved_by: Optional[str] = "Timetable Manager"

@router.get("/active")
def get_active_replacements(org_id: int, db: Session = Depends(get_db)):
    """
    Returns all currently active replacements.
    Powers the Active Swaps panel at bottom-left of the timetable.
    """
    logs = (
        db.query(ReplacementLog)
        .filter(ReplacementLog.org_id == org_id, ReplacementLog.status == "active")
        .order_by(ReplacementLog.created_at.desc())
        .all()
    )
    
    results = []
    for l in logs:
        orig = l.original_person
        rep = l.replacement_person
        assign = db.query(Assignment).filter(Assignment.id == l.assignment_id).first()
        slot = assign.slot if assign else None

        results.append({
            "id": l.id,
            "assignment_id": l.assignment_id,
            "slot_title": slot.title if slot else "Assignment",
            "date_str": l.date_str,
            "time_window": f"{l.original_start_time} - {l.original_end_time}",
            "original_person_id": l.original_person_id,
            "original_person_name": orig.name if orig else "Unknown",
            "replacement_person_id": l.replacement_person_id,
            "replacement_person_name": rep.name if rep else "Unknown",
            "replacement_type": l.replacement_type,
            "reason": l.reason,
            "match_score": l.match_score,
            "created_at": l.created_at,
            "can_restore": l.can_restore
        })
    return results

@router.get("/pending-returns")
def get_pending_returns(org_id: int, db: Session = Depends(get_db)):
    """
    Staff members returning to work who have active replacements in place,
    ready to be evaluated and safely restored.
    """
    logs = (
        db.query(ReplacementLog)
        .filter(
            ReplacementLog.org_id == org_id,
            ReplacementLog.status == "active",
            ReplacementLog.can_restore == True
        )
        .all()
    )

    returns = []
    for l in logs:
        orig = l.original_person
        rep = l.replacement_person
        returns.append({
            "replacement_log_id": l.id,
            "assignment_id": l.assignment_id,
            "original_person": {
                "id": orig.id if orig else None,
                "name": orig.name if orig else "Unknown",
                "role": orig.role_title if orig else ""
            },
            "replacement_person": {
                "id": rep.id if rep else None,
                "name": rep.name if rep else "Unknown"
            },
            "date_str": l.date_str,
            "time_window": f"{l.original_start_time} - {l.original_end_time}",
            "reason": l.reason
        })
    return returns

@router.post("/recommend")
def get_replacement_recommendations(req: ReplacementRecommendRequest, db: Session = Depends(get_db)):
    """
    Steps 2 & 3: Evaluates and ranks qualified, available candidates
    for an affected timetable assignment.
    """
    assignment = db.query(Assignment).filter(Assignment.id == req.assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    slot = assignment.slot
    if not slot:
        raise HTTPException(status_code=404, detail="Associated slot not found")

    current_person_id = assignment.person_id or assignment.original_person_id or 0
    ranked = ReplacementEngine.evaluate_replacement_candidates(
        db=db,
        slot=slot,
        exclude_person_id=current_person_id
    )

    return {
        "assignment_id": assignment.id,
        "slot_title": slot.title,
        "date_str": slot.date_str,
        "time_window": f"{slot.start_time} - {slot.end_time}",
        "required_skills": slot.required_skills or [],
        "candidates": ranked
    }

@router.post("/approve")
def approve_replacement(req: ReplacementApproveRequest, db: Session = Depends(get_db)):
    """
    Steps 5, 6, 7: Authorize replacement, update timetable assignment,
    record in ReplacementLog, and push in-app notification.
    """
    res = ReplacementEngine.approve_and_apply_replacement(
        db=db,
        assignment_id=req.assignment_id,
        replacement_person_id=req.replacement_person_id,
        replacement_type=req.replacement_type,
        reason=req.reason
    )
    return res

@router.post("/restore/{log_id}")
def restore_assignment(log_id: int, db: Session = Depends(get_db)):
    """
    Return to Work: Check availability/conflicts and safely restore original person.
    """
    res = ReplacementEngine.restore_original_assignment(db=db, replacement_log_id=log_id)
    return res

@router.get("/history")
def get_replacement_history(org_id: int, db: Session = Depends(get_db)):
    logs = (
        db.query(ReplacementLog)
        .filter(ReplacementLog.org_id == org_id)
        .order_by(ReplacementLog.created_at.desc())
        .all()
    )
    results = []
    for l in logs:
        results.append({
            "id": l.id,
            "date_str": l.date_str,
            "original_person_name": l.original_person.name if l.original_person else "Unknown",
            "replacement_person_name": l.replacement_person.name if l.replacement_person else "Unknown",
            "replacement_type": l.replacement_type,
            "status": l.status,
            "match_score": l.match_score,
            "reason": l.reason,
            "created_at": l.created_at,
            "restored_at": l.restored_at
        })
    return results

# Swaps
@router.post("/swaps")
def create_swap_request(req: CreateSwapRequest, db: Session = Depends(get_db)):
    swap = SwapRequest(
        org_id=req.org_id,
        requester_id=req.requester_id,
        requester_assignment_id=req.requester_assignment_id,
        target_person_id=req.target_person_id,
        target_assignment_id=req.target_assignment_id,
        reason=req.reason,
        status="pending"
    )
    db.add(swap)
    db.commit()
    db.refresh(swap)
    return swap

@router.get("/swaps")
def list_swap_requests(org_id: int, db: Session = Depends(get_db)):
    swaps = db.query(SwapRequest).filter(SwapRequest.org_id == org_id).order_by(SwapRequest.created_at.desc()).all()
    results = []
    for s in swaps:
        req_assign = db.query(Assignment).filter(Assignment.id == s.requester_assignment_id).first()
        tgt_assign = db.query(Assignment).filter(Assignment.id == s.target_assignment_id).first() if s.target_assignment_id else None

        req_slot = req_assign.slot if req_assign else None
        tgt_slot = tgt_assign.slot if tgt_assign else None

        results.append({
            "id": s.id,
            "requester_id": s.requester_id,
            "requester_name": s.requester.name if s.requester else "Unknown",
            "target_id": s.target_person_id,
            "target_name": s.target_person.name if s.target_person else "Open Replacement",
            "reason": s.reason,
            "status": s.status,
            "approved_by": s.approved_by,
            "created_at": s.created_at,
            "requester_slot_title": req_slot.title if req_slot else None,
            "requester_slot_time": f"{req_slot.start_time} - {req_slot.end_time}" if req_slot else None,
            "target_slot_title": tgt_slot.title if tgt_slot else None,
            "target_slot_time": f"{tgt_slot.start_time} - {tgt_slot.end_time}" if tgt_slot else None,
        })
    return results

@router.post("/swaps/{swap_id}/approve")
def approve_swap(swap_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    swap = db.query(SwapRequest).filter(SwapRequest.id == swap_id).first()
    if not swap:
        raise HTTPException(status_code=404, detail="Swap request not found")

    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only managers and administrators can approve swap requests.")
    if current_user.person_id and current_user.person_id == swap.requester_id:
        raise HTTPException(status_code=403, detail="Employees cannot approve their own swap requests.")

    req_assign = db.query(Assignment).filter(Assignment.id == swap.requester_assignment_id).first()
    tgt_assign = db.query(Assignment).filter(Assignment.id == swap.target_assignment_id).first() if swap.target_assignment_id else None

    # Check faculty subject eligibility for educational organizations
    org = db.query(Organization).filter(Organization.id == swap.org_id).first()
    if org and org.type in ["college", "university"]:
        # Verify target faculty is qualified/authorized for requester's course
        if req_assign and req_assign.slot and req_assign.slot.subject_id:
            req_sub_id = req_assign.slot.subject_id
            target_authorized = db.query(TeacherSubjectAssignment).filter(
                TeacherSubjectAssignment.org_id == swap.org_id,
                TeacherSubjectAssignment.person_id == swap.target_person_id,
                TeacherSubjectAssignment.subject_id == req_sub_id
            ).first()
            if not target_authorized:
                target_p = db.query(Person).filter(Person.id == swap.target_person_id).first()
                target_skills = {s.get("name", "").lower() for s in (target_p.skills or [])} if target_p else set()
                sub_obj = req_assign.slot.subject
                if not (sub_obj and (sub_obj.name.lower() in target_skills or any(sk in sub_obj.name.lower() for sk in target_skills))):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Replacement faculty '{target_p.name if target_p else 'candidate'}' is not authorized or qualified to teach '{sub_obj.name if sub_obj else 'this subject'}'."
                    )
        # Verify requester faculty is qualified/authorized for target's course
        if tgt_assign and tgt_assign.slot and tgt_assign.slot.subject_id:
            tgt_sub_id = tgt_assign.slot.subject_id
            req_authorized = db.query(TeacherSubjectAssignment).filter(
                TeacherSubjectAssignment.org_id == swap.org_id,
                TeacherSubjectAssignment.person_id == swap.requester_id,
                TeacherSubjectAssignment.subject_id == tgt_sub_id
            ).first()
            if not req_authorized:
                req_p = db.query(Person).filter(Person.id == swap.requester_id).first()
                req_skills = {s.get("name", "").lower() for s in (req_p.skills or [])} if req_p else set()
                sub_obj2 = tgt_assign.slot.subject
                if not (sub_obj2 and (sub_obj2.name.lower() in req_skills or any(sk in sub_obj2.name.lower() for sk in req_skills))):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Faculty '{req_p.name if req_p else 'requester'}' is not authorized or qualified to teach '{sub_obj2.name if sub_obj2 else 'this subject'}'."
                    )

    # Exchange assignments immediately in the timetable
    if req_assign and tgt_assign:
        p1 = req_assign.person_id
        p2 = tgt_assign.person_id
        req_assign.person_id = p2
        req_assign.is_replacement = True
        req_assign.replacement_type = "swap"
        tgt_assign.person_id = p1
        tgt_assign.is_replacement = True
        tgt_assign.replacement_type = "swap"
    elif req_assign and swap.target_person_id:
        req_assign.person_id = swap.target_person_id
        req_assign.is_replacement = True
        req_assign.replacement_type = "swap"

    swap.status = "approved"
    swap.approved_by = current_user.full_name

    # Audit log
    audit = AuditLog(
        org_id=swap.org_id,
        action="SWAP_REQUEST_APPROVED",
        entity_type="swap_request",
        entity_id=str(swap.id),
        details={"approved_by": current_user.full_name, "requester_id": swap.requester_id, "target_id": swap.target_person_id}
    )
    db.add(audit)
    db.commit()

    return {"success": True, "message": "Swap approved and timetable assignments updated successfully.", "status": "approved"}

@router.post("/swaps/{swap_id}/reject")
def reject_swap(swap_id: int, payload: RejectSwapRequest = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    swap = db.query(SwapRequest).filter(SwapRequest.id == swap_id).first()
    if not swap:
        raise HTTPException(status_code=404, detail="Swap request not found")

    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only managers and administrators can reject swap requests.")
    if current_user.person_id and current_user.person_id == swap.requester_id:
        raise HTTPException(status_code=403, detail="Employees cannot reject their own swap requests.")

    swap.status = "rejected"
    swap.approved_by = current_user.full_name
    reason_text = payload.reason if payload and payload.reason else "Manager rejected swap request"

    audit = AuditLog(
        org_id=swap.org_id,
        action="SWAP_REQUEST_REJECTED",
        entity_type="swap_request",
        entity_id=str(swap.id),
        details={"rejected_by": current_user.full_name, "reason": reason_text}
    )
    db.add(audit)
    db.commit()

    return {"success": True, "message": "Swap request rejected", "status": "rejected", "reason": reason_text}

@router.post("/timetable-swap")
def execute_timetable_swap(req: TimetableSwapRequest, db: Session = Depends(get_db)):
    """
    Drag-and-drop & click-based assignment swapping directly in the timetable.
    Validates qualifications, availability, leave, working-hour limits, and conflicts.
    Supports dry_run=True for instant preview and validation before confirming.
    """
    res = ReplacementEngine.validate_and_execute_timetable_swap(
        db=db,
        schedule_id=req.schedule_id,
        source_slot_id=req.source_slot_id,
        target_slot_id=req.target_slot_id,
        reason=req.reason or "Timetable assignment swap",
        dry_run=bool(req.dry_run),
        approved_by=req.approved_by or "Timetable Manager"
    )
    return res
