from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.core.database import get_db
from app.models.models import Assignment, RequirementSlot, Person, ReplacementLog, SwapRequest, AuditLog, Notification
from app.schemas.schemas import ReplacementRecommendRequest, ReplacementApproveRequest
from app.services.replacement_engine import ReplacementEngine
from pydantic import BaseModel

router = APIRouter(prefix="/replacements", tags=["replacements"])

class CreateSwapRequest(BaseModel):
    org_id: int
    requester_id: int
    requester_assignment_id: int
    target_person_id: int
    target_assignment_id: int
    reason: str

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
    swaps = db.query(SwapRequest).filter(SwapRequest.org_id == org_id).all()
    results = []
    for s in swaps:
        results.append({
            "id": s.id,
            "requester_name": s.requester.name if s.requester else "Unknown",
            "target_name": s.target_person.name if s.target_person else "Unknown",
            "reason": s.reason,
            "status": s.status,
            "created_at": s.created_at
        })
    return results

@router.post("/swaps/{swap_id}/approve")
def approve_swap(swap_id: int, db: Session = Depends(get_db)):
    swap = db.query(SwapRequest).filter(SwapRequest.id == swap_id).first()
    if not swap:
        raise HTTPException(status_code=404, detail="Swap request not found")

    # Exchange assignments
    req_assign = db.query(Assignment).filter(Assignment.id == swap.requester_assignment_id).first()
    tgt_assign = db.query(Assignment).filter(Assignment.id == swap.target_assignment_id).first() if swap.target_assignment_id else None

    if req_assign and tgt_assign:
        p1 = req_assign.person_id
        p2 = tgt_assign.person_id
        req_assign.person_id = p2
        req_assign.is_replacement = True
        req_assign.replacement_type = "swap"
        tgt_assign.person_id = p1
        tgt_assign.is_replacement = True
        tgt_assign.replacement_type = "swap"

    swap.status = "approved"
    db.commit()
    return {"success": True, "message": "Swap approved and assignments exchanged."}
